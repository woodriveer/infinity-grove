/** Runtime state of a single monster encounter (Unity MonsterEntity). */
export interface MonsterEntity {
  readonly monsterId: string;
  readonly name: string;
  readonly sprite: string;
  readonly maxHp: number;
  readonly currentHp: number;
  readonly goldReward: number;
}

export function newMonsterEntity(
  monsterId: string,
  name: string,
  sprite: string,
  maxHp: number,
  goldReward: number,
): MonsterEntity {
  return { monsterId, name, sprite, maxHp, currentHp: maxHp, goldReward };
}

/**
 * TakeDamage: HP clamps at 0 and defeated is true exactly on the hit that
 * reaches 0. A hit on an already-dead monster changes nothing.
 */
export function takeDamage(monster: MonsterEntity, amount: number): { monster: MonsterEntity; defeated: boolean } {
  if (monster.currentHp === 0) return { monster, defeated: false };
  const currentHp = Math.max(0, (monster.currentHp - amount) | 0);
  return { monster: { ...monster, currentHp }, defeated: currentHp === 0 };
}
