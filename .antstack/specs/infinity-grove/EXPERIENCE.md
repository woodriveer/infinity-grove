# Infinity Grove — Experience (v1)

## Status

Fast path draft, companion to [DESIGN.md](./DESIGN.md) (visual tokens referenced
by name below) and [ARCHITECTURE.md](./ARCHITECTURE.md) (the client/server sync
model referenced in State Patterns). `[ASSUMPTION]` marks inferred decisions.

## Foundation

- **Form factor:** PC desktop, Steam release. Mouse + keyboard primary input;
  the project's existing Input System `Player` action map (Move/Look/Attack/
  Interact/etc.) already anticipates more than a pure point-and-click surface —
  `[ASSUMPTION]` v1 UI itself is mouse-and-click-driven (per FR-9's tap model),
  keyboard shortcuts are a nice-to-have, not required for any flow.
- **UI system:** Unity UGUI + TextMesh Pro, Screen Space Canvas (existing
  project setup). No third-party UI framework assumed.
- **Resolution target:** 16:9 primary `[ASSUMPTION — open question, see
  DESIGN.md Layout & Spacing]`.
- **Connectivity model:** Per ARCHITECTURE.md AD-6, the game is fully playable
  offline; all screens below must render from locally cached state first and
  reconcile silently in the background — no screen may block on a network call
  except the flows explicitly marked "online-required" below (Market listing/
  purchase, which are inherently a Steam-online action).

## Information Architecture

```
Main Menu
 ├─ New Game → Starter Selection (FR-1) → Game Scene
 └─ Continue → Game Scene

Game Scene (persistent — the idle sim keeps running underneath every overlay below)
 ├─ HUD (always visible): Gold/Power readout, current stage, notification bell
 ├─ Combat View (center): active hero + monster, tap-to-attack, potion bar (boss only)
 ├─ Stage Map (overlay): node trail, modifier badges, Power Gate/Mismatch risk hint
 ├─ Roster (overlay): Active Squad (5) ⇄ Bench (unlimited), tap-to-swap
 ├─ Fusion (overlay, opened from a hero card): duplicate progress, confirm-to-fuse
 ├─ Equipment & Crafting (overlay): 4 slots per active hero, shared bag, preset tabs
 ├─ Market (overlay, online-required to transact): Buy on Market / Buy Direct compare
 └─ Season Cave (overlay, unlocked at card-count gate): ranked entry, leaderboard/race state
```

Overlays layer on top of the Game Scene rather than replacing it as a new scene
— the idle sim (gold accrual, background combat resolution) never pauses just
because a player opened Roster or Fusion. `[ASSUMPTION]` — the only state that
*does* pause the underlying view is a modal confirmation (e.g. the fusion
confirm step), which blocks further taps until resolved but does not stop
accrual.

## Voice and Tone

Warm, wondrous, slightly ancient-and-mysterious storybook narrator — matching
the logo's tone (an infinity-tree wrapped in glowing runes), not a cutesy or
snarky idle-game voice. Flavor text (hero bios, stage names) can lean lyrical.

**One deliberate exception:** failure-state copy (Power Gate vs. Composition
Mismatch, FR-11) drops the lyrical voice entirely and states the cause in plain,
literal language — "Your squad isn't strong enough yet. Grind for more power."
vs. "Wrong team for this stage's [Fire] modifier. Swap your squad." The PRD is
explicit that a loss must never read as ambiguous; flavor text is the wrong tool
there.

## Component Patterns

(Visual specs for each component live in DESIGN.md's Components section — this
covers behavior only.)

- **Tap-to-attack:** every tap registers an immediate local damage number and
  hit animation with zero perceived latency (optimistic, per ARCHITECTURE.md
  AD-6) — never waits on a server round-trip. Once a hero is unlocked its
  automation continues the same attack loop without further taps; manual taps
  always add on top of automation (FR-9), never replace it.
- **Fusion:** open from a hero card → panel shows tier/duplicates/ability
  preview → player taps Fuse → a confirmation step states plainly that the
  duplicates will be **permanently consumed** (FR-7) → on confirm, plays a
  ceremony beat (violet register, DESIGN.md) → result. No accidental single-tap
  fusion; the irreversible action always has one extra confirmation step.
- **Squad management:** tap a bench hero → tap an Active Squad slot to place
  (tap-to-swap, not drag) `[ASSUMPTION — chosen over drag-and-drop for
  precision/accessibility reasons, see Accessibility Floor]`. Attempting a 6th
  active hero doesn't silently fail — it prompts "Bench someone first" and
  highlights the 5 current slots as swap targets (FR-3 AC).
- **Stage select:** every node shows its modifier badge before entry (FR-10);
  the current Active Squad's predicted risk (Power Gate-likely vs. Mismatch-
  likely vs. clear) is shown as a small inline hint before the player commits
  to entering (FR-46) — this is a hint, not a guarantee, since actual gate vs.
  mismatch is still determined by the real combat rules.
