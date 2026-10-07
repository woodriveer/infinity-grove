import { type CombatParams, advance, startStage } from './CombatRules';
import type { StageSpec } from './StageCurves';

export interface FarmRate {
  goldPerCycle: number;
  cycleMs: number;
  goldPerSecond: number;
}

/** A cycle that never ends (no damage either way) is abandoned after one hour of combat. */
const MAX_CYCLE_STEPS = 36000;
const STEP_MS = 100;

const ZERO: FarmRate = { goldPerCycle: 0, cycleMs: 0, goldPerSecond: 0 };

/**
 * Gold per second of farming `stage` with the squad in `p`: one cycle through `advance` in farming
 * mode, from the stage start to the last monster's kill or the squad's wipe, whichever comes first.
 */
export function farmRate(stage: StageSpec, p: CombatParams): FarmRate {
  if (p.squad.length === 0) return ZERO;
  let enc = startStage(stage, p);
  let gold = 0;
  let kills = 0;
  for (let steps = 1; steps <= MAX_CYCLE_STEPS; steps++) {
    const r = advance(enc, 1, p, 'farming');
    enc = r.enc;
    let ended = false;
    for (const o of r.outcomes) {
      if (o.kind === 'kill') {
        gold += o.gold;
        kills++;
      } else if (o.kind === 'squadWiped') ended = true;
    }
    if (ended || kills >= p.monstersPerStage) {
      const cycleMs = steps * STEP_MS;
      return { goldPerCycle: gold, cycleMs, goldPerSecond: gold / (cycleMs / 1000) };
    }
  }
  return ZERO;
}
