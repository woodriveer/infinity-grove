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

const add = (path: string, json: unknown) => (entries: ContentEntry[]) => [...entries, { path, json }];
const stage = (stageId: string, stageNumber: number) => ({
  stageId, stageNumber, displayName: stageId, favoredType: 'Fire', powerFloor: 1, monsters: ['slime'],
});
/** Stage 5 (bramble-throne) is the first boss stage of the checked-in economy (bossEvery 5). */
const bossStage = (boss: Record<string, unknown>) => edit('stages/bramble-throne.json', (j) => (j['boss'] = boss));

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
      { path: 'stages/mossy-hollow-copy.json', json: stage('mossy-hollow', 11) },
    ];
    expect(problems(dup)).toEqual([
      "stages/mossy-hollow-copy.json: stageId 'mossy-hollow' must equal the file name 'mossy-hollow-copy'",
      "stages/mossy-hollow.json: duplicate stageId 'mossy-hollow' (also in stages/mossy-hollow-copy.json)",
    ]);
  });

  it('rejects an out-of-range value', () => {
    expect(problems(edit('monsters/slime.json', (j) => (j['maxHp'] = 0)))).toEqual([
      'monsters/slime.json: maxHp: Too small: expected number to be >0',
      // The invalid monster is dropped, so the references to it fail too.
      "stages/bramble-throne.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/cinder-hollow.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/duskroot-path.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/elder-heart.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/ember-ridge.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/mistwater-shallows.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/moonlit-fen.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/mossy-hollow.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/shadow-canopy.json: monsters[0] 'slime' has no monsters/slime.json",
      "stages/sunlit-glade.json: monsters[0] 'slime' has no monsters/slime.json",
      "settings/game.json: monsterPool[0] 'slime' has no monsters/slime.json",
    ]);
    expect(problems(edit('heroes/ranger.json', (j) => (j['heroType'] = 'Ice')))).toEqual([
      expect.stringMatching(/^heroes\/ranger\.json: heroType: /),
      "settings/game.json: starterHeroId 'ranger' has no heroes/ranger.json",
    ]);
  });
});

