/**
 * Dev/test-only surface (AD-14, RFR-15/16; EXPERIENCE "Agent Operability"). Imported
 * only when MODE !== 'production', so none of this reaches a release bundle (the
 * production build is scanned for "__ig").
 *
 * Boot URLs: ?scene=<screen>&save=<fixture|none>&seed=<n>&clock=manual[&hero=<id>]
 * window.__ig: describe(), goto(), advance(ms), input(...), state(), focused().
 */
import type { SaveGameData } from '../domain/SaveGameData';
import type { GamepadButton, InputRouter } from '../presentation/input/InputRouter';
import type { WorldScene } from '../presentation/scenes/WorldScene';
import type { ScreenId } from '../presentation/ui/model';
import type { SemanticAction, UiController } from '../presentation/UiController';
import type { SteppedClock } from '../platform/browser/BrowserPorts';
import { SaveCodec } from '../services/save/SaveCodec';
import type { AppContext } from './compose';

const FIXTURES = import.meta.glob('/fixtures/saves/*.json', { eager: true, import: 'default' });
const SCREENS: readonly ScreenId[] = ['menu', 'settings', 'game', 'roster', 'fusion', 'equipment', 'stages'];

export interface DevParams {
  scene: ScreenId | null;
  sceneParams: Record<string, string>;
  save: string | undefined;
  seed: number | undefined;
  clock: 'manual' | 'real';
}

export function parseParams(search: string): DevParams {
  const q = new URLSearchParams(search);
  const scene = q.get('scene');
  const seed = q.get('seed');
  return {
    scene: scene && (SCREENS as readonly string[]).includes(scene) ? (scene as ScreenId) : null,
    sceneParams: q.get('hero') ? { heroId: q.get('hero') as string } : {},
    save: q.get('save') ?? undefined,
    seed: seed !== null && Number.isFinite(Number(seed)) ? Number(seed) : undefined,
    clock: q.get('clock') === 'manual' ? 'manual' : 'real',
  };
}

export function fixture(name: string): SaveGameData {
  const json = FIXTURES[`/fixtures/saves/${name}.json`];
  if (!json) throw new Error(`Unknown save fixture '${name}'. Available: ${Object.keys(FIXTURES).map((k) => k.replace(/^.*\/|\.json$/g, '')).join(', ')}`);
  return SaveCodec.parsePlain(json);
}

type InputArg = SemanticAction | { key: string } | { gamepad: GamepadButton } | { action: SemanticAction; device?: 'keyboard' | 'gamepad' | 'mouse' };

export function install(
  target: Record<string, unknown>,
  deps: { app: AppContext; ui: UiController; input: InputRouter; world: WorldScene; manualClock: SteppedClock | null; advance: (frameDelta: number) => void },
): void {
  const { app, ui, input, world, manualClock, advance } = deps;
  target['__ig'] = {
    get ready() {
      return world.isReady();
    },
    describe: () => ui.describe(),
    screen: () => ui.screen,
    focused: () => ui.focused(),
    focusChangedAt: () => ui.lastFocusChangeAt,
    interactiveIds: () => ui.interactiveIds(),
    goto: (screen: ScreenId, params: Record<string, string> = {}) => ui.goto(screen, params),
    /** Moves the manual clock and the game loop by ms (no wall-clock waits in tests). */
    advance: (ms: number) => {
      if (!manualClock) throw new Error('__ig.advance needs ?clock=manual');
      manualClock.advance(ms);
      advance(ms);
    },
    input: (arg: InputArg) => {
      if ('key' in arg) input.key(arg.key);
      else if ('gamepad' in arg) input.gamepad(arg.gamepad);
      else if ('action' in arg) input.dispatch(arg.action, arg.device ?? 'keyboard');
      else input.dispatch(arg, 'keyboard');
      return performance.now();
    },
    click: (id: string) => ui.activate(id),
    state: () => {
      const s = app.store.get();
      return {
        gold: s.gold,
        furthestStageCleared: s.furthestStageCleared,
        activeSquad: s.activeSquad,
        heroes: s.heroes,
        combat: { state: s.combat.state, kills: s.combat.kills, monster: s.combat.monster, attackCount: s.combat.attackCount },
        krellEquipmentId: s.krellEquipmentId,
        pendingEvents: s.eventLog.pending.map((e) => e.type),
        notices: s.notices,
      };
    },
    world: () => ({ krellAnimation: world.krellAnimation() }),
  };
}
