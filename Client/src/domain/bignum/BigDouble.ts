/**
 * Port of Backend/src/InfinityGrove.Backend.Domain/Shared/BreakInfinity.cs (AD-7).
 *
 * A normalized (mantissa, exponent) pair, value = mantissa * 10^exponent. Every
 * operation mirrors the C# line by line, including its quirks, because the wire
 * format and backend replay must agree bit-for-bit (PRD S2). Exponent arithmetic
 * wraps to int32 exactly as C# `int` does (unchecked). The vectors in
 * shared/test-vectors/bignum-*.json are the oracle; a mismatch is fixed here,
 * never at a call site.
 *
 * Deliberate difference: C# Normalize never terminates on an infinite mantissa
 * (e.g. FromDouble of a subnormal). The port throws instead (see PORT_MAP.md).
 */
import { formatFixed, log10, pow10 } from './precise';

export class BigDouble {
  static readonly Tolerance = 1e-9;
  private static readonly ExponentThreshold = 21;

  static readonly Zero = new BigDouble(0, 0, true);
  static readonly One = new BigDouble(1, 0, true);

  readonly mantissa: number;
  readonly exponent: number;

  /** Normalizing constructor, like `new BigDouble(mantissa, exponent)` in C#. */
  constructor(mantissa: number, exponent: number, noNormalize = false) {
    if (noNormalize) {
      this.mantissa = mantissa;
      this.exponent = exponent | 0;
      return;
    }
    const [m, e] = normalize(mantissa, exponent | 0);
    this.mantissa = m;
    this.exponent = e;
  }

  static of(mantissa: number, exponent: number): BigDouble {
    return new BigDouble(mantissa, exponent);
  }

  static fromMantissaExponentNoNormalize(mantissa: number, exponent: number): BigDouble {
    return new BigDouble(mantissa, exponent, true);
  }

  static fromDouble(value: number): BigDouble {
    if (Number.isNaN(value)) {
      throw new ArgumentError('Cannot represent NaN as a BigDouble.');
    }
    if (value === 0 || !Number.isFinite(value)) {
      return value > 0
        ? new BigDouble(1, INT_MAX, true)
        : value < 0
          ? new BigDouble(-1, INT_MAX, true)
          : BigDouble.Zero;
    }
    const exponent = toInt32(Math.floor(log10(Math.abs(value))));
    const mantissa = value / pow10(exponent);
    return new BigDouble(mantissa, exponent);
  }

  static parse(value: string): BigDouble {
    const r = BigDouble.tryParse(value);
    if (r === null) throw new Error(`'${value}' is not a valid BigDouble.`);
    return r;
  }

  /** C# TryParse: returns null where C# returns false. */
  static tryParse(value: string | null | undefined): BigDouble | null {
    if (value === null || value === undefined || value.trim() === '') return null;
    const v = value.trim();
    const eIndex = v.search(/[eE]/);
    if (eIndex >= 0) {
      const mantissa = parseCSharpDouble(v.slice(0, eIndex));
      const exponent = parseCSharpInt(v.slice(eIndex + 1));
      if (mantissa === null || exponent === null) return null;
      return new BigDouble(mantissa, exponent);
    }
    const plain = parseCSharpDouble(v);
    if (plain === null) return null;
    return BigDouble.fromDouble(plain);
  }

  toDouble(): number {
    if (this.exponent > 308) {
      return this.mantissa > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }
    if (this.exponent < -324) {
      return 0;
    }
    return this.mantissa * pow10(this.exponent);
  }

  abs(): BigDouble {
    return new BigDouble(Math.abs(this.mantissa), this.exponent, true);
  }

  sign(): number {
    return Math.sign(this.mantissa) || 0;
  }

  negate(): BigDouble {
    return new BigDouble(-this.mantissa, this.exponent, true);
  }

  add(b: BigDouble): BigDouble {
    const a = this as BigDouble;
    if (a.mantissa === 0) return b;
    if (b.mantissa === 0) return a;
    let larger: BigDouble;
    let smaller: BigDouble;
    if (a.exponent >= b.exponent) {
      larger = a;
      smaller = b;
    } else {
      larger = b;
      smaller = a;
    }
    const exponentDiff = toInt32(larger.exponent - smaller.exponent);
    if (exponentDiff > 17) {
      return larger;
    }
    const combinedMantissa = larger.mantissa + smaller.mantissa / pow10(exponentDiff);
    return new BigDouble(combinedMantissa, larger.exponent);
  }

  sub(b: BigDouble): BigDouble {
    return this.add(b.negate());
  }

  mul(b: BigDouble): BigDouble {
    return new BigDouble(this.mantissa * b.mantissa, toInt32(this.exponent + b.exponent));
  }

  div(b: BigDouble): BigDouble {
    if (b.mantissa === 0) {
      throw new DivideByZeroError('Cannot divide a BigDouble by zero.');
    }
    return new BigDouble(this.mantissa / b.mantissa, toInt32(this.exponent - b.exponent));
  }

