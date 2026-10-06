/**
 * RNFR-8 / AD-14: scans a built bundle for dev hooks and secret patterns.
 * Usage: tsx tools/scan-secrets.ts <dir>
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const patterns: Array<[string, RegExp]> = [
  ['dev hook global __ig', /__ig\b/],
  ['Steam Web API / publisher key', /\b[A-F0-9]{32}\b/],
  ['JWT signing key', /local-dev-only-signing-key/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['PublisherKey setting', /PublisherKey/],
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const findings: string[] = [];
for (const file of walk(root).filter((f) => /\.(js|html|css|json|map)$/.test(f) && !f.endsWith('.map'))) {
  const text = readFileSync(file, 'utf8');
  for (const [label, re] of patterns) {
    if (re.test(text)) findings.push(`${file}: contains ${label}`);
  }
}
if (findings.length > 0) {
  console.error(`scan:secrets: ${findings.length} finding(s) in ${root}:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`scan:secrets: ${root} is clean.`);
