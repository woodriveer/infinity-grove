import Phaser from 'phaser';
import { getBridge } from '../platform/electron/ElectronPorts';
import { MusicController } from '../presentation/audio/MusicController';
import { InputRouter } from '../presentation/input/InputRouter';
import { NoticeTimer } from '../presentation/NoticeTimer';
import { SAFE_H, SAFE_W, WorldScene } from '../presentation/scenes/WorldScene';
import { applyCssTokens, colorHex } from '../presentation/theme/tokens';
import { mountUi } from '../presentation/ui/App';
import { UiController } from '../presentation/UiController';
import type { SaveGameData } from '../domain/SaveGameData';
import { compose } from './compose';
import { defaultConfig } from './config';
import { createPlatform } from './platform';

const SETTINGS_KEY = 'ig.settings';

/**
 * Boot (ARCHITECTURE AD-20 order): load the local save (cloud-resolved), apply
 * offline accrual, render, then authenticate and sync in the background.
 */
export async function boot(): Promise<void> {
  const mode = import.meta.env.MODE;
  const config = defaultConfig(mode, import.meta.env as Record<string, string | undefined>);
  applyCssTokens(document.documentElement.style);

  const devModule = mode !== 'production' && config.devHooks ? await import('./dev-hooks') : null;
  const params = devModule?.parseParams(location.search) ?? null;

  const platform = createPlatform(config, {
    seed: params?.seed,
    manualClock: params?.clock === 'manual',
    ephemeralSave: params?.save !== undefined,
  });
  const app = compose(config, platform.ports);

  // 1–2. Load (fixture in dev/test) and offline accrual.
  if (params?.save !== undefined) {
    const fixture: SaveGameData | null = params.save === 'none' ? null : (devModule?.fixture(params.save) ?? null);
    app.sync.loadFrom(fixture);
  } else {
    await app.sync.load();
  }

  // 3. Render: Phaser world + DOM menus.
  const settings = loadSettings();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastNow = platform.ports.clock.nowMs();
  const noticeTimer = new NoticeTimer(app, () => platform.ports.clock.nowMs());
  const advance = (_frameDelta: number) => {
    // Progress follows the clock, not the frame count (RFR-8): hidden or throttled
    // frames arrive late with a large elapsed time and are caught up, not lost.
    const now = platform.ports.clock.nowMs();
    const elapsed = now - lastNow;
    lastNow = now;
    if (elapsed > 0) app.tick.advance(elapsed);
    noticeTimer.update(now);
  };
  const world = new WorldScene(app, {
    effects: config.effects === 'on',
    audio: config.effects === 'on',
    reducedMotion,
    driveTime: platform.manualClock === null,
    advance,
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: colorHex.bgWorld,
    scale: { mode: Phaser.Scale.EXPAND, width: SAFE_W, height: SAFE_H, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: config.effects !== 'on' },
    banner: false,
    scene: [world],
  });

  const music = new MusicController(game, () => settings.musicVolume);
  const ui = new UiController(app, {
    onEnterGame: () => {
      world.setMode('game');
      music.stop();
      app.combat.begin();
    },
    onAttack: () => app.combat.playerAttack(app.playerCombat.calculateAttackDamage()),
    settings: {
      musicVolume: () => settings.musicVolume,
      setMusicVolume: (v) => {
        settings.musicVolume = v;
        saveSettings(settings);
        music.applyVolume();
      },
    },
  });
  const input = new InputRouter(ui);
  input.attach(window);
  const uiRoot = document.getElementById('ui-root') as HTMLElement;
  mountUi(uiRoot, ui);
  fitUiRoot(uiRoot);
  window.addEventListener('resize', () => fitUiRoot(uiRoot));
  game.events.once(Phaser.Core.Events.READY, () => music.playMenu());

  // Lifecycle: suspend/hidden persists and syncs (Unity OnApplicationPause); quit
  // persists locally and to Steam Cloud within the shell's timeout (AD-20).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void app.sync.syncNow();
  });
  const bridge = getBridge();
  if (bridge) {
    bridge.app.onSuspend(() => void app.sync.syncNow());
    bridge.app.onBeforeQuit(() => app.sync.persistLocalAndCloud(), 3000);
    bridge.steam.onOverlayActivated((active) => {
      ui.inputSuspended = active;
    });
  } else {
    window.addEventListener('pagehide', () => void app.sync.persist());
  }

  if (devModule && params) {
    devModule.install(window as unknown as Record<string, unknown>, { app, ui, input, world, manualClock: platform.manualClock, advance });
    if (params.scene) ui.goto(params.scene, params.sceneParams);
  }

  // 4–5. Authenticate and sync in the background; never block play on the network.
  void app.sync.connect().catch((e: Error) => platform.ports.logger.warn(`Initial sync failed: ${e.message}`));
}

interface Settings {
  musicVolume: number;
}

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
    return { musicVolume: typeof raw.musicVolume === 'number' ? raw.musicVolume : 70 };
  } catch {
    return { musicVolume: 70 };
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the setting lasts this session */
  }
}

/** Matches the DOM layer to Phaser's EXPAND safe frame: same scale, centered. */
function fitUiRoot(root: HTMLElement): void {
  const scale = Math.min(window.innerWidth / SAFE_W, window.innerHeight / SAFE_H);
  const left = (window.innerWidth - SAFE_W * scale) / 2;
  const top = (window.innerHeight - SAFE_H * scale) / 2;
  root.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}
