# Playable Vertical Slice Specification

> **Status: superseded (2026-10-06).** Written for the Unity client, which is being replaced
> (refactor-unity-to-phaser4). Its scope is re-specified for the Phaser client by
> `starter-selection`, `stage-combat` and `boss-drops` (see `.specs/STATE.md` AD-002/AD-003).
> Kept for history; do not implement.

## Problem Statement

Infinity Grove's launch-grade PRD (`.antstack/specs/infinity-grove/PRD.md`) and its full
backend (ASP.NET Core + PostgreSQL, `Backend/`) and layered Unity client (VContainer,
`Assets/Scripts/Game/{Data,Domain,Service,Presentation}`) are already code-complete for
Roster/Squad, Fusion, Equipment, Crafting, Loadout Presets, and Stage Select (PLAN.md
T002/T007/T008, confirmed done). None of it is playable: `HeroData`/`StageData` content
assets don't exist, so `GameLifetimeScope`'s `_heroPool`/`_stagePool` are empty, every new
screen has nothing to display, and there is no path (starter grant or combat drop) for a
player to ever own a hero. Only the old single-hero Krell/Monster vertical slice (gold-only,
no cards, no gear) currently runs end to end. This feature closes that gap: author the
minimum content and wiring for a real local play session through the new systems, without
attempting the PRD's full launch scope (Steam Market, real money, seasons, 600 stages,
legal review) which is out of reach and out of place in this pass.

## Goals

