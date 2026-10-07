export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface WeaponPoseResult {
  readonly x: number;
  readonly y: number;
  /** Radians, clockwise-positive in screen space (y down), as Phaser expects. */
  readonly rotation: number;
}

/**
 * Places a weapon image so its grip sits on the hero's grip and its tip points where the hero's tip points (ART-06).
 * A degenerate vector (tip equal to grip) has no direction, so its angle counts as 0.
 */
export function weaponPose(heroGrip: Point, heroTip: Point, weaponGrip: Point, weaponTip: Point): WeaponPoseResult {
  const heroAngle = angle(heroGrip, heroTip);
  const weaponAngle = angle(weaponGrip, weaponTip);
  return { x: heroGrip.x, y: heroGrip.y, rotation: heroAngle - weaponAngle };
}

function angle(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
}
