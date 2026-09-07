# Infinity Grove — Briefing

## Status

Real launch planned (paid, PC/Steam first). Not a hobby/portfolio project — treat
competitive positioning and monetization as load-bearing, not decorative.

## The problem being solved

In the user's words: idle/incremental clickers ("a coal-mining idle game — mine, buy
more miners, mine faster") are a proven genre, but most of them are pure number-go-up
with no meaningful decisions. Infinity Grove wants to keep that compounding-economy
fantasy while adding real strategic choice on top of it: which heroes to run, which
cards to swap in to clear a stage, and — eventually — a player-driven economy where
cards have value because other players will pay for them.

The founding tension the project is testing: **can an idle clicker also be a
strategy game, and can it be worth paying for once instead of running on IAP/gacha
like most of the genre?**

## Target audience

Idle/incremental genre fans who already play games like Clicker Heroes or Melvor Idle
and want more depth than those games give them — people who like watching numbers
compound, but who also want tactical decisions (card loadouts, hero
evolution/carryover) rather than pure passive number-watching.

## Competitive / market context

Named reference points: Clicker Heroes, Melvor Idle, Idle Champions of the Forgotten
Realms, and (from the original concept doc) generic "coal-mining" idle games. Per the
user, none of these come close to what differentiates Infinity Grove:

- **Heroes evolve/reset across stages** rather than just accumulating — clearing a
  stage can mean re-investing or transforming your roster to push the next stage,
  not just stacking more automation on top of the last one.
- **Card swapping as a strategic layer** — passing a stage involves choosing which
  cards to run, not just clicking faster. This is the project's explicit pitch for
  not being "just a clicker."
- **A player-to-player card economy via the Steam Community Market** — cards
  wouldn't only drop and get consumed; players could buy/sell them, so progression
  speed becomes partly a market decision, not just a grind decision.

One caveat worth flagging honestly: a naming-research pass (pasted into the source
material) claims "no existing game is called Infinity Grove" and treats this as a
confirmed competitive advantage. That claim is unverified — it reads like AI-generated
marketing copy, not a checked trademark/market search — and this briefing does not
treat it as fact. It should be reverified before the name is treated as locked.

Also worth flagging: the same naming pass optimizes for mobile App Store/Play Store
discoverability (ASO-style subtitles), but the confirmed target platform is PC/Steam
first. Downstream phases should not inherit mobile-first assumptions from that
material.

## Current build vs. the vision (important gap)

What exists in the repo today is a single-stage vertical slice, not yet the system
described below:

- Krell (the first hero) walks, encounters one monster at a time, the player clicks
  to punch, the monster has HP and dies, gold drops. (`KrellController`,
  `CombatManager`, `Monster`, `MonsterData`.)
- One equipment slot changes damage and animation (`Equipment`).
- A flat player level/damage-per-level stat (`PlayerStats`).

None of the following exist yet in code: missions, card drops, multiple heroes,
stage gating, big-number math/notation, offline/idle progression, hero
evolution/reset between stages, or the Steam Marketplace integration. This
prototype is the "action" primitive the fuller loop will wrap — it is not a
smaller version of the full game yet.

## Product vision

**Core loop** (per the original concept, confirmed still intended):
tap → hero performs an action → action fills a mission → mission completion drops
cards → a card can unlock a new hero → heroes automate the action loop → tapping
still accelerates output on top of automation → accumulated gold gates the next
stage → repeat with new heroes/cards.

**Key systems for v1:**

- **Hero roster starting from Krell.** Krell is the first hero, not a separate
  player-avatar layer. Additional heroes are collected via cards and each
  automates its own action loop; passives buff the shared economy (e.g. more gold
  per action, faster action cycles).
- **Stage transitions with hero evolution/reset.** Advancing a stage isn't just
  "unlock more stuff" — the roster evolves or re-invests between stages. The exact
  mechanic (what carries over, what resets, what the player chooses) is not
  designed yet and is explicitly open for Brainstorm/PRD.
- **Card-swap strategy layer.** Which cards/heroes are active going into a stage is
  a real decision, not automatic — this is the project's main claim to being more
  than a clicker.
- **Big-number economy.** Gold and costs need an arbitrary-precision/scientific
  notation system (1K → 1M → ... → 1az → 1bz → ...) since the intended curve runs
  from hundreds of gold into indefinite exponential territory.
- **Offline/idle progression.** Heroes keep generating while the game is closed;
  accrual computed from a persisted last-seen timestamp on resume.
- **Steam Community Market integration for cards**, targeted for v1 per explicit
  decision, despite high execution risk (Valve approval, Steam Inventory Service
  integration, and potential legal exposure around real-money item trading in some
  jurisdictions — comparable regulatory scrutiny to skin-trading systems in other
  Steam titles). This should be validated for feasibility early, not assumed.
- **Monetization: single paid purchase, priced low.** No IAP/gacha currency layer
  planned — a deliberate contrast with how most of the referenced competitors
  monetize.
- **Scale target: roughly 600 stages** (the source material floats 59, 60, and 600
  as alternatives — not yet settled).

## Known unknowns (surfaced honestly, not resolved here)

These come directly from the original concept doc and remain open after this
conversation — they belong to Brainstorm/PRD, not this briefing:

- Exact stage count and structure (flat 600 vs. ~60 stages × sub-levels).
- Concrete tuning formulas for gold gates vs. income growth (the doc's own note:
  "costs go up but feel cheaper" needs real curves to hold).
- Card drop rules: rates, duplicate handling, whether non-hero card types exist.
- Hero progression: can heroes level individually, do passives scale with level.
- **Endgame design.** The intent is infinite scaling past stage ~600, with some
  form of community interaction/exploitation of the endgame — but the user
  explicitly does not yet know what that interaction looks like (leaderboards?
  shared market dynamics? something else?). This is unresolved by design, not by
  omission.
- Steam Marketplace feasibility specifics: approval path, whether Valve's
  Inventory Service supports this use case for a first-time/small developer, and
  which jurisdictions' regulations would apply.
- Hero-evolution-between-stages mechanic: what carries over, what resets, what the
  player actively chooses versus what's automatic.

## One-line pitch

Tap to grow a hero economy, swap cards to strategically clear escalating stages,
evolve your roster between them, and trade cards with other players on Steam's
market — an idle clicker built to reward strategy, not just patience.
