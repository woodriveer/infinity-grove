# Infinity Grove — Design (v1)

## Status

Fast path draft. Captures the visual identity already established by the
project's existing art (`InfinityGrove/Assets/Art/UI/**`): the `infity_grove.png`
logo, `bg-full-hd*.png` forest backgrounds, `buttons.png` plaque buttons, and the
Cinzel Decorative typeface already wired into TextMesh Pro. `[ASSUMPTION]` marks
anything inferred rather than confirmed — user confirmed no additional direction
beyond these existing assets. Companion to [EXPERIENCE.md](./EXPERIENCE.md) and
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Brand & Style

Painted-illustration fantasy — a storybook/concept-art look (soft brushwork, not
flat vector), not a cartoon-cute style. The brand's central image is the
tree-of-life-as-infinity-symbol from the logo: two intertwined trunks forming an
∞, glowing with faint rune-like markings. That fusion of "infinite" and "grove" is
the throughline for new art: growth, cycles, and something ancient and a little
mysterious rather than cheerful.

Two registers already exist in the source art and should stay distinct:
- **Menu/brand register** — deep violet backdrop (as in the logo), used for
  title/menu screens and high-ceremony moments (new hero acquired, star-tier up).
- **In-world register** — the misty teal-green forest (`bg-full-hd*.png`), used
  for the actual gameplay screen behind combat and most UI.
`[ASSUMPTION]` — no third register (e.g. a distinct "dungeon"/boss backdrop) is
assumed for v1; boss stages reuse the in-world register with intensified glow/fog,
unless later art says otherwise.

## Colors

Sampled/derived from the existing assets, not invented from scratch:

| Token | Value | Use |
|---|---|---|
| `bg-menu` | `#3D2A5C` (deep violet, from logo backdrop) | Title/menu screens, ceremony overlays |
| `bg-world` | `#12241F` (deep misty forest green) | In-game backdrop |
| `accent-gold` | `#D9A94A` | Primary buttons (gold plaque), currency, headline text trim |
| `accent-gold-dim` | `#8A6A3A` (secondary wood plaque brown) | Secondary/disabled buttons, less prominent frames |
| `accent-glow` | `#7FE0C9` (firefly/rune teal) | Magic/active-state glow: abilities, active potions, fusion energy |
| `ink` | `#EFE7D8` | Body text on dark backgrounds (warm off-white, not pure white — keeps the painterly warmth) |
| `success` | `#6FBF73` | Stage clear, fusion success, positive deltas |
| `danger-power-gate` | `#C0532B` (ember/rust) | Power Gate failure state |
| `danger-mismatch` | `#5B6FD4` (indigo) | Composition Mismatch failure state — deliberately a *different hue family* from Power Gate, not just a different shade, so the two failure states are distinguishable at a glance even before reading icon/shape (NFR-3 still requires icon+shape redundancy on top of this) |

Rarity/star-tier colors `[ASSUMPTION — no existing precedent in assets, proposed
for consistency with common ARPG-itemization conventions the PRD's genre already
assumes]`: 1★ bone/gray → 2★ `accent-gold-dim` bronze → 3★ `accent-gold` gold →
4★ `accent-glow` teal → 5★ a reserved deep magenta/violet (`#A64CA6`) tying back
to the brand's violet register for the top tier.

## Typography

Cinzel Decorative is ornate and reads beautifully at large sizes (logo, hero
names, screen titles) but is illegible for dense or fast-changing text — and this
genre lives or dies on fast-changing numbers. Pairing:

- **Display — Cinzel Decorative** (existing): game title, screen headers, hero
  names, star-tier-up ceremony text. Not used below ~24pt.
- **Body/narrative — a legible companion serif** `[ASSUMPTION]`: e.g. *Spectral*
  or *Cormorant Garamond* (Google Fonts, free) for flavor text, tooltips,
  descriptions — keeps the fantasy-book feel at readable sizes.
- **Numeric/HUD — a tabular-figure sans** `[ASSUMPTION]`: e.g. *Inter* with
  `tnum` tabular figures enabled, for gold counters, damage numbers, stage
  numbers, and any big-number (scientific-notation) display. Digits must not
  visually jitter in width as they change on every tap — this is a hard
  requirement given FR-9/FR-25's tap-driven, constantly-updating numbers, not a
  cosmetic nicety.

## Layout & Spacing

Screen Space Canvas (per existing project setup), designed for 16:9 first.
`[ASSUMPTION — open question]`: ultrawide/other-aspect support is not yet
decided; assume 16:9 with pillarboxing fallback until confirmed. Spacing scale
follows the proportions already baked into `buttons.png`'s hexagonal-cut
plaques — treat that plaque's corner-cut ratio and internal padding as the base
unit for all new panel/card frames, so new UI matches the existing button
geometry rather than introducing a second grid system.

