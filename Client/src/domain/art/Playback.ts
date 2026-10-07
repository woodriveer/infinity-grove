import type { EnchantBand } from '../content/types';

/** The band with the highest `minLevel` not above `level`, or null below the first band (ART-08). */
export function enchantBand(level: number, bands: readonly EnchantBand[]): EnchantBand | null {
  let found: EnchantBand | null = null;
  for (const band of bands) {
    if (level >= band.minLevel && (found === null || band.minLevel > found.minLevel)) found = band;
  }
  return found;
}

/** Playback speed that fits an animation tag into the attack interval; never below 1 (ART-08). */
export function attackSpeed(tagDurationMs: number, intervalMs: number): number {
  if (!(intervalMs > 0) || !(tagDurationMs > 0)) return 1;
  return Math.max(1, tagDurationMs / intervalMs);
}
