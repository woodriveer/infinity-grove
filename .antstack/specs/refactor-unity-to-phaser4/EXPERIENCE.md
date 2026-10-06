# Refactor: Unity Client → Phaser 4 — Experience

## Status

This is a delta document. Behavior is **inherited unchanged** from
[`../infinity-grove/EXPERIENCE.md`](../infinity-grove/EXPERIENCE.md), under design freeze
(PRD S6). This file covers what the re-platform changes or adds:

- the parity-scope IA;
- device-agnostic input and focus;
- Steam Deck and overlay lifecycle;
- the semantic `describe()` contract that makes behavior agent-verifiable.

Visual tokens are named from [DESIGN.md](./DESIGN.md). Mechanics come from
[ARCHITECTURE.md](./ARCHITECTURE.md). `[ASSUMPTION]` marks inferred decisions.

**One deliberate override of the parent:** the parent marked keyboard as optional and
mouse as primary. PRD S3/RFR-43 now make **mouse, keyboard and gamepad equally complete**
on every parity screen. This is a platform requirement, not a game-design change.

## Foundation

- **Form factor:** multi-surface desktop. It covers Windows 10/11 (mouse + keyboard,
  optional gamepad) and Steam Deck in Game Mode (built-in controls + touchscreen, 1280×800
  16:10). Development and testing also run it in a browser. That is not a shipped surface.
- **UI system:** a Phaser 4 world canvas. Menus are either Preact DOM overlays or
  Phaser-drawn, decided by the Roster gate (RFR-48). Behavior below is written to hold for
  both.
- **Connectivity:** unchanged. Everything renders from local state and syncs in the
  background (parent AD-6). Crafting is local at parity (ARCHITECTURE AD-22).

## Information Architecture (parity scope, P1–P15)

```
Main Menu (P1) ── Play ──▶ Game Scene (persistent; idle sim never pauses for overlays)
                            ├─ HUD: gold (formatBig), stage, offline/sync indicator
                            ├─ Combat View (P2, P3)
                            ├─ Stage Select overlay (P9)
                            ├─ Roster overlay (P4, P15) ──▶ Fusion panel (P5)
                            ├─ Equipment overlay (P6) ── Crafting panel (P7) ── Preset tabs (P8)
                            ├─ Offline Accrual summary (P10, on launch)
                            └─ Sync Toast (P12, on reconciliation correction)
```

The parent IA items *outside* parity are **not built** in this refactor: Starter
Selection, Market, Season Cave and Potion Bar. Their entries are not shown as disabled
placeholders either. They don't exist until their game-PRD feature lands (PRD §4).

**Overlay stack rule:** at most one overlay plus one panel (e.g. Roster → Fusion). `back`
always pops exactly one level. `back` on an empty stack does nothing in the Game Scene;
it never quits.

## Voice and Tone

Unchanged from the parent. New microcopy introduced by the port:

| Context | Copy |
|---|---|
| Controller glyph hints | Verb only: "Fuse", "Back", "Swap" (no "Press A to…") |
| Quit while unsynced | "Saving your progress…" (shown at most 3 s, then quits; progress stays in the save) |
| Overlay purchase pending (readiness only, RFR-34) | Not player-visible at parity |

## Component Patterns (behavioral deltas)

- **Every interactive element is a semantic node.** It appears in the screen's
  `describe()` with `role` (`button|tab|listitem|slot|toggle|text|value`), a
  human-readable `label`, `enabled`, `value` and `focused`. A disabled button's label or
  `value` states *why* (e.g. "Fuse — needs 3 duplicates, have 2"). This rule exists because
  e2e tests assert on these strings (RFR-16).
- **Tap-to-swap (Roster, Equipment)** maps to `confirm` on a source node, then `confirm` on
  a target. With a source picked, `back` cancels the pick instead of closing the overlay.
  Mouse click, Enter and gamepad A are interchangeable.
- **Fusion confirm** (irreversible, parent FR-7): the confirm dialog opens with focus on
  **Cancel**, never on Fuse, so a double-press of A can't consume cards.
- **Tabs** (loadout presets, equipment slots): LB/RB, Q/E or a click switches tabs. Focus
  moves to the first item of the new tab.
- **Combat attack:** a mouse click on the combat area, Space, or gamepad A while focus is
  on the Combat View. A *held* button does not auto-repeat attacks `[ASSUMPTION — keeps
  parity with Unity click-per-hit]`.

## State Patterns

Unchanged categories (loading / empty / error-offline / success). Port-specific states:

- **Boot:** first frame shows the local save. While fonts and atlases load, a
  `bg-menu` splash with the logo appears. There is no spinner on returning players. Steam
  auth and sync run silently afterward.
- **Steam overlay open:** game input is suspended (ARCHITECTURE AD-16) and the idle sim
  keeps running. No in-game "paused" banner is shown.
- **Suspend/resume (Deck sleep, minimized window):** on resume, elapsed time is applied
  through the catch-up path. If more than 60 s passed `[ASSUMPTION — matches AD-6 cap]`,
  the Offline Accrual summary is shown, the same as at launch.
