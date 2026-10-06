import { render } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { HeroTypeDisplay } from '../HeroTypeDisplay';
import { colorHex } from '../theme/tokens';
import type { UiController } from '../UiController';
import { isInteractive, type ScreenModel, type UiNode, type UiSection } from './model';

/**
 * The hybrid DOM menu layer (AD-15): Preact renders the semantic models the screen
 * controllers build, over the Phaser canvas, in one 1920×1080 logical frame. Every
 * interactive element carries data-node-id so the FocusNavigator can measure it.
 */
export function mountUi(root: HTMLElement, ui: UiController): void {
  render(<App ui={ui} root={root} />, root);
}

function App({ ui, root }: { ui: UiController; root: HTMLElement }) {
  const [, force] = useState(0);
  // Subscribe before paint and re-render once: a change made between the first
  // render and the subscription (e.g. a boot-URL goto) must not be missed.
  useLayoutEffect(() => {
    const unsubscribe = ui.subscribe(() => force((x) => x + 1));
    force((x) => x + 1);
    return unsubscribe;
  }, [ui]);
  useLayoutEffect(() => {
    ui.rectOf = (id) => {
      const el = root.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
  }, [ui, root]);

  const layers = ui.layers();
  const focused = ui.focused();
  const kb = ui.device !== 'mouse';
  useLayoutEffect(() => {
    if (!kb || !focused) return;
    root.querySelector(`[data-node-id="${CSS.escape(focused)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  return (
    <div class={kb ? 'kb' : 'mouse'}>
      {layers.map((model, i) => (
        <Layer key={model.id} model={model} ui={ui} focused={focused} top={i === layers.length - 1} stacked={i >= 2} />
      ))}
    </div>
  );
}

function Layer(props: { model: ScreenModel; ui: UiController; focused: string | null; top: boolean; stacked: boolean }) {
  const { model, ui, focused, top } = props;
  const inert = !top || model.dialog !== undefined ? { inert: true } : {};
  const body = (() => {
    switch (model.id) {
      case 'menu':
        return (
          <div class="menu-actions">
            <Sections sections={model.sections} ui={ui} focused={focused} screen={model.id} />
          </div>
        );
      case 'game':
        return <GameLayer model={model} ui={ui} focused={focused} />;
      default:
        return (
          <div class={`panel ${props.stacked ? 'panel-stacked' : ''}`} role="dialog" aria-label={model.title}>
            <h2 class="panel-title" data-node-id={`${model.id}.title`}>
              {model.title}
            </h2>
            <Sections sections={model.sections} ui={ui} focused={focused} screen={model.id} />
          </div>
        );
    }
  })();
  return (
    <>
      <div class="layer" data-screen={model.id} {...inert}>
        {body}
      </div>
      {top && model.dialog && (
        <div class="layer" data-screen={`${model.id}.dialog`}>
          <div class="dialog-backdrop" />
          <div class="dialog" role="alertdialog" aria-label={model.dialog.title}>
            <h3 class="heading" data-node-id={`${model.dialog.id}.title`}>
              {model.dialog.title}
            </h3>
            <div class="text" data-node-id={`${model.dialog.id}.body`}>
              {model.dialog.body}
            </div>
            <div class="row">
              {model.dialog.nodes.map((n) => (
                <Node key={n.id} n={n} ui={ui} focused={focused} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GameLayer({ model, ui, focused }: { model: ScreenModel; ui: UiController; focused: string | null }) {
  const hud = model.sections.find((s) => s.id === 'hud');
  const combat = model.sections.find((s) => s.id === 'combat')?.rows[0]?.nodes[0];
  const notices = model.sections.find((s) => s.id === 'notices');
  const [values, menus] = hud?.rows ?? [];
  return (
    <>
      {combat && (
        <button
          data-node-id={combat.id}
          class={`combat-target ${focused === combat.id ? 'is-focused' : ''}`}
          aria-label={`${combat.label}${combat.value ? `, ${combat.value}` : ''}`}
          aria-disabled={combat.enabled === false}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onPointerEnter={() => ui.hover(combat.id)}
          onClick={() => ui.attack()}
        >
          <span class="sr">{combat.label}</span>
        </button>
      )}
      <div class="hud">
        <div class="hud-values">
          {values?.nodes.map((n) =>
            n.role === 'value' ? (
              <div key={n.id} class={`hud-value tone-${n.tone ?? 'default'}`} data-node-id={n.id}>
                {n.label}
                <b>{n.value}</b>
              </div>
            ) : (
              <span key={n.id} class={`text tone-${n.tone ?? 'default'}`} data-node-id={n.id}>
                {n.label}
              </span>
            ),
          )}
        </div>
        <div class="hud-menus">
          {menus?.nodes.map((n) => (
            <Node key={n.id} n={n} ui={ui} focused={focused} />
          ))}
        </div>
      </div>
      <div class="toasts">
        {notices?.rows.map((r) =>
          r.nodes.map((n) => (
            <div key={n.id} class={`toast tone-${n.tone ?? 'default'}`} data-node-id={n.id} role="status">
              {n.label}
            </div>
          )),
        )}
      </div>
    </>
  );
}

function Sections({ sections, ui, focused, screen }: { sections: readonly UiSection[]; ui: UiController; focused: string | null; screen: string }) {
  return (
    <>
      {sections.map((s) => (
        <div key={s.id} class="section">
          {s.title && (
            <h3 class="section-title" data-node-id={`${screen}.${s.id}.title`}>
              {s.title}
            </h3>
          )}
          {s.rows.map((r) => (
            <div key={r.id} class="row">
              {r.nodes.map((n) => (
                <Node key={n.id} n={n} ui={ui} focused={focused} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Node({ n, ui, focused }: { n: UiNode; ui: UiController; focused: string | null }) {
  if (isInteractive(n)) {
    const glyph = n.glyph ? glyphFor(n.glyph, ui.device) : null;
    return (
      <button
        data-node-id={n.id}
        class={`btn ${n.role} ${n.primary ? 'primary' : ''} ${n.selected ? 'selected' : ''} ${focused === n.id ? 'is-focused' : ''}`}
        role={n.role === 'tab' ? 'tab' : undefined}
        aria-selected={n.role === 'tab' ? n.selected === true : undefined}
        aria-pressed={n.role !== 'tab' && n.selected !== undefined ? n.selected : undefined}
        aria-disabled={n.enabled === false}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onPointerEnter={() => ui.hover(n.id)}
        onClick={() => ui.activate(n.id)}
      >
        <span class="label">{n.label}</span>
        {n.value && <span class="value">{n.value}</span>}
        {glyph && <span class="glyph">{glyph}</span>}
      </button>
    );
  }
  if (n.heroType) {
    const color = colorHex[HeroTypeDisplay.color(n.heroType)];
    return (
      <span class="type-badge" data-node-id={n.id} style={{ '--type-color': color }}>
        {n.label}
      </span>
    );
  }
  if (n.role === 'heading') {
    return (
      <h3 class={`heading tone-${n.tone ?? 'default'}`} data-node-id={n.id}>
        {n.label}
      </h3>
    );
  }
  return (
    <span class={`text tone-${n.tone ?? 'default'} ${n.role === 'value' ? 'num' : ''}`} data-node-id={n.id}>
      {n.label}
      {n.value ? ` ${n.value}` : ''}
    </span>
  );
}

function glyphFor(kind: 'confirm' | 'back', device: UiController['device']): string | null {
  if (device === 'gamepad') return kind === 'confirm' ? 'A' : 'B';
  if (device === 'keyboard') return kind === 'confirm' ? 'Enter' : 'Esc';
  return null;
}
