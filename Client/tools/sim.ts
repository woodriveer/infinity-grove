/**
 * `npm run sim -- --script <file> [--seed n] [--save <fixture>]` (RFR-13).
 * Runs a scenario headless and prints the resulting state and emitted events as JSON.
 * Exit 1 (naming the scenario and field) when the scenario's "expect" does not match.
 */
import { basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { loadScenario, runScenario } from './lib/simRunner';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const script = arg('script');
if (!script) {
  console.error('usage: npm run sim -- --script <scenario.json> [--seed n] [--save <fixture>]');
  process.exit(1);
}

const scenario = loadScenario(script);
const seedArg = arg('seed');
const saveArg = arg('save');
const output = await runScenario(scenario, {
  seed: seedArg !== undefined ? Number(seedArg) : undefined,
  save: saveArg !== undefined ? saveArg : undefined,
  name: basename(script),
});
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

const mismatches = scenario.expect ? diff(scenario.expect, output, '') : [];
if (mismatches.length > 0) {
  console.error(`sim: ${basename(script)} did not meet its expectations:\n${mismatches.map((m) => `  - ${m}`).join('\n')}`);
  process.exit(1);
}

/** Subset match: every expected field must equal the output's (arrays compared whole). */
function diff(expected: unknown, actual: unknown, path: string): string[] {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    if (actual === null || typeof actual !== 'object') return [`${path || '(root)'}: expected an object, got ${JSON.stringify(actual)}`];
    return Object.entries(expected).flatMap(([k, v]) => diff(v, (actual as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return isDeepStrictEqual(expected, actual) ? [] : [`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
}
