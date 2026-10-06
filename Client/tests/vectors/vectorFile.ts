import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Tolerance = 'exact' | { relative: number };

export interface VectorFile<C> {
  family: string;
  source: 'backend' | 'unity-frozen';
  tolerance: Tolerance;
  generator: string;
  cases: C[];
}

export const VECTOR_DIR = resolve(__dirname, '../../../shared/test-vectors');

export function loadVectors<C>(family: string): VectorFile<C> {
  return JSON.parse(readFileSync(resolve(VECTOR_DIR, `${family}.json`), 'utf8')) as VectorFile<C>;
}

/** Vector doubles: numbers, or "Infinity"/"-Infinity"/"NaN" strings for non-finite values. */
export function num(v: number | string): number {
  if (typeof v === 'number') return v;
  if (v === 'Infinity') return Number.POSITIVE_INFINITY;
  if (v === '-Infinity') return Number.NEGATIVE_INFINITY;
  return Number.NaN;
}

/** Asserts `actual` against `expected` under the file's declared tolerance. */
export function withinTolerance(actual: number, expected: number, tolerance: Tolerance): boolean {
  if (tolerance === 'exact') return Object.is(actual, expected) || actual === expected;
  if (actual === expected) return true;
  const scale = Math.max(Math.abs(expected), Math.abs(actual));
  return Math.abs(actual - expected) <= tolerance.relative * scale;
}