## Elevation & Depth

No flat Material-style drop shadows or cards. Depth reads through:
- **Parallax** forest layers (the project already has `bg-full-hd` vs
  `bg-full-hd-clean` variants — the clean one is the gameplay backdrop layer,
  with foreground foliage/fireflies composited above UI-safe areas).
- **Glow**, not shadow, as the primary depth cue for anything magical (fusion
  energy, active potion buffs, rune borders) — reuses the existing Fireflies
  shader graph's bloom language.
- **Carved-plaque relief** for UI chrome: buttons and panel frames read as
  physically carved wood/gold objects (per `buttons.png`), not flat layered
  cards — bevels and an inner-shadow groove, not a drop shadow underneath.

## Shapes

- **Hexagonal-cut plaque** (from `buttons.png`) is the primary silhouette for
  buttons and primary CTAs.
- **Rounded-rect with gold trim** for cards and panels (hero cards, equipment
  slots, dialogs) — an ornate double-border (thin gold line + thicker carved
  frame), consistent with the logo's gold lettering treatment.
- **Circular node** for the stage-select map (path nodes connected by a trail,
  echoing the forest path in `bg-full-hd-clean.png`).

## Components

- **Primary Button** — gold plaque (enabled/primary actions); **Secondary
  Button** — brown/bronze plaque (secondary or de-emphasized actions); both from
  `buttons.png`'s two existing variants. Disabled state desaturates further, not
  just dims, to stay distinguishable from "secondary."
- **Hero Card** — portrait, name in Cinzel Decorative, star-tier pips using the
  rarity colors above, a type/element icon badge (see Do's and Don'ts — icon
  shape, not color alone), duplicate-count badge when on the Fusion screen.
- **Currency/Power Readout** — gold coin icon + tabular numeric text, always
  using the shared big-number formatting (see EXPERIENCE.md).
- **Stage Node** — circular node on the map trail; locked (dim/no glow), current
  (gold glow pulse), cleared (small checkmark/star), each stage node also carries
  its rotating modifier as an icon badge.
- **Fusion Panel** — current tier, duplicates owned vs. required (progress arc in
  `accent-glow`), ability-gain preview, and an explicit irreversible-action
  confirmation step (fusion permanently consumes cards — FR-7).
- **Equipment Slot** (×4: weapon/chest/boots/gloves) — icon silhouette per slot
  type, affix summary on hover/focus, empty-slot state visually distinct from
  filled.
- **Loadout Preset Tabs** — Strength / Intelligence / Agility, one-tap apply.
- **Potion Bar** (boss stages only) — up to 4 consumable slots, cooldown/charge
  state per potion, hidden entirely outside boss encounters (not just disabled).
- **Failure Banner** — two visually distinct treatments per NFR-3: Power Gate
  uses `danger-power-gate` + a closed-gate/lock icon + a solid-block shape
  language; Composition Mismatch uses `danger-mismatch` + a crossed-swords/
  mismatched-puzzle icon + an angular "clash" shape language. Color, icon, and
  shape all differ between the two — never color alone.
- **Market Compare Row** — "Buy on Market" (live price, opens Steam Overlay) and
  "Buy Direct" (fixed Summoning Stone price, in-game purchase flow) shown
  side by side per FR-29.
- **Sync Toast** — a small, calm (not alarm-styled) notification used only when
  a locally optimistic action is corrected after server reconciliation
  (AD-6 in ARCHITECTURE.md); uses `ink`/neutral tones, never `danger-*` colors,
  since this is routine plumbing, not a player-facing failure.

## Do's and Don'ts

- **Do** keep Cinzel Decorative for display only; **don't** ever set body copy,
  tooltips, or numeric HUD text in it.
- **Do** pair every type/modifier and every failure state with a distinct icon
  and shape, not color alone (NFR-3). **Don't** ship a colorblind-only
  distinction anywhere in stage-modifier or failure-state UI.
- **Do** use tabular/monospaced-figure numerals everywhere big numbers update
  live. **Don't** let digit width jitter during rapid tap-driven updates.
- **Do** treat the Sync Toast as calm/neutral. **Don't** style routine
  server-reconciliation corrections as errors — that would make ordinary offline
  play feel punishing.
- **Do** keep the violet menu register reserved for ceremony/ ""big moment""
  screens (new hero, star-tier up, Season Cave entry). **Don't** use it as a
  generic panel background — that dilutes the moments it's meant to mark.

---

## Appendix — Asset Generation Prompts (Gemini / Nano Banana)

