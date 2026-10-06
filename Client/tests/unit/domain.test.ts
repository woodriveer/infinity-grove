/** RFR-23: the game-PRD rules each ported Domain module carries. */
import { describe, expect, it } from 'vitest';
import { BigDouble } from '../../src/domain/bignum/BigDouble';
import { formatBig, formatWhole } from '../../src/domain/bignum/format';
import { fromWire, toWire } from '../../src/domain/bignum/wire';
import type { HeroData } from '../../src/domain/content/types';
import { getAbilityDescription, tryGetServerHeroId } from '../../src/domain/HeroData';
import { FusionRules } from '../../src/domain/FusionRules';
import { newHeroEntity } from '../../src/domain/HeroEntity';
import { OfflineAccrualCalculator } from '../../src/domain/OfflineAccrualCalculator';
import { PlayerProgressReplay } from '../../src/domain/PlayerProgressReplay';
import { createRng, uuidV4 } from '../../src/domain/rng';
import { RosterRules } from '../../src/domain/RosterRules';
import { StageOutcomeClassifier } from '../../src/domain/StageOutcomeClassifier';
import { getAffix, setAffix } from '../../src/domain/EquipmentInstance';

const hero = (id: string, basePower: number): HeroData => ({
  heroId: id, serverHeroId: '', displayName: id, heroType: 'Fire', portrait: '', basePower,
  abilityByStarTier: Array.from({ length: 12 }, (_, i) => `A${i + 1}`),
});

describe('RosterRules (FR-3, FR-4)', () => {
  it('caps the Active Squad at 5', () => expect(RosterRules.ActiveSquadCapacity).toBe(5));

  it('counts only Active Squad heroes: benched heroes contribute zero power', () => {
    const data: Record<string, HeroData> = { a: hero('a', 10), b: hero('b', 7) };
    const active = [newHeroEntity('a', 2)];
    expect(RosterRules.squadPower(active, (id) => data[id] as HeroData)).toBe(20);
    expect(RosterRules.squadPower([], (id) => data[id] as HeroData)).toBe(0);
  });
});

describe('FusionRules (FR-6)', () => {
  it('stops at 12★: no cost, cannot fuse, preview says max', () => {
    expect(FusionRules.duplicatesRequiredForNextTier(12)).toBe(0);
    expect(FusionRules.canFuse(12, 99)).toBe(false);
    const p = FusionRules.preview(newHeroEntity('a', 12, 50), hero('a', 1));
    expect(p).toMatchObject({ isMaxTier: true, canFuse: false, nextTierAbilityDescription: 'Max star tier reached.' });
  });

  it('shows the next tier ability and the duplicates owned/required', () => {
    const p = FusionRules.preview(newHeroEntity('a', 2, 1), hero('a', 1));
    expect(p).toMatchObject({ currentStarTier: 2, duplicatesOwned: 1, duplicatesRequired: 3, canFuse: false, nextTierAbilityDescription: 'A3' });
  });
});

describe('StageOutcomeClassifier (FR-11)', () => {
  it('below the floor is always Power Gate, whatever the composition', () => {
    expect(StageOutcomeClassifier.classify(99, 100, 'Fire', ['Fire'])).toBe('PowerGate');
  });
  it('at or above the floor, a missing type is always Composition Mismatch', () => {
    expect(StageOutcomeClassifier.classify(100, 100, 'Fire', ['Water'])).toBe('CompositionMismatch');
    expect(StageOutcomeClassifier.classify(100, 100, 'Fire', ['Water', 'Fire'])).toBe('Success');
  });
});

describe('HeroData helpers', () => {
  it('falls back when a tier has no ability text', () => {
    const h = { ...hero('a', 1), abilityByStarTier: ['', 'two'] };
    expect(getAbilityDescription(h, 1)).toBe('No ability data configured for this tier.');
    expect(getAbilityDescription(h, 99)).toBe('two');
  });
  it('only maps valid GUIDs to the backend, lower-cased', () => {
    expect(tryGetServerHeroId({ ...hero('a', 1), serverHeroId: '' })).toBeNull();
    expect(tryGetServerHeroId({ ...hero('a', 1), serverHeroId: 'AAAAAAAA-0000-4000-8000-000000000001' })).toBe('aaaaaaaa-0000-4000-8000-000000000001');
  });
});

describe('big numbers', () => {
  it('round-trips the backend wire shape', () => {
    const v = BigDouble.fromDouble(123456.789);
    expect(fromWire(toWire(v)).equals(v)).toBe(true);
  });
  it('formats gold in FR-25 notation', () => {
    expect(formatWhole(1234567)).toBe('1,234,567');
    expect(formatBig(new BigDouble(4.2, 25))).toBe('4.20e+25');
  });
});

describe('OfflineAccrualCalculator (FR-41/42)', () => {
  it('credits at most the cap and reports it', () => {
    const r = OfflineAccrualCalculator.calculate(0, 20 * 3_600_000, 10, 1, 12 * 3_600_000);
    expect(r.goldAccrued.toDouble()).toBe(120);
    expect(r.wasCapped).toBe(true);
  });
  it('accrues nothing with an empty squad or a clock that went backwards', () => {
    expect(OfflineAccrualCalculator.calculate(0, 3_600_000, 0, 1, 1e9).goldAccrued.sign()).toBe(0);
    expect(OfflineAccrualCalculator.calculate(10, 0, 10, 1, 1e9).goldAccrued.sign()).toBe(0);
  });
});

describe('Rng and ids (RFR-7)', () => {
  it('is deterministic for a seed and resumable from its state', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    expect(Array.from({ length: 5 }, () => b.nextUint32())).toEqual(seqA);
    const resumed = createRng(a.state());
    expect(resumed.nextUint32()).toBe(a.nextUint32());
  });
  it('rangeInt stays in [min, max) like UnityEngine.Random.Range(int, int)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.rangeInt(3, 9);
      expect(v >= 3 && v < 9).toBe(true);
    }
  });
  it('produces RFC 4122 v4 ids', () => {
    expect(uuidV4(createRng(1))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('EquipmentInstance', () => {
  it('reads unset affixes as 0 and never mutates', () => {
    const item = { instanceId: 'i', itemId: 'x', affixRolls: {} };
    const next = setAffix(item, 'Speed', 12);
    expect(getAffix(item, 'Speed')).toBe(0);
    expect(getAffix(next, 'Speed')).toBe(12);
  });
});

describe('PlayerProgressReplay', () => {
  it('rejects spending gold the account does not have, with the backend wording', () => {
    expect(() => PlayerProgressReplay.applyEvent(PlayerProgressReplay.newLedger().state, 'GoldSpent', { goldMantissa: 5, goldExponent: 1 }))
      .toThrow('Insufficient gold: have 0, need 50.00.');
  });
});
