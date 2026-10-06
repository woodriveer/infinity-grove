/**
 * `npm run steam:upload` (AD-21): uploads release/{win,linux}-unpacked as the Steam
 * depots described in steam/app_build.vdf. Run by the developer, never by CI (Steam
 * Guard credentials stay out of CI). Needs steamcmd on PATH and STEAM_BUILD_USER.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const user = process.env['STEAM_BUILD_USER'];
const missing: string[] = [];
if (!user) missing.push('set STEAM_BUILD_USER to the Steamworks build account');
for (const dir of ['release/win-unpacked', 'release/linux-unpacked']) {
  if (!existsSync(dir)) missing.push(`${dir} is missing: run npm run build:desktop first`);
}
if (spawnSync('steamcmd', ['+quit'], { stdio: 'ignore', shell: true }).error) missing.push('steamcmd is not on PATH');
if (missing.length > 0) {
  console.error(`steam:upload: cannot upload:\n${missing.map((m) => `  - ${m}`).join('\n')}`);
  process.exit(1);
}

const result = spawnSync('steamcmd', ['+login', user as string, '+run_app_build', resolve('steam/app_build.vdf'), '+quit'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
