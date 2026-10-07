/**
 * AD-002 boss stages. Mirrors Backend PlayerProgress.IsBossStage and the
 * ProgressOptions.BossEvery default; shared/test-vectors/stage-rules.json proves both.
 */
export const DEFAULT_BOSS_EVERY = 5;

export function isBossStage(stageNumber: number, bossEvery: number): boolean {
  return stageNumber % bossEvery === 0;
}
