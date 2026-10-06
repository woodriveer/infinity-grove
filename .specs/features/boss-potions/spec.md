# Boss Potions Specification

## Problem Statement

Boss fights (stage-combat) are short and decisive, with no tactical choice beyond squad
composition. The game PRD (FR-14) adds consumable potions usable only in boss fights. The
developer decided potions come only from boss drops; with fights of at most 60 s, timing a
potion is the tactical decision.

## Goals

- [ ] Bosses drop potions; the player holds a capped stock and fires them mid-boss.
- [ ] Potion stock and consumption are server-validated (AD-001).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Buying potions | Developer: only drops |
| Potions on normal stages or in Season Cave | FR-14 limits them to boss encounters; Season Cave is normalized (season-cave) |
| Potion crafting | Not requested |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Source | Boss defeats only, rolled by the backend | Developer | y |
| Drop chance | 20% per boss defeat, type uniform among the four kinds; number in economy-tuning | Placeholder until tuning | n |
| Kinds | +50% attack, +50% attack speed, double attack (each hit lands twice), double projectile (hits two targets / boss takes a second hit) — all from FR-14 | FR-14 examples | n |
| Duration | 10 s of game time | Fits a ≤60 s fight | n |
| Stack rule | At most one active potion of each kind; different kinds stack | Simple and readable | n |
| Inventory cap | 5 per kind; drops beyond the cap are lost with "Potion bag full" | FR-14 "capped inventory" | n |
| Controls | One button per kind in the boss HUD, also bound to keys 1–4 and gamepad X/Y/LB/RB during boss fights | Must be usable without a pointer (RFR-43) | n |
| Consumption authority | Client applies the effect immediately; a `PotionUsed` event is validated by the backend against stock; an invalid use invalidates that boss victory | AD-001 without input lag | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Use a potion in a boss fight ⭐ MVP

**User Story**: As a player, I want to fire a potion at the right moment so that I can beat a boss that is just out of reach.

**Why P1**: FR-14.

**Acceptance Criteria**:

1. WHILE a boss fight runs the system SHALL show one potion button per kind with the count owned.
2. WHILE no boss fight runs the system SHALL hide the potion buttons.
3. WHEN the player activates a potion with count ≥ 1 THEN the system SHALL apply its effect for 10 s of game time and reduce the count by 1.
4. IF the same kind is already active THEN the system SHALL disable that button with "Active — <seconds> s".
5. WHEN a potion is activated THEN the system SHALL append one `PotionUsed` event with kind and boss stage.

**Independent Test**: sim: boss just above reach fails without a potion and wins with +50% attack at second 5; e2e: gamepad X activates potion 1 in a boss fight.

---

### P1: Bosses drop potions ⭐ MVP

**User Story**: As a player, I want bosses to drop potions so that farming bosses stocks me up for harder ones.

**Why P1**: Only source of potions.

**Acceptance Criteria**:

1. WHEN the backend accepts a `BossDefeated` event THEN the backend SHALL grant one potion with the tuned probability, kind uniform.
2. IF the account already holds 5 of that kind THEN the backend SHALL not grant it and the client SHALL show "Potion bag full".

**Independent Test**: backend seeded tests; sim with the in-process backend.

---

### P2: Potion use is validated

**User Story**: As the operator, I want potion use checked against stock so that a modified client cannot fire unlimited potions.

**Why P2**: AD-001.

**Acceptance Criteria**:

1. IF the backend receives a `PotionUsed` event for a kind with zero stock THEN the backend SHALL reject it and also reject the `BossDefeated` event of that fight with "Invalid potion use."

**Independent Test**: backend event-validation vectors.

---

## Edge Cases

- WHEN a boss fight ends while a potion is active THEN the system SHALL end the effect.
- IF a potion button is pressed on the frame the fight ends THEN the system SHALL not consume the potion.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| POT-01 | P1: Use a potion | - | Pending |
| POT-02 | P1: Bosses drop potions | - | Pending |
| POT-03 | P2: Potion use is validated | - | Pending |
| POT-04 | Edge cases | - | Pending |

**Coverage:** 4 total, 0 mapped to tasks, 4 unmapped ⚠️

---

## Success Criteria

- [ ] A sim boss tuned to need one potion is won with it and lost without it.
- [ ] Every potion use is matched against server stock.
