import Phaser from 'phaser';
import { defaultConfig } from './config';
import { applyCssTokens, phaserColor } from '../presentation/theme/tokens';

/** Empty-game boot (G0 skeleton). Replaced by the composed game in later phases. */
export async function boot(): Promise<void> {
  const config = defaultConfig(import.meta.env.MODE, import.meta.env as Record<string, string | undefined>);
  applyCssTokens(document.documentElement.style);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: phaserColor('bgWorld'),
    scale: { mode: Phaser.Scale.EXPAND, width: 1920, height: 1080, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false,
    scene: [],
  });
  if (import.meta.env.MODE !== 'production' && config.devHooks) {
    const { installDevHooks } = await import('./dev-hooks');
    installDevHooks(window as unknown as Record<string, unknown>);
  }
}
