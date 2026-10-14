/** stage-combat T14 (COMBAT-03): save format v2 with the persisted combat stage and auto-advance. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compose } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import { SaveGameData } from '../../src/domain/SaveGameData';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';
import { SaveCodec } from '../../src/services/save/SaveCodec';
import { saveFromState, stateFromSave } from '../../src/services/state/projection';

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const content = () => compose(defaultConfig('test'), createNodePlatform({ seed: 1 })).content;

describe('save v2', () => {
  it('migrates a v1 save to furthest + 1 with auto-advance on', () => {
    const v1 = readJson('fixtures/legacy/save-v1-mid-game.json') as { formatVersion: number; lastReconciledState: { furthestStageCleared: number } };
    expect(v1.formatVersion).toBe(1);
    const save = SaveCodec.parsePlain(v1);
    expect(save.formatVersion).toBe(SaveGameData.CurrentFormatVersion);
    expect(save.local.combat).toEqual({ stageNumber: v1.lastReconciledState.furthestStageCleared + 1, autoAdvance: true });
  });

  it('caps the stage to the content and to furthest + 1 on load', () => {
    const c = content();
    const base = SaveCodec.parsePlain(readJson('fixtures/saves/mid-game.json'));
    const far = { ...base, local: { ...base.local, combat: { stageNumber: 999, autoAdvance: false } } };
    const s = stateFromSave(far, c);
    expect(s.stageCombat.stageNumber).toBe(Math.min(s.furthestStageCleared + 1, c.stages.length));
    expect(s.stageCombat.autoAdvance).toBe(false);
  });

  it('round-trips the stage and auto-advance, and never persists the encounter', () => {
    const c = content();
    const base = SaveCodec.parsePlain(readJson('fixtures/saves/mid-game.json'));
    const loaded = stateFromSave({ ...base, local: { ...base.local, combat: { stageNumber: 1, autoAdvance: false } } }, c);
    expect(loaded.stageCombat.encounter).toBeNull();
    const saved = saveFromState(loaded, 123);
    expect(saved.formatVersion).toBe(SaveGameData.CurrentFormatVersion);
    expect(saved.local.combat).toEqual({ stageNumber: 1, autoAdvance: false });
    expect(JSON.stringify(saved)).not.toContain('encounter');
    expect(SaveCodec.parsePlain(JSON.parse(SaveCodec.toPlainJson(saved)))).toEqual(saved);
  });
});
