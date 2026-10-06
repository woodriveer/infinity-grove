import { BigDouble } from './bignum/BigDouble';
import type { RosterEntrySnapshot } from './RosterEntrySnapshot';

/**
 * Client mirror of the backend's canonical PlayerStateDto (AD-6/AD-9). Gold is
 * the backend's (mantissa, exponent) pair (AD-7). GUIDs are lower-case strings.
 */
export interface PlayerStateSnapshot {
  readonly goldMantissa: number;
  readonly goldExponent: number;
  readonly furthestStageCleared: number;
  readonly lastAppliedSequence: number;
  readonly roster: readonly RosterEntrySnapshot[];
  readonly activeSquadHeroIds: readonly string[];
}

export const PlayerStateSnapshot = {
  empty(): PlayerStateSnapshot {
    return { goldMantissa: 0, goldExponent: 0, furthestStageCleared: 0, lastAppliedSequence: 0, roster: [], activeSquadHeroIds: [] };
  },
  gold(s: PlayerStateSnapshot): BigDouble {
    return new BigDouble(s.goldMantissa, s.goldExponent);
  },
} as const;
