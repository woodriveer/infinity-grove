# Season Cave Specification

## Problem Statement

The game has no endgame or competitive mode. The game PRD (FR-35–FR-40) defines Season Cave:
a ranked mode where account power is normalized so hero star quality decides the race, with
rotating season rules, cosmetic-only rewards, and stages that join the base game afterwards.
The developer chose a stage-climb format. Rankings carry status, so results are server-validated
(AD-001).

## Goals

- [ ] Each season opens a cave of new stages with its own rules; entrants climb with normalized power.
- [ ] A leaderboard ranks the highest stage reached, tie-broken by who reached it first.
- [ ] Results are reproduced and validated by the backend before they count.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Final-boss damage ranking | Developer chose the stage climb only |
| Cash, sweepstakes or tradeable prizes | FR-39: cosmetic rewards only |
| Cosmetic art (frames, skins) production | Art pipeline; this spec defines the reward rules |
| Potions in the cave | Normalized mode; boss-potions limits potions to the base game |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Format | Stage climb with season rules; rank = highest cave stage cleared, tie-break = earliest server time | Developer | y |
| Season length | 8 weeks | Genre norm; content value | n |
| Entry gate (FR-36) | Minimum unique heroes owned, value per season in content (default 8), reachable by free play within a season (economy-tuning documents the time) | FR-36 | n |
| Normalization (FR-35) | Every hero fights at a fixed base power × its star multiplier; equipment, enchant levels and Krell's weapon are ignored in the cave | "Star quality is the only differentiator" | n |
| Season rules (FR-37) | Content per season: type damage modifiers (e.g., Water +30%, Fire −30%) and optional new heroes | FR-37 | n |
| Cave combat | Same boss rules as stage-combat (timer ≤ 60 s, AD-004 damage); every cave stage is a boss | Fast climbs; reuses one combat model | n |
| Validation | The client submits squad, stage and seed; the backend re-simulates the fight deterministically and accepts the result only if it reproduces a win | AD-001; ranking forgery is the top cheat target | n |
| Attempts | Unlimited, no cost | FR-12 spirit; time is the cost | n |
| Rewards | Cosmetic frame per rank band (top 1%, top 10%, top 50%, participant), granted at season end | FR-39 | n |
| After the season | Cave stages join the base game as regular stages after the current last stage (FR-40) | FR-40 | y (PRD) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Enter and climb the cave ⭐ MVP

**User Story**: As a player with enough heroes, I want to climb the season cave so that I compete on hero quality, not hours played.

**Why P1**: FR-35, FR-36.

**Acceptance Criteria**:

1. WHILE the account owns fewer unique heroes than the season's gate the system SHALL show the cave locked with "Requires <n> unique heroes (you have <m>)".
2. WHEN an eligible player starts a cave stage THEN the system SHALL compute every hero's power as the normalized base × its star multiplier, ignoring equipment and enchant levels.
3. WHILE a cave fight runs the system SHALL apply the season's type modifiers to damage.
4. WHEN the player wins a cave stage THEN the system SHALL submit squad, stage and seed to the backend and show the result only after it is accepted.

**Independent Test**: sim: two accounts with equal heroes but different gear produce identical cave results; e2e: locked label with a small roster fixture.

---

### P1: Server-validated ranking ⭐ MVP

**User Story**: As a competitor, I want rankings that cannot be faked so that the race is fair.

**Why P1**: AD-001; FR-38.

**Acceptance Criteria**:

1. WHEN the backend receives a cave result THEN the backend SHALL re-simulate the fight with the submitted squad and seed and accept it only if the simulation ends in a win.
2. IF the submitted squad contains a hero or star tier the account does not own THEN the backend SHALL reject the result with "Squad does not match the account."
3. The backend SHALL rank accounts by highest accepted cave stage, ties ordered by the server time of acceptance.
4. WHEN the player opens the leaderboard THEN the system SHALL show the top 100 and the player's own rank.

**Independent Test**: VectorGen vectors of cave fights (same simulation in TS and .NET); backend rejection tests.

---

### P2: Season lifecycle and rewards

**User Story**: As a player, I want seasons to end with cosmetic rewards and their stages to stay so that every season leaves something behind.

**Why P2**: FR-39, FR-40.

**Acceptance Criteria**:

1. WHEN a season ends THEN the backend SHALL grant each participant the cosmetic frame of their rank band.
2. WHEN a season ends THEN the system SHALL add that season's stages to the base game after the current last stage.
3. The system SHALL grant no gold, hero cards, items or tradeable goods as season rewards.

**Independent Test**: backend season-close job test with a fixture leaderboard.

---

## Edge Cases

- IF a player starts a cave fight before season end and finishes after THEN the backend SHALL reject the result with "Season has ended."
- IF the client and backend simulations disagree THEN the backend SHALL reject the result and log both seeds for investigation.
- WHEN two players reach the same stage THEN the earlier accepted result SHALL rank higher.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAVE-01 | P1: Enter and climb (AC 1–3) | - | Pending |
| CAVE-02 | P1: Enter and climb (AC 4) | - | Pending |
| CAVE-03 | P1: Server-validated ranking | - | Pending |
| CAVE-04 | P2: Season lifecycle and rewards | - | Pending |
| CAVE-05 | Edge cases | - | Pending |

**Coverage:** 5 total, 0 mapped to tasks, 5 unmapped ⚠️

---

## Success Criteria

- [ ] TS and .NET cave simulations agree on 100% of vectors (deterministic fights).
- [ ] No result is ranked without a backend re-simulation.
