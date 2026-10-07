import { describe, expect, it } from 'vitest';
import { attackSpeed, enchantBand } from '../../src/domain/art/Playback';

const bands = [
  { minLevel: 7, glow: true, aura: false },
  { minLevel: 10, glow: true, aura: true },
  { minLevel: 15, glow: true, aura: true, particles: 'sparks' },
];

describe('enchantBand', () => {
  it('has no band below +7', () => {
    expect(enchantBand(0, bands)).toBeNull();
    expect(enchantBand(6, bands)).toBeNull();
  });
  it('picks the band at each boundary', () => {
    expect(enchantBand(7, bands)?.minLevel).toBe(7);
    expect(enchantBand(9, bands)?.minLevel).toBe(7);
    expect(enchantBand(10, bands)?.minLevel).toBe(10);
    expect(enchantBand(14, bands)?.minLevel).toBe(10);
    expect(enchantBand(15, bands)?.minLevel).toBe(15);
    expect(enchantBand(99, bands)?.minLevel).toBe(15);
  });
  it('returns null with no bands', () => {
    expect(enchantBand(20, [])).toBeNull();
  });
});

describe('attackSpeed', () => {
  it('speeds up a tag longer than the interval', () => {
    expect(attackSpeed(600, 300)).toBe(2);
  });
  it('never goes below 1', () => {
    expect(attackSpeed(300, 600)).toBe(1);
  });
  it('is 1 for equal values', () => {
    expect(attackSpeed(400, 400)).toBe(1);
  });
  it('handles a zero interval without Infinity', () => {
    expect(attackSpeed(400, 0)).toBe(1);
    expect(Number.isFinite(attackSpeed(400, 0))).toBe(true);
  });
});
