/** RFR-13 / RFR-14 / RFR-7 / AD-5: checked-in sim scenarios, asserted. */
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compose } from '../../src/app/compose';
import { defaultConfig } from '../../src/app/config';
import { BigDouble } from '../../src/domain/bignum/BigDouble';
import { PlayerProgressReplay } from '../../src/domain/PlayerProgressReplay';
import { PlayerStateSnapshot } from '../../src/domain/PlayerStateSnapshot';
import { createNodePlatform } from '../../src/platform/node/nodePlatform';
import { loadFixture, loadScenario, runScenario } from '../../tools/lib/simRunner';

const DIR = resolve(__dirname, '../../scenarios');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

describe('sim scenarios', () => {
  it('cover every parity item P2–P12 (RFR-13 AC)', () => {
    for (let p = 2; p <= 12; p++) {
      expect(files.some((f) => f.startsWith(`p${String(p).padStart(2, '0')}-`)), `no scenario for P${p}`).toBe(true);
    }
  });

  it.each(files)('%s meets its expectations', async (file) => {
    const scenario = loadScenario(join(DIR, file));
    expect(scenario.expect, `${file} has no "expect"`).toBeDefined();
    const output = await runScenario(scenario, { name: file });
    expect(output).toMatchObject(scenario.expect as object);
  });

  it.each(files)('%s is byte-identical across runs with the same seed (RFR-7)', async (file) => {
    const scenario = loadScenario(join(DIR, file));
    const a = JSON.stringify(await runScenario(scenario, { name: file }));
    const b = JSON.stringify(await runScenario(scenario, { name: file }));
    expect(b).toBe(a);
  });

  it.each(files.filter((f) => !/p10|p12/.test(f)))('%s: every persisted change has a matching event (AD-5)', async (file) => {
    const scenario = loadScenario(join(DIR, file));
    const out = await runScenario(scenario, { name: file });
    const fixture = scenario.save ? loadFixture(scenario.save) : null;
    let ledger = PlayerProgressReplay.newLedger(fixture?.lastReconciledState ?? PlayerStateSnapshot.empty());
    const pendingBefore = fixture?.unsyncedEvents ?? [];
    ledger = PlayerProgressReplay.ingestBatch(
      ledger,
      pendingBefore.map((e) => ({ clientEventId: e.clientEventId, sequenceNumber: e.sequenceNumber, type: e.type, payload: JSON.parse(e.payloadJson) })),
    ).ledger;
    const fresh = out.events.filter((e) => !pendingBefore.some((p) => p.sequenceNumber === e.seq && p.type === e.type));
    ledger = PlayerProgressReplay.ingestBatch(
      ledger,
      fresh.map((e, i) => ({ clientEventId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, sequenceNumber: e.seq, type: e.type, payload: e.payload })),
    ).ledger;
    expect(Math.round(PlayerStateSnapshot.gold(ledger.state).toDouble())).toBe(out.final.gold);
    expect(ledger.state.furthestStageCleared).toBe(out.final.furthestStageCleared);
    expect(ledger.state.activeSquadHeroIds.length).toBe(out.final.activeSquad.length);
  });

  it('a new player can fight: at least one kill and a gold reward (RFR-14 AC)', async () => {
    const out = await runScenario({ description: 'new-player combat', save: 'new-player', steps: [{ do: 'begin' }, { do: 'attackUntilKill' }] });
    expect(out.final.combat.kills).toBeGreaterThanOrEqual(1);
    expect(out.final.gold).toBeGreaterThan(0);
    expect(out.events.some((e) => e.type === 'GoldEarned' && BigDouble.of((e.payload as { goldMantissa: number }).goldMantissa, 0).sign() > 0)).toBe(true);
  });
});

describe('adding content needs no code change (RFR-12 AC)', () => {
  it('a new hero and stage file show up in Roster and Stage Select', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ig-content-'));
    try {
      cpSync(resolve(__dirname, '../../content'), dir, { recursive: true });
      writeFileSync(
        join(dir, 'heroes/fixture-golem.json'),
        JSON.stringify({
          heroId: 'fixture-golem', serverHeroId: '1f6e0000-0000-4000-8000-0000000000aa', displayName: 'Fixture Golem', heroType: 'Light',
          portrait: '', basePower: 20, abilityByStarTier: Array.from({ length: 12 }, (_, i) => `Golem ${i + 1}`),
        }),
      );
      writeFileSync(
        join(dir, 'stages/fixture-crag.json'),
        JSON.stringify({ stageId: 'fixture-crag', stageNumber: 5, displayName: 'Fixture Crag', favoredType: 'Light', powerFloor: 20 }),
      );
      const app = compose(defaultConfig('test'), createNodePlatform({ contentRoot: dir }));
      app.sync.loadFrom(null);
      app.roster.addHeroCard('fixture-golem');
      expect(app.roster.allHeroes().map((h) => h.heroId)).toContain('fixture-golem');
      expect(app.stages.stages().map((s) => s.stageId)).toContain('fixture-crag');
      app.roster.tryActivate('fixture-golem');
      expect(app.stages.getPreview('fixture-crag').predictedOutcome).toBe('Success');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