The PRD's biggest production risk (§10) is animation/art coverage — every new
hero needs a full kit, star tiers need visible differentiation, and several new
icon sets don't exist yet. Below are ready-to-use, detailed prompts sized for an
image model (Gemini "Nano Banana"), written to match the existing painted-
fantasy style sampled above. Generate each, then hand-trace/clean up in a sprite
tool for animation-ready assets — these prompts produce concept/key art and
still frames, not rigged animation.

**1. Second starter hero (to reach the 3–5 starters FR-1 requires)**
> Painted fantasy game character concept art, full body, front-facing idle pose,
> a young forest ranger with a bow, wearing weathered leather and moss-green
> cloth, dark auburn hair, calm confident expression. Semi-realistic painterly
> illustration style with soft brushwork, muted teal-green and warm brown
> palette, faint bioluminescent teal rune glow on a bracer, ambient forest fog
> lighting from behind. Clean, isolated on a plain dark teal background suitable
> for sprite extraction, no border, no text, no watermark. Match the style of a
> mystical enchanted-forest idle RPG with gold-and-bronze fantasy UI.

**2. Third starter hero (mage archetype)**
> Painted fantasy game character concept art, full body, front-facing idle pose,
> an elderly forest druid mage leaning on a gnarled wooden staff topped with a
> small glowing crystal, deep green and violet robes with gold trim embroidery,
> long silver beard, wise weathered face. Semi-realistic painterly illustration,
> soft brushwork, muted teal-green and deep violet palette, faint glowing teal
> runes along the staff, soft ambient forest light. Isolated on a plain dark
> teal background for sprite extraction, no border, no text, no watermark.

**3. Rarity/star-tier card frame set (1★–5★)**
> A set of five ornate fantasy trading-card border frames arranged in a row,
> carved wood-and-gold engraved style matching a mystical forest theme, each
> frame slightly more elaborate and glowing than the last: frame 1 plain bone-
> gray wood with simple gold corner studs, frame 2 bronze wood with vine
> engravings, frame 3 rich gold wood with leaf-and-rune engravings and a soft
> gold inner glow, frame 4 gold frame with glowing teal bioluminescent rune
> inlay, frame 5 a deep violet-and-gold frame with intricate infinity-symbol
> engravings and a strong violet glow. Flat front-on view of each frame, empty
> center (transparent/plain dark background) for card art insertion, no text,
> no watermark, consistent proportions across all five.

**4. Stage-modifier type icons**
> A set of six distinct fantasy elemental type icons arranged in a grid, each a
> simple bold engraved-metal emblem readable at small size: a flame emblem
> (Fire), a water droplet with wave engraving (Water), a leaf-and-vine emblem
> (Nature), a lightning-bolt-through-a-rune emblem (Storm), a crescent-moon-
> with-stars emblem (Arcane), and a mountain-with-crack emblem (Stone). Each
> icon carved in gold metal on a small round bronze medallion background,
> consistent style, high silhouette clarity so each icon reads by shape alone
> even in grayscale, no text, no watermark, matching a mystical forest fantasy
> game's UI language.

**5. Failure-state icons (Power Gate vs. Composition Mismatch)**
> Two fantasy UI icons side by side, painted/engraved metal style: left icon is
> a closed, barred stone gate wrapped in dead vines glowing faint ember-orange,
> representing "blocked, not strong enough yet" — solid, heavy, blocklike
> silhouette. Right icon is two mismatched crossed swords with a small cracked-
> puzzle-piece motif between them glowing indigo-blue, representing "wrong
> approach, not a strength problem" — angular, clashing silhouette clearly
> different in shape from the left icon. Both icons on small round bronze
> medallion backgrounds matching the type-icon set, no text, no watermark.

**6. Currency/gold coin icon**
> A single fantasy gold coin icon, engraved with a small tree-of-life-as-
> infinity-symbol motif matching a game logo, warm gold metal with a subtle
> engraved leaf border, soft rim light, isolated on a plain dark background, no
> text, no watermark, matching a mystical enchanted-forest game's UI style.

**7. Stage-select world map background**
> A wide, top-down/isometric-hybrid painted fantasy map of a mystical forest
> region, showing a winding glowing path connecting several clearings and
> ancient tree landmarks, soft teal bioluminescent fireflies scattered along the
> path, deep misty teal-green palette matching a forest game background,
> painterly illustration style, no UI elements, no text, no watermark, wide
> aspect ratio suitable for a game map screen background.

**8. Season Cave key art**
> A painted fantasy key-art illustration of a mysterious glowing cave entrance
> deep in an ancient forest, entrance framed by twisted roots shaped subtly like
> an infinity symbol, strong violet and teal bioluminescent glow emanating from
> within the cave contrasted against a dark forest exterior, sense of mystery
and competitive challenge, painterly illustration style matching an
> enchanted-forest idle RPG, wide aspect ratio, no text, no watermark.
