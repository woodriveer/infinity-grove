import type { CombatParams } from '../../domain/combat/CombatRules';
import { stageSpec } from '../../domain/combat/StageCurves';
import type { ContentCatalog } from '../content/ContentLoader';
import { RosterService } from '../roster/RosterService';
import type { GameState } from '../state/types';

/**
 * Builds `CombatParams` from content and the Active Squad (slot order, leader first).
 * A hero's power is `basePower × starTier`; benched heroes never take part. The stage
 * list covers all content, so `stageNumber` only exists for call-site symmetry with the
 * design and is validated against it.
 */
export const CombatParamsBuilder = {
  build(content: Pick<ContentCatalog, 'combat' | 'stages' | 'hero'>, s: GameState, stageNumber: number): CombatParams {
    if (!content.stages.some((st) => st.stageNumber === stageNumber)) throw new Error(`No stage ${stageNumber} in content`);
    const eco = content.combat;
    return {
      monstersPerStage: eco.monstersPerStage,
      spawnDelayMs: eco.spawnDelayMs,
      typeBonus: eco.typeBonus,
      clickDpsShare: eco.clickDpsShare,
      dpsPerPower: eco.dpsPerPower,
      defenseK: eco.defenseK,
      squad: RosterService.activeSquadOf(s).map((hero) => {
        const data = content.hero(hero.heroId);
        return {
          heroId: hero.heroId,
          heroType: data.heroType,
          power: data.basePower * hero.starTier,
          maxHp: data.baseHp,
          defense: data.baseDefense,
          attackIntervalMs: data.attackIntervalMs,
        };
      }),
      stages: [...content.stages].sort((a, b) => a.stageNumber - b.stageNumber).map((st) => stageSpec(st, eco)),
    };
  },
};
