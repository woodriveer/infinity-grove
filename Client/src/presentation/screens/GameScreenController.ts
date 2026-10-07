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
    const enc = s.stageCombat.encounter;
    const foe = enc?.phase === 'fighting' ? enc.foe : null;
    const noSquad = s.activeSquad.length === 0;
    const combat: UiNode = foe
      ? {
          id: 'game.combat',
          role: 'button',
          label: `Attack ${this.ui.app.content.monster(foe.monsterId).monsterName}`,
          value: `${Math.ceil(foe.hp)}/${Math.ceil(foe.maxHp)} HP`,
          enabled: true,
          primary: true,
          glyph: 'confirm',
          onActivate: () => this.ui.attack(),
        }
      : {
          id: 'game.combat',
          role: 'button',
          label: noSquad ? 'Add a hero to your Active Squad to fight' : 'Your squad is searching for a monster',
          value: noSquad ? 'no squad' : 'searching',
          enabled: false,
          onActivate: () => this.ui.attack(),
        };
    const monstersPerStage = this.ui.app.content.combat.monstersPerStage;
    const progress = enc ? `${Math.min(enc.monsterIndex + 1, monstersPerStage)}/${monstersPerStage}` : `0/${monstersPerStage}`;

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
                { id: 'game.current', role: 'value', label: 'Fighting stage', value: String(s.stageCombat.stageNumber) },
                { id: 'game.progress', role: 'value', label: 'Monster', value: progress },
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
        {
          id: 'field',
          rows: (enc?.heroes ?? []).map((h) => ({
            id: `field-${h.heroId}`,
            nodes: [
              {
                id: `game.field.${h.heroId}`,
                role: 'value' as const,
                label: this.ui.app.content.hero(h.heroId).displayName,
                value: `${Math.ceil(h.hp)}/${Math.ceil(h.maxHp)} HP`,
                enabled: h.alive,
              },
            ],
          })),
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
