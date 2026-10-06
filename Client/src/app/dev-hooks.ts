/** Dev/test-only debug surface (AD-14). Never imported in production builds. */
export function installDevHooks(target: Record<string, unknown>): void {
  target['__ig'] = { ready: true, describe: () => [] };
}
