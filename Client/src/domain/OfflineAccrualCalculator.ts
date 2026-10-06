import { BigDouble } from './bignum/BigDouble';
import { OfflineAccrualResult } from './OfflineAccrualResult';

const TICKS_PER_MS = 10_000;
const TICKS_PER_HOUR = 36_000_000_000;

/**
 * Offline gold accrual from a persisted last-seen timestamp (FR-41), capped (FR-42).
 * Times are epoch milliseconds from the injected Clock. Hours are computed from
 * .NET ticks (TimeSpan.TotalHours = ticks / 3.6e10) so results match the Unity
 * calculator within the RFR-21 tolerance (relative 1e-9).
 */
export const OfflineAccrualCalculator = {
  calculate(
    lastSeenMs: number,
    nowMs: number,
    activeSquadPower: number,
    goldPerSquadPowerPerHour: number,
    capMs: number,
  ): OfflineAccrualResult {
    const elapsedActualMs = nowMs - lastSeenMs;
    if (elapsedActualMs <= 0 || activeSquadPower <= 0 || goldPerSquadPowerPerHour <= 0) {
      return OfflineAccrualResult.None;
    }
    const elapsedCreditedMs = elapsedActualMs > capMs ? capMs : elapsedActualMs;
    const hoursCredited = (elapsedCreditedMs * TICKS_PER_MS) / TICKS_PER_HOUR;
    const gold = BigDouble.fromDouble(activeSquadPower * goldPerSquadPowerPerHour * hoursCredited);
    return OfflineAccrualResult.create(gold, elapsedActualMs, elapsedCreditedMs);
  },
} as const;