describe('combat content validation (stage-combat COMBAT-04)', () => {
  it('loads the combat economy', () => {
    const c = loadContent(base, ALL_ASSET_KEYS);
    expect(c.combat).toMatchObject({ monstersPerStage: 10, bossEvery: 5, spawnDelayMs: 300, defaultBossTimerSeconds: 30 });
  });

  it('rejects content without the combat economy', () => {
    expect(problems((entries) => entries.filter((e) => e.path !== 'economy/combat.json'))).toEqual(['economy/combat.json: missing']);
  });

  it('requires the new hero fields', () => {
    expect(problems(edit('heroes/druid.json', (j) => delete j['attackIntervalMs']))).toEqual([
      expect.stringMatching(/^heroes\/druid\.json: attackIntervalMs: /),
    ]);
    expect(problems(edit('heroes/druid.json', (j) => (j['baseHp'] = 0)))).toEqual([
      'heroes/druid.json: baseHp: Too small: expected number to be >0',
    ]);
  });

  it('accepts a boss on a boss stage and rejects a boss stage without one', () => {
    expect(problems(bossStage({ monsterId: 'slime', powerFloor: 40 }))).toEqual([]);
    expect(problems(edit('stages/bramble-throne.json', (j) => delete j['boss']))).toEqual([
      'stages/bramble-throne.json: boss is required on stage 5 (a multiple of bossEvery 5 in economy/combat.json)',
    ]);
  });

  it('rejects a boss on a stage that is not a boss stage', () => {
    expect(problems(edit('stages/moonlit-fen.json', (j) => (j['boss'] = { monsterId: 'slime', powerFloor: 1 })))).toEqual([
      'stages/moonlit-fen.json: boss is only allowed on boss stages (multiples of bossEvery 5 in economy/combat.json)',
    ]);
  });

  it('follows bossEvery from the economy', () => {
    expect(problems(edit('economy/combat.json', (j) => (j['bossEvery'] = 2)))).toEqual([
      'stages/bramble-throne.json: boss is only allowed on boss stages (multiples of bossEvery 2 in economy/combat.json)',
      'stages/ember-ridge.json: boss is required on stage 2 (a multiple of bossEvery 2 in economy/combat.json)',
      'stages/mistwater-shallows.json: boss is required on stage 8 (a multiple of bossEvery 2 in economy/combat.json)',
      'stages/shadow-canopy.json: boss is required on stage 4 (a multiple of bossEvery 2 in economy/combat.json)',
      'stages/sunlit-glade.json: boss is required on stage 6 (a multiple of bossEvery 2 in economy/combat.json)',
    ]);
  });

  it('accepts a 60 s boss timer and rejects a longer one, naming the file and boss.timerSeconds', () => {
    expect(problems(bossStage({ monsterId: 'slime', powerFloor: 40, timerSeconds: 60 }))).toEqual([]);
    expect(problems(bossStage({ monsterId: 'slime', powerFloor: 40, timerSeconds: 61 }))).toEqual([
      'stages/bramble-throne.json: boss.timerSeconds: must be at most 60 s',
      // The invalid stage 5 is dropped, so the stages after it leave a gap.
      'stages/sunlit-glade.json: stageNumber 6 leaves a gap (stage numbers must be contiguous from 1)',
    ]);
  });

  it('rejects a default boss timer above 60 s', () => {
    expect(problems(edit('economy/combat.json', (j) => (j['defaultBossTimerSeconds'] = 61)))).toEqual([
      'economy/combat.json: defaultBossTimerSeconds: must be at most 60 s',
    ]);
  });

  it('rejects stage and boss monsters that do not exist', () => {
    expect(problems(edit('stages/mossy-hollow.json', (j) => (j['monsters'] = ['slime', 'ghost'])))).toEqual([
      "stages/mossy-hollow.json: monsters[1] 'ghost' has no monsters/ghost.json",
    ]);
    expect(problems(bossStage({ monsterId: 'ghost', powerFloor: 40 }))).toEqual([
      "stages/bramble-throne.json: boss.monsterId 'ghost' has no monsters/ghost.json",
    ]);
  });

  it('accepts a spawn delay that is a multiple of 100 ms up to 500 ms', () => {
    expect(problems(edit('economy/combat.json', (j) => (j['spawnDelayMs'] = 500)))).toEqual([]);
    expect(problems(edit('economy/combat.json', (j) => (j['spawnDelayMs'] = 250)))).toEqual([
      'economy/combat.json: spawnDelayMs: must be a multiple of 100 ms (one combat step)',
    ]);
    expect(problems(edit('economy/combat.json', (j) => (j['spawnDelayMs'] = 600)))).toEqual([
      'economy/combat.json: spawnDelayMs: must be at most 500 ms',
    ]);
  });

  it('rejects stage numbers that are not contiguous from 1', () => {
    expect(problems(add('stages/far-glade.json', stage('far-glade', 12)))).toEqual([
      'stages/far-glade.json: stageNumber 12 leaves a gap (stage numbers must be contiguous from 1)',
    ]);
    expect(problems((entries) => entries.filter((e) => e.path !== 'stages/mossy-hollow.json'))).toEqual([
      'stages/ember-ridge.json: stageNumber 2 leaves a gap (stage numbers must be contiguous from 1)',
    ]);
  });
});

describe('placeholder combat content (stage-combat COMBAT-02, COMBAT-03)', () => {
  const c = loadContent(base, ALL_ASSET_KEYS);

  it('has at least 10 contiguous stages with boss stages 5 and 10', () => {
    const numbers = c.stages.map((s) => s.stageNumber);
    expect(numbers.length).toBeGreaterThanOrEqual(10);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    expect(c.stages.filter((s) => s.boss).map((s) => s.stageNumber)).toEqual(
      numbers.filter((n) => n % c.combat.bossEvery === 0),
    );
    expect(c.stages[4]?.boss).toBeDefined();
    expect(c.stages[9]?.boss).toBeDefined();
  });

  it('lists Krell as a regular hero with a server id and its animations entry', () => {
    const krell = c.heroes.find((h) => h.heroId === 'krell');
    expect(krell).toMatchObject({ serverHeroId: expect.stringMatching(/^[0-9a-f-]{36}$/), heroType: expect.any(String) });
    expect(c.animations.some((a) => a.characterId === krell?.heroId)).toBe(true);
  });

  it('gives every hero its own combat stats', () => {
    const stats = c.heroes.map((h) => `${h.baseHp}/${h.baseDefense}/${h.attackIntervalMs}`);
    expect(new Set(stats).size).toBe(c.heroes.length);
  });
});
