import type { StageOutcome } from '../../domain/StageOutcome';
import { HeroTypeDisplay } from '../HeroTypeDisplay';
import type { ScreenModel, Tone, UiRow } from '../ui/model';
import type { ScreenController, UiContext } from './types';

/**
 * Stage select (P9, Unity StageSelectPresenter): modifier type, power floor vs squad
 * power, the predicted risk before entry (FR-46) and distinct Power Gate vs
 * Composition Mismatch results (FR-11), with the Unity wording.
 */
export class StageSelectController implements ScreenController {
  readonly id = 'stages' as const;

  constructor(private readonly ui: UiContext) {}

  build(): ScreenModel {
    const { stages } = this.ui.app;
    const rows: UiRow[] = stages.stages().map((stage) => {
      const preview = stages.getPreview(stage.stageId);
      const p = `stages.${stage.stageId}`;
      return {
        id: stage.stageId,
        nodes: [
          { id: `${p}.name`, role: 'text', label: `Stage ${stage.stageNumber}: ${stage.displayName}` },
          { id: `${p}.type`, role: 'text', label: HeroTypeDisplay.label(stage.favoredType), heroType: stage.favoredType },
          { id: `${p}.power`, role: 'text', label: `Power floor: ${stage.powerFloor} (yours: ${preview.squadPower})` },
          { id: `${p}.risk`, role: 'text', label: riskLabel(preview.predictedOutcome), tone: tone(preview.predictedOutcome) },
          {
            id: `${p}.attempt`,
            role: 'button',
            label: 'Attempt',
            value: riskLabel(preview.predictedOutcome),
            enabled: true,
            onActivate: () => {
              stages.attemptStage(stage.stageId);
              this.ui.refresh();
            },
          },
        ],
      };
    });

    const last = this.ui.app.store.get().lastStageAttempt;
    const result: UiRow[] = [];
    if (last) {
      const stage = this.ui.app.content.stage(last.stageId);
      if (last.outcome === 'Success') {
        result.push({ id: 'r1', nodes: [{ id: 'stages.result', role: 'heading', label: `✓ CLEARED - Stage ${stage.stageNumber}`, tone: 'success' }] });
      } else if (last.outcome === 'PowerGate') {
        result.push(
          { id: 'r1', nodes: [{ id: 'stages.result', role: 'heading', label: '⚠ POWER GATE', tone: 'powerGate' }] },
          { id: 'r2', nodes: [{ id: 'stages.result.detail', role: 'text', label: 'Your account power/gear/star quality is too low for this stage. Go grind - swapping heroes will not help.' }] },
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
                label: `Your power is sufficient, but no hero in your Active Squad matches this stage's ${HeroTypeDisplay.abbreviation(stage.favoredType)} modifier. Swap your squad.`,
              },
            ],
          },
        );
      }
    }

    const first = stages.stages()[0];
    return {
      id: 'stages',
      title: 'Stages',
      initialFocus: first ? `stages.${first.stageId}.attempt` : 'stages.close',
      sections: [
        { id: 'list', title: `Furthest cleared: ${this.ui.app.store.get().furthestStageCleared}`, rows },
        ...(result.length > 0 ? [{ id: 'result', title: 'Last attempt', rows: result }] : []),
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