- **No gamepad focus target:** if a screen has no enabled node, focus rests on the
  overlay's close/back node. Focus is never lost to "nothing".

## Interaction Primitives

| Semantic action | Mouse | Keyboard | Gamepad / Deck |
|---|---|---|---|
| `navigate` | hover moves focus | Arrow keys / WASD | D-pad / left stick |
| `confirm` | left click | Enter / Space | A |
| `back` | right click or close (×) node | Esc | B |
| `tabPrev` / `tabNext` | click tab | Q / E | LB / RB |
| `openMenu(roster\|equipment\|stages)` | HUD buttons | R / I / M | Y opens a radial or HUD row focus `[ASSUMPTION]` |
| `attack` | click combat area | Space (Combat View focused) | A (Combat View focused) |

- **Last-used device** decides glyph hints and pointer-hover focus. A mouse move shows the
  cursor and hides the glyphs. Any key or button press hides the cursor and shows the
  focus ring.
- **Touch (Deck screen):** behaves like a mouse click on that node. It is not required by
  any AC, but must not break.
- No action requires a pointer, a hold, a chord or a double-press.

## Accessibility Floor

The parent floor applies unchanged: never color alone (NFR-3), no twitch precision,
tap-to-swap. The port adds:

- **Full non-pointer operability** on every parity screen (RFR-43), proven by a
  gamepad-only and a keyboard-only e2e walk per screen.
- **Visible focus at all times** in keyboard/gamepad mode: exactly one `focus-ring` (see
  DESIGN.md).
- **Readable on a 7" screen:** the DESIGN.md minimum sizes are measured at Deck scale.
- **Reduced motion:** honors `prefers-reduced-motion`. It stops the focus pulse and reduces
  fireflies; the gameplay feedback (damage numbers) stays.
- **`describe()` doubles as an accessibility tree.** Labels are written for a person, not
  for an ID.

## Agent Operability (product-specific section)

The build team (developer + Claude Code) is the primary user of this refactor (PRD §2).
Their surface is not a screen but a set of terminal-reachable behaviors:

- **Reach any state in one step:** `?scene=<screen>&save=<fixture>&seed=<n>&clock=manual`
  (dev/test builds only).
- **Read the screen as data:** `window.__ig.describe()` returns the semantic tree above.
- **Act like a player:** `__ig.input(action)` injects semantic actions or raw
  keyboard/gamepad events. `__ig.advance(ms)` moves the manual clock.
- **Look when needed:** screenshots are saved per screen and state for inspection. They
  never gate CI.

## Key Flows

**1. Rafa plays on the couch with a Steam Deck.**

1. Rafa launches the game from Game Mode. The logo splash shows, then their game from last
   night.
2. With the D-pad they open Roster (Y → Roster), move focus with the stick, and press A on
   a benched Ranger. Then A on an Active Squad slot: swap done.
3. They press B twice and are back in combat. A taps attack.
4. They put the Deck to sleep mid-fight and walk away for two hours.
5. **Climax beat:** they wake the Deck and the Offline Accrual summary shows two hours of
   gold. Nothing was lost to suspend, and they never touched the touchscreen.

Failure path: if the backend is unreachable on wake, the offline indicator appears and
play continues. Sync happens later, silently.

**2. Mara fuses with the keyboard only.**

1. Mara presses R (Roster) and uses the arrow keys to reach a hero marked fusable, then
   presses Enter.
2. The Fusion panel's Fuse button is focused and reads "Fuse — 3/3 duplicates". She
   presses Enter.
3. The confirm dialog opens with focus on **Cancel**.
4. **Climax beat:** her habitual second Enter lands on Cancel, not Fuse. She reads "This
   permanently consumes 3 duplicates", moves to Fuse deliberately, and confirms. The
   irreversible-action guard survives keyboard muscle memory.

**3. Claude Code verifies the Fusion screen with no human in the loop.**

1. The agent runs `npm run test:e2e`. Playwright opens
   `?scene=fusion&save=fusion-ready&seed=42`.
2. It calls `__ig.describe()` and asserts the Fuse button is enabled with a label naming
   3/3 duplicates.
3. It injects gamepad A. The confirm dialog opens and `describe()` shows focus on Cancel.
   It then injects navigate → Fuse, A.
4. **Climax beat:** `describe()` now shows the new star tier, and the sim log shows exactly
   one fusion event. The feature is proven by terminal output alone.

Failure path: an unreachable button fails the focus-walk test with the screen and node
label named in plain text (RNFR-11).

## Open Questions

- The gamepad mapping for `openMenu` (Y radial vs. focusing a HUD row) is
  `[ASSUMPTION]`. Settle it during the Roster gate on a real Deck.
- Text-scale option and ultrawide: still open, carried from the parent.
- Whether a held attack button should auto-repeat is assumed **no** for parity. A change
  would be a game-PRD decision.
