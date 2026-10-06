import type { ScreenModel } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/** Main menu (P1, Unity MainMenuPresenter): Play enters the game; Config opens settings. */
export class MenuScreenController implements ScreenController {
  readonly id = 'menu' as const;

  constructor(private readonly ui: UiContext) {}

  build(): ScreenModel {
    return {
      id: 'menu',
      title: 'Infinity Grove',
      initialFocus: 'menu.play',
      sections: [
        {
          id: 'actions',
          rows: [
            { id: 'play', nodes: [{ id: 'menu.play', role: 'button', label: 'Play', enabled: true, primary: true, glyph: 'confirm', onActivate: () => this.ui.enterGame() }] },
            { id: 'config', nodes: [{ id: 'menu.settings', role: 'button', label: 'Settings', enabled: true, onActivate: () => this.ui.open('settings') }] },
          ],
        },
      ],
    };
  }
}

/** Settings (RFR-47): music volume, persisted per player. */
export class SettingsController implements ScreenController {
  readonly id = 'settings' as const;

  constructor(private readonly ui: UiContext) {}

  build(): ScreenModel {
    const v = this.ui.settings.musicVolume();
    const set = (next: number) => {
      this.ui.settings.setMusicVolume(Math.max(0, Math.min(100, next)));
      this.ui.refresh();
    };
    return {
      id: 'settings',
      title: 'Settings',
      initialFocus: 'settings.volume.up',
      sections: [
        {
          id: 'audio',
          title: 'Audio',
          rows: [
            {
              id: 'music',
              nodes: [
                { id: 'settings.volume.down', role: 'button', label: 'Music −', enabled: v > 0, onActivate: () => set(v - 10) },
                { id: 'settings.volume', role: 'value', label: 'Music volume', value: `${v}%` },
                { id: 'settings.volume.up', role: 'button', label: 'Music +', enabled: v < 100, onActivate: () => set(v + 10) },
              ],
            },
          ],
        },
        { id: 'close', rows: [{ id: 'close', nodes: [{ id: 'settings.close', role: 'button', label: 'Back', enabled: true, glyph: 'back', onActivate: () => this.ui.close() }] }] },
      ],
    };
  }
}
