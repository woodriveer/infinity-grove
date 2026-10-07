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
    const bossFight = enc?.bossStepsLeft != null;
    const progress = bossFight
      ? `Boss ${Math.ceil((enc?.bossStepsLeft ?? 0) / 10)}s`
      : enc
        ? `${Math.min(enc.monsterIndex + 1, monstersPerStage)}/${monstersPerStage}`
        : `0/${monstersPerStage}`;
    const stages = this.ui.app.content.stages;
    const nextStage = stages.find((st) => st.stageNumber === s.furthestStageCleared + 1);
    const fightingNumber = enc?.stageNumber ?? s.stageCombat.stageNumber;
    const last = s.stageCombat.lastBossResult;
    const showResult = last !== null && last.outcome !== 'Success' && last.stageNumber > s.furthestStageCleared;
    const rate = `${formatWhole(this.ui.app.combat.goldPerSecond())}/s`;
    const actions: UiNode[] = [
      {
        id: 'game.auto',
        role: 'toggle',
        label: 'Auto-advance',
        value: s.stageCombat.autoAdvance ? 'On' : 'Off',
        selected: s.stageCombat.autoAdvance,
        enabled: true,
        onActivate: () => {
          this.ui.app.combat.setAutoAdvance(!s.stageCombat.autoAdvance);
          this.ui.refresh();
        },
      },
    ];
    if (nextStage?.boss && fightingNumber !== nextStage.stageNumber && !noSquad) {
      actions.push({
        id: 'game.fightBoss',
        role: 'button',
        label: 'Fight boss',
        enabled: true,
        onActivate: () => {
          this.ui.app.combat.fightBoss();
          this.ui.refresh();
        },
      });
    }

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
                { id: 'game.progress', role: 'value', label: bossFight ? 'Boss timer' : 'Monster', value: progress },
                { id: 'game.goldRate', role: 'value', label: 'Gold per second', value: rate, tone: 'gold' },
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
        { id: 'combat', rows: [{ id: 'combat', nodes: [combat] }, { id: 'actions', nodes: actions }] },
        {
          id: 'status',
          rows: [
            ...(noSquad ? [{ id: 'empty', nodes: [{ id: 'game.emptySquad', role: 'text' as const, label: 'Add a hero to your Active Squad to fight', tone: 'muted' as const }] }] : []),
            ...(showResult && last ? [{ id: 'result', nodes: [{ id: 'game.result', role: 'text' as const, label: resultLabel(last.outcome, last.stageNumber), tone: last.outcome === 'PowerGate' ? ('powerGate' as const) : ('mismatch' as const) }] }] : []),
            ...(s.furthestStageCleared >= stages.length ? [{ id: 'last', nodes: [{ id: 'game.lastStage', role: 'text' as const, label: 'More stages coming soon', tone: 'muted' as const }] }] : []),
          ],
        },
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

function resultLabel(outcome: 'PowerGate' | 'CompositionMismatch' | 'Success', stageNumber: number): string {
  return outcome === 'CompositionMismatch' ? `⇄ COMPOSITION MISMATCH - Stage ${stageNumber} boss` : `⚠ POWER GATE - Stage ${stageNumber} boss`;
}
