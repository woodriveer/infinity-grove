import type { StageOutcome } from '../../domain/StageOutcome';
import { HeroTypeDisplay } from '../HeroTypeDisplay';
import type { ScreenModel, Tone, UiNode, UiRow } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/**
 * Stage select (P9, AD-002): jump to a cleared stage or the next uncleared one. Boss rows show the
 * favored type, the power floor vs squad power and the predicted risk (FR-11, FR-46); the result of the
 * last boss fight keeps the distinct Power Gate vs Composition Mismatch wording.
 */
export class StageSelectController implements ScreenController {
  readonly id = 'stages' as const;

  constructor(private readonly ui: UiContext) {}

  build(): ScreenModel {
    const { stages, combat } = this.ui.app;
    const fighting = this.ui.app.store.get().stageCombat.stageNumber;
    const entries = stages.selectableStages();
    const rows: UiRow[] = entries.map(({ stage, cleared, preview }) => {
      const p = `stages.${stage.stageId}`;
      const nodes: UiNode[] = [
        { id: `${p}.name`, role: 'text', label: `Stage ${stage.stageNumber}: ${stage.displayName}${stage.boss ? ' (Boss)' : ''}` },
        { id: `${p}.type`, role: 'text', label: HeroTypeDisplay.label(stage.favoredType), heroType: stage.favoredType },
      ];
      if (preview && stage.boss) {
        nodes.push(
          { id: `${p}.power`, role: 'text', label: `Power floor: ${stage.boss.powerFloor} (yours: ${preview.squadPower})` },
          { id: `${p}.risk`, role: 'text', label: riskLabel(preview.predictedOutcome), tone: tone(preview.predictedOutcome) },
        );
      }
      nodes.push({
        id: `${p}.go`,
        role: 'button',
        label: stage.stageNumber === fighting ? 'Fighting here' : cleared ? 'Farm' : 'Go',
        enabled: true,
        onActivate: () => {
          combat.jumpToStage(stage.stageNumber);
          this.ui.refresh();
        },
      });
      return { id: stage.stageId, nodes };
    });

    const last = this.ui.app.store.get().stageCombat.lastBossResult;
    const result: UiRow[] = [];
    if (last) {
      const stage = this.ui.app.content.stages.find((st) => st.stageNumber === last.stageNumber);
      if (last.outcome === 'Success') {
        result.push({ id: 'r1', nodes: [{ id: 'stages.result', role: 'heading', label: `✓ CLEARED - Stage ${last.stageNumber}`, tone: 'success' }] });
      } else if (last.outcome === 'PowerGate') {
        result.push(
          { id: 'r1', nodes: [{ id: 'stages.result', role: 'heading', label: '⚠ POWER GATE', tone: 'powerGate' }] },
          { id: 'r2', nodes: [{ id: 'stages.result.detail', role: 'text', label: 'Your squad power/gear/star quality is too low for this boss. Go grind - swapping heroes will not help.' }] },
        );
      } else {
        result.push(
          { id: 'r1', nodes: [{ id: 'stages.result', role: 'heading', label: '⇄ COMPOSITION MISMATCH', tone: 'mismatch' }] },
          {
            id: 'r2',
            nodes: [
              {
                id: 'stages.result.detail',
                role: 'text',
                label: `Your power is sufficient, but no hero in your Active Squad matches this boss's ${stage ? HeroTypeDisplay.abbreviation(stage.favoredType) : ''} modifier. Swap your squad.`,
              },
            ],
          },
        );
      }
    }

    const first = entries[0];
    return {
      id: 'stages',
      title: 'Stages',
      initialFocus: first ? `stages.${first.stage.stageId}.go` : 'stages.close',
      sections: [
        { id: 'list', title: `Furthest cleared: ${this.ui.app.store.get().furthestStageCleared}`, rows },
        ...(result.length > 0 ? [{ id: 'result', title: 'Last boss fight', rows: result }] : []),
        { id: 'close', rows: [{ id: 'close', nodes: [{ id: 'stages.close', role: 'button', label: 'Close', enabled: true, glyph: 'back', onActivate: () => this.ui.close() }] }] },
      ],
    };
  }
}

function riskLabel(predicted: StageOutcome): string {
  switch (predicted) {
    case 'Success':
      return 'Ready';
    case 'PowerGate':
      return '⚠ Power Gate risk';
    case 'CompositionMismatch':
      return '⇄ Composition Mismatch risk';
  }
}

function tone(predicted: StageOutcome): Tone {
  switch (predicted) {
    case 'Success':
      return 'success';
    case 'PowerGate':
      return 'powerGate';
    case 'CompositionMismatch':
      return 'mismatch';
  }
}
