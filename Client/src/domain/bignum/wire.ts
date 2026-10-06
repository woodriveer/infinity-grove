import { BigDouble } from './BigDouble';

/** The backend's (mantissa: double, exponent: int) wire shape (AD-7). */
export interface BigWire {
  mantissa: number;
  exponent: number;
}

export function toWire(value: BigDouble): BigWire {
  return { mantissa: value.mantissa, exponent: value.exponent };
}

/** `new BigDouble(mantissa, exponent)` on the backend: normalizing. */
export function fromWire(wire: BigWire): BigDouble {
  return new BigDouble(wire.mantissa, wire.exponent);
}
