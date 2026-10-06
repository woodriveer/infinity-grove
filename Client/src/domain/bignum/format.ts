import { BigDouble } from './BigDouble';

/** Parent FR-25 notation: plain grouped decimal below 1e21, scientific beyond (BigDouble.ToString()). */
export function formatBig(value: BigDouble | number, decimalPlaces = 2): string {
  const big = typeof value === 'number' ? BigDouble.fromDouble(value) : value;
  return big.toString(decimalPlaces);
}

/** Whole-number display for integer counters (gold): no decimals below 1e21. */
export function formatWhole(value: BigDouble | number): string {
  const big = typeof value === 'number' ? BigDouble.fromDouble(value) : value;
  return big.exponent >= 0 && big.exponent < 21 ? big.toString(0) : big.toString(2);
}
