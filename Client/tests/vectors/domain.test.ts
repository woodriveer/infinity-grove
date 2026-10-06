/** RFR-19/RFR-21: domain rules agree with the backend and the frozen Unity rules. */
import { describe, expect, it } from 'vitest';
import { BigDouble } from '../../src/domain/bignum/BigDouble';
import { CraftingRules } from '../../src/domain/CraftingRules';
import { DamageCalculator } from '../../src/domain/DamageCalculator';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../../src/domain/EquipmentSlot';
import { ARCHETYPES, type Archetype } from '../../src/domain/Archetype';
import type { AffixType } from '../../src/domain/AffixType';
import { FusionRules } from '../../src/domain/FusionRules';
import type { HeroData } from '../../src/domain/content/types';
import { applyFusion, newHeroEntity, reconcileTo } from '../../src/domain/HeroEntity';
import type { HeroType } from '../../src/domain/HeroType';
import { newLoadoutPreset, setSlot, tryGetSlot } from '../../src/domain/LoadoutPreset';
import { newMonsterEntity, takeDamage } from '../../src/domain/MonsterEntity';
import { OfflineAccrualCalculator } from '../../src/domain/OfflineAccrualCalculator';
import { PlayerProgressReplay, type IngestEvent } from '../../src/domain/PlayerProgressReplay';
import type { PlayerEventType } from '../../src/domain/PlayerEventType';
import { toPlayerMessage } from '../../src/domain/ReconciliationCorrection';
import { RosterRules } from '../../src/domain/RosterRules';
import { StageOutcomeClassifier } from '../../src/domain/StageOutcomeClassifier';
import { loadVectors, num, withinTolerance } from './vectorFile';

describe('damage (unity-frozen)', () => {
  type C =
    | { op: 'playerDamage'; level: number; damagePerLevel: number; bonusDamage: number; result: number }
    | { op: 'monsterHits'; maxHp: number; hits: number[]; hpAfter: number[]; defeatedCount: number };
  const file = loadVectors<C>('damage');
  it('is exact and matches every case', () => {
    expect(file.tolerance).toBe('exact');
    for (const c of file.cases) {
      if (c.op === 'playerDamage') {
        expect(DamageCalculator.calculatePlayerDamage(c.level, c.damagePerLevel, c.bonusDamage), JSON.stringify(c)).toBe(c.result);
      } else {
        let m = newMonsterEntity('slime', 'Slime', '', c.maxHp, 7);
        let defeated = 0;
        const hp: number[] = [];
        for (const h of c.hits) {
          const r = takeDamage(m, h);
          m = r.monster;
          if (r.defeated) defeated++;
          hp.push(m.currentHp);
        }
        expect({ hp, defeated }, JSON.stringify(c)).toEqual({ hp: c.hpAfter, defeated: c.defeatedCount });
      }
    }
  });
});

describe('stage-outcome (unity-frozen)', () => {
  const file = loadVectors<{ squadPower: number; powerFloor: number; favoredType: HeroType; squadTypes: HeroType[]; outcome: string }>('stage-outcome');
  it('matches every classification', () => {
    for (const c of file.cases) {
      expect(StageOutcomeClassifier.classify(c.squadPower, c.powerFloor, c.favoredType, c.squadTypes), JSON.stringify(c)).toBe(c.outcome);
    }
  });
});

describe('roster-rules (unity-frozen)', () => {
  type C =
    | { op: 'capacity'; activeSquadCapacity: number }
    | { op: 'reconcileTo'; ownedCount: number; starTier: number; resultDuplicatesOwned: number; resultStarTier: number };
  const file = loadVectors<C>('roster-rules');
  it('matches capacity and reconciliation', () => {
    for (const c of file.cases) {
      if (c.op === 'capacity') expect(RosterRules.ActiveSquadCapacity).toBe(c.activeSquadCapacity);
      else {
        const h = reconcileTo(newHeroEntity('h', 4, 9), c.ownedCount, c.starTier);
        expect([h.duplicatesOwned, h.starTier], JSON.stringify(c)).toEqual([c.resultDuplicatesOwned, c.resultStarTier]);
      }
    }
  });
});

describe('fusion-rules (unity-frozen)', () => {
  type C = {
    starTier: number; duplicatesOwned: number; duplicatesRequired: number; canFuse: boolean; isMaxTier: boolean;
    nextTierAbilityDescription: string; afterFuse?: { starTier: number; duplicatesOwned: number };
  };
  const file = loadVectors<C>('fusion-rules');
  const data: HeroData = {
    heroId: 'frozen-hero', serverHeroId: '', displayName: 'frozen-hero', heroType: 'Fire', portrait: '', basePower: 10,
    abilityByStarTier: Array.from({ length: 12 }, (_, i) => (i % 4 === 3 ? '' : `Ability ${i + 1}`)),
  };
  it('matches preview and fusion for every tier/duplicate pair', () => {
    for (const c of file.cases) {
      const hero = newHeroEntity('frozen-hero', c.starTier, c.duplicatesOwned);
      const p = FusionRules.preview(hero, data);
      expect(
        { r: p.duplicatesRequired, f: p.canFuse, m: p.isMaxTier, a: p.nextTierAbilityDescription },
        JSON.stringify(c),
      ).toEqual({ r: c.duplicatesRequired, f: c.canFuse, m: c.isMaxTier, a: c.nextTierAbilityDescription });
      if (c.afterFuse) {
        const after = applyFusion(hero, p.duplicatesRequired);
        expect({ s: after.starTier, d: after.duplicatesOwned }).toEqual({ s: c.afterFuse.starTier, d: c.afterFuse.duplicatesOwned });
      }
    }
  });
});

