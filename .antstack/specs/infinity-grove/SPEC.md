# Infinity Grove — PRD (v1 / Launch)

## Status

Launch-grade. Real paid PC/Steam release — competitive positioning, monetization,
and legal exposure are load-bearing requirements in this document, not aspirational
notes. Builds directly on [BRIEFING.md](./BRIEFING.md) and [BRAINSTORM.md](./BRAINSTORM.md);
this PRD does not re-litigate decisions already made there except where noted.

## 1. Overview

Infinity Grove is an idle/incremental clicker that adds a real strategic layer on
top of the genre's compounding-economy fantasy: an FTL-style rotating 5-hero squad,
duplicate-fusion star progression, ARPG-style itemization, and a player-driven card
economy on the Steam Community Market. The founding bet: an idle clicker can also be
a strategy game, and can be funded by a single deliberate purchase model instead of
gacha/loot-box IAP.

Current repo state is a single-hero, single-stage vertical slice (Krell walks,
encounters one monster, click-to-punch, monster dies, gold drops). None of the
systems in this PRD exist in code yet; this document specifies the full v1 system,
not an increment on the prototype.

## 2. Glossary

| Term | Meaning |
|---|---|
| **Card** | The unit players collect, drop, buy, and trade. v1 cards represent heroes only (see §5). |
| **Active Squad** | The 5 hero slots that fight in a stage. Hard cap, regardless of roster size. All 5 slotted heroes attack automatically and simultaneously on screen (FR-9) — there is no separate singular "active hero" concept. |
| **Bench** | Any owned hero not in the Active Squad. Contributes zero passive value while benched. |
| **Star Tier (★)** | A hero's power/ability tier, raised by fusing duplicate copies of that hero's card, capped at 12★ for every hero. Per-player progress, unrelated to Summoning Stone eligibility — see Hero Block. |
| **Hero Block** | A group of heroes gated to a stage-progress threshold: a hero becomes eligible as a Deterministic Summoning Stone target only once the player's own furthest cleared stage reaches that hero's block (e.g., heroes in the block gated at stage 250 cannot be stone-summoned by a player still at stage 1). Blocks unlock progressively at a fixed stage interval (tuning parameter); once a player passes the final block's threshold, every hero in the game is stone-eligible. This — not a fixed rarity classification — is what this PRD means whenever earlier text says a hero card is "low-tier." |
| **Fusion** | Consuming N duplicate copies of a hero card to advance that hero one star tier. |
| **Power Gate** | Stage failure caused by insufficient account power/gear/star quality. Fixed by grinding. |
| **Composition Mismatch** | Stage failure caused by wrong team type vs. a stage's rotating modifier. Fixed by swapping loadout. |
| **Season Cave** | The ranked mode; account power is normalized so hero star quality is the only differentiator. |
| **Deterministic Summoning Stone** | Real-money purchase of one specific, player-chosen hero card whose Hero Block is already unlocked relative to the player's own stage progress. No randomness. |

## 3. Target Users

Idle/incremental genre players (Clicker Heroes, Melvor Idle, Idle Champions of the
Forgotten Realms audience) who already enjoy compounding numbers but are underserved
on tactical decision-making. They want a reason to think about their roster and
loadout, not just wait and click faster. They are price-sensitive to genre norms
(low one-time price expected) and — per the genre's own community norms — are
generally trading-savvy or trading-curious (many have used Steam Market on other
titles), which is what makes a card economy a plausible draw rather than a foreign
mechanic bolted on.

## 4. Core Loop Walkthrough (v1)

Derived from the Brainstorm's system decisions, not a fresh user interview — this
walkthrough exists to make the FR list traceable to an actual play session:

1. Player starts a new game, chooses a main hero from 3–5 starter options.
2. Tapping the screen adds player-driven damage on top of the Active Squad's
   automatic attacks — all 5 Active Squad heroes attack simultaneously on screen
   once placed there, not a single tappable "active hero"; clearing enough
   hits/mission progress drops gold and, less frequently, cards and gear.
3. A dropped hero card either adds a new hero to the roster or becomes a duplicate,
   which can be fused into an existing hero for a star-tier upgrade (consuming the
   duplicate permanently — see §9, D1).
4. Gold — displayed in scientific/big-number notation — buys stage progression, gear
   crafting/enchanting, and account power upgrades.
5. Before attempting a new stage, the player checks the stage's rotating type
   modifier and decides whether their 5-hero Active Squad matches it, swapping in
   benched heroes or re-equipping gear via a loadout preset as needed.
6. On stage failure, the game tells the player unambiguously whether it was a Power
   Gate (go grind) or a Composition Mismatch (swap the squad) — never an ambiguous
   loss.
7. On a boss stage, the player times consumable potions (attack%, attack speed,
   double attack, double projectile) for an active execution layer on top of the
   pre-fight strategic loadout decision.
8. The player closes the game; heroes keep generating gold offline, computed from a
   persisted last-seen timestamp on next launch.
9. Once eligible (minimum unique heroes unlocked through normal play), the player can
   enter the seasonal Season Cave, where account power is normalized and only hero
   star quality differentiates ranked performance; ranked rewards are cosmetic only.
10. At any point, the player can list an unwanted duplicate or benched card's owned
    (non-fused) copies on the Steam Community Market, or buy a specific card there
    instead of grinding for it, or buy a deterministic Summoning Stone from Infinity
    Grove's own shop for a fixed, non-random price on any card whose Hero Block
    is already unlocked at the player's current stage progress.

## 5. Scope Decisions Carried Into This PRD

