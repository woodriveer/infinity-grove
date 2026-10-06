/** RFR-10 AC: each kind of content error fails, naming the file and field (RNFR-11). */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_ASSET_KEYS } from '../../src/generated/assets.gen';
import { FsContentSource } from '../../src/platform/node/NodePorts';
import { ContentError, loadContent } from '../../src/services/content/ContentLoader';
import type { ContentEntry } from '../../src/services/ports';

const base = new FsContentSource(resolve(__dirname, '../../content')).entries();

function problems(mutate: (entries: ContentEntry[]) => ContentEntry[]): string[] {
  try {
    loadContent(mutate(base.map((e) => ({ ...e, json: structuredClone(e.json) }))), ALL_ASSET_KEYS);
    return [];
  } catch (e) {
    if (e instanceof ContentError) return [...e.problems];
    throw e;
  }
}

const edit = (path: string, change: (json: Record<string, unknown>) => void) => (entries: ContentEntry[]) =>
  entries.map((e) => {
    if (e.path !== path) return e;
    const json = e.json as Record<string, unknown>;
    change(json);
    return { path, json };
  });

describe('content validation', () => {
  it('accepts the checked-in content', () => expect(problems((e) => e)).toEqual([]));

  it('rejects a dangling reference', () => {
    expect(problems(edit('settings/game.json', (j) => (j['monsterPool'] = ['slime', 'ghost'])))).toEqual([
      "settings/game.json: monsterPool[1] 'ghost' has no monsters/ghost.json",
    ]);
    expect(problems(edit('heroes/druid.json', (j) => (j['portrait'] = 'characters/portraits/missing')))).toEqual([
      "heroes/druid.json: portrait 'characters/portraits/missing' is not an asset key (run npm run gen:assets?)",
    ]);
  });

  it('rejects a duplicate id', () => {
    const dup = (entries: ContentEntry[]) => [
      ...entries,
      { path: 'stages/mossy-hollow-copy.json', json: { stageId: 'mossy-hollow', stageNumber: 9, displayName: 'Copy', favoredType: 'Fire', powerFloor: 1 } },
    ];
    expect(problems(dup)).toEqual([
      "stages/mossy-hollow-copy.json: stageId 'mossy-hollow' must equal the file name 'mossy-hollow-copy'",
      "stages/mossy-hollow.json: duplicate stageId 'mossy-hollow' (also in stages/mossy-hollow-copy.json)",
    ]);
  });

  it('rejects an out-of-range value', () => {
    expect(problems(edit('monsters/slime.json', (j) => (j['maxHp'] = 0)))).toEqual([
      'monsters/slime.json: maxHp: Too small: expected number to be >0',
      // The invalid monster is dropped, so the reference to it fails too.
      "settings/game.json: monsterPool[0] 'slime' has no monsters/slime.json",
    ]);
    expect(problems(edit('heroes/ranger.json', (j) => (j['heroType'] = 'Ice')))).toEqual([
      expect.stringMatching(/^heroes\/ranger\.json: heroType: /),
      "settings/game.json: starterHeroId 'ranger' has no heroes/ranger.json",
    ]);
  });
});
