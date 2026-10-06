import { BigDouble } from './bignum/BigDouble';

/** Result of OfflineAccrualCalculator, shown as the "welcome back" summary. */
export interface OfflineAccrualResult {
  readonly goldAccrued: BigDouble;
  readonly elapsedActualMs: number;
  readonly elapsedCreditedMs: number;
  readonly wasCapped: boolean;
}

export const OfflineAccrualResult = {
  create(goldAccrued: BigDouble, elapsedActualMs: number, elapsedCreditedMs: number): OfflineAccrualResult {
    return { goldAccrued, elapsedActualMs, elapsedCreditedMs, wasCapped: elapsedCreditedMs < elapsedActualMs };
  },
  None: { goldAccrued: BigDouble.Zero, elapsedActualMs: 0, elapsedCreditedMs: 0, wasCapped: false } as OfflineAccrualResult,
} as const;
