/** hero-art-pipeline T10: `weaponPose`. ART-06. */
import { describe, expect, it } from 'vitest';
import { weaponPose } from '../../src/domain/art/WeaponPose';

const p = (x: number, y: number) => ({ x, y });

describe('weaponPose', () => {
  it('positions the weapon at the hero grip', () => {
    const pose = weaponPose(p(100, 50), p(120, 50), p(0, 0), p(10, 0));
    expect(pose.x).toBe(100);
    expect(pose.y).toBe(50);
  });

  it('has rotation 0 when both axes are aligned', () => {
    expect(weaponPose(p(0, 0), p(5, 0), p(2, 2), p(12, 2)).rotation).toBe(0);
  });

  it('rotates a quarter turn', () => {
    expect(weaponPose(p(0, 0), p(0, 10), p(0, 0), p(10, 0)).rotation).toBeCloseTo(Math.PI / 2);
    expect(weaponPose(p(0, 0), p(10, 0), p(0, 0), p(0, 10)).rotation).toBeCloseTo(-Math.PI / 2);
  });

  it('handles negative angles and a half turn', () => {
    expect(weaponPose(p(0, 0), p(0, -10), p(0, 0), p(10, 0)).rotation).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(weaponPose(p(0, 0), p(-10, 0), p(0, 0), p(10, 0)).rotation)).toBeCloseTo(Math.PI);
  });

  it('treats a degenerate hero vector as angle 0', () => {
    expect(weaponPose(p(3, 3), p(3, 3), p(0, 0), p(0, 10)).rotation).toBeCloseTo(-Math.PI / 2);
  });

  it('treats a degenerate weapon vector as angle 0', () => {
    expect(weaponPose(p(0, 0), p(0, 10), p(4, 4), p(4, 4)).rotation).toBeCloseTo(Math.PI / 2);
  });

  it('returns rotation 0 when both are degenerate', () => {
    expect(weaponPose(p(1, 1), p(1, 1), p(2, 2), p(2, 2)).rotation).toBe(0);
  });
});
