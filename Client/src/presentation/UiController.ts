import type { AppServices } from '../services/AppServices';
import { FocusNavigator, type Direction, type Rect } from './input/FocusNavigator';
import { EquipmentController } from './screens/EquipmentController';
import { FusionController } from './screens/FusionController';
import { GameScreenController } from './screens/GameScreenController';
import { MenuScreenController, SettingsController } from './screens/MenuControllers';
import { RosterController } from './screens/RosterController';
import { StageSelectController } from './screens/StageSelectController';
import type { ScreenController, UiContext } from './screens/types';
import { isInteractive, nodesOf, visibleNodes, type ScreenId, type ScreenModel, type SemanticNode, type UiNode } from './ui/model';

/** Semantic actions (AD-16): every device maps to these; controllers never see raw input. */
export type SemanticAction =
  | { type: 'navigate'; dir: Direction }
  | { type: 'confirm' }
  | { type: 'back' }
  | { type: 'tabPrev' }
  | { type: 'tabNext' }
  | { type: 'openMenu'; id: 'roster' | 'equipment' | 'stages' }
  | { type: 'focusMenus' }
  | { type: 'attack' };

export type InputDevice = 'mouse' | 'keyboard' | 'gamepad';

export interface UiHooks {
  /** Main menu → game transition (scene switch, combat begin, music). */
  onEnterGame(): void;
  /** Click-to-damage; the world plays the punch from the store. */
  onAttack(): void;
  readonly settings: UiContext['settings'];
}

/**
 * Owns the screen stack (base menu|game plus at most one overlay and one panel),
 * routes semantic actions, keeps focus valid and produces describe(). One instance,
 * built by the app and handed to the views.
 */
export class UiController implements UiContext {
  readonly focusNav = new FocusNavigator();
  private base: 'menu' | 'game' = 'menu';
  private stack: ScreenId[] = [];
  private readonly controllers: Record<ScreenId, ScreenController>;
  private models: ScreenModel[] = [];
  private readonly listeners = new Set<() => void>();
  private dialogShown: string | null = null;
  private pendingFocus: string | null = null;

  device: InputDevice = 'mouse';
  /** True while the Steam overlay is open: game input is suspended (AD-16). */
  inputSuspended = false;
  /** Set by the DOM view: where a node is on screen, for spatial navigation. */
  rectOf: (id: string) => Rect | null = () => null;
  /** performance.now() of the last focus change, for the RFR-48 latency probe. */
  lastFocusChangeAt = 0;

  constructor(
    readonly app: AppServices,
    private readonly hooks: UiHooks,
  ) {
    this.controllers = {
      menu: new MenuScreenController(this),
      settings: new SettingsController(this),
      game: new GameScreenController(this),
      roster: new RosterController(this),
      fusion: new FusionController(this),
      equipment: new EquipmentController(this),
      stages: new StageSelectController(this),
    };
    app.store.subscribe(() => this.rebuild());
    this.rebuild();
  }

  get settings(): UiContext['settings'] {
    return this.hooks.settings;
  }

  // ---------- UiContext ----------

  open(id: ScreenId, params: Record<string, string> = {}): void {
    if (id === 'menu' || id === 'game') return;
    const isPanel = id === 'fusion';
    if (isPanel) this.stack = [...this.stack.filter((s) => s !== 'fusion').slice(0, 1), id];
    else this.stack = [id];
    this.controllers[id].onOpen?.(params);
    this.focusNav.forget(id);
    this.rebuild();
  }

  close(): void {
    if (this.stack.length === 0) return;
    this.stack = this.stack.slice(0, -1);
    this.rebuild();
  }

  enterGame(): void {
    this.base = 'game';
    this.stack = [];
    this.hooks.onEnterGame();
    this.rebuild();
  }

  /** Dev/test navigation (boot URLs, __ig.goto). */
  goto(screen: ScreenId, params: Record<string, string> = {}): void {
    if (screen === 'menu') {
      this.base = 'menu';
      this.stack = [];
    } else if (screen === 'game') {
      if (this.base !== 'game') this.enterGame();
      this.stack = [];
    } else if (screen === 'settings') {
      this.base = 'menu';
      this.stack = [];
      this.open('settings', params);
      return;
    } else {
      if (this.base !== 'game') this.enterGame();
      if (screen === 'fusion') this.stack = ['roster'];
      this.open(screen, params);
      return;
    }
    this.rebuild();
  }

  refresh(): void {
    this.rebuild();
  }

  focus(id: string): void {
    this.pendingFocus = id;
  }

