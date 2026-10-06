import { formatBig } from '../../domain/bignum/format';
import { OfflineAccrualCalculator } from '../../domain/OfflineAccrualCalculator';
import type { OfflineAccrualResult } from '../../domain/OfflineAccrualResult';
import { toPlayerMessage } from '../../domain/ReconciliationCorrection';
import { RosterRules } from '../../domain/RosterRules';
import { SaveGameData } from '../../domain/SaveGameData';
import type { BackendApi } from '../backend/BackendApi';
import type { CombatService } from '../combat/CombatService';
import type { ServiceDeps } from '../core';
import { bigToInt } from '../core';
import { PlayerEventLog } from '../events/PlayerEventLog';
import type { SaveStore, SteamIdentity } from '../ports';
import type { RosterService } from '../roster/RosterService';
import type { SaveCodec } from '../save/SaveCodec';
import { applySnapshotToLive, project, saveFromState, stateFromSave } from '../state/projection';
import type { GameState, Notice } from '../state/types';
import type { SteamCloudSync } from './SteamCloudSync';

/**
 * Local save, Steam Cloud, offline accrual and backend reconciliation (P10–P13,
 * Unity SaveSyncService; ARCHITECTURE AD-20 boot order):
 *   load()    — 1. read cloud + local, 2. apply offline accrual (render can follow)
 *   connect() — 4. authenticate, 5. pull canonical state, flush events, persist
 * then syncNow() on the TickDriver interval, on suspend and on quit.
 */
export class SaveSyncService {
  private lastEncoded: Uint8Array | null = null;

  constructor(
    private readonly deps: ServiceDeps,
    private readonly saveStore: SaveStore,
    private readonly codec: SaveCodec,
    private readonly cloud: SteamCloudSync,
    private readonly identity: SteamIdentity | null,
    private readonly backend: BackendApi,
    private readonly combat: CombatService,
    private readonly roster: RosterService,
  ) {}

  /** Loads the save (or starts a new game) and applies offline accrual. */
  async load(): Promise<{ newGame: boolean; accrual: OfflineAccrualResult | null }> {
    const local = await this.codec.decode(await this.saveStore.read().catch(() => null));
    const { save } = await this.cloud.chooseOnBoot(local);
    return this.loadFrom(save);
  }

  /** Same as load() from an explicit envelope (fixtures, sim, dev URLs); null = new game. */
  loadFrom(save: SaveGameData | null): { newGame: boolean; accrual: OfflineAccrualResult | null } {
    if (!save) {
      this.startNewGame();
      return { newGame: true, accrual: null };
    }
    const s = stateFromSave(save, this.deps.content);
    this.deps.store.commit({ ...s, combat: this.deps.store.get().combat, notices: this.deps.store.get().notices });
    const accrual = this.applyOfflineAccrual(save.lastSeenAtMs, this.deps.clock.nowMs());
    return { newGame: false, accrual };
  }

  /** RFR-14: a new game starts with the fixed starter hero in the Active Squad and Krell's starting weapon. */
  private startNewGame(): void {
    const settings = this.deps.content.settings;
    const fresh = stateFromSave(SaveGameData.createNew(this.deps.clock.nowMs(), settings.startingEquipmentId), this.deps.content);
    this.deps.store.commit({ ...fresh, combat: this.deps.store.get().combat });
    this.roster.addHeroCard(settings.starterHeroId);
    this.roster.tryActivate(settings.starterHeroId);
  }

  /**
   * FR-41: gold for time away, from Active Squad power, capped. A real earn: it emits
   * GoldEarned like any other. Also the catch-up path for gaps beyond TickDriver's cap.
   */
  applyOfflineAccrual(lastSeenMs: number, nowMs: number): OfflineAccrualResult | null {
    const settings = this.deps.content.settings;
    const squad = this.roster.activeSquad();
    const power = RosterRules.squadPower(squad, (id) => this.deps.content.hero(id));
    const accrual = OfflineAccrualCalculator.calculate(
      lastSeenMs,
      nowMs,
      power,
      settings.idleGoldPerSquadPowerPerHour,
      Math.max(settings.offlineAccrualCapHours, 0) * 3_600_000,
    );
    if (accrual.goldAccrued.sign() <= 0) return null;
    const goldToAdd = bigToInt(accrual.goldAccrued);
    if (goldToAdd <= 0) return null;
    this.combat.addGold(goldToAdd);
    const hours = accrual.elapsedCreditedMs / 3_600_000;
    this.pushNotice({
      kind: 'offline-accrual',
      goldAccrued: formatBig(accrual.goldAccrued),
      hoursCredited: hours,
      wasCapped: accrual.wasCapped,
      message: `Welcome back! Your Active Squad earned ${accrual.goldAccrued.toString()} gold over ${formatHours(hours)}h offline${accrual.wasCapped ? ' (capped)' : ''}.`,
    });
    return accrual;
  }

