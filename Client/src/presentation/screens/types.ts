import type { AppServices } from '../../services/AppServices';
import type { ScreenId, ScreenModel } from '../ui/model';

/** What a screen controller can do besides reading services. */
export interface UiContext {
  readonly app: AppServices;
  /** Pushes an overlay/panel (EXPERIENCE overlay stack: one overlay plus one panel). */
  open(id: ScreenId, params?: Record<string, string>): void;
  /** Pops the top overlay/panel. */
  close(): void;
  /** Switches between the main menu and the game. */
  enterGame(): void;
  /** Rebuild after a controller-local state change. */
  refresh(): void;
  /** Focus a node on the current screen (e.g. after a dialog closes). */
  focus(id: string): void;
  /** Click-to-damage (P2/P3). */
  attack(): void;
  readonly settings: {
    musicVolume(): number;
    setMusicVolume(v: number): void;
  };
}

/** Framework-agnostic screen controller (AD-15): builds the semantic model, handles back. */
export interface ScreenController {
  readonly id: ScreenId;
  build(): ScreenModel;
  /** Called when opened (params from open()). */
  onOpen?(params: Record<string, string>): void;
  /** Consumes `back` for screen-local state (cancel a pick, close a dialog). True if consumed. */
  back?(): boolean;
}
