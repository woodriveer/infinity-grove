/** stage-combat T23 (COMBAT-08): HUD texts that need a state e2e fixtures cannot reach. */
import { describe, expect, it } from 'vitest';
import { GameScreenController } from '../../src/presentation/screens/GameScreenController';
import type { UiContext } from '../../src/presentation/screens/types';
import type { UiNode } from '../../src/presentation/ui/model';
import { emptyGameState } from '../../src/services/state/projection';

function nodes(furthest: number, stageCount: number, squad: string[]): UiNode[] {
  const base = emptyGameState();
  const state = { ...base, furthestStageCleared: furthest, activeSquad: squad, stageCombat: { ...base.stageCombat, stageNumber: Math.min(furthest + 1, stageCount) } };
  const stages = Array.from({ length: stageCount }, (_, i) => ({ stageNumber: i + 1 }));
  const ui = {
    app: {
      store: { get: () => state },
      content: { stages, combat: { monstersPerStage: 10 }, monster: () => ({ monsterName: 'Slime' }), hero: () => ({ displayName: 'Hero' }) },
      combat: { goldPerSecond: () => 0 },
    },
  } as unknown as UiContext;
  return new GameScreenController(ui).build().sections.flatMap((s) => s.rows.flatMap((r) => r.nodes));
}

describe('GameScreenController HUD', () => {
  it('says more stages are coming once the last stage in content is cleared', () => {
    expect(nodes(10, 10, ['ranger']).find((n) => n.id === 'game.lastStage')?.label).toBe('More stages coming soon');
    expect(nodes(9, 10, ['ranger']).some((n) => n.id === 'game.lastStage')).toBe(false);
  });
});
