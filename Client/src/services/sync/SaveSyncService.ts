import { formatBig } from '../../domain/bignum/format';
import { BigDouble } from '../../domain/bignum/BigDouble';
import { OfflineAccrualResult } from '../../domain/OfflineAccrualResult';
import { toPlayerMessage } from '../../domain/ReconciliationCorrection';
import { SaveGameData } from '../../domain/SaveGameData';
import type { BackendApi } from '../backend/BackendApi';
import type { StageCombatService } from '../combat/StageCombatService';
import type { ServiceDeps } from '../core';
import { PlayerEventLog, STALE_SEQUENCE_REASON } from '../events/PlayerEventLog';
import type { AppLifecycle, SaveStore, SteamIdentity } from '../ports';
import type { RewardService } from '../rewards/RewardService';
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
  private pendingRewardsShown = false;

  constructor(
    private readonly deps: ServiceDeps,
    private readonly saveStore: SaveStore,
    private readonly codec: SaveCodec,
    private readonly cloud: SteamCloudSync,
    private readonly identity: SteamIdentity | null,
    private readonly backend: BackendApi,
    private readonly combat: StageCombatService,
    private readonly roster: RosterService,
    private readonly rewards: RewardService,
    private readonly lifecycle: AppLifecycle | null = null,
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
    this.deps.store.commit({ ...s, notices: this.deps.store.get().notices });
    const accrual = this.applyOfflineAccrual(save.lastSeenAtMs, this.deps.clock.nowMs());
    return { newGame: false, accrual };
  }

  /** RFR-14: a new game starts with the fixed starter hero in the Active Squad and Krell's starting weapon. */
  private startNewGame(): void {
    const settings = this.deps.content.settings;
    const fresh = stateFromSave(SaveGameData.createNew(this.deps.clock.nowMs(), settings.startingEquipmentId), this.deps.content);
    this.deps.store.commit(fresh);
    this.roster.addHeroCard(settings.starterHeroId);
    this.roster.tryActivate(settings.starterHeroId);
  }

  /**
   * FR-41: gold for time away, farmed by the Active Squad through `fastForward` (COMBAT-07), capped (FR-42).
   * The stage never advances offline. Also the catch-up path for gaps beyond TickDriver's cap.
   */
  applyOfflineAccrual(lastSeenMs: number, nowMs: number): OfflineAccrualResult | null {
    const capMs = Math.max(this.deps.content.settings.offlineAccrualCapHours, 0) * 3_600_000;
    const elapsedActualMs = nowMs - lastSeenMs;
    if (!(elapsedActualMs > 0) || !(capMs > 0)) return null;
    const elapsedCreditedMs = Math.min(elapsedActualMs, capMs);
    const farmed = this.combat.fastForward(elapsedCreditedMs);
    if (farmed.gold <= 0) return null;
    const wasCapped = elapsedActualMs > capMs;
    const accrual = OfflineAccrualResult.create(BigDouble.fromDouble(farmed.gold), elapsedActualMs, elapsedCreditedMs);
    const hours = elapsedCreditedMs / 3_600_000;
    this.pushNotice({
      kind: 'offline-accrual',
      goldAccrued: formatBig(accrual.goldAccrued),
      hoursCredited: hours,
      wasCapped,
      message: `Welcome back! Your Active Squad earned ${accrual.goldAccrued.toString()} gold over ${formatHours(hours)}h offline${wasCapped ? ' (capped)' : ''}.`,
    });
    return accrual;
  }

  /** Authenticates, pulls canonical state, flushes pending events, persists. Never throws. */
  async connect(): Promise<void> {
    if (!this.isReplaced()) {
      if (await this.authenticate()) await this.pullAndFlush();
      else this.noteRewardsPending();
    }
    await this.persist();
  }

  /** The account signed in on another device: nothing syncs until the player picks "Play here". */
  private isReplaced(): boolean {
    return this.deps.store.get().sync.sessionReplaced;
  }

  private async pullAndFlush(): Promise<void> {
    const server = await this.backend.getState();
    this.noteReplaced();
    if (server) this.applyCanonical(server);
    await this.flush();
  }

  /** Raises the flag once a call actually came back as `session-replaced`; never before. */
  private noteReplaced(): void {
    if (this.backend.sessionReplaced && !this.isReplaced()) this.setSync({ sessionReplaced: true });
  }

  /** "Play here": log in again (taking the session back), adopt the canonical state, resend pending events. Offline keeps the modal. */
  async playHere(): Promise<void> {
    if (!this.isReplaced() || this.deps.store.get().sync.inFlight) return;
    this.setSync({ inFlight: true });
    try {
      if (await this.authenticate()) await this.pullAndFlush();
      await this.persist();
    } finally {
      this.setSync({ inFlight: false });
    }
  }

  /** Quit from the modal: save locally and to the cloud, then ask the shell to close. */
  async quitGame(): Promise<void> {
    await this.persistLocalAndCloud();
    this.lifecycle?.quit();
  }

  /** Periodic/suspend sync (SyncNowAsync). Skips while one is in flight. */
  async syncNow(): Promise<void> {
    this.combat.flushIncome();
    const s = this.deps.store.get();
    if (s.sync.inFlight) return;
    if (s.sync.sessionReplaced) {
      await this.persist();
      return;
    }
    this.setSync({ inFlight: true });
    try {
      if (this.backend.isAuthenticated || (await this.authenticate())) await this.flush();
      else this.noteRewardsPending();
      await this.persist();
    } finally {
      this.setSync({ inFlight: false });
    }
  }

  /** Writes the local save (atomic, AD-12). */
  async persist(): Promise<void> {
    this.combat.flushIncome();
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
    this.setSync({
      authenticated: ok,
      online: ok || this.deps.store.get().sync.online,
      sessionReplaced: ok ? false : this.deps.store.get().sync.sessionReplaced,
    });
    if (ok && this.backend.steamId64) {
      const s = this.deps.store.get();
      this.deps.store.commit({ ...s, steamId64: this.backend.steamId64 });
    }
    return ok;
  }

  private async flush(): Promise<void> {
    const pending = this.deps.store.get().eventLog.pending;
    if (pending.length === 0) return;
    if (!this.backend.isAuthenticated) {
      this.noteRewardsPending();
      return;
    }
    const response = await this.backend.ingestBatch(pending);
    if (!response) {
      this.noteReplaced();
      if (!this.isReplaced()) {
        this.setSync({ online: false });
        this.noteRewardsPending();
      }
      return;
    }
    let s = this.deps.store.get();
    let log = s.eventLog;
    for (const result of response.results) {
      const original = pending.find((e) => e.clientEventId === result.clientEventId);
      // Another device advanced the cursor: keep the event, applyCanonical renumbers it for the next sync.
      if (!result.accepted && result.rejectionReason === STALE_SEQUENCE_REASON) continue;
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
    this.rewards.applyGrants(response.results.flatMap((r) => r.grants ?? []));
    this.setSync({ online: true, lastSyncAtMs: this.deps.clock.nowMs() });
    await this.persist();
    if (this.lastEncoded) await this.cloud.write(this.lastEncoded);
  }

  /** Drops are decided by the backend: while kill or boss events wait, say so once per session (DROP-05). */
  private noteRewardsPending(): void {
    if (this.pendingRewardsShown || this.isReplaced()) return;
    if (!this.deps.store.get().eventLog.pending.some((e) => e.type === 'MonsterKillsBatch' || e.type === 'BossDefeated')) return;
    this.pendingRewardsShown = true;
    this.pushNotice({ kind: 'reward', message: 'Rewards pending sync' });
  }

  /** ApplyCanonicalStateSilently: adopt the backend's state, re-project what is still pending. */
  private applyCanonical(server: GameState['canonical']): void {
    const s = this.deps.store.get();
    const live = applySnapshotToLive(s, project(server, s.eventLog.pending), this.deps.content);
    this.deps.store.commit({
      ...live,
      canonical: server,
      lastReconciledAtMs: this.deps.clock.nowMs(),
      eventLog: PlayerEventLog.rebase(
        PlayerEventLog.seedSequence(live.eventLog, server.lastAppliedSequence + 1),
        server.lastAppliedSequence,
      ),
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