- **Market panel:** "Buy on Market" opens the Steam Overlay (Valve's own
  purchase UI — the game does not reimplement Market UI); "Buy Direct"
  (Summoning Stone) uses the in-game purchase flow. Both prices shown side by
  side (FR-29). This is the one flow that requires connectivity to act on
  (though the comparison view itself renders from cached price data if offline,
  clearly marked stale).
- **Sync correction toast:** appears only when a background reconciliation
  (AD-6) actually changes something the player saw locally — e.g. a fusion the
  server rejected. Calm styling (DESIGN.md), plain-language explanation, and a
  link to "why" (brief, factual, never blaming the player).

## State Patterns

- **Loading:** app launch shows the locally cached state immediately (no
  blocking spinner for returning players); Steam auth + background sync happen
  silently after. A blocking loading state is reserved for genuinely new
  state — first-ever launch (starter selection can't be skipped) and restoring
  onto a fresh device with no local cache (Steam Cloud pull).
- **Empty:** a fresh roster (starter only) shows Bench as an inviting empty
  state — "Clear stages to find more heroes" rather than a bare empty list.
  Equipment bag empty state similarly guides toward the next action instead of
  looking broken.
- **Error / offline:** loss of connectivity is *not* an error state for combat,
  roster, fusion, or crafting — those keep working from local state per the
  Foundation section. A small persistent, non-blocking "Offline — will sync"
  indicator sits near the HUD notification bell. Only Market purchase/listing
  surfaces an explicit "connect to Steam to trade" state, since that's
  inherently online-only.
- **Success:** stage clear reward popup, fusion ceremony, boss-defeat sequence,
  new-hero-acquired ceremony (violet register per DESIGN.md) — each of these is
  a "big moment" and gets the ceremony treatment, not a toast.

## Interaction Primitives

- **Click/tap:** primary input for attack, all UI navigation, tap-to-swap squad
  management.
- **Hover:** desktop-only affordance for equipment affix tooltips, card detail
  peeks, and Market price context — a PC-native advantage not available if this
  were ever ported to touch, noted here so it isn't accidentally treated as
  optional chrome.
- **Keyboard:** `[ASSUMPTION]` optional shortcuts only (e.g. a hotkey to open
  Roster) — never required to complete any flow, since the existing Input
  System action map is not yet proven out for full UI navigation.
- **Boss potions:** activated via explicit click on the potion bar during the
  encounter only (FR-14); timing windows should be generous rather than
  twitch-precise, keeping the "active layer" a real decision rather than a
  reflex test (ties to Accessibility Floor below).

## Accessibility Floor

- **Never color-alone:** every stage-type modifier and every failure state
  (Power Gate vs. Composition Mismatch) pairs a distinct icon and shape with its
  color (NFR-3; icon/shape assets specified in DESIGN.md's Appendix prompts
  #4–5). This is a hard requirement, not a nice-to-have, since FR-11's whole
  point is that a loss must never be ambiguous — a colorblind player reading it
  wrong is exactly that failure.
- **No twitch-precision requirement:** the core loop is idle-friendly by design;
  boss potion timing windows must stay generous enough that reaction speed is
  never the actual gate on progress.
- **Tap-to-swap over drag-and-drop** for squad/equipment management, avoiding
  fine-motor drag precision as a requirement.
- **Text scaling:** `[ASSUMPTION — open question]` whether a UI text-scale
  option ships in v1 is not decided; flagged for a follow-up decision rather
  than assumed either way.

## Key Flows

**1. Mara hits her first real wall.**
Mara has been clearing stages steadily with her starter squad. She hits a stage
that fails twice in a row. The failure banner is unambiguous both times: ember-
orange, gate icon, "Your squad isn't strong enough yet." She grinds two earlier
stages for gold and gear, comes back stronger, and clears it. *Climax beat:* the
moment she reads the Power Gate banner and immediately knows what to do next —
no confusion about whether her team choice was wrong.

**2. Theo fuses a hero and has to decide: keep or sell.**
Theo's third duplicate of a hero drops. He opens Fusion, sees the ability
preview for the next star tier, and confirms — the ceremony plays, and the
duplicate is gone for good. Right after, he opens that hero's card and sees his
now-fewer remaining duplicates alongside the Market's live price for that card
compared to the Summoning Stone ceiling price. He decides the price is good and
lists one. *Climax beat:* the moment the Fusion confirm step reminds him the
consumption is permanent, right before he commits — the game never lets that
surprise him after the fact.

**3. Priya enters Season Cave for the first time.**
Priya crosses the card-count threshold and the Season Cave becomes available.
Entering shows the violet ceremony register — this is a "big moment" screen,
distinct from ordinary gameplay. Her account power is normalized; she sees her
star-tier quality is now what actually differentiates her from other entrants,
not the account level she'd been grinding. *Climax beat:* the moment the power
normalization lands and she realizes her fusion choices — not her play-time —
are what will decide her ranked run.

## Open Questions

- Ultrawide/non-16:9 resolution support (ties to DESIGN.md Layout & Spacing).
- Whether a UI text-scale accessibility option ships at v1 or is deferred.
- Whether any keyboard-only navigation path is required for v1 or genuinely
  optional, pending broader accessibility review beyond the NFR-3 floor above.
