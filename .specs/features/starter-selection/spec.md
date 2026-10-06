# Starter Selection Specification

## Problem Statement

A new game starts with one hero fixed in content data (`settings.starterHeroId`, refactor RFR-14).
The game PRD (FR-1) promises a real first choice between starter heroes, made with enough
information to matter. Without it the first decision of the game is missing and the paused
Unity `playable-vertical-slice` work has no Phaser equivalent.

## Goals

- [ ] A new save shows a starter choice before the first fight; the chosen hero is owned and leads the Active Squad.
- [ ] The choice is permanent for the save and never blocks acquiring the other starters later.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Hero art and combat animation for the starters | stage-combat owns on-field sprites |
| Re-picking or resetting the starter | FR-1: the choice is permanent for that save |
| Tutorial / onboarding flow beyond the choice | Not requested; separate feature if wanted |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Number of starters | Exactly 3, each a different hero type | FR-1 allows 3–5; 3 keeps the choice readable and covers three types | n |
| Which heroes are starters | Heroes flagged `starter: true` in content (a new optional hero field) | Content, not code, decides (RFR-12) | n |
| Information shown per starter | Name, portrait, type (abbreviation + name), base power, 1★ ability text | FR-1 "role/type/base stats"; reuses existing hero data | n |
| Where the chosen hero goes | Active Squad slot 1 (leader, AD-004) | The leader matters in boss fights; the only hero should lead | n |
| Server authority (AD-001) | The choice is a `StarterChosen` event the backend validates (hero is a starter, account has no starter yet) and that grants the card | A free hero card has Market value | n |
| Offline first launch | Choice is allowed offline; the grant is queued and validated on first sync | The game must be playable offline (RFR-30) | n |
| Confirm step | One confirm dialog ("Lead with X? This choice is permanent.") with focus on Cancel | Irreversible choice; same pattern as fusion (EXPERIENCE) | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Choose a starter on a new game ⭐ MVP

**User Story**: As a new player, I want to pick my first hero from a few options so that my first decision shapes how I play.

**Why P1**: FR-1; nothing else in the core loop starts without an owned hero.

**Acceptance Criteria**:

1. WHEN a save has no chosen starter and no owned hero THEN the system SHALL show the starter screen before combat begins.
2. The starter screen SHALL list exactly the heroes flagged as starters in content, each with name, type abbreviation and name, base power and 1★ ability text.
3. WHEN the player confirms a starter THEN the system SHALL add that hero to the roster and place it in Active Squad slot 1.
4. WHEN the player confirms a starter THEN the system SHALL append one `StarterChosen` event carrying that hero's backend id.
5. WHILE a save already has a chosen starter the system SHALL never show the starter screen again.
6. WHEN the player picks a starter THEN the system SHALL open a confirm dialog whose initial focus is Cancel.

**Independent Test**: e2e `?save=none` shows the starter screen; gamepad-only pick + confirm → `describe()` of Roster shows the hero in slot 1; reload keeps it and skips the screen.

---

### P1: Server validates the starter grant ⭐ MVP

**User Story**: As the game operator, I want the backend to grant the starter so that a modified client cannot claim extra free heroes.

**Why P1**: AD-001; a starter card is a tradeable hero card.

**Acceptance Criteria**:

1. WHEN the backend receives a `StarterChosen` event for an account with no starter and a hero flagged as starter THEN the backend SHALL add one copy of that hero to the account roster.
2. IF the account already has a starter THEN the backend SHALL reject the event with reason "Starter already chosen."
3. IF the hero is not a starter THEN the backend SHALL reject the event with reason "Hero is not a starter."

**Independent Test**: VectorGen event-validation scenarios for the three cases; TS replay matches them.

---

### P2: Other starters remain obtainable

**User Story**: As a player, I want the starters I did not pick to still drop later so that my choice is not a permanent loss.

**Why P2**: FR-1 AC; depends on boss-drops existing.

**Acceptance Criteria**:

1. The drop tables SHALL include non-chosen starters on the same terms as any other hero of their band.

**Independent Test**: sim scenario with a seeded drop shows a non-chosen starter added to the bench.

---

## Edge Cases

- IF the player quits before confirming THEN the system SHALL show the starter screen again on next launch.
- IF a synced backend state already contains a starter (another device) THEN the system SHALL adopt it and skip the starter screen.
- IF content flags fewer than 3 starters THEN `validate:content` SHALL fail naming `heroes/*.json` and the field `starter`.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| STARTER-01 | P1: Choose a starter (AC 1–2) | - | Pending |
| STARTER-02 | P1: Choose a starter (AC 3–4) | - | Pending |
| STARTER-03 | P1: Choose a starter (AC 5–6) | - | Pending |
| STARTER-04 | P1: Server validates the grant | - | Pending |
| STARTER-05 | P2: Other starters remain obtainable | - | Pending |
| STARTER-06 | Edge cases | - | Pending |

**Coverage:** 6 total, 0 mapped to tasks, 6 unmapped ⚠️

---

## Success Criteria

- [ ] A new player reaches the first fight with a chosen hero in under 60 s of interaction.
- [ ] Zero ways to obtain a second free starter (backend rejects every attempt in tests).
