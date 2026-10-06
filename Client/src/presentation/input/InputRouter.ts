import type { InputDevice, SemanticAction, UiController } from '../UiController';

/**
 * Maps devices to semantic actions (AD-16, EXPERIENCE "Interaction Primitives"):
 * keyboard (arrows/WASD, Enter/Space, Esc, Q/E, R/I/M), the browser Gamepad API
 * (Steam Input exposes Deck controls as a standard gamepad) and pointer. In test
 * builds the same paths accept injected keys and gamepad buttons (__ig.input).
 */
export type GamepadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'Up' | 'Down' | 'Left' | 'Right';

const KEYMAP: Record<string, SemanticAction | 'space'> = {
  ArrowUp: { type: 'navigate', dir: 'up' },
  ArrowDown: { type: 'navigate', dir: 'down' },
  ArrowLeft: { type: 'navigate', dir: 'left' },
  ArrowRight: { type: 'navigate', dir: 'right' },
  KeyW: { type: 'navigate', dir: 'up' },
  KeyS: { type: 'navigate', dir: 'down' },
  KeyA: { type: 'navigate', dir: 'left' },
  KeyD: { type: 'navigate', dir: 'right' },
  Enter: { type: 'confirm' },
  NumpadEnter: { type: 'confirm' },
  Space: 'space',
  Escape: { type: 'back' },
  KeyQ: { type: 'tabPrev' },
  KeyE: { type: 'tabNext' },
  KeyR: { type: 'openMenu', id: 'roster' },
  KeyI: { type: 'openMenu', id: 'equipment' },
  KeyM: { type: 'openMenu', id: 'stages' },
};

const PAD: Record<GamepadButton, SemanticAction> = {
  A: { type: 'confirm' },
  B: { type: 'back' },
  X: { type: 'attack' },
  Y: { type: 'focusMenus' },
  LB: { type: 'tabPrev' },
  RB: { type: 'tabNext' },
  Up: { type: 'navigate', dir: 'up' },
  Down: { type: 'navigate', dir: 'down' },
  Left: { type: 'navigate', dir: 'left' },
  Right: { type: 'navigate', dir: 'right' },
};

/** Standard Gamepad mapping indices. */
const STANDARD: Array<[number, GamepadButton]> = [
  [0, 'A'], [1, 'B'], [2, 'X'], [3, 'Y'], [4, 'LB'], [5, 'RB'], [12, 'Up'], [13, 'Down'], [14, 'Left'], [15, 'Right'],
];

const REPEAT_DELAY_MS = 350;
const REPEAT_RATE_MS = 140;

export class InputRouter {
  private readonly held = new Map<string, number>();
  private stickDir: GamepadButton | null = null;
  private stickNextAt = 0;
  private raf = 0;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.repeat && !e.code.startsWith('Arrow')) return;
    if (this.key(e.code)) e.preventDefault();
  };

  constructor(private readonly ui: UiController) {}

  attach(target: Window): void {
    target.addEventListener('keydown', this.onKey);
    target.addEventListener('pointermove', () => this.setDevice('mouse'), { passive: true });
    target.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.dispatch({ type: 'back' }, 'mouse');
    });
    const poll = () => {
      this.pollGamepads(target.navigator);
      this.raf = target.requestAnimationFrame(poll);
    };
    this.raf = target.requestAnimationFrame(poll);
  }

  detach(target: Window): void {
    target.removeEventListener('keydown', this.onKey);
    target.cancelAnimationFrame(this.raf);
  }

  /** A keyboard key by KeyboardEvent.code. Returns true if it mapped to an action. */
  key(code: string): boolean {
    const mapped = KEYMAP[code];
    if (!mapped) return false;
    if (mapped === 'space') {
      // Space attacks while the Combat View is focused, confirms elsewhere.
      this.dispatch(this.ui.focused() === 'game.combat' ? { type: 'attack' } : { type: 'confirm' }, 'keyboard');
    } else {
      this.dispatch(mapped, 'keyboard');
    }
    return true;
  }

  /** A gamepad button press (real polling and test injection share this path). */
  gamepad(button: GamepadButton): void {
    const action = PAD[button];
    // A on the Combat View attacks (EXPERIENCE: A while Combat View focused).
    if (button === 'A' && this.ui.focused() === 'game.combat') this.dispatch({ type: 'attack' }, 'gamepad');
    else this.dispatch(action, 'gamepad');
  }

  dispatch(action: SemanticAction, device: InputDevice): void {
    this.ui.handle(action, device);
  }

  private setDevice(device: InputDevice): void {
    if (this.ui.device !== device) {
      this.ui.device = device;
      this.ui.refresh();
    }
  }

  private pollGamepads(nav: Navigator): void {
    const pads = typeof nav.getGamepads === 'function' ? nav.getGamepads() : [];
    const now = performance.now();
    for (const pad of pads) {
      if (!pad || pad.mapping !== 'standard') continue;
      for (const [index, name] of STANDARD) {
        const key = `${pad.index}:${index}`;
        const pressed = pad.buttons[index]?.pressed ?? false;
        const since = this.held.get(key);
        if (pressed && since === undefined) {
          this.held.set(key, now);
          this.gamepad(name);
        } else if (!pressed && since !== undefined) {
          this.held.delete(key);
        }
      }
      // Left stick as a D-pad with repeat.
      const [x = 0, y = 0] = pad.axes;
      const dir: GamepadButton | null = Math.abs(x) < 0.5 && Math.abs(y) < 0.5 ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'Right' : 'Left') : y > 0 ? 'Down' : 'Up';
      if (dir === null) this.stickDir = null;
      else if (dir !== this.stickDir) {
        this.stickDir = dir;
        this.stickNextAt = now + REPEAT_DELAY_MS;
        this.gamepad(dir);
      } else if (now >= this.stickNextAt) {
        this.stickNextAt = now + REPEAT_RATE_MS;
        this.gamepad(dir);
      }
    }
  }
}