  attack(): void {
    if (this.base !== 'game') return;
    this.hooks.onAttack();
  }

  // ---------- state ----------

  get screen(): ScreenId {
    return this.stack.at(-1) ?? this.base;
  }

  /** Models bottom to top (base screen first). */
  layers(): readonly ScreenModel[] {
    return this.models;
  }

  current(): ScreenModel {
    return this.models.at(-1) as ScreenModel;
  }

  focused(): string | null {
    return this.focusNav.get(this.focusKey());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  interactiveIds(): string[] {
    return nodesOf(this.current()).filter(isInteractive).map((n) => n.id);
  }

  /** RFR-16: what the player can see and do on the active screen. */
  describe(): SemanticNode[] {
    const model = this.current();
    const focused = this.focused();
    return visibleNodes(model).map((n: UiNode) => ({
      id: n.id,
      screen: model.id,
      role: n.role,
      label: n.label,
      enabled: n.enabled ?? true,
      value: n.value ?? null,
      focused: n.id === focused,
      selected: n.selected ?? false,
    }));
  }

  // ---------- input ----------

  handle(action: SemanticAction, device: InputDevice): void {
    this.device = device;
    if (this.inputSuspended) return;
    const model = this.current();
    switch (action.type) {
      case 'navigate': {
        const before = this.focused();
        const after = this.focusNav.move(this.focusKey(), this.interactiveIds(), action.dir, this.rectOf);
        if (after !== before) this.lastFocusChangeAt = performance.now();
        break;
      }
      case 'confirm':
        this.activate(this.focused());
        return;
      case 'attack':
        this.attack();
        break;
      case 'back': {
        const ctrl = this.controllers[this.screen];
        if (ctrl.back?.()) return;
        if (this.stack.length > 0) this.close();
        return;
      }
      case 'tabPrev':
      case 'tabNext': {
        const tabs = nodesOf(model).filter((n) => n.role === 'tab' && isInteractive(n));
        if (tabs.length === 0) break;
        const i = Math.max(0, tabs.findIndex((t) => t.selected));
        const next = tabs[(i + (action.type === 'tabNext' ? 1 : -1) + tabs.length) % tabs.length] as UiNode;
        next.onActivate?.();
        this.focus(next.id);
        this.rebuild();
        return;
      }
      case 'openMenu':
        if (this.base === 'game') this.open(action.id);
        return;
      case 'focusMenus':
        if (this.base === 'game' && this.stack.length === 0) this.setFocus('game.open.roster');
        break;
    }
    this.notify();
  }

  /** Pointer hover moves focus (EXPERIENCE: mouse hover moves focus). */
  hover(id: string): void {
    this.device = 'mouse';
    if (this.interactiveIds().includes(id) && this.focused() !== id) {
      this.setFocus(id);
      this.notify();
    }
  }

  /** Activates a node: click, Enter, A. Disabled nodes do nothing. */
  activate(id: string | null): void {
    if (!id || this.inputSuspended) return;
    const node = nodesOf(this.current()).find((n) => n.id === id);
    if (!node || !isInteractive(node) || node.enabled === false) return;
    this.setFocus(id);
    node.onActivate?.();
    this.rebuild();
  }

  // ---------- internals ----------

  private focusKey(): string {
    const model = this.models.at(-1);
    return model?.dialog ? model.dialog.id : this.screen;
  }

  private setFocus(id: string): void {
    if (this.focusNav.get(this.focusKey()) !== id) this.lastFocusChangeAt = performance.now();
    this.focusNav.set(this.focusKey(), id);
  }

  private rebuild(): void {
    const ids: ScreenId[] = [this.base, ...this.stack];
    this.models = ids.map((id) => this.controllers[id].build());
    const model = this.current();
    const dialogId = model.dialog?.id ?? null;
    if (dialogId !== this.dialogShown) {
      this.dialogShown = dialogId;
      if (model.dialog) this.focusNav.set(model.dialog.id, model.dialog.initialFocus);
    }
    const interactive = this.interactiveIds();
    if (this.pendingFocus && interactive.includes(this.pendingFocus)) this.setFocus(this.pendingFocus);
    this.pendingFocus = null;
    const before = this.focused();
    const after = this.focusNav.reconcile(this.focusKey(), interactive, model.dialog?.initialFocus ?? model.initialFocus);
    if (after !== before) this.lastFocusChangeAt = performance.now();
    this.notify();
  }

  private notify(): void {
    for (const l of [...this.listeners]) l();
  }
}
