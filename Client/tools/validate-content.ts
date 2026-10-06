/**
 * `npm run validate:content` (RFR-10, AD-8): schema, unique ids, id = file name and
 * every cross-reference (stage monsters, hero portraits, item icons, animation sheets,
 * settings references) against the generated asset manifest. Every problem names
 * the file and field (RNFR-11). Exit 1 on any problem.
 *
 * Usage: npm run validate:content [-- --content <dir>]
 */
import { resolve } from 'node:path';
import { ALL_ASSET_KEYS } from '../src/generated/assets.gen';
import { FsContentSource } from '../src/platform/node/NodePorts';
import { ContentError, loadContent } from '../src/services/content/ContentLoader';

const argIndex = process.argv.indexOf('--content');
const root = resolve(argIndex > 0 ? (process.argv[argIndex + 1] as string) : 'content');
const entries = new FsContentSource(root).entries();

const parseErrors = entries.flatMap((e) => {
  const err = (e.json as { __parseError?: string } | null)?.__parseError;
  return err ? [err] : [];
});
if (parseErrors.length > 0) {
  console.error(`validate:content: ${parseErrors.length} file(s) are not valid JSON:\n${parseErrors.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

try {
  const c = loadContent(entries, ALL_ASSET_KEYS);
  console.log(
    `validate:content: OK — ${c.heroes.length} heroes, ${c.monsters.length} monsters, ${c.stages.length} stages, ` +
      `${c.items.length} items, ${c.equipment.length} equipment, ${c.animations.length} animations, ${c.effects.length} effects (${root})`,
  );
} catch (e) {
  if (e instanceof ContentError) {
    console.error(`validate:content: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
