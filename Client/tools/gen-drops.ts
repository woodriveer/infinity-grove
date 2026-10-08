/**
 * `npm run gen:drops` (boss-drops, design decision 1): writes shared/drop-catalog/drop-catalog.json from
 * content so the backend rolls drops from the same heroes, stages and items. gen:check fails when stale.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ALL_ASSET_KEYS } from '../src/generated/assets.gen';
import { FsContentSource } from '../src/platform/node/NodePorts';
import { loadContent } from '../src/services/content/ContentLoader';
import { renderDropCatalog } from './lib/dropCatalog';

export const DROP_CATALOG_PATH = '../shared/drop-catalog/drop-catalog.json';

mkdirSync(dirname(DROP_CATALOG_PATH), { recursive: true });
writeFileSync(DROP_CATALOG_PATH, renderDropCatalog(loadContent(new FsContentSource('content').entries(), ALL_ASSET_KEYS)));
console.log(`gen:drops: wrote ${DROP_CATALOG_PATH}`);
