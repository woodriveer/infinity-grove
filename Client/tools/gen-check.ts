/**
 * CI staleness check (RFR-11, RFR-25): regenerates the asset manifest and the
 * API client, then fails if either differs from the checked-in copy.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const targets = ['src/generated/assets.gen.ts', 'src/generated/api/schema.ts'];
const before = targets.map((t) => readFileSync(t, 'utf8'));
execSync('npm run -s gen:assets', { stdio: 'inherit' });
execSync('npm run -s gen:api', { stdio: 'inherit' });
let stale = false;
targets.forEach((t, i) => {
  if (readFileSync(t, 'utf8') !== before[i]) {
    console.error(`gen:check: ${t} is stale. Run the generator and commit the result.`);
    stale = true;
  }
});
if (stale) process.exit(1);
console.log('gen:check: generated files are up to date.');
