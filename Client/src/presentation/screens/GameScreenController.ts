import { formatWhole } from '../../domain/bignum/format';
import type { ScreenModel, UiNode } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/**
 * The persistent Game Scene's semantic layer (P1–P3, P10, P12): HUD values, the
 * menu buttons, the combat target and the notices (offline summary, sync toast).
 * The world itself is drawn by Phaser (GameScene); this is what describe() sees.
 */
export class GameScreenController implements ScreenController {
  readonly id = 'game' as const;

  constructor(private readonly ui: UiContext) {}

  build(): ScreenModel {
    const s = this.ui.app.store.get();
    const monster = s.combat.monster;
    const fighting = s.combat.state === 'Fighting' && monster !== null;
    const combat: UiNode = fighting
      ? {
          id: 'game.combat',
          role: 'button',
          label: `Attack ${monster.name}`,
          value: `${monster.currentHp}/${monster.maxHp} HP`,
          enabled: true,
          primary: true,
          glyph: 'confirm',
          onActivate: () => this.ui.attack(),
        }
      : {
          id: 'game.combat',
          role: 'button',
          label: 'Krell is searching for a monster',
          value: 'walking',
          enabled: false,
          onActivate: () => this.ui.attack(),
        };

    const syncLabel = s.sync.authenticated ? (s.sync.online ? 'Synced' : 'Offline — will sync later') : 'Offline — progress saved locally';
    return {
      id: 'game',
      title: 'Infinity Grove',
      initialFocus: 'game.combat',
      sections: [
        {
          id: 'hud',
          rows: [
            {
              id: 'values',
              nodes: [
                { id: 'game.gold', role: 'value', label: 'Gold', value: formatWhole(s.gold), tone: 'gold' },
                { id: 'game.stage', role: 'value', label: 'Furthest stage', value: String(s.furthestStageCleared) },
                { id: 'game.sync', role: 'text', label: syncLabel, tone: 'muted' },
              ],
            },
            {
              id: 'menus',
              nodes: [
                { id: 'game.open.roster', role: 'button', label: 'Roster', enabled: true, onActivate: () => this.ui.open('roster') },
                { id: 'game.open.equipment', role: 'button', label: 'Equipment', enabled: true, onActivate: () => this.ui.open('equipment') },
                { id: 'game.open.stages', role: 'button', label: 'Stages', enabled: true, onActivate: () => this.ui.open('stages') },
              ],
            },
          ],
        },
        { id: 'combat', rows: [{ id: 'combat', nodes: [combat] }] },
        {
          id: 'notices',
          rows: s.notices.map((n) => ({
            id: `notice-${n.id}`,
            nodes: [{ id: `game.notice.${n.id}`, role: 'text' as const, label: n.message, tone: n.kind === 'offline-accrual' ? ('success' as const) : ('muted' as const) }],
          })),
        },
      ],
    };
  }
}
