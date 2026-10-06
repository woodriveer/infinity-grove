import { tryGetServerHeroId } from '../../domain/HeroData';
import { addDuplicate, newHeroEntity, reconcileTo, type HeroEntity } from '../../domain/HeroEntity';
import { RosterRules } from '../../domain/RosterRules';
import type { ServiceDeps } from '../core';
import { withEvent, withSquadEvent } from '../core';
import type { GameState } from '../state/types';

/**
 * Roster and Active Squad (P4, Unity RosterService). Acquiring a copy emits
 * HeroAcquired; changing the squad set emits ActiveSquadChanged (both only for
 * heroes mapped to a backend GUID, as in Unity).
 */
export class RosterService {
  constructor(private readonly deps: ServiceDeps) {}

  /** FR-3 cap, for presentation (which may not import domain values, F5). */
  readonly capacity = RosterRules.ActiveSquadCapacity;

  allHeroes(): readonly HeroEntity[] {
    return this.deps.store.get().heroes;
  }

  activeSquad(): readonly HeroEntity[] {
    return RosterService.activeSquadOf(this.deps.store.get());
  }

  bench(): readonly HeroEntity[] {
    return this.deps.store.get().heroes.filter((h) => !h.isInActiveSquad);
  }

  findByHeroId(heroId: string): HeroEntity | null {
    return this.deps.store.get().heroes.find((h) => h.heroId === heroId) ?? null;
  }

  static activeSquadOf(s: GameState): HeroEntity[] {
    return s.activeSquad.map((id) => s.heroes.find((h) => h.heroId === id)).filter((h): h is HeroEntity => h !== undefined);
  }

  /** AddHeroCard: a new hero, or one more duplicate of an owned one. */
  addHeroCard(heroId: string): HeroEntity {
    const data = this.deps.content.hero(heroId);
    const s = this.deps.store.get();
    const existing = s.heroes.find((h) => h.heroId === heroId);
    const hero = existing ? addDuplicate(existing) : newHeroEntity(heroId);
    let next: GameState = {
      ...s,
      heroes: existing ? s.heroes.map((h) => (h.heroId === heroId ? hero : h)) : [...s.heroes, hero],
    };
    const serverId = tryGetServerHeroId(data);
    if (serverId) next = withEvent(this.deps, next, 'HeroAcquired', { heroDefinitionId: serverId });
    else this.deps.logger.warn(`Hero '${heroId}' has no serverHeroId mapping; acquisition will not sync to the backend.`);
    this.deps.store.commit(next);
    return hero;
  }

  tryActivate(heroId: string): boolean {
    const s = this.deps.store.get();
    const hero = s.heroes.find((h) => h.heroId === heroId);
    if (!hero || hero.isInActiveSquad) return false;
    if (s.activeSquad.length >= RosterRules.ActiveSquadCapacity) return false;
    const after = setSquad(s, [...s.activeSquad, heroId]);
    this.deps.store.commit(withSquadEvent(this.deps, s, after));
    return true;
  }

  benchHero(heroId: string): void {
    const s = this.deps.store.get();
    const hero = s.heroes.find((h) => h.heroId === heroId);
    if (!hero || !hero.isInActiveSquad) return;
    const after = setSquad(s, s.activeSquad.filter((id) => id !== heroId));
    this.deps.store.commit(withSquadEvent(this.deps, s, after));
  }

  /** Tap-to-swap (EXPERIENCE): a benched hero takes an active hero's slot, in one change. */
  swap(activeHeroId: string, benchedHeroId: string): boolean {
    const s = this.deps.store.get();
    const index = s.activeSquad.indexOf(activeHeroId);
    const benched = s.heroes.find((h) => h.heroId === benchedHeroId);
    if (index < 0 || !benched || benched.isInActiveSquad) return false;
    const squad = [...s.activeSquad];
    squad[index] = benchedHeroId;
    this.deps.store.commit(withSquadEvent(this.deps, s, setSquad(s, squad)));
    return true;
  }

  /** Server-authoritative roster correction (ReconcileHero); emits nothing. */
  static reconcileHero(s: GameState, heroId: string, ownedCount: number, starTier: number): GameState {
    const existing = s.heroes.find((h) => h.heroId === heroId);
    if (existing) {
      const hero = reconcileTo(existing, ownedCount, starTier);
      return { ...s, heroes: s.heroes.map((h) => (h.heroId === heroId ? hero : h)) };
    }
    const hero = newHeroEntity(heroId, Math.max(starTier, 1), Math.max(ownedCount - 1, 0));
    return { ...s, heroes: [...s.heroes, hero] };
  }

  /** ReconcileActiveSquad: replaces the squad (cap 5, skipping duplicates); emits nothing. */
  static reconcileActiveSquad(s: GameState, heroIds: readonly string[]): GameState {
    const squad: string[] = [];
    for (const id of heroIds) {
      if (squad.length >= RosterRules.ActiveSquadCapacity) break;
      if (squad.includes(id) || !s.heroes.some((h) => h.heroId === id)) continue;
      squad.push(id);
    }
    return setSquad(s, squad);
  }
}

function setSquad(s: GameState, squad: string[]): GameState {
  const active = new Set(squad);
  return {
    ...s,
    activeSquad: squad,
    heroes: s.heroes.map((h) => (h.isInActiveSquad === active.has(h.heroId) ? h : { ...h, isInActiveSquad: active.has(h.heroId) })),
  };
}
