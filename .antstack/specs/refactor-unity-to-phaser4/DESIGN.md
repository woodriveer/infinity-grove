# Refactor: Unity Client → Phaser 4 — Design

## Status

This is a delta document. Visual identity is **inherited unchanged** from
[`../infinity-grove/DESIGN.md`](../infinity-grove/DESIGN.md): brand, registers, color
tokens, shapes, components, do's and don'ts. This file records only:

- how those tokens map onto the new render media (Phaser canvas + optional DOM layer);
- the visual elements the port adds because of new requirements (controller focus, 16:10
  Steam Deck screen);
- the fidelity items the developer signs off by eye (PRD S5, RFR-44).

Confirmed in this phase:

- Steam Deck 16:10 is handled as a 16:9 safe frame with extended background.
- Inter (tabular figures) is added for numerics.
- The focus indicator is an `accent-glow` halo.

On conflict, the parent DESIGN.md wins on identity and this file wins on rendering
mechanics.

## Brand & Style

Unchanged: painted fantasy, with the violet menu register and the teal forest in-world
register. The port must not drift toward a flat or "web app" look, even though menus may
be HTML (ARCHITECTURE AD-15). DOM menus use the same plaque and frame bitmaps as the
canvas, never CSS-only approximations of them.

## Colors

- **Single source.** Every parent token (`bg-menu`, `bg-world`, `accent-gold`,
  `accent-gold-dim`, `accent-glow`, `ink`, `success`, `danger-power-gate`,
  `danger-mismatch`, star-tier colors) is defined once in
  `presentation/theme/tokens.ts`. It is emitted as CSS custom properties (`--ig-accent-gold`)
  and as Phaser numeric colors (`0xD9A94A`). Hex literals outside that file fail lint.
- **New token `focus-ring`:** an alias of `accent-glow` (`#7FE0C9`), used only for
  controller/keyboard focus.
- **New token `letterbox-fill`:** an alias of `bg-world`, shown only if a background asset
  is missing in the extended area.

## Typography

| Role | Face | Rule |
|---|---|---|
| Display | **Cinzel Decorative** (existing `.ttf` → bundled `woff2`) | Titles, hero names, ceremony text. Never below 36 px logical (24 px physical on Deck). |
| Numeric / HUD | **Inter**, `font-variant-numeric: tabular-nums` (bundled `woff2`) | Gold, damage numbers, stage numbers, every `formatBig()` output. **New vs. Unity; needs S5 sign-off.** |
| Body | Inter (regular) for parity `[ASSUMPTION]` | The parent's companion serif (Spectral/Cormorant) is deferred to a game-PRD change. |

- Fonts are bundled and never loaded from a CDN, because the game must work offline.
  Phaser text waits for `document.fonts.load()` before first render, so no fallback-font
  flash shows in the canvas.
- **Gradient button text** (TMP gradient): `background-clip: text` with a linear gradient
  in DOM, or a canvas `CanvasGradient` fill on Phaser `Text`. Both use `accent-gold` → a
  lighter gold stop, with the exact stops sampled from Unity `Button.prefab` at sign-off.

## Layout & Spacing

- **Logical safe frame:** 1920×1080 (16:9). All UI is positioned inside it.
- **Extended area:** on 16:10 (Steam Deck 1280×800) or other aspects, the canvas expands
  beyond the safe frame. Background layers (`bg-full-hd*`, the menu backdrop) cover the full
  window and are anchored at the center. No UI, HUD or interactive element sits outside the
  safe frame.
- **Minimum sizes (logical px):** body/numeric text 24 and interactive targets 64×64.
  On Deck the scale factor is 0.667, giving 16 px text and 43 px targets.
- **Spacing base unit:** unchanged (the `buttons.png` plaque corner-cut ratio). Expressed
  as `space-1…space-6` tokens in `tokens.ts`.

## Elevation & Depth

Unchanged principles: parallax, glow over shadow, carved-plaque relief. Mechanics:

- Glow uses Phaser 4 filters (Glow/Bloom) on the canvas and layered `box-shadow` with
  `focus-ring`/`accent-glow` color in DOM. No `drop-shadow` underneath panels.
- Fireflies use additive particles plus a glow filter, with parameters in
  `content/effects/fireflies.json` (ARCHITECTURE AD-9). They can be disabled in low-spec
  mode and tests, and they use the same visual language as the Unity Shader Graph.
- Scene lighting uses the Phaser 4 Lighting component only where Unity used URP 2D lights.
  Elsewhere it is baked into the background art.

## Shapes

Unchanged (hexagonal-cut plaque, gold-trim rounded frames, circular stage nodes). In
DOM, frames use 9-slice `border-image` from the existing bitmaps. In Phaser, they use
`NineSlice`. Both read the same slice insets from `content/ui/frames.json`.

## Components

Visual specs are inherited from the parent. Port-specific additions:

- **Focus Ring (new):** a 3 px `focus-ring` outline that follows the element's shape
  (plaque or rounded frame), plus an outer `focus-ring` glow at 40% opacity and a slow
  1.6 s pulse (static when reduced-motion is set). It must never use `accent-gold`, so
  focus can't be mistaken for "primary button". Exactly one focus ring is visible at a
  time.
- **Controller Glyph Hint (new):** small button glyphs (A/B/LB/RB, or Enter/Esc on
  keyboard) next to primary and back actions. They are shown only while the last input
  device was a gamepad or keyboard, and hidden on mouse use. Glyph set: Xbox-style
  `[ASSUMPTION]`, which Steam Input remaps on the Deck.
- **Offline Indicator / Sync Toast:** unchanged visuals (calm, `ink`, never `danger-*`).

## Fidelity sign-off list (RFR-44)

Each item is approved by eye from side-by-side screenshots (Unity vs. Phaser, same
fixture state). Results are recorded in `FIDELITY.md`.

| Item | Phaser technique | Acceptable difference |
|---|---|---|
| Krell idle/walk/punch | Aseprite-JSON animation from re-sliced sheets | Frame timing within one frame |
| Fireflies | Particles + glow filter | Motion feel and color; exact particle paths don't matter |
| Scene lighting | Lighting component or baked | Overall mood |
| Cinzel Decorative | Web font, bundled | Hinting and anti-aliasing differences |
| Gradient button | CSS / canvas gradient | Gradient stops |
| Backgrounds and card frames | Same bitmaps, 9-slice | None in the safe frame |
| Inter numerics (new) | Web font, tnum | n/a: a new element, approved on its own merit |

## Do's and Don'ts

- **Do** take every color from `tokens.ts`. **Don't** hard-code hex values in a view, a
  CSS file or a Phaser call.
- **Do** keep all interaction inside the 16:9 safe frame. **Don't** place UI in the
  Deck's extended area.
- **Do** use the focus-ring *treatment* (shape-following outline + pulse) only for focus.
  **Don't** apply it to "selected" or "active" states. Those keep the parent's fill and
  glow language, even though they share the teal hue.
- **Do** reuse the Unity bitmaps for frames and plaques in both media. **Don't**
  approximate them with CSS borders or gradients.
- The parent DESIGN.md do's and don'ts all still apply.
