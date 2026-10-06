/** RFR-19/RFR-20: big-number parity with BreakInfinity.cs, bit-exact (S2). */
import { describe, expect, it } from 'vitest';
import { BigDouble } from '../../src/domain/bignum/BigDouble';
import { loadVectors, num } from './vectorFile';

type W = { m: number | string; e: number };
const big = (w: W) => BigDouble.fromMantissaExponentNoNormalize(num(w.m), w.e);

/** Bit-exact comparison of a BigDouble (or error) with a vector result. */
function same(actual: BigDouble | string, expected: W | string): boolean {
  if (typeof expected === 'string') return actual === expected;
  if (typeof actual === 'string') return false;
  return Object.is(actual.mantissa, num(expected.m)) && actual.exponent === expected.e;
}

function attempt(f: () => BigDouble): BigDouble | string {
  try {
    return f();
  } catch (e) {
    return `error:${(e as Error).name}`;
  }
}

const show = (v: BigDouble | string) => (typeof v === 'string' ? v : `{m:${v.mantissa},e:${v.exponent}}`);

describe('bignum-wire', () => {
  const file = loadVectors<{ op: string; input: unknown; result: W | string | number }>('bignum-wire');
  it('is declared exact', () => expect(file.tolerance).toBe('exact'));
  it('matches every case bit-exactly', () => {
    const failures: string[] = [];
    for (const c of file.cases) {
      let ok: boolean;
      let actual: unknown;
      switch (c.op) {
        case 'fromDouble':
          actual = attempt(() => BigDouble.fromDouble(num(c.input as number | string)));
          ok = same(actual as BigDouble, c.result as W);
          break;
        case 'construct': {
          const i = c.input as W;
          actual = attempt(() => new BigDouble(num(i.m), i.e));
          ok = same(actual as BigDouble, c.result as W);
          break;
        }
        case 'parse': {
          const r = attempt(() => BigDouble.tryParse(c.input as string) ?? ('invalid' as never));
          actual = r;
          ok = same(r === 'invalid' ? 'invalid' : r, c.result as W | string);
          break;
        }
        case 'toDouble':
          actual = big(c.input as W).toDouble();
          ok = Object.is(actual, num(c.result as number | string));
          break;
        default:
          throw new Error(`unknown op ${c.op}`);
      }
      if (!ok) failures.push(`${c.op}(${JSON.stringify(c.input)}): expected ${JSON.stringify(c.result)}, got ${typeof actual === 'object' ? show(actual as BigDouble) : String(actual)}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('bignum-arithmetic', () => {
  const file = loadVectors<{ op: string; a: W; b?: W; p?: number | string; result: W | string }>('bignum-arithmetic');
  it('matches every case bit-exactly', () => {
    const failures: string[] = [];
    for (const c of file.cases) {
      const a = big(c.a);
      const b = c.b ? big(c.b) : BigDouble.Zero;
      const actual = attempt(() => {
        switch (c.op) {
          case 'add': return a.add(b);
          case 'sub': return a.sub(b);
          case 'mul': return a.mul(b);
          case 'div': return a.div(b);
          case 'pow': return a.pow(num(c.p ?? 0));
          case 'negate': return a.negate();
          case 'abs': return a.abs();
          default: throw new Error(`unknown op ${c.op}`);
        }
      });
      if (!same(actual, c.result)) {
        failures.push(`${c.op}(${JSON.stringify(c.a)}, ${JSON.stringify(c.b ?? c.p)}): expected ${JSON.stringify(c.result)}, got ${show(actual)}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });
});

describe('bignum-compare', () => {
  const file = loadVectors<{ a: W; b: W; compareTo: number; equals: boolean; max: W; min: W }>('bignum-compare');
  it('matches ordering, equality, max and min for 100% of cases (parent NFR-1)', () => {
    const failures: string[] = [];
    for (const c of file.cases) {
      const a = big(c.a);
      const b = big(c.b);
      if (a.compareTo(b) !== c.compareTo) failures.push(`compareTo ${JSON.stringify(c)}`);
      if (a.equals(b) !== c.equals) failures.push(`equals ${JSON.stringify(c)}`);
      if (!same(BigDouble.max(a, b), c.max)) failures.push(`max ${JSON.stringify(c)}`);
      if (!same(BigDouble.min(a, b), c.min)) failures.push(`min ${JSON.stringify(c)}`);
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });
});

describe('bignum-format', () => {
  const file = loadVectors<{ value: W; default: string; dp0: string; dp4: string }>('bignum-format');
  it('matches the parent FR-25 notation exactly', () => {
    const failures: string[] = [];
    for (const c of file.cases) {
      const v = big(c.value);
      const got = { default: v.toString(), dp0: v.toString(0), dp4: v.toString(4) };
      if (got.default !== c.default || got.dp0 !== c.dp0 || got.dp4 !== c.dp4) {
        failures.push(`${JSON.stringify(c.value)}: expected ${JSON.stringify([c.default, c.dp0, c.dp4])}, got ${JSON.stringify([got.default, got.dp0, got.dp4])}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