  pow(power: number): BigDouble {
    if (power === 0) return BigDouble.One;
    if (this.mantissa === 0) return BigDouble.Zero;
    if (this.mantissa < 0) {
      throw new InvalidOperationError('Pow is only defined for non-negative BigDouble bases.');
    }
    const logValue = log10(this.mantissa) + this.exponent;
    const newLog10 = logValue * power;
    const newExponent = toInt32(Math.floor(newLog10));
    const newMantissa = pow10(newLog10 - newExponent);
    return new BigDouble(newMantissa, newExponent);
  }

  static max(a: BigDouble, b: BigDouble): BigDouble {
    return a.gte(b) ? a : b;
  }

  static min(a: BigDouble, b: BigDouble): BigDouble {
    return a.lte(b) ? a : b;
  }

  compareTo(other: BigDouble): number {
    if (this.mantissa === 0 && other.mantissa === 0) return 0;
    if (this.mantissa === 0) return other.mantissa > 0 ? -1 : 1;
    if (other.mantissa === 0) return this.mantissa > 0 ? 1 : -1;
    const signA = Math.sign(this.mantissa);
    const signB = Math.sign(other.mantissa);
    if (signA !== signB) return cmp(signA, signB);
    const exponentCompare = cmp(this.exponent, other.exponent);
    if (exponentCompare !== 0) return signA > 0 ? exponentCompare : -exponentCompare;
    return cmp(this.mantissa, other.mantissa);
  }

  /** C# Equals: mantissas within 1e-9 and identical exponents. */
  equals(other: BigDouble): boolean {
    return Math.abs(this.mantissa - other.mantissa) < BigDouble.Tolerance && this.exponent === other.exponent;
  }

  lt(b: BigDouble): boolean {
    return this.compareTo(b) < 0;
  }
  gt(b: BigDouble): boolean {
    return this.compareTo(b) > 0;
  }
  lte(b: BigDouble): boolean {
    return this.compareTo(b) <= 0;
  }
  gte(b: BigDouble): boolean {
    return this.compareTo(b) >= 0;
  }

  /**
   * Plain grouped decimal below 10^21, scientific beyond (C# ToString(decimalPlaces)):
   * `value.ToString("N" + dp)` / `Mantissa.ToString("F" + dp) + "e" + sign + Exponent`.
   */
  toString(decimalPlaces = 2): string {
    if (this.mantissa === 0) return '0';
    if (this.exponent >= 0 && this.exponent < BigDouble.ExponentThreshold) {
      return formatN(this.toDouble(), decimalPlaces);
    }
    const mantissaText = formatF(this.mantissa, decimalPlaces);
    return `${mantissaText}e${this.exponent >= 0 ? '+' : ''}${this.exponent}`;
  }
}

export class ArgumentError extends Error {
  override readonly name = 'ArgumentException';
}

export class DivideByZeroError extends Error {
  override readonly name = 'DivideByZeroException';
}

export class InvalidOperationError extends Error {
  override readonly name = 'InvalidOperationException';
}

const INT_MAX = 2147483647;

function toInt32(n: number): number {
  // C# (int) of a double: truncation; out-of-range or non-finite is undefined in C#
  // and yields int.MinValue on x64. `| 0` wraps instead, so mirror x64 explicitly.
  if (!Number.isFinite(n) || n >= 2147483648 || n < -2147483648) return -2147483648;
  return n | 0;
}

function cmp(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}


function normalize(mantissa: number, exponent: number): [number, number] {
  if (mantissa === 0) {
    return [mantissa, 0];
  }
  if (Number.isNaN(mantissa)) {
    throw new InvalidOperationError('BigDouble mantissa became NaN.');
  }
  if (!Number.isFinite(mantissa)) {
    throw new InvalidOperationError('BigDouble mantissa became infinite (C# Normalize does not terminate here).');
  }
  const sign = Math.sign(mantissa);
  let absMantissa = Math.abs(mantissa);
  const shift = toInt32(Math.floor(log10(absMantissa)));
  if (shift !== 0) {
    absMantissa /= pow10(shift);
    exponent = toInt32(exponent + shift);
  }
  while (absMantissa >= 10) {
    absMantissa /= 10;
    exponent = toInt32(exponent + 1);
  }
  while (absMantissa < 1) {
    absMantissa *= 10;
    exponent = toInt32(exponent - 1);
  }
  return [sign * absMantissa, exponent];
}

/** double.TryParse(s, NumberStyles.Float, InvariantCulture): whitespace, sign, decimal point, exponent. */
function parseCSharpDouble(s: string): number | null {
  const t = s.trim();
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
  if (/^[+-]?Infinity$/.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
  if (t === 'NaN') return Number.NaN;
  return null;
}

/** int.TryParse(s, NumberStyles.Integer, InvariantCulture). */
function parseCSharpInt(s: string): number | null {
  const t = s.trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  const n = Number(t);
  if (n > INT_MAX || n < -2147483648) return null;
  return n;
}

/** .NET "F<dp>" (exact value, ties to even). */
export function formatF(value: number, dp: number): string {
  return formatFixed(value, dp);
}

/** .NET "N<dp>": "F<dp>" with invariant-culture thousands grouping. */
export function formatN(value: number, dp: number): string {
  const fixed = formatF(value, dp);
  const negative = fixed.startsWith('-');
  const body = negative ? fixed.slice(1) : fixed;
  const [intPart = '0', frac] = body.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${frac !== undefined ? `.${frac}` : ''}`;
}

