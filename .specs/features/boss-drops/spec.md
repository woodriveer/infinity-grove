# Boss and Monster Drops Specification

## Problem Statement

After the starter, nothing in the game hands out heroes or equipment: Fusion, Equipment and
Crafting only have content through fixtures. The game PRD (FR-16, FR-17, FR-19) makes drops the
normal way to grow the roster and the bag. The developer's design: bosses drop heroes
(guaranteed the first time), monsters and bosses drop equipment, and every roll is decided
by the server (AD-001).

## Goals

- [ ] Each boss's first defeat always yields a hero card; later defeats yield one with 1% chance.
- [ ] Equipment drops from monsters and bosses feed the bag through normal play.
- [ ] No drop can be produced or altered by the client.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Potion drops | boss-potions |
| Drop rate balancing | economy-tuning owns the numbers; this spec fixes rules and data shapes |
| Summoning Stones, Market | Monetization area, not in this brainstorm |
| Server-side fusion (`/cards/fuse` in the client) | Separate feature; noted under Deferred in the brainstorm |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| First-defeat hero drop | 100% on the first defeat of each boss stage, per account | Developer | y |
| Repeat-defeat hero drop | 1% per repeat defeat | Developer | y |
| Type of the dropped hero | 40% the boss's favored type; 60% split evenly across the other four types (15% each) | Developer | y |
| Which hero within the type | Uniform among heroes of that type whose Hero Block band is unlocked at that stage (content field `minStage` per hero) | "Faixa" of the stage, FR-49 Hero Blocks | y |
| Empty type pool | If no hero of the rolled type is unlocked, reroll the type among types that have unlocked heroes | Never waste a guaranteed drop | n |
| New vs. owned hero | New → added to the bench; owned → +1 copy as fusion material (FR-17) | FR-17 | y |
| Equipment drop rates | Normal monster 3%, boss 25%, per kill; numbers live in economy-tuning content | Developer accepted the recommendation | y |
| Equipment drop content | Item template from the stage band's item table; affixes rolled within `CraftingRules` ranges; enchant level +0 | Uses existing item and affix model | n |
| Where rolls happen | Backend, when it accepts a `MonsterKilled` batch / `BossDefeated` event; the response lists granted rewards | AD-001 | y |
| Batching monster kills | Kills sync as counts per stage (`MonsterKillsBatch {stage, count}`), validated against the stage's max kill rate | One event per kill would flood the log | n |
| Display of rewards | Reward toast per drop ("New hero: Tide Caller!" / "Duplicate: Tide Caller +1" / "Item: Bark Blade") | Calm toast pattern exists | n |
| Offline / unsynced | Rewards appear only after the backend grants them; until then the toast says "Rewards pending sync" | AD-001 | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Bosses drop heroes ⭐ MVP

**User Story**: As a player, I want defeating a boss to give me a hero so that my roster grows and I can fuse duplicates.

**Why P1**: The only free source of heroes (FR-18 stage drops).

**Acceptance Criteria**:

1. WHEN the backend accepts the first `BossDefeated` event for a boss stage on an account THEN the backend SHALL grant exactly one hero card.
2. WHEN the backend accepts a repeat `BossDefeated` event THEN the backend SHALL grant one hero card with probability 0.01.
3. WHEN the backend grants a hero card THEN the backend SHALL pick its type as the boss's favored type with probability 0.40 and each other type with probability 0.15.
4. WHEN the backend has picked a type THEN the backend SHALL pick uniformly among heroes of that type whose `minStage` is at or below the boss stage.
5. IF no hero of the picked type is eligible THEN the backend SHALL pick the type again among types with at least one eligible hero.
6. WHEN the client receives a granted hero it does not own THEN the system SHALL add it to the bench and show "New hero: <name>!".
7. WHEN the client receives a granted hero it owns THEN the system SHALL add one duplicate and show "Duplicate: <name> +1".

**Independent Test**: VectorGen vectors for the drop table (seeded backend RNG) and a statistical backend test (100 000 rolls: type shares within ±1 point); sim with the in-process backend shows the first-defeat grant.

---

### P1: Monsters and bosses drop equipment ⭐ MVP

**User Story**: As a player, I want items to drop while I farm so that I have gear to equip, enchant and sell.

**Why P1**: FR-19; feeds equipment-enchant and rotating-shop.

**Acceptance Criteria**:

1. WHEN the backend accepts kills of normal monsters THEN the backend SHALL grant each kill an item with the stage's normal drop chance (default 0.03).
2. WHEN the backend accepts a `BossDefeated` event THEN the backend SHALL grant an item with the stage's boss drop chance (default 0.25), independently of the hero roll.
3. WHEN the backend grants an item THEN the backend SHALL choose the template from the stage band's item table and roll each affix within that slot's range.
4. WHEN the client receives a granted item THEN the system SHALL add it to the bag at +0 and show "Item: <name>".

**Independent Test**: backend unit tests with a fixed seed; sim with the in-process backend shows items in the bag after farming.

---

### P2: Drops cannot be forged

**User Story**: As the operator, I want every drop decided by the server so that cheaters cannot mint heroes or items.

**Why P2**: AD-001; Market value of cards.

**Acceptance Criteria**:

1. The client SHALL never add a hero card or item to state except from a backend grant.
2. IF the backend receives more kills for a stage than the stage's maximum kill rate allows for the elapsed time THEN the backend SHALL reject the excess with reason "Kill rate exceeds the possible maximum."
3. IF the backend receives a `BossDefeated` event for a stage beyond furthest cleared + 1 THEN the backend SHALL reject it with reason "Cannot defeat boss of stage <n> before stage <m>."

**Independent Test**: lint rule (no roster/bag additions outside the grant path, like the AD-22 affix rule); backend event-validation vectors.

---

## Edge Cases

- IF a grant arrives for a hero id missing from client content THEN the system SHALL keep the card in state, show "New hero (update the game to see it)" and log the id.
- WHEN two devices report the same boss's first defeat THEN the backend SHALL grant the guaranteed drop once (first accepted event wins).
- IF the bag is full (economy-tuning cap) THEN the backend SHALL still grant the item and the client SHALL show "Bag full: sell items to make room" and block new item drops until space frees.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DROP-01 | P1: Bosses drop heroes (AC 1–5) | - | Pending |
| DROP-02 | P1: Bosses drop heroes (AC 6–7) | - | Pending |
| DROP-03 | P1: Equipment drops | - | Pending |
| DROP-04 | P2: Drops cannot be forged | - | Pending |
| DROP-05 | Edge cases | - | Pending |

**Coverage:** 5 total, 0 mapped to tasks, 5 unmapped ⚠️

---

## Success Criteria

- [ ] Every boss stage yields its guaranteed hero exactly once per account.
- [ ] Type shares over 100 000 backend rolls land within ±1 percentage point of 40/15/15/15/15.
- [ ] No client code path adds a card or item outside a backend grant (lint + tests).