These three items were explicitly decided for this PRD (superseding the "default/
recommended" options considered during Brainstorm) and shape multiple FR groups
below:

- **D1 — Fusion consumes duplicates permanently.** Fusing a hero destroys the
  duplicate cards spent, making the hero-card supply deflationary over time. This
  is a deliberate lever for long-term Market scarcity/value.
- **D2 — Full itemization ships at launch.** Equipment drops, the shared account
  bag, archetype loadout presets, *and* crafting/enchanting with rollable affixes
  all ship in v1 — not phased into a later season. See §11 (Reviewer Notes) for the
  risk this stacks onto an already tight production plan.
- **D3 — Steam Community Market integration is a hard v1 launch requirement**, not
  a goal-with-fallback. The game does not ship v1 without live Market trading
  working. See §11 for why this is the single highest-risk line item in the whole
  PRD.

## 6. Out of Scope / Non-Goals for v1

- **Non-hero card types.** v1 cards represent heroes exclusively. Consumable,
  cosmetic, or resource-type cards are explicitly deferred — not designed here.
  `[ASSUMPTION]`
- **In-game direct player-to-player trade.** Trading exists only through the Steam
  Community Market (Brainstorm decision, carried forward as-is).
- **Anti-bot / multi-account grinding countermeasures beyond the ranked entry
  gate.** Explicitly accepted as a trade-off in Brainstorm for ranked/Season Cave
  fairness specifically; do not build additional anti-bot systems for ranked
  eligibility. This does not extend to Market economic abuse — see NFR-8, added
  post-D3 to address bot/farm exploitation of real-money card trading, which is a
  distinct risk from ranked fairness and was not covered by the original
  Brainstorm trade-off.
- **Real-money auction house or random-reward paid gacha of any kind.** Rejected in
  Brainstorm as legally and structurally equivalent to loot-box gambling patterns.
- **Localization beyond English.** Not raised in Briefing or Brainstorm; assumed
  English-only for v1 launch. `[ASSUMPTION]`
- **Prestige/ascension full resets, permadeath, and full economy wipes.** Explicitly
  rejected in Brainstorm as incompatible with cards being real-money assets.
- **Cash-equivalent or sweepstakes-adjacent ranked prizes.** Season rewards are
  cosmetic only; anything beyond cosmetics is out of scope pending its own legal
  review (flagged, not designed, in Brainstorm).

## 7. Functional Requirements

IDs are global and stable; grouping is organizational only.

### 7.1 Hero Roster & Active Squad

- **FR-1.** At new-game start, the player chooses one main hero from 3–5 starter
  options, presented with enough information (role/type/base stats) to make an
  informed choice.
  *AC:* Choice is presented before the first stage; choice is permanent for that
  save (does not block acquiring the other starters later via normal drops).
- **FR-2.** All heroes beyond the chosen starter are acquired exclusively through
  normal card acquisition (drops, Market purchase, Summoning Stone) — none are
  unlocked by any other means in v1.
- **FR-3.** The roster has no upper size limit; the Active Squad has a hard cap of
  exactly 5 heroes.
  *AC:* UI blocks adding a 6th hero to the Active Squad without first benching one.
- **FR-4.** A benched hero contributes zero passive value to the shared economy
  (gold generation, action automation, or any other account-wide bonus) while
  benched.
  *AC:* Automated/idle income calculations only sum contributions from the 5
  Active Squad slots, verified against a save with >5 owned heroes.
- **FR-5.** All heroes scale off a single shared account-level power stat; there is
  no per-hero independent leveling track in v1.
- **FR-6.** Collecting duplicate copies of a hero fuses it up a star tier (1★, 2★,
  3★, … up to a fixed cap of **12★**); each star tier unlocks or upgrades that
  hero's special ability. Star Tier is per-player fusion progress on an owned
  hero, capped identically for every hero — it is not a rarity/value
  classification and does not determine Summoning Stone eligibility (see FR-49
  for that mechanism).
  *AC:* Fusion UI shows current tier, duplicates owned, duplicates required for
  next tier, and a preview of the ability gained; no hero can be fused past 12★.
- **FR-7.** Per Scope Decision D1, fusion permanently consumes the duplicate cards
  spent; they cannot be recovered, un-fused, or later listed on the Market.
  *AC:* Post-fusion, the consumed card count is removed from the player's Market-
  listable inventory, not merely hidden in the UI.
- **FR-8.** The exact fusion duplicate-cost curve per star tier is a tuning
  parameter, not fixed by this PRD; it must be defined in a separate balancing pass
  before content lock. `[ASSUMPTION — deferred to tuning/spreadsheet work]`

### 7.2 Combat & Stage Progression

- **FR-9.** All 5 heroes in the Active Squad attack automatically and
  simultaneously on screen once placed there — this is what FR-4's "action
  automation" refers to, and no tap is required for baseline output. Tapping the
  screen adds player-driven damage on top of that automated baseline, felt across
  the Active Squad's ongoing attack loop, not restricted to a single "active
  hero." A hero must be both owned and in the Active Squad to automate; being
  merely owned-but-benched (FR-4) automates nothing.
- **FR-10.** Each stage carries a rotating type/element modifier that favors or
  disfavors specific hero types, changing effective squad performance on that
  stage.
  *AC:* The stage-select screen displays the current stage's modifier before entry,
  not only after a failed attempt.
- **FR-11.** On stage failure, the game classifies the cause as exactly one of two
  states and communicates it unambiguously to the player: **Power Gate**
  (insufficient account power/gear/star quality — never failable below the intended
  power floor purely on team choice) or **Composition Mismatch** (sufficient power,
  wrong team type for this stage's modifier).
  *AC:* Failure screen copy and iconography differ visibly between the two states;
  QA must confirm no stage is completable by every squad composition at the
  intended power floor except through a genuine composition swap, and no stage is
  failable via Power Gate at power-floor-or-above regardless of composition (a
  Composition Mismatch failure remains possible above the power floor if the
  squad type is wrong for that stage's modifier).
- **FR-12.** There is no permadeath. Failed stages may be retried at will with no
  resource cost beyond time.
- **FR-13.** Players may replay any previously cleared stage at will (e.g., to farm
  resources before re-attempting a harder stage).
- **FR-14.** Boss stages support tactical consumable potions (e.g., +attack%,
  +attack speed, double attack, double projectile) that the player activates
  mid-fight.
  *AC:* Potions are obtained as drops/rewards, held in a capped inventory, and
  activated via an explicit UI action during boss encounters only (not usable on
  regular stages).
- **FR-15.** v1 ships with approximately 600 stages as launch content (not a hard
  ceiling — see §7.8 for seasonal stage additions).

### 7.3 Card & Fusion Economy

- **FR-16.** Hero cards drop from stage clears at a rate to be defined in tuning;
  drop rate must be tuned so that fused progression is achievable through normal
  free play alone (ties to FR-33, the ranked entry gate). `[ASSUMPTION — tuning
  deferred]`
- **FR-17.** A card obtained while the represented hero is not yet owned adds that
  hero to the roster (benched by default); a card obtained for an already-owned
  hero becomes fusion material per FR-6/FR-7.
- **FR-18.** Card acquisition sources in v1 are exactly three: stage drops, Steam
  Community Market purchase, and deterministic Summoning Stone purchase (§7.6). No
  other acquisition path exists.

### 7.4 Itemization: Equipment, Crafting & Enchanting

Per Scope Decision D2, the full system below ships at launch.

- **FR-19.** Stage clears drop equipment across four slots per hero: weapon, chest,
  boots, gloves.
- **FR-20.** Equipment is owned per-hero (each hero has its own equipped loadout);
  unequipped equipment lives in one shared account-wide bag, not stranded on a
  benched hero.
  *AC:* Moving a benched hero into the Active Squad allows immediately equipping
  any bag item to it without first unequipping anything from another hero.
- **FR-21.** Players can save and apply loadout presets by archetype (Strength /
  Intelligence / Agility) to re-gear a newly activated hero in one action instead of
  equipping piece by piece.
  *AC:* Applying a preset re-equips all 4 slots (where matching items exist in the
  bag) in a single confirmed action, reversible before confirmation.
- **FR-22.** Equipment supports rollable affixes via a crafting/enchanting system:
  weapons roll crit chance / attack% / crit damage; chest rolls defense; boots roll
  speed; gloves roll precision/accuracy.
  *AC:* Crafting UI shows current affix roll(s), the cost to re-roll, and the
  possible affix range for that slot type before the player commits currency.
- **FR-23.** Exact crafting costs, affix value ranges, and roll odds are tuning
  parameters not fixed by this PRD. `[ASSUMPTION — deferred to tuning/spreadsheet
  work]`
- **FR-24.** Equipment and crafted affixes are account-bound; per §6, they are not
  Steam Market tradeable in v1 (only hero cards are — see §7.7). `[ASSUMPTION,
  carried from Brainstorm's exclusive framing of cards as the Market asset]`

### 7.5 Economy & Big-Number Currency

- **FR-25.** Gold and all cost values use an arbitrary-precision or scientific
  notation system supporting growth from low hundreds into indefinite exponential
  territory (e.g., 1K → 1M → … → 1az → 1bz → …), with no overflow or precision loss
  at any reachable value.
- **FR-26.** Gold gates stage, crafting, and account-power progression.
- **FR-27.** Cost-vs-income growth curves must satisfy the constraint that
  progression cost increases feel bounded relative to income growth at each stage
  (the source concept doc's own framing: "costs go up but feel cheaper"); the exact
  formulas are a tuning/spreadsheet deliverable, not fixed here. `[ASSUMPTION —
  deferred to tuning work; this PRD only fixes the constraint the formula must
  satisfy]`

### 7.6 Monetization: Deterministic Summoning Stones

- **FR-28.** Players may spend real money to purchase one specific, player-chosen
  hero card, restricted to heroes whose Hero Block is already unlocked relative
  to the player's own furthest cleared stage (FR-49) — not any hero in the game
  unconditionally. The transaction has zero randomness — the player selects the
  exact card they receive before paying.
  *AC:* No purchase flow in the game presents a random or unrevealed reward in
  exchange for real money, anywhere; the purchase UI only offers heroes whose
  Hero Block the player has already reached, and rejects a request for a
  not-yet-unlocked hero.
- **FR-29.** The Summoning Stone price for a given card acts as a soft price
  ceiling for that card on the Steam Community Market: the game must surface a
  recent reference price from Market listings alongside the Summoning Stone price
  so players can compare. This is a periodically-refreshed snapshot, not a
  real-time live quote — Valve does not expose an officially supported live-price
  API; see Architecture.md AD-13 for the fetch/cache mechanism.
  *AC:* Card detail view shows both "Buy on Market" (most recent known price,
  labeled with its last-updated time, e.g. "updated 2h ago") and "Buy directly"
  (fixed Summoning Stone price) side by side where both are available.
- **FR-30.** Beyond the base game's single paid purchase and Summoning Stones,
  there is no other real-money currency, no loot box, and no chance-based reward
  tied to any payment. This clarifies and narrows the Briefing's original "no IAP"
  framing: the actual pillar is **no random-reward monetization**, not zero paid
  purchases beyond the base price — deterministic stones were explicitly added in
  Brainstorm to fund ongoing seasonal content.
- **FR-49.** Heroes are grouped into **Hero Blocks**, each gated to a stage-
  progress threshold at a fixed stage interval (tuning parameter — e.g., a new
  block every 100 stages, matching the FR-15/FR-40 stage-count structure); a
  hero is eligible as a Summoning Stone target only once the player's own
  furthest cleared stage reaches that hero's block. This is the sole mechanism
  behind every earlier reference in this PRD to a "low-tier" card — there is no
  separate rarity classification. Once a player's furthest cleared stage passes
  the final block's threshold, every hero in the game is stone-eligible; a
  season's new heroes (FR-37) are assigned to the new stage block that season
  adds (FR-40), following the same rule. Exact block size, hero-to-block
  assignment, and total hero count are tuning/content deliverables, not fixed
  here. `[ASSUMPTION — deferred to tuning/content work; this PRD only fixes the
  progress-gated mechanism itself]`
  *AC:* Attempting to buy a Summoning Stone for a hero whose block the player
  has not yet reached is rejected client- and server-side (per FR-34, this
  check is server-authoritative, not merely a UI filter); the purchase UI never
  lists a not-yet-unlocked hero as a selectable option in the first place.

### 7.7 Steam Community Market Integration

Per Scope Decision D3, this is a hard v1 launch requirement.

- **FR-31.** Hero cards are represented as Steam Inventory items, listable and
  purchasable through the Steam Community Market.
- **FR-32.** Trading is Market-only; there is no in-game direct player-to-player
  trade or gifting path for cards in v1.
- **FR-33.** A card's Market-listable and fusable status must be mutually
  exclusive at all times, in both directions: (a) a card consumed in fusion
  (FR-7) must be removed from the player's Market-listable inventory atomically
  with the fusion action, and (b) a card currently listed on the Market must be
  rejected as fusion material until that listing is resolved (sold or
  cancelled) — no window exists, in either direction, where the same card is
  simultaneously spendable in fusion and listable/listed on the Market.
  *AC:* Fusion and inventory-state update happen as a single transaction (or with
  equivalent guarantees) to prevent double-spend of a card between fusion and
  listing; a fusion request targeting a currently-listed card is rejected with a
  clear reason, not silently allowed.
- **FR-34.** All Market-facing card ownership state must be validated
  server-side; the client save file is not the source of truth for anything that
  can be listed for real money. See NFR-4 for the anti-tamper rationale.

### 7.8 Seasonal Ladder & Endgame (Season Cave)

- **FR-35.** A ranked mode ("Season Cave") normalizes account power to a fixed
  baseline for all entrants, so competitive differentiation within it comes from
  hero star quality, not raw account level or time invested.
- **FR-36.** Entry to Season Cave requires a minimum count of unique heroes
  unlocked in the roster (distinct heroes owned at all, regardless of duplicate
  count or star tier — not specific named heroes); this threshold must be
  reachable through normal free play alone within a season, without requiring any
  real-money purchase. Fusing duplicates (D1) never reduces this count, since it
  only consumes duplicate copies of already-owned heroes, not the roster entry
  itself — this resolves the tension the fusion sink would otherwise create
  against a raw-card-count gate.
  *AC:* Design/tuning must document the expected free-play time to reach the gate
  and confirm it does not exceed a season's normal active-player pace.
- **FR-37.** Each season introduces rule variants (e.g., elemental buffs/penalties)
  that rotate the competitive meta, and typically debuts new heroes designed around
  that season's rules.
- **FR-38.** Season progress is tracked via a race metric: first to reach the
  season's new final stage, or highest damage on the season's final boss.
- **FR-39.** Season rewards are cosmetic only (frames, skins); v1 must not offer
  any cash-equivalent, sweepstakes-adjacent, or gambling-adjacent prize for ranked
  performance.
- **FR-40.** Each season permanently adds a fixed block of new stages (e.g., +100)
  to the base game, on top of the ~600 launch stages (FR-15); seasonal stage
  additions are not removed when the season ends.

### 7.9 Offline/Idle Progression

- **FR-41.** Heroes in the Active Squad continue generating gold while the game is
  closed; on next launch, accrued gold is computed from a persisted last-seen
  timestamp.
- **FR-42.** Whether offline accrual is time-capped (e.g., an 8–24h ceiling common
  in the genre) or uncapped is not resolved in Brainstorm; this PRD assumes a
  capped model to preserve a return-to-play incentive, with the exact cap left to
  tuning. `[ASSUMPTION — flagged for explicit confirmation; see §11]`

### 7.10 Save, Persistence & Anti-Tamper

- **FR-43.** All progression state (roster, star tiers, gear, gold, stage
  progress, last-seen timestamp, season state) persists across sessions.
- **FR-44.** Given a PC/Steam target, save data supports Steam Cloud sync.
- **FR-45.** Any state that determines Market-listable card ownership or fusion
  history must be authoritative on a server the studio controls, not solely in the
  local/cloud save file, to prevent client-side tampering from fabricating
  real-money-tradeable assets. This is a new architectural requirement introduced
  by combining D1 (permanent card consumption) and D3 (mandatory Market trading) —
  see NFR-4 and §11.

### 7.11 UI/UX Meta Requirements

- **FR-46.** The stage-select screen surfaces the active stage's type modifier,
  the player's current Active Squad composition, and enough information to predict
  Power Gate vs. Composition Mismatch risk before attempting the stage.
- **FR-47.** Roster management UI clearly distinguishes Active Squad (5 slots) from
  Bench (unlimited), and surfaces which benched cards are duplicate/fusable vs.
  unique.
- **FR-48.** Card and gear detail views must clearly indicate Market-tradeable
  status (tradeable / consumed-by-fusion / account-bound) so players never
  mistakenly believe a consumed or account-bound item can be sold.

## 8. Non-Functional Requirements

- **NFR-1 (Numeric integrity).** The big-number system (FR-25) must maintain
  correct ordering and formatting at all reachable magnitudes with no visible
  rounding artifacts that change relative comparisons players rely on (e.g., "can I
  afford this").
- **NFR-2 (Save reliability).** Saves must be written atomically; a crash or forced
  quit mid-write must never corrupt the previous valid save. Cloud sync conflicts
  (two devices) must resolve without silently discarding progress.
- **NFR-3 (Accessibility — type legibility).** Because Composition Mismatch (FR-11)
  depends on players correctly reading elemental/type favor, type indicators must
  be distinguishable without relying on color alone (icon/shape/pattern
  redundancy), for colorblind accessibility.
- **NFR-4 (Anti-tamper / server authority).** Per FR-34/FR-45, all state that can
  become a real-money Market asset must be validated against a studio-controlled
  authoritative source, not trusted from the client alone. This is the single
  largest net-new technical scope this PRD introduces beyond a normal single-player
  Unity build — see §11.
- **NFR-5 (Legal/compliance).** Before launch: (a) confirm loot-box law exposure is
  fully avoided by the deterministic-purchase design (FR-28) in all target sale
  regions; (b) confirm cosmetic-only ranked rewards (FR-39) do not trigger
  gambling/sweepstakes regulation; (c) confirm real-money card trading via Steam
  Market does not trigger additional regulatory obligations (e.g., virtual-currency
  or virtual-goods trading rules) in target sale regions. None of these are
  resolved by this PRD — they require legal review.
- **NFR-6 (Platform).** PC/Steam first; no mobile-specific requirements in v1 (the
  Briefing explicitly flags that ASO/mobile-discoverability material should not be
  inherited into design assumptions).
- **NFR-7 (Anti-bot — explicit non-goal, ranked only).** Per §6, no additional
  anti-bot/multi-account measures beyond the Season Cave entry gate (FR-36) are
  required for ranked fairness; do not over-engineer this. This non-goal is
  scoped to ranked eligibility only — it does not cover Market economic abuse;
  see NFR-8.
- **NFR-8 (Anti-bot — Market economic abuse, scoped).** Because D3 makes hero
  cards real-money-tradeable assets, the backend must include minimum automated-
  abuse detection scoped to Market-relevant paths: anomalous per-account
  drop/farming rate detection (e.g., stage-clear cadence inconsistent with human
  play) and rate limiting on Market listing actions. This is narrower than a
  general anti-cheat system and explicitly does not extend to ranked/Season Cave
  multi-accounting (NFR-7), which remains an accepted non-goal. Exact thresholds
  and detection heuristics are a tuning/ops deliverable, not fixed by this PRD.
  `[ASSUMPTION — deferred to tuning/ops work; this PRD only fixes that
  Market-scoped detection must exist]`

## 9. Success Metrics (with counter-metrics)

A metric without a counter-metric is easy to game; each pairing below exists to
catch the failure mode the metric alone would hide.

| # | Metric | Counter-metric | Why paired |
|---|---|---|---|
| 1 | Deterministic Summoning Stone revenue per active player | % of a player's Active Squad power sourced from purchased (vs. earned) cards | Proves the funding model works without proving the game quietly became pay-to-win despite non-random purchases. |
| 2 | Season Cave entry rate (% of eligible players who enter ranked each season) | % of entrants who reached the card-count gate (FR-36) via free play alone, with zero real-money spend | High entry with a real-money-dependent gate would mean ranked is de facto pay-gated, breaking the fairness pillar. |
| 3 | Steam Market listing/transaction volume for hero cards | Median card price deviation from its Summoning Stone ceiling price (FR-29) | Volume alone doesn't show whether the price-ceiling mechanism (D1 + FR-29) is actually containing speculation; large sustained deviation signals the deflationary fusion sink (D1) is over- or under-tuned. |
| 4 | D7/D30 retention | Median time-to-clear for stages at the intended power floor (FR-11's Power Gate case) | Retention propped up by an over-tuned grind wall (pushing players toward paying to skip it) would look identical to healthy retention without this counter-metric. |

## 10. Production & Platform Constraints

Carried forward from Brainstorm as a first-class constraint, not a footnote:
**animation coverage is the most likely real bottleneck on how much of this PRD can
ship on schedule**, more than code complexity. The current build has exactly one
animated character (Krell: idle/walk/punch). This PRD's scope multiplies that
requirement several times over:

- Every collectible hero (FR-2) needs its own animation kit, and per FR-9's
  resolved definition, up to **5 heroes animate and attack simultaneously on
  screen** at once (the full Active Squad), not one tappable hero at a time —
  this confirms the animation-cost multiplier is on the expensive end of the
  range this section originally flagged as a risk, not the cheaper single-
  character alternative.
- Star-tier visual differentiation (FR-6) — a 5★ hero should read as visibly
  stronger than a 1★ of the same hero — needs additional art/animation states per
  hero, not just a stat change.
- Equipment changes (FR-19–21) should ideally be visible on the character model.
- Boss potion activation (FR-14) needs clear animated feedback to read as a real
  decision.

This PRD does not resolve pacing/roadmap sequencing against this constraint —
that belongs to the Architecture/roadmap phase — but the phase that plans hero
count, season cadence, and launch date must treat animation throughput as a hard
input, not a polish-pass afterthought.

## 11. Reviewer Notes — Flags for the User

Per PRD review discipline, these are genuinely open calls surfaced here rather than
silently resolved or silently ignored:

1. **Stacked v1 risk from D2 + D3.** Shipping the *full* itemization/crafting
   system (D2) **and** making Steam Community Market integration a *hard, non-
   negotiable* launch requirement (D3) — on top of the animation bottleneck in §10
   and the Market's own unresolved Valve-approval/legal feasibility (NFR-5) — stacks
   three independent high-effort/high-uncertainty items onto one launch. Each was a
   deliberate choice in this session, but the combination has not been risk-reviewed
   against a real timeline. Recommend a dedicated feasibility/timeline check before
   locking a launch date, specifically re-testing whether D3 should have a
   fallback after all if Valve approval timing turns out to be the actual
   constraint.
2. **Resolved, scope larger than originally flagged: full server authority, not
   just Market-relevant state.** This item originally flagged that NFR-4's
   card-ownership server-authority requirement implied an unscoped backend. It is
   now resolved by Architecture.md (AD-2/AD-6/AD-15): the team chose full
   server-side authoritative progress for *all* persisted state (gold, star
   tiers, gear, crafted affixes, stage progress — not only the Market-relevant
   card/fusion state FR-45/NFR-4 strictly require). This is a larger validation
   surface than this PRD's own requirements call for — every gold tick, stage
   clear, and craft/re-roll (AD-15's offline-crafting trade-off) is now
   server-validated, not only fusion/Market-facing actions. Anyone sizing the
   schedule from this section should treat the backend as full-scope from day
   one, not Market-scoped, when weighing it against the D2+D3 stacked risk in
   item 1 above.
3. **Offline-accrual cap (FR-42)** is an assumption this PRD made without a
   Brainstorm decision behind it (capped vs. uncapped was never discussed). Worth
   an explicit call before implementation, since it affects both retention design
   (metric #4 in §9) and the "tap accelerates output on top of automation" pitch
   line from the Briefing.
4. **Non-hero card types (§6)** were scoped out by assumption, not by an explicit
   decision — the Briefing listed this as an open unknown and Brainstorm did not
   resolve it. If any future system (e.g., consumable-type cards) is intended for
   v1 rather than a later season, that needs to be raised before content lock, since
   it affects both drop-table design and Market taxonomy.
5. **Gear tradeability (FR-24)** was inferred from Brainstorm's exclusive framing
   of *cards* as the Market asset, but was never explicitly stated as "gear is NOT
   tradeable." Worth a one-line confirmation, since getting this wrong either way
   has Market-taxonomy and legal-review (NFR-5) implications.

---

*This PRD does not include a SOLUTIONS.md split — Infinity Grove is a single game
product; the systems above (roster, combat, economy, Market, seasons) are features
of one solution, not independently buildable products.*


# Infinity Grove — Architecture (v1 / Launch)

## Status

Launch-grade, matching [PRD.md](./PRD.md) v1 scope. Builds on the existing vertical
slice (`InfinityGrove/Assets/Scripts/Game/*`: `CombatManager`, `KrellController`,
`Monster`, `MonsterData`, `Equipment`, `PlayerStats`) — plain `MonoBehaviour` +
`ScriptableObject` + C# events, no DI, no backend, no persistence. This document
specifies the target architecture the PRD's full system (backend authority,
itemization, fusion, Steam Market) requires, and how the existing slice migrates
into it incrementally rather than via a rewrite.

Decisions below reflect explicit choices made with the user during this session:
backend resourced and owned by the team (not solo-unsupported), full server-side
authoritative progress (not just Market-relevant card state), ASP.NET Core +
PostgreSQL backend, AWS as the eventual cloud target (starting local), Facepunch.
Steamworks client-side, and VContainer-based layering for the Unity client.

## Componentes

- Unity Game Client (PC/Steam)
- Backend API Service

## AD-N Decisions

### AD-1 — Unity client adopts VContainer + layered composition, migrated incrementally
- **Decision:** New gameplay code is organized into Data / Domain / Service /
  Presentation layers, wired through a single `LifetimeScope` composition root
  (Bootstrap scene). `MonoBehaviour`s become presentation-only: they read from and
  call injected service interfaces, never hold gameplay state themselves and never
  reference each other directly.
- **Reason:** The PRD adds backend sync, fusion, itemization, and Market state —
  systems that need to be testable and mockable in isolation. The user chose to
  introduce DI now rather than let direct-reference wiring (today's
  `CombatManager`-style `[SerializeField]` links) scale into this surface area.
- **Trade-off:** More interface/DI ceremony than the current quick wiring; a new
  package dependency (`VContainer`) and a composition-root discipline the whole
  team must follow.
- **Impact:** `CombatManager`, `KrellController`, `Monster`, `Equipment` are
  migrated to this pattern as each is touched by a PRD feature (e.g.
  `CombatManager` becomes a `CombatService` + a thin presentation `MonoBehaviour`),
  not rewritten up front. No new gameplay code may use `FindObjectOfType` or a
  hand-rolled singleton to reach another system.

### AD-2 — Backend is ASP.NET Core + PostgreSQL, layered Controllers → Application → Domain → Infrastructure
- **Decision:** The backend is a single ASP.NET Core (.NET 8 LTS) Web API project
  against PostgreSQL via EF Core, layered as Controllers (HTTP) → Application
  (use-case orchestration) → Domain (rules: fusion curves, drop validation, market
  ledger invariants, crafting/affix-roll rules — see AD-15) → Infrastructure (EF
  Core repositories, Steamworks Web API client).
- **Reason:** Sharing C# with the Unity client lets rules that must match exactly
  on both sides (big-number math, fusion cost curves) reuse the same types instead
  of two independent reimplementations drifting apart. PostgreSQL's transactions
  are required for atomic multi-row operations like fusion (consume N duplicates
  as one commit).
- **Trade-off:** A relational schema needs explicit migrations as itemization
  affixes and card definitions evolve, vs. a schemaless NoSQL store's flexibility.
- **Impact:** All server-authoritative state (account, roster, star tiers, gear,
  crafted affixes, gold, stage progress, Market ledger) lives in Postgres tables
  owned exclusively by this service. The Unity client never writes authoritative
  state directly to any datastore.

### AD-3 — Local Docker Compose now, AWS ECS Fargate + RDS at pre-launch
- **Decision:** Local development runs the API + PostgreSQL via `docker-compose`.
  The production target is AWS: ECS Fargate for the API container(s), RDS for
  PostgreSQL, Secrets Manager for the Steamworks publisher key and DB credentials,
  behind an ALB. AWS CDK is the IaC tool for this environment; it remains a
  pre-launch deliverable, not a day-one one.
- **Reason:** User confirmed AWS as the target but wants to start locally; Fargate
  fits a small team without dedicated infra/DevOps headcount better than
  self-managed EC2 or the cold-start/state constraints of Lambda for a
  stateful, EF-Core-migrated API.
- **Trade-off:** Containerizing from day one adds Docker as a local dev dependency;
  in exchange it removes "works on my machine" drift between local and the eventual
  AWS deploy.
- **Impact:** `docker-compose.yml` (API + Postgres) is the canonical local dev
  environment from the first line of backend code. IaC and the actual AWS account
  setup are explicitly deferred to a pre-launch infra pass (see Open Questions).

### AD-4 — Facepunch.Steamworks client-side; all inventory-mutating Steamworks calls are backend-only
- **Decision:** The Unity client uses Facepunch.Steamworks for Steam Cloud saves,
  obtaining Auth Session Tickets, and read-only Inventory queries. Any call that
  *mutates* Steam Inventory (grant, consume, exchange items) happens only on the
  backend via the Steamworks Web API using the publisher key — the client never
  makes a mutating Inventory call directly. Real-money purchase authorization
  (Summoning Stones) follows this same backend-only rule; see AD-12 for that flow.
- **Reason:** User chose Facepunch.Steamworks (actively maintained, modern C#
  API). NFR-4/FR-45 require server authority over anything Market-relevant, so a
  client-side mutating call would be a direct route around that authority.
- **Trade-off:** Every inventory-relevant action (fusion, card grant from a drop)
  now costs a network round-trip to the backend instead of a local Steamworks SDK
  call, and the backend must securely hold and never leak the publisher key.
- **Impact:** Fusion, drop-to-card grants, and any future item mint/consume path
  are backend-orchestrated: client requests the action → backend validates →
  backend mutates its own ledger and calls Steam Inventory Service → backend
  returns the canonical result → client updates its local view.

### AD-5 — Steam is the sole identity provider
- **Decision:** The client obtains a Steam Auth Session Ticket (Facepunch.
  Steamworks) and sends it to the backend on startup; the backend verifies it
  against the Steamworks Web API (`AuthenticateUserTicket`) and maps it to an
  account keyed by SteamID64, creating one on first sight.
- **Reason:** V1 is PC/Steam-exclusive (NFR-6) — a separate email/password account
  system would be unused scope.
- **Trade-off:** No login path exists outside Steam; the game requires at least an
  initial online Steam session to mint a ticket (Steam's own offline-ticket
  behavior applies afterward per Steamworks semantics).
- **Impact:** The backend's `Account` table is keyed by SteamID64. No credential
  storage, password reset, or email-verification code exists anywhere in the
  system.

### AD-6 — Full server-authoritative progress via batched event log, not lockstep
- **Decision:** All persisted progress (gold, star tiers, roster, gear, crafted
  affixes, stage progress) is authoritative on the backend, per the user's choice
  of a full server-side player-account model. The client stays fully playable
  offline and locally responsive (instant tap feedback, FR-9; offline gold accrual
  display, FR-41) by recording every state-changing action as a discrete event
  (stage cleared, fusion performed, item crafted, gold earned) in an append-only
  local log, which syncs to the backend opportunistically — periodically while
  online, and on pause/quit. The backend replays and validates each event against
  game rules and returns the canonical state; the client reconciles silently
  unless an event is rejected, in which case it corrects the client and surfaces
  why.
- **Reason:** A literal server round-trip per tap or per idle tick is infeasible
  for an idle clicker's UX and directly conflicts with FR-41's offline-accrual
  requirement; a batched, validated event log is how "full server authority" and
  "playable offline, responsive taps" coexist.
- **Trade-off:** A window exists where the client's local display is briefly ahead
  of confirmed server state; accepted because it is corrected on the next sync,
  not silently trusted forever, and the correction path is a first-class UX case
  (see EXPERIENCE.md state patterns), not an edge case bolted on later.
- **Impact:** Every gameplay system that changes persisted state must express the
  change as a discrete, independently validatable event — never as a raw
  "set gold to X" diff. This event shape is also what gives FR-33/FR-45's
  anti-tamper audit trail its data.

### AD-7 — BreakInfinity.cs big-number representation, shared client/server
- **Decision:** `BreakInfinity.cs` is the big-number type for all currency and
  cost math (FR-25/NFR-1), used identically on client and server. The backend
  stores canonical values in Postgres as a `(mantissa double, exponent int)` pair,
  not a native numeric column.
- **Reason:** It is the de facto standard library for idle-game big numbers —
  adopting it avoids re-deriving formatting, comparison, and overflow-safety edge
  cases the genre has already solved.
- **Trade-off:** BreakInfinity trades exact low-order precision for range at
  extreme magnitudes; acceptable because NFR-1 only requires no *visible*
  rounding artifact that changes a relative comparison, not exact integer gold.
- **Impact:** Any code path touching gold or costs uses this shared type
  end-to-end. Existing plain `int` fields (e.g. `PlayerStats.damagePerLevel`,
  `Equipment.bonusDamage`) migrate to it as those systems are touched by PRD
  features, not in a blanket pass.

### AD-8 — Fusion/Market mutations use an outbox-backed saga, not a naive two-phase commit
- **Decision:** Fusion is one backend transaction: validate duplicate count →
  decrement duplicate rows in Postgres → write an outbox record for the
  corresponding Steam Inventory mutation → commit. A background worker drains the
  outbox and calls the Steamworks Web API; on failure it retries with backoff. The
  fusion is only reported "complete" to the client once the outbox entry is
  confirmed applied. This relies on AD-8b's default-non-marketable item state to
  close the double-spend window during the async drain — see AD-8b.
- **Reason:** FR-33 requires no window where a card is both spent and separately
  listable; Postgres and Steam's API cannot share one atomic transaction, so the
  outbox pattern is what makes the two eventually-consistent without a client-
  visible inconsistent state.
- **Trade-off:** Requires an outbox table and a reconciliation worker from day
  one — more moving parts than a direct synchronous call, in exchange for no
  double-spend window even when Steam's API is briefly unreachable, given AD-8b.
- **Impact:** Any future operation touching both Postgres and Steam Inventory
  (not just fusion) must go through this same outbox mechanism, not a bespoke
  direct call.

### AD-8b — Cards are non-marketable by default; listing requires synchronous backend authorization; a "Listed" state blocks fusion until reconciled
- **Decision:** Every hero card's Steam Inventory item instance is minted with
  `marketable=false` and a Postgres card-instance state of `Owned`. It is never
  flipped to `marketable=true` by fusion, drops, or any client action directly.
  The only path that sets `marketable=true` is an explicit "prepare to list"
  backend call: the client asks to list a specific card, the backend
  synchronously checks that card's current Postgres state is `Owned` (not
  `Consumed` by fusion, not `PendingOutbox`, not already `Listed`) and, only if
  clear, calls the Steamworks Web API to flip that one item instance to
  `marketable=true` **and** transitions its Postgres state to `Listed` in the
  same transaction, before returning success to the client. Fusion (AD-8) and
  any other consuming action validate against this same state column and reject
  a duplicate that is `Listed`, exactly as they already reject `Consumed` or
  `PendingOutbox` — closing the reverse direction FR-33 didn't originally cover
  (listing → fusion, not just fusion → listing). A scheduled reconciliation job
  (same recurring-job pattern as AD-13/AD-14) polls the Steamworks Web API for
  every card currently `Listed`, and transitions it: to `Sold` (removed from
  the player's Steam Inventory — the sale completed on Valve's side) or back to
  `Owned` with `marketable=false` restored (the player cancelled the listing via
  Steam's native UI, outside the game, without a synchronous game-side call).
- **Reason:** User confirmed adding the `Listed` state plus a periodic
  reconciliation job over a webhook-based push mechanism (not confirmed
  available/reliable from Steamworks for this use case) or a game-UI-only
  cancel path (which alone doesn't cover a player cancelling via Steam's native
  Market UI, the exact gap the review identified). Reusing the AD-13/AD-14
  scheduled-job pattern avoids a new class of infrastructure for this.
- **Trade-off:** A card sold or delisted on Steam's side is only reflected in
  Postgres on the next reconciliation poll, not instantly — a small window
  where a just-sold card's Postgres state still reads `Listed` (harmless, since
  `Listed` already blocks fusion) and a small window where a just-cancelled
  listing still blocks fusion as `Listed` until the next poll confirms it's
  back to `Owned`. Acceptable because it only delays the player's own next
  action slightly; it never re-opens the double-spend/double-list risk this AD
  exists to close.
- **Impact:** Card minting (drops, Summoning Stone grants, AD-12) must always
  set `marketable=false` and Postgres state `Owned` at creation. The Domain
  layer's card-instance state machine is now explicitly four states — `Owned`,
  `Listed`, `PendingOutbox` (fusion's async drain, AD-8), `Consumed` — and every
  consuming action (fusion, and any future one) must validate against all of
  them, not just the subset any single AD names. FR-33/FR-34's server-authority
  requirement now has concrete enforcement points on both directions: the
  "prepare to list" endpoint (blocks listing an already-committed-to-fusion
  card) and fusion's own validation (blocks fusing an already-`Listed` card).

### AD-9 — Local save is a cache, never authority
- **Decision:** The client persists an encrypted local file (Unity
  `Application.persistentDataPath`) holding the last reconciled server state plus
  any not-yet-synced events from the log in AD-6. Steam Cloud syncs this file
  across a player's devices. Postgres remains the source of truth used to resolve
  any conflict on next sync.
- **Reason:** FR-43/FR-44/NFR-2 require cross-device continuity and crash-safe
  writes; combined with AD-6, the file's job is instant load and offline play, not
  authority.
- **Trade-off:** Local encryption raises the bar against casual save editing but
  is not a security boundary — that boundary is server-side event validation
  (AD-6), not the file's secrecy.
- **Impact:** No gameplay code may treat the local file as authoritative for
  anything Market-relevant; a stale or edited local file is always corrected by
  the next server reconciliation, not trusted.

### AD-10 — REST+JSON over HTTPS, versioned, session-token auth
- **Decision:** Client-backend communication is REST+JSON over HTTPS under
  `/api/v1/...`. The Steam Auth Session Ticket (AD-5) is exchanged once for a
  short-lived backend session token, sent as a bearer credential on subsequent
  calls.
- **Reason:** AD-6's batched, non-per-frame sync model doesn't need gRPC or a
  persistent WebSocket; REST+JSON keeps the integration surface simple for a
  team that isn't solo but is still small.
- **Trade-off:** Not suited to anything genuinely latency-sensitive. Acceptable
  because Season Cave (FR-38) is a race-to-milestone/highest-damage metric, not a
  live spectator or real-time PvP feature.
- **Impact:** A future real-time feature (e.g. a live season leaderboard ticker)
  is an explicit deferred/open item requiring its own transport decision, not
  something assumed to fall out of this protocol.

### AD-11 — Observability without a third-party analytics vendor in v1
- **Decision:** The backend uses structured logging (Serilog) and a health-check
  endpoint. The §9 success metrics (Summoning Stone revenue mix, Season Cave entry
  rate, Market volume/price deviation, retention/time-to-clear) are computed from
  the backend's own event data (the AD-6 event log, persisted in Postgres),
  not a separate analytics SDK.
- **Reason:** Avoids adding a third-party data-collection dependency before
  NFR-5's legal/compliance review has run; reuses infrastructure already required
  for anti-cheat sync instead of duplicating it.
- **Trade-off:** Less turnkey dashboarding than a vendor product (Amplitude/
  GameAnalytics); querying/reporting tooling on top of Postgres is on the team to
  build.
- **Impact:** If a vendor analytics SDK is added later, it is an additive
  decision revisited post-NFR-5, not assumed here.

### AD-12 — Deterministic Summoning Stone purchases go through Steamworks Microtransactions (ISteamMicroTxn), backend-orchestrated
- **Decision:** A Summoning Stone purchase (FR-28/FR-29/FR-30) is processed via the
  Steamworks Microtransaction API. The client requests a purchase for a specific
  card; the backend first validates server-side that the requested hero's Hero
  Block (FR-49) is unlocked relative to the player's own furthest cleared stage —
  rejecting the request before any charge is initiated if not — then calls
  `InitTxn` against the Steamworks Web API with the price and the player's
  SteamID; Steam presents its own native payment UI (Steam Wallet or card on
  file); Steam calls back to a backend authorization endpoint; the backend calls
  `FinalizeTxn` to confirm the charge, then grants the chosen card via the same
  outbox-backed Steam Inventory mutation path as fusion (AD-8). The backend never
  exposes the publisher key to the client, and the client never finalizes a
  transaction itself.
- **Reason:** User confirmed this option. It reuses AD-4/AD-8's existing rule that
  all Steam Inventory-mutating calls are backend-only, so a real-money grant is
  handled by the same trusted path as a fusion or drop grant, rather than
  introducing a second, differently-shaped mutation path. It also avoids operating
  a separate payment processor outside the Steam ecosystem.
- **Trade-off:** Ties the purchase flow to Steam's own transaction UI/latency and
  to Valve's approval of the microtransaction integration (see NFR-5/§11 risk);
  the backend must implement and securely expose the `InitTxn` authorization
  callback endpoint.
- **Impact:** The backend owns a `Purchase`/transaction record keyed by Steam's
  transaction ID, reconciled with the AD-8 outbox entry that performs the actual
  card grant. No client code calls `ISteamMicroTxn` directly, and no purchase is
  reported "complete" to the player until `FinalizeTxn` succeeds and the outbox
  grant is confirmed applied — the same completion discipline AD-8 already uses
  for fusion.

### AD-13 — Market reference price is a backend-cached periodic snapshot via the unofficial `priceoverview` endpoint
- **Decision:** A background backend job polls Valve's unofficial, unsupported
  `steamcommunity.com/market/priceoverview` endpoint per tradeable card at a fixed
  interval (parameter TBD in tuning) and stores the last-known price plus its
  fetch timestamp in Postgres. The client never calls this endpoint directly and
  never gets a truly real-time quote; it reads the cached value and displays its
  age (FR-29's "updated Xh ago").
- **Reason:** User confirmed softening FR-29 to a periodic reference price rather
  than a live quote, since Valve has no officially supported API for Market
  pricing — `priceoverview` is the only viable source and is not covered by any
  SLA. Polling on a fixed backend-owned schedule (vs. an on-demand call per
  client request) keeps call volume bounded and predictable regardless of player
  count, reducing rate-limit/block risk.
- **Trade-off:** The displayed price can lag actual Market movement by up to the
  polling interval; acceptable because FR-29 only needs a *soft* price-ceiling
  reference for player comparison, not a transaction-grade quote — no purchase or
  balance decision in this system depends on this value being exact or current
  to the second.
- **Impact:** If Valve changes or blocks `priceoverview` at scale, this AD is the
  first thing that breaks — the price panel must degrade to "price unavailable"
  rather than blocking the Summoning Stone purchase flow (AD-12), which does not
  depend on this value.

### AD-14 — Market anti-bot detection (NFR-8) runs as a scheduled job over the AD-6 event log
- **Decision:** NFR-8's Market-scoped abuse detection (anomalous drop/farming
  rate, listing-rate patterns) runs as a periodic scheduled backend job that
  queries the same append-only event log AD-6 already requires for progress
  reconciliation — not a separate dedicated detection service.
- **Reason:** User confirmed this over standing up a dedicated service. It reuses
  data and job infrastructure the backend already has for AD-6/AD-11 instead of
  adding a new deployable component, which fits a small team without dedicated
  infra headcount (same reasoning as AD-3's Fargate choice) better than a
  bespoke real-time detection service for v1.
- **Trade-off:** Detection latency is bounded by the job's polling interval, not
  real-time/streaming — an abuse pattern is caught on the next scheduled run,
  not the instant it happens. Accepted because NFR-8 requires *some* Market-
  scoped detection to exist, not sub-second response.
- **Impact:** NFR-8 names two mechanisms; only the pattern-anomaly side (drop/
  farming-rate analysis) is this AD's scheduled-job decision. The listing
  rate-limit half of NFR-8 is a hard precondition, not an analysis, and so is
  enforced inline at request time in AD-8b's "prepare to list" endpoint
  regardless of this AD — the two mechanisms have different natural homes by
  their own nature, not because a hybrid architecture was chosen here. Exact
  interval, signals, and thresholds for the scheduled job remain a tuning/ops
  deliverable (see NFR-8 in PRD.md).

### AD-15 — Crafting/enchanting is a single server-side Postgres transaction, no outbox; affix RNG is server-only
- **Decision:** Crafting and re-rolling equipment affixes (FR-19–24) is one
  backend transaction: validate gold balance and the requested slot's affix
  range → debit the gold cost → generate the affix roll server-side → persist
  the new roll → append the corresponding event to the AD-6 event log → commit.
  Unlike fusion (AD-8), this has no outbox step and no Steam Inventory call,
  because equipment is account-bound and not Market-tradeable (FR-24) — there is
  no second external system to keep eventually consistent with. The affix roll
  itself is always computed and validated server-side; the client never
  pre-computes or predicts a roll locally, and only displays the value the
  server returns.
- **Reason:** User confirmed both: (a) crafting doesn't need AD-8's outbox/saga
  machinery since it never touches Steam Inventory, so a single atomic
  transaction is sufficient and simpler; (b) server-only RNG avoids exposing
  affix-roll logic or seed state to a client that could otherwise be tampered
  with to bias or predict favorable rolls, and crafting is a deliberate,
  network-available action (unlike a tap or idle tick) that doesn't need
  AD-6's offline-optimistic-then-reconciled pattern.
- **Trade-off:** Every craft/re-roll action requires a live round-trip to the
  backend — there is no offline crafting, unlike offline gold accrual (FR-41).
  Acceptable because FR-19–24 never claim offline crafting is supported, and
  the action already requires spending gold whose authoritative balance lives
  server-side.
- **Impact:** AD-2's Domain layer gains an explicit crafting rule set (affix
  ranges per slot type, re-roll cost formula, roll-odds table) alongside the
  "fusion curves, drop validation, market ledger invariants" it already names —
  "crafted affixes" stops being only a Postgres column name and becomes a real
  Domain concept with its own validation, matching the level of detail AD-8
  gives fusion.

## Open Questions / Deferred

- **Unity client CI/build pipeline** (Unity Cloud Build / Unity Build Automation
  vs. a self-hosted runner vs. manual Steam depot uploads) — not decided; needed
  before any real release cadence, but independent of the AD-1..AD-11 decisions
  above.
- **Admin/ops tooling** for season rule variants, drop tables, and Summoning
  Stone pricing (FR-29, FR-37) — no admin UI is scoped for v1; content changes are
  assumed to ship via direct data/config changes deployed with the backend. If
  this becomes a live-ops need before launch, it needs its own scoping pass.
- **Outbox worker operational detail** (retry backoff schedule, alerting on
  stuck entries) — deferred to implementation; AD-8 fixes the pattern, not the
  parameters.
- **NFR-5 legal/compliance review** is an external dependency this architecture
  does not resolve. A negative finding on Steam Market card trading in any target
  region would directly affect AD-4/AD-8's design and is the single biggest risk
  to this architecture holding as specified — carried forward from PRD §11 item 1,
  unchanged by this document.
- **Vendor analytics** for §9 metrics — deferred pending NFR-5 (see AD-11).
- **Animation/art production throughput vs. roadmap pacing** (PRD §10) — PRD.md
  explicitly names this "the most likely real bottleneck" on how much of this
  PRD can ship on schedule, and explicitly defers resolving it to "the
  Architecture/roadmap phase." This document does not resolve it: no AD above
  sequences hero count, Hero Block (FR-49) content pacing, or season cadence
  (FR-37/FR-40) against animation throughput, and FR-9's confirmed "5 heroes
  animate simultaneously" mechanic (vs. a single tappable hero) raises this
  cost further, not lower. This is carried forward unresolved from PRD §10,
  same as NFR-5 above, and needs a dedicated production/roadmap pass — not an
  architecture decision — before a launch date or hero/season count is locked.