- [ ] A new local save can start the game, choose a starter hero, and see that hero owned and in the Active Squad before the first stage.
- [ ] Playing (clicking through the existing walk/fight loop) has a chance to drop hero cards and equipment, feeding the Roster/Fusion/Equipment screens with real content over a session.
- [ ] Roster, Fusion, Equipment, Crafting, Loadout Preset, and Stage Select screens are each demonstrated working against real data in Unity Play Mode, not just compiling.
- [ ] Stage Select produces both a Power Gate failure and a Composition Mismatch failure at least once each, verified by an actual play pass (PRD FR-11's core promise).
- [ ] No live backend, Steam session, or real-money path is required to play.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Steam Community Market, Summoning Stones, real-money purchases | Requires Valve approval, a live backend deployment, and legal review (PRD §11 item 1/NFR-5) — unreachable in this pass. |
| Live backend integration (Postgres/ASP.NET running, Steam auth) | Code exists and is untouched by this feature; local-only stubs (`EncryptedSaveFileStore`, `LocalOnlyCloudStore`, `DevSteamIdentityProvider`) already registered in `GameLifetimeScope` are used as-is. |
| Season Cave, seasonal content, ~600-stage launch content | Endgame/content-scale work, not required for "playable"; a small stage set (≈15-20) exercises the same mechanics. |
| 5-hero simultaneous animated combat on screen (FR-9's visual claim) | No animation kits exist for any hero but Krell (Druid/Ranger have concept art only); PRD §10 flags this as the single biggest production bottleneck. Stage attempts stay the already-coded abstract power/type classifier (`StageService`), not a live battle scene. |
| Fusion cost curve / drop rate / crafting cost tuning balance pass | FR-8/FR-16/FR-23 are explicitly deferred tuning work in the PRD; this feature picks workable placeholder numbers, not balanced ones. |
| Boss stages & consumable potions (FR-14) | No boss/potion content or UI exists yet; unrelated to unblocking the already-built systems this feature targets. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Which heroes to author as content | 4 starter-eligible heroes: Krell (reuses existing idle/walk/punch sprites/animator), plus Ranger, Druid, and one new original hero — all four using a static portrait `Sprite` only (no combat animation) since only Krell has an animation kit | Meets FR-1's "3-5 starter options"; avoids inventing art production this pass | n (agent default, user picked "migrate to new system" broadly, not this specific count) |
| Starter hero selection UX | A minimal one-time "Choose Your Hero" screen (new `StarterSelectPresenter` using existing `UiFactory` helpers) shown when `IRosterService.AllHeroes` is empty at boot; picking grants the card via `AddHeroCard` and auto-activates it into the Active Squad | FR-1 requires the choice be presented before the first stage with role/type/stats visible; no such screen exists yet | n |
| How stage attempts connect to visible combat | They don't, by design — `StageService.AttemptStage` stays the existing instant power/type classifier; the old walk/fight scene is the only literal on-screen combat and is reframed as generic "farming" (gold + card/gear drops), not a per-stage battle | Matches how `StageService` was already implemented (no `ICombatService` dependency); rebuilding it as a live battle is an animation-cost problem this pass explicitly avoids | n |
| Drop mechanism | Extend `CombatService.HandleMonsterDefeated` (or an equivalent orchestration point) to roll, per monster kill: a small chance of a hero card (random entry from the wired hero pool, via `IRosterService.AddHeroCard`) and a small chance of an equipment drop (via the existing equipment/bag service), independent of the gold roll already there | FR-16/17/19 require drops to be how cards/gear normally enter play; without this the new screens have no content path outside a debug seed | n |
| Stage content volume | 15 `StageData` assets, `stageNumber` 1-15, `powerFloor` increasing roughly geometrically, `favoredType` cycling through all `HeroType` enum values at least twice | Enough to exercise both Power Gate and Composition Mismatch outcomes and the stage list UI without authoring anywhere near 600 | n |
| Equipment content volume | Reuse existing `EquipmentItemData`/`Equipment` definitions if any exist; otherwise author one item per slot (weapon/chest/boots/gloves) per archetype (Strength/Intelligence/Agility) = up to 12 items, whatever the existing crafting/loadout-preset code expects as a minimum to demo | `CraftingPresenter`/`EquipmentPresenter`/`LoadoutPresetPresenter` need real bag items to show non-empty state | n |
| Persistence scope | New content (`heroId`s, `stageNumber`s) is added to the local save/event-log shapes already coded; no new save-format migration work is introduced beyond what naturally falls out of populating previously-empty pools | AD-6/AD-9 already designed the save/event shapes generically; this feature is content, not new persistence architecture | n |

**Open questions:** none - all resolved above via agent defaults consistent with the user's
"migrate to the new system, local-only" scope decision; flagged `n` (not individually
re-confirmed) because they are implementation-detail defaults within that already-approved
direction, not new product decisions.

---

## User Stories

### P1: Author starter hero content and wire the hero pool ⭐ MVP

**User Story**: As a player, I want to choose from a few real heroes at the start of a new
game so that the Roster/Fusion/Equipment/Stage-Select screens have something to show and
manage.

**Why P1**: Every other screen in the new architecture is empty and non-functional without
at least one owned hero; this is the root blocker identified by investigation.

**Acceptance Criteria**:

1. The system SHALL provide at least 3 and at most 5 `HeroData` assets, each with a unique `heroId`, non-empty `displayName`, a `heroType`, a non-zero `basePower`, and a non-null `portrait`.
2. The `GameLifetimeScope.Bootstrap` GameObject in `Game Scene.unity` SHALL have its `_heroPool` field assigned to reference every authored `HeroData` asset.
3. WHEN a new local save has zero owned heroes (`IRosterService.AllHeroes` is empty) THEN the system SHALL present a hero-choice screen showing each starter hero's name, type, and base power before any stage can be attempted.
4. WHEN the player selects a starter hero on that screen THEN the system SHALL add that hero to the roster via `IRosterService.AddHeroCard` and place it in the Active Squad via `IRosterService.TryActivate`, and SHALL NOT show the hero-choice screen again for that save.
5. WHILE the roster already has at least one owned hero (an existing or reconciled save) THE system SHALL skip the hero-choice screen entirely.

**Independent Test**: Delete/rename the local save file, enter Play Mode from Main Menu →
Game Scene, confirm the hero-choice screen appears with 3-5 legible options, pick one,
confirm it appears in the Roster screen's Active Squad list.

---

### P2: Author stage content and verify Stage Select outcomes

**User Story**: As a player, I want to see a real list of stages with their type modifier
and attempt them, getting an honest Power Gate or Composition Mismatch verdict, so the
stage-progression loop has something concrete to interact with.

**Why P2**: Depends on P1 (needs an Active Squad to have any power/type to classify);
distinct, independently demoable screen once P1 exists.

**Acceptance Criteria**:

1. The system SHALL provide 15 `StageData` assets with ascending `stageNumber` (1-15), each with a `favoredType` and a `powerFloor`.
2. The `GameLifetimeScope.Bootstrap` GameObject SHALL have its `_stagePool` field assigned to reference every authored `StageData` asset in `stageNumber` order.
3. WHEN the player opens Stage Select THEN the system SHALL display each stage's `favoredType` and a preview of Power-Gate/Composition-Mismatch risk against the current Active Squad, before the player attempts it (PRD FR-46).
4. WHEN the player attempts a stage whose `powerFloor` exceeds the current Active Squad's total power THEN the system SHALL classify the outcome as Power Gate, regardless of squad composition.
5. WHEN the player attempts a stage whose `powerFloor` is at or below the current Active Squad's total power but whose `favoredType` matches no Active Squad member THEN the system SHALL classify the outcome as Composition Mismatch.
6. WHEN the player attempts a stage whose `powerFloor` is at or below the current Active Squad's total power and whose `favoredType` matches at least one Active Squad member THEN the system SHALL classify the outcome as a success and, if `stageNumber` exceeds the previous `FurthestClearedStage`, SHALL advance it.

**Independent Test**: With a low-power starter squad, attempt a high-`powerFloor` stage and
confirm a Power Gate result; then attempt a low-`powerFloor` stage whose `favoredType` the
squad lacks and confirm a Composition Mismatch result; then attempt one the squad is built
for and confirm success and progress advancement.

---

### P2: Connect combat kills to card and equipment drops

**User Story**: As a player, I want killing monsters in the existing walk/fight loop to
sometimes reward a hero card or gear, so I can grow my roster and bag through normal play
instead of the screens staying permanently empty after the starter grant.

**Why P2**: Without this, Fusion (needs duplicates) and Equipment/Crafting (needs bag
items) are unreachable after the one-time starter grant — the screens exist but nothing
ever changes.

**Acceptance Criteria**:

1. WHEN a monster is defeated THEN the system SHALL, in addition to the existing gold reward, roll an independent chance to grant one hero card (a random entry from the wired hero pool) via `IRosterService.AddHeroCard`.
2. WHEN a monster is defeated THEN the system SHALL roll an independent chance to grant one equipment item into the shared account-wide bag via the existing equipment/bag service.
3. WHEN a granted hero card corresponds to a hero already owned THEN the system SHALL increase that hero's duplicate count (existing `AddHeroCard` semantics), making it available as fusion material.
4. The system SHALL NOT block or slow the existing walk/fight/gold loop timing as a result of adding the drop rolls.

**Independent Test**: Play through several monster kills and observe at least one hero-card
drop (visible as a new/duplicate entry in the Roster/Bench or a "fusable" tag) and at least
one equipment drop (visible in the Equipment bag) within a reasonable number of kills.

---

### P2: Verify Fusion, Equipment, Crafting, and Loadout Preset screens against real data

**User Story**: As a developer verifying this feature, I want to confirm each already-coded
screen actually works once real content and drops exist, not just that it compiles.

**Why P2**: The prior investigation confirmed these screens are wired into the scene and DI
container but has never been exercised against non-empty pools; untested assumptions in
each Presenter against real data are the most likely remaining runtime break.

**Acceptance Criteria**:

1. WHEN the player owns at least one duplicate of a hero (via P1 starter pick + a P2 drop, or two drops of the same hero) THEN the Fusion screen SHALL show that hero's current star tier, duplicates owned, duplicates required for the next tier, and the next tier's ability text, and SHALL allow fusing when the duplicate requirement is met.
2. WHEN the player owns at least one bag equipment item THEN the Equipment screen SHALL allow equipping it to an Active Squad hero's matching slot and reflect the change immediately.
3. WHEN the player has an equipped item THEN the Crafting screen SHALL show its current affix roll(s) and the cost to re-roll, and re-rolling SHALL change the displayed affix within the slot's defined range.
4. WHEN the player saves a Loadout Preset for an archetype and later applies it to a hero with matching bag items THEN the Loadout Preset screen SHALL re-equip all 4 slots in one action.

**Independent Test**: Manual Play Mode pass through Fusion (fuse a duplicate), Equipment
(equip/unequip an item), Crafting (re-roll an affix), and Loadout Presets (save then apply a
preset), confirming each action's visible result matches the AC and no exception is logged
in the Console.

---

## Edge Cases

- IF the hero-choice screen is shown but the player closes/backgrounds the game before picking THEN the system SHALL re-show the hero-choice screen on next launch (roster still empty) rather than leaving the game in an unplayable state with no owned hero.
- IF a card or equipment drop roll succeeds but the relevant pool (`_heroPool` or the equipment catalog) is empty THEN the system SHALL skip the grant silently (no exception), matching the existing `SpawnMonster` null/empty-pool guard style already in `CombatService`.
- IF the Active Squad is empty when a stage is attempted THEN the system SHALL classify the outcome as Power Gate (zero power never clears a positive `powerFloor`), not throw or crash.
- WHEN a hero is fused to the 12★ cap THEN the Fusion screen SHALL indicate no further fusion is possible for that hero, per existing FR-6 AC.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PLAY-01 | P1: Starter hero content & pool wiring | Tasks | Pending |
| PLAY-02 | P1: Starter hero content & pool wiring | Tasks | Pending |
| PLAY-03 | P1: Starter hero content & pool wiring | Tasks | Pending |
| PLAY-04 | P1: Starter hero content & pool wiring | Tasks | Pending |
| PLAY-05 | P1: Starter hero content & pool wiring | Tasks | Pending |
| PLAY-06 | P2: Stage content & outcomes | Tasks | Pending |
| PLAY-07 | P2: Stage content & outcomes | Tasks | Pending |
| PLAY-08 | P2: Stage content & outcomes | Tasks | Pending |
| PLAY-09 | P2: Stage content & outcomes | Tasks | Pending |
| PLAY-10 | P2: Stage content & outcomes | Tasks | Pending |
| PLAY-11 | P2: Stage content & outcomes | Tasks | Pending |
| PLAY-12 | P2: Combat drops | Tasks | Pending |
| PLAY-13 | P2: Combat drops | Tasks | Pending |
| PLAY-14 | P2: Combat drops | Tasks | Pending |
| PLAY-15 | P2: Combat drops | Tasks | Pending |
| PLAY-16 | P2: Screen verification | Tasks | Pending |
| PLAY-17 | P2: Screen verification | Tasks | Pending |
| PLAY-18 | P2: Screen verification | Tasks | Pending |
| PLAY-19 | P2: Screen verification | Tasks | Pending |

**ID format:** `PLAY-[NUMBER]`, assigned in story order matching each AC line above.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 19 total, 19 to be mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] From a clean local save, a full manual Play Mode pass goes: Main Menu → Game Scene → hero-choice screen → pick a hero → roster shows it active → click through walk/fight loop → observe at least one card and one gear drop → open Roster/Fusion/Equipment/Crafting/Loadout Preset/Stage Select screens and successfully perform one meaningful action in each → attempt stages until both a Power Gate and a Composition Mismatch result are observed → attempt a stage the squad is suited for and see it succeed and advance `FurthestClearedStage`.
- [ ] Zero unhandled exceptions in the Console during that full pass.
- [ ] The project still produces a successful Windows batchmode build (`BuildScript.cs`) after all changes.
- [ ] No change in this feature requires a running backend, a live Steam session, or real money.