  /** Authenticates, pulls canonical state, flushes pending events, persists. Never throws. */
  async connect(): Promise<void> {
    if (await this.authenticate()) {
      const server = await this.backend.getState();
      if (server) this.applyCanonical(server);
      await this.flush();
    }
    await this.persist();
  }

  /** Periodic/suspend sync (SyncNowAsync). Skips while one is in flight. */
  async syncNow(): Promise<void> {
    const s = this.deps.store.get();
    if (s.sync.inFlight) return;
    this.setSync({ inFlight: true });
    try {
      if (this.backend.isAuthenticated || (await this.authenticate())) await this.flush();
      await this.persist();
    } finally {
      this.setSync({ inFlight: false });
    }
  }

  /** Writes the local save (atomic, AD-12). */
  async persist(): Promise<void> {
    const save = saveFromState(this.deps.store.get(), this.deps.clock.nowMs());
    const bytes = await this.codec.encode(save);
    this.lastEncoded = bytes;
    try {
      await this.saveStore.write(bytes);
    } catch (e) {
      this.deps.logger.error(`SaveSyncService: failed to write the local save. ${(e as Error).message}`);
    }
  }

  /** On quit: persist locally and to Steam Cloud (AD-20). */
  async persistLocalAndCloud(): Promise<void> {
    await this.persist();
    if (this.lastEncoded) await this.cloud.write(this.lastEncoded);
  }

  private async authenticate(): Promise<boolean> {
    const ticket = this.identity ? await this.identity.getAuthTicketHex().catch(() => null) : null;
    const ok = await this.backend.authenticateWithSteam(ticket);
    this.setSync({ authenticated: ok, online: ok || this.deps.store.get().sync.online });
    if (ok && this.backend.steamId64) {
      const s = this.deps.store.get();
      this.deps.store.commit({ ...s, steamId64: this.backend.steamId64 });
    }
    return ok;
  }

  private async flush(): Promise<void> {
    const pending = this.deps.store.get().eventLog.pending;
    if (!this.backend.isAuthenticated || pending.length === 0) return;
    const response = await this.backend.ingestBatch(pending);
    if (!response) {
      this.setSync({ online: false });
      return;
    }
    let s = this.deps.store.get();
    let log = s.eventLog;
    for (const result of response.results) {
      const original = pending.find((e) => e.clientEventId === result.clientEventId);
      if (!result.accepted && original) {
        this.pushNotice({
          kind: 'correction',
          message: toPlayerMessage({
            eventType: original.type,
            reason: result.rejectionReason ?? 'Unknown reason.',
            occurredAtMs: this.deps.clock.nowMs(),
          }),
        });
        s = this.deps.store.get();
      }
      log = PlayerEventLog.applyResult(log, result.clientEventId, result.accepted ? 'Accepted' : 'Rejected');
    }
    this.deps.store.commit({ ...s, eventLog: log });
    this.applyCanonical(response.state);
    this.setSync({ online: true, lastSyncAtMs: this.deps.clock.nowMs() });
    await this.persist();
    if (this.lastEncoded) await this.cloud.write(this.lastEncoded);
  }

  /** ApplyCanonicalStateSilently: adopt the backend's state, re-project what is still pending. */
  private applyCanonical(server: GameState['canonical']): void {
    const s = this.deps.store.get();
    const live = applySnapshotToLive(s, project(server, s.eventLog.pending), this.deps.content);
    this.deps.store.commit({
      ...live,
      canonical: server,
      lastReconciledAtMs: this.deps.clock.nowMs(),
      eventLog: PlayerEventLog.seedSequence(live.eventLog, server.lastAppliedSequence + 1),
    });
  }

  private pushNotice(notice: NoticeInput): void {
    const s = this.deps.store.get();
    const id = s.notices.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    this.deps.store.commit({ ...s, notices: [...s.notices, { ...notice, id } as Notice] });
  }

  private setSync(patch: Partial<GameState['sync']>): void {
    const s = this.deps.store.get();
    this.deps.store.commit({ ...s, sync: { ...s.sync, ...patch } });
  }
}

type NoticeInput = Notice extends infer N ? (N extends Notice ? Omit<N, 'id'> : never) : never;

/** .NET "0.#": one optional decimal, rounded half away from zero. */
function formatHours(hours: number): string {
  const r = Math.sign(hours) * Math.round(Math.abs(hours) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
