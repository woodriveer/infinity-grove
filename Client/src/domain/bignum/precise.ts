/**
 * Correctly rounded numeric primitives, so BigDouble matches .NET bit-for-bit.
 *
 * V8's Math.pow / Math.log10 can be one ulp away from the correctly rounded
 * result; .NET's Math.Pow / Math.Log10 (UCRT on x64) are correctly rounded in
 * every case the vectors cover. These helpers compute in double-double
 * precision (~106 bits) and round once, which reproduces those results.
 * Likewise .NET number formatting rounds exact decimal ties half-to-even, which
 * toFixed does not; formatFixed works on the exact binary value with BigInt.
 */

// ---------- double-double arithmetic ----------

type DD = [number, number];

const SPLITTER = 134217729; // 2^27 + 1

function twoSum(a: number, b: number): DD {
  const s = a + b;
  const bb = s - a;
  return [s, a - (s - bb) + (b - bb)];
}

function quickTwoSum(a: number, b: number): DD {
  const s = a + b;
  return [s, b - (s - a)];
}

function split(a: number): DD {
  const t = SPLITTER * a;
  const hi = t - (t - a);
  return [hi, a - hi];
}

function twoProd(a: number, b: number): DD {
  const p = a * b;
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return [p, ah * bh - p + ah * bl + al * bh + al * bl];
}

function ddAdd(a: DD, b: DD): DD {
  const [s, e] = twoSum(a[0], b[0]);
  return quickTwoSum(s, e + a[1] + b[1]);
}

function ddMul(a: DD, b: DD): DD {
  const [p, e] = twoProd(a[0], b[0]);
  return quickTwoSum(p, e + a[0] * b[1] + a[1] * b[0]);
}

function ddMulD(a: DD, b: number): DD {
  const [p, e] = twoProd(a[0], b);
  return quickTwoSum(p, e + a[1] * b);
}

function ddDiv(a: DD, b: DD): DD {
  const q1 = a[0] / b[0];
  let r = ddAdd(a, ddMulD(b, -q1));
  const q2 = r[0] / b[0];
  r = ddAdd(r, ddMulD(b, -q2));
  const q3 = r[0] / b[0];
  return ddAdd(quickTwoSum(q1, q2), [q3, 0]);
}

const LN2: DD = [0.6931471805599453, 2.3190468138462996e-17];
const LN10: DD = [2.302585092994046, -2.1707562233822494e-16];

/** e^x for a double-double x, |x| moderate. */
function ddExp(x: DD): DD {
  const k = Math.round(x[0] / LN2[0]);
  const r = ddAdd(x, ddMulD(LN2, -k));
  // exp(r) for |r| <= ln2/2 via exp(r/2^10)^(2^10) with a Taylor series.
  const scaledR: DD = [r[0] / 1024, r[1] / 1024];
  let term: DD = [1, 0];
  let sum: DD = [1, 0];
  for (let i = 1; i <= 20; i++) {
    term = ddMul(term, scaledR);
    term = [term[0] / i, term[1] / i];
    sum = ddAdd(sum, term);
    if (Math.abs(term[0]) < 1e-36) break;
  }
  for (let i = 0; i < 10; i++) sum = ddMul(sum, sum);
  const scale = Math.pow(2, k);
  return [sum[0] * scale, sum[1] * scale];
}

/** ln(x) for a positive finite double, in double-double: ln(f * 2^k) = ln(f) + k ln2, f in [1, 2). */
function ddLog(x: number): DD {
  // Exact binary exponent from the bits (Math.log2 rounds up to 1024 near MAX_VALUE).
  let k = 0;
  let scaled = x;
  if (scaled < 2.2250738585072014e-308) {
    scaled *= 18014398509481984; // 2^54: lift subnormals into the normal range
    k -= 54;
  }
  F64[0] = scaled;
  const e = Number(((U64[0] as bigint) >> 52n) & 0x7ffn) - 1023;
  k += e;
  const f = scaled / Math.pow(2, e);
  // Newton step on exp: y1 = y0 + (f - e^y0) / e^y0, then add k ln2.
  const y0 = Math.log(f);
  const ey = ddExp([y0, 0]);
  const diff = ddAdd([f, 0], [-ey[0], -ey[1]]);
  const lnF = ddAdd([y0, 0], ddDiv(diff, ey));
  return ddAdd(lnF, ddMulD(LN2, k));
}

const round = (d: DD): number => d[0] + d[1];

/**
 * 10^n for integer n as .NET Math.Pow(10, n) returns it: correctly rounded. The JS
 * parser also rounds correctly, except that it breaks the exact tie at 10^23 to
 * even (99999999999999991611392) where .NET returns the upper neighbour.
 */
export function pow10Int(n: number): number {
  if (n === 23) return 1.0000000000000001e23;
  return Number(`1e${n}`);
}

/** Correctly rounded 10^x for any finite double x (as .NET Math.Pow(10, x)). */
export function pow10(x: number): number {
  if (Number.isInteger(x)) return pow10Int(x);
  if (!Number.isFinite(x)) return Math.pow(10, x);
  return round(ddExp(ddMulD(LN10, x)));
}

/** Correctly rounded log10(x) (as .NET Math.Log10). */
export function log10(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return Math.log10(x);
  const n = Math.round(Math.log10(x));
  if (Math.abs(n) <= 22 && pow10Int(n) === x) return n;
  return round(ddDiv(ddLog(x), LN10));
}

// ---------- exact decimal formatting ----------

const F64 = new Float64Array(1);
const U64 = new BigUint64Array(F64.buffer);

/** Decomposes a finite double into an exact BigInt significand and binary exponent: |v| = sig * 2^exp. */
function decompose(v: number): { sig: bigint; exp: number } {
  F64[0] = Math.abs(v);
  const bits = U64[0] as bigint;
  const biasedExp = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  if (biasedExp === 0) return { sig: frac, exp: -1074 };
  return { sig: frac | (1n << 52n), exp: biasedExp - 1075 };
}

/**
 * .NET "F<dp>" formatting of a finite double: the exact binary value rounded to
 * dp decimals, ties to even. Negative values keep their sign even when they
 * round to zero (.NET Core 3.0+).
 */
export function formatFixed(value: number, dp: number): string {
  const negative = value < 0 || Object.is(value, -0);
  const { sig, exp } = decompose(value);
  const scale = 10n ** BigInt(dp);
  let q: bigint;
  if (exp >= 0) {
    q = sig * (1n << BigInt(exp)) * scale;
  } else {
    const num = sig * scale;
    const den = 1n << BigInt(-exp);
    q = num / den;
    const twiceRem = 2n * (num % den);
    if (twiceRem > den || (twiceRem === den && q % 2n === 1n)) q += 1n;
  }
  let digits = q.toString();
  if (dp > 0) {
    digits = digits.padStart(dp + 1, '0');
    digits = `${digits.slice(0, digits.length - dp)}.${digits.slice(digits.length - dp)}`;
  }
  return negative && !Object.is(value, -0) ? `-${digits}` : digits;
}
