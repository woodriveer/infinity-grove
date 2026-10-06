import type { HeroData } from './content/types';

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** HeroData.GetAbilityDescription: ability text for a 1-based star tier. */
export function getAbilityDescription(data: HeroData, starTier: number): string {
  const table = data.abilityByStarTier;
  const index = clamp(starTier - 1, 0, table.length - 1);
  const text = table.length > index ? table[index] : undefined;
  return text !== undefined && text !== '' ? text : 'No ability data configured for this tier.';
}

/** HeroData.TryGetServerHeroId: the backend GUID (lower-case), or null if unmapped. */
export function tryGetServerHeroId(data: HeroData): string | null {
  return GUID.test(data.serverHeroId) ? data.serverHeroId.toLowerCase() : null;
}

/** UnityEngine.Mathf.Clamp(int, int, int). */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
