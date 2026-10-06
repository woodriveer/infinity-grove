// Marks dist-desktop/ as CommonJS: the package is ESM, but sandboxed preloads must be CommonJS.
import { writeFileSync } from 'node:fs';

writeFileSync('dist-desktop/package.json', `${JSON.stringify({ type: 'commonjs' })}\n`);