describe('fusion-cost-curve (backend)', () => {
  const file = loadVectors<{ currentStarTier: number; duplicatesRequired: number; maxStarTier: number }>('fusion-cost-curve');
  it('client curve (1-based) agrees with backend curve (0-based) below the cap', () => {
    for (const c of file.cases) {
      expect(FusionRules.MaxStarTier).toBe(c.maxStarTier);
      // Same formula (tier + 1) on both sides; the client additionally returns 0 at the cap.
      if (c.currentStarTier < FusionRules.MaxStarTier) {
        expect(FusionRules.duplicatesRequiredForNextTier(c.currentStarTier)).toBe(c.duplicatesRequired);
      }
    }
  });
});

describe('crafting-rules (unity-frozen)', () => {
  type C =
    | { op: 'affixesForSlot'; slot: EquipmentSlot; affixes: AffixType[] }
    | { op: 'affixRange'; affix: AffixType; min: number; max: number }
    | { op: 'rerollCost'; cost: number };
  const file = loadVectors<C>('crafting-rules');
  it('matches slots, ranges and cost', () => {
    for (const c of file.cases) {
      if (c.op === 'affixesForSlot') expect(CraftingRules.affixesForSlot(c.slot)).toEqual(c.affixes);
      else if (c.op === 'affixRange') expect(CraftingRules.affixRange(c.affix)).toEqual({ min: c.min, max: c.max });
      else expect(CraftingRules.RerollCost).toBe(c.cost);
    }
  });
});

describe('offline-accrual (unity-frozen)', () => {
  type C = {
    elapsedMs: number; activeSquadPower: number; goldPerSquadPowerPerHour: number; capHours: number;
    gold: { m: number; e: number }; elapsedActualMs: number; elapsedCreditedMs: number; wasCapped: boolean;
  };
  const file = loadVectors<C>('offline-accrual');
  it('declares relative 1e-9 and stays within it', () => {
    expect(file.tolerance).toEqual({ relative: 1e-9 });
    const epoch = Date.UTC(2026, 0, 1);
    for (const c of file.cases) {
      const r = OfflineAccrualCalculator.calculate(epoch, epoch + c.elapsedMs, c.activeSquadPower, c.goldPerSquadPowerPerHour, c.capHours * 3_600_000);
      const expected = new BigDouble(num(c.gold.m), c.gold.e).toDouble();
      expect(withinTolerance(r.goldAccrued.toDouble(), expected, file.tolerance), `${JSON.stringify(c)} got ${r.goldAccrued.toDouble()}`).toBe(true);
      expect([r.elapsedActualMs, r.elapsedCreditedMs, r.wasCapped]).toEqual([c.elapsedActualMs, c.elapsedCreditedMs, c.wasCapped]);
    }
  });
});

describe('loadout-preset (unity-frozen)', () => {
  const file = loadVectors<Record<string, unknown>>('loadout-preset');
  it('last write wins per slot; archetype and slot order match Unity', () => {
    const [writes, order] = file.cases as [
      { archetype: Archetype; heroId: string; writes: Record<string, string>[]; slots: Record<string, string | null> },
      { archetypes: string[]; slotOrder: string[] },
    ];
    let preset = newLoadoutPreset(writes.archetype, writes.heroId);
    for (const w of writes.writes) for (const [slot, id] of Object.entries(w)) preset = setSlot(preset, slot as EquipmentSlot, id);
    for (const slot of EQUIPMENT_SLOTS) expect(tryGetSlot(preset, slot)).toBe(writes.slots[slot]);
    expect([...ARCHETYPES]).toEqual(order.archetypes);
    expect([...EQUIPMENT_SLOTS]).toEqual(order.slotOrder);
  });
});

describe('reconciliation-messages (unity-frozen)', () => {
  const file = loadVectors<{ eventType: PlayerEventType; reason: string; message: string }>('reconciliation-messages');
  it('words corrections exactly as Unity did', () => {
    for (const c of file.cases) expect(toPlayerMessage({ eventType: c.eventType, reason: c.reason, occurredAtMs: 0 })).toBe(c.message);
  });
});

describe('event-validation (backend)', () => {
  type Batch = {
    events: Array<{ clientEventId: string; sequenceNumber: number; type: string; payload: unknown }>;
    results: Array<{ clientEventId: string; status: string; rejectionReason: string | null }>;
    state: Record<string, unknown>;
  };
  const file = loadVectors<{ scenario: string; batches: Batch[] }>('event-validation');
  it('accepts, rejects, words reasons and reaches the same canonical state as the backend', () => {
    for (const c of file.cases) {
      let ledger = PlayerProgressReplay.newLedger();
      for (const batch of c.batches) {
        const r = PlayerProgressReplay.ingestBatch(ledger, batch.events as IngestEvent[]);
        ledger = r.ledger;
        expect(r.results, c.scenario).toEqual(batch.results);
        expect(ledger.state, c.scenario).toEqual(batch.state);
      }
    }
  });
});
