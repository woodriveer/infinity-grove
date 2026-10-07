/** stage-combat T12: `BossFailureLabel`. COMBAT-06. */
import { describe, expect, it } from 'vitest';
import { BossFailureLabel } from '../../src/domain/combat/BossFailureLabel';

describe('BossFailureLabel.label', () => {
  it('below the floor is a Power Gate, with or without the favored type', () => {
    expect(BossFailureLabel.label(10, 50, 'Fire', ['Fire'])).toBe('PowerGate');
    expect(BossFailureLabel.label(10, 50, 'Fire', ['Nature'])).toBe('PowerGate');
  });
  it('at the floor without the favored type is a Composition Mismatch', () => {
    expect(BossFailureLabel.label(50, 50, 'Fire', ['Nature'])).toBe('CompositionMismatch');
    expect(BossFailureLabel.label(50, 50, 'Fire', [])).toBe('CompositionMismatch');
  });
  it('at the floor with the favored type maps Success to Power Gate', () => {
    expect(BossFailureLabel.label(50, 50, 'Fire', ['Nature', 'Fire'])).toBe('PowerGate');
  });
});
