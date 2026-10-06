/**
 * `npm run test:e2e [-- --screenshots] [playwright args]` (RFR-17): runs Playwright on
 * the test build. --screenshots saves PNGs per screen/state to artifacts/screenshots/
 * for the agent and the developer to look at; they never gate CI.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const env = { ...process.env };
const i = args.indexOf('--screenshots');
if (i >= 0) {
  args.splice(i, 1);
  env['IG_SCREENSHOTS'] = '1';
}
const result = spawnSync('npx', ['playwright', 'test', ...args], { stdio: 'inherit', env, shell: true });
process.exit(result.status ?? 1);
