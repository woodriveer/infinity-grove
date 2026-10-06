import type { HeroType } from '../../domain/HeroType';

/**
 * The semantic screen model (AD-15/AD-16, EXPERIENCE "Every interactive element is a
 * semantic node"). Screen controllers build it from game state; the DOM view renders
 * it; describe() flattens it. Tests assert on this, never on pixels or DOM structure.
 */
export type Role = 'button' | 'tab' | 'listitem' | 'slot' | 'toggle' | 'text' | 'value' | 'heading';

export type Tone = 'default' | 'gold' | 'success' | 'powerGate' | 'mismatch' | 'muted';

export interface UiNode {
  readonly id: string;
  readonly role: Role;
  readonly label: string;
  readonly enabled?: boolean;
  readonly value?: string;
  readonly tone?: Tone;
  readonly heroType?: HeroType;
  readonly selected?: boolean;
  /** Primary action of its screen: plaque style + glyph hint. */
  readonly primary?: boolean;
  /** Controller glyph hint (DESIGN.md "Controller Glyph Hint"). */
  readonly glyph?: 'confirm' | 'back';
  readonly onActivate?: () => void;
}

export interface UiRow {
  readonly id: string;
  readonly nodes: readonly UiNode[];
}

export interface UiSection {
  readonly id: string;
  readonly title?: string;
  readonly rows: readonly UiRow[];
}

export interface UiDialog {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly nodes: readonly UiNode[];
  /** Node focused when the dialog opens (Fusion confirm opens on Cancel). */
  readonly initialFocus: string;
}

export type ScreenId = 'menu' | 'settings' | 'game' | 'roster' | 'fusion' | 'equipment' | 'stages';

export interface ScreenModel {
  readonly id: ScreenId;
  readonly title: string;
  readonly sections: readonly UiSection[];
  readonly dialog?: UiDialog;
  readonly initialFocus?: string;
}

/** describe() output (RFR-16). */
export interface SemanticNode {
  readonly id: string;
  readonly screen: ScreenId;
  readonly role: Role;
  readonly label: string;
  readonly enabled: boolean;
  readonly value: string | null;
  readonly focused: boolean;
  readonly selected: boolean;
}

const INTERACTIVE: ReadonlySet<Role> = new Set(['button', 'tab', 'listitem', 'slot', 'toggle']);

export function isInteractive(n: UiNode): boolean {
  return INTERACTIVE.has(n.role) && n.onActivate !== undefined;
}

export function nodesOf(model: ScreenModel): UiNode[] {
  if (model.dialog) return [...model.dialog.nodes];
  return model.sections.flatMap((s) => s.rows.flatMap((r) => r.nodes));
}

/** All nodes visible on a model, including dialog nodes and section titles. */
export function visibleNodes(model: ScreenModel): UiNode[] {
  const title: UiNode[] = model.id === 'game' || model.id === 'menu' ? [] : [{ id: `${model.id}.title`, role: 'heading', label: model.title }];
  const base = title.concat(model.sections.flatMap((s) => [
    ...(s.title ? [{ id: `${model.id}.${s.id}.title`, role: 'heading' as const, label: s.title }] : []),
    ...s.rows.flatMap((r) => r.nodes),
  ]));
  return model.dialog
    ? [...base, { id: `${model.dialog.id}.title`, role: 'heading', label: model.dialog.title }, { id: `${model.dialog.id}.body`, role: 'text', label: model.dialog.body }, ...model.dialog.nodes]
    : base;
}
