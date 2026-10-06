/**
 * RFR-21 AC: every vector file declares exactly the tolerance in the PRD table.
 * Changing a tolerance means editing this table, the PRD table and PORT_MAP.md.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadVectors, VECTOR_DIR } from './vectorFile';

const RFR_21: Record<string, 'exact' | { relative: number }> = {
  'offline-accrual': { relative: 1e-9 },
  'catch-up-equivalence': { relative: 1e-6 },
};

describe('vector tolerances', () => {
  const families = readdirSync(VECTOR_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));

  it('finds the vector files', () => expect(families.length).toBeGreaterThan(10));

  it.each(families)('%s declares the RFR-21 tolerance', (family) => {
    expect(loadVectors(family).tolerance).toEqual(RFR_21[family] ?? 'exact');
  });
});
