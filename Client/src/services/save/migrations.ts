import { SaveGameData } from '../../domain/SaveGameData';

/**
 * Save format migrations (AD-12). A formatVersion bump adds a step here that turns
 * version n into n + 1; the codec runs them in order before validating. Version 1
 * is the first format; version 2 adds local.combat (stage-combat T14).
 */
const STEPS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 -> v2: fight the stage after the furthest cleared; the loader caps it to the content.
  1: (save) => {
    const state = (save['lastReconciledState'] ?? {}) as Record<string, unknown>;
    const furthest = typeof state['furthestStageCleared'] === 'number' ? (state['furthestStageCleared'] as number) : 0;
    const local = (save['local'] ?? {}) as Record<string, unknown>;
    return { ...save, local: { ...local, combat: { stageNumber: furthest + 1, autoAdvance: true } } };
  },
};

export function migrate(json: unknown): unknown {
  if (json === null || typeof json !== 'object') return json;
  let save = json as Record<string, unknown>;
  let version = typeof save['formatVersion'] === 'number' ? (save['formatVersion'] as number) : SaveGameData.CurrentFormatVersion;
  while (version < SaveGameData.CurrentFormatVersion) {
    const step = STEPS[version];
    if (!step) throw new Error(`No save migration from formatVersion ${version}.`);
    save = step(save);
    version += 1;
    save = { ...save, formatVersion: version };
  }
  return save;
}
