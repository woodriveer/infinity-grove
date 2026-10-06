/**
 * RFR-5 / AD-1 / AD-6: each layer and global rule must fire on a deliberately
 * bad fixture. If a rule is loosened or a path pattern breaks, this fails.
 */
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { cruise } from 'dependency-cruiser';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FIX = 'tests/lint/fixtures/src';

async function cruiseViolations(file: string): Promise<string[]> {
  const ruleSet = require('../../.dependency-cruiser.cjs');
  const result = await cruise([file], {
    ruleSet,
    validate: true,
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
  });
  const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;
  return output.summary.violations.map((v: { rule: { name: string } }) => v.rule.name);
}

async function eslintMessages(file: string): Promise<string[]> {
  const eslint = new ESLint({ ignore: false });
  const [res] = await eslint.lintFiles([file]);
  return (res?.messages ?? []).map((m) => `${m.ruleId}: ${m.message}`);
}

describe('dependency-cruiser layer rules', () => {
  it.each([
    ['domain imports phaser', `${FIX}/domain/ImportsPhaser.ts`, 'domain-is-pure'],
    ['domain imports services', `${FIX}/domain/ImportsServices.ts`, 'domain-is-pure'],
    ['services imports phaser', `${FIX}/services/ImportsPhaser.ts`, 'services-allowlist'],
    ['services imports node fs', `${FIX}/services/ImportsNodeFs.ts`, 'services-allowlist'],
    ['presentation imports platform', `${FIX}/presentation/ImportsPlatform.ts`, 'presentation-allowlist'],
    ['presentation imports a domain value', `${FIX}/presentation/ImportsDomainValue.ts`, 'presentation-domain-types-and-formatters-only'],
    ['presentation imports the writable GameStore', `${FIX}/presentation/ImportsGameStore.ts`, 'game-store-writes-only-in-services'],
    ['platform imports presentation', `${FIX}/platform/ImportsPresentation.ts`, 'platform-implements-ports'],
  ])('%s fails', async (_label, file, rule) => {
    expect(await cruiseViolations(file)).toContain(rule);
  });
});

describe('ESLint banned globals (RFR-7, AD-6)', () => {
  it.each([
    ['Date.now', `${FIX}/domain/UsesDateNow.ts`, 'Use the injected Clock'],
    ['Math.random', `${FIX}/domain/UsesMathRandom.ts`, 'Use the injected Rng'],
    ['fetch', `${FIX}/services/UsesFetch.ts`, 'HttpPort'],
    ['setTimeout', `${FIX}/services/UsesSetTimeout.ts`, 'TickDriver'],
    ['crypto.randomUUID', `${FIX}/services/UsesRandomUuid.ts`, 'IdGenerator'],
    ['affix roll outside BackendAffixRollSource', `${FIX}/services/RollsAffix.ts`, 'server-authoritative'],
    ['hex color in presentation', `${FIX}/presentation/HexColor.ts`, 'tokens.ts'],
  ])('%s fails', async (_label, file, fragment) => {
    const messages = await eslintMessages(file);
    expect(messages.join('\n')).toContain(fragment);
  });
});
