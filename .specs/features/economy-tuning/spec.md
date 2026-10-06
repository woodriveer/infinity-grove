# Economy Tuning Specification

## Problem Statement

Every number in the game is a placeholder: monster HP and gold, boss HP, damage and timers,
hero power per star, fusion costs, drop chances, scroll and shop prices, the enchant affix
step. The game PRD defers them to a tuning pass (FR-8, FR-23, FR-27) with one constraint:
costs must feel bounded relative to income. The developer chose a slow, grindy pace and a
12 h offline cap. This feature turns the numbers into versioned content and proves the
pacing with the simulator instead of a spreadsheet.

## Goals

- [ ] All economy numbers live in content files with schemas; no balance value is hard-coded.
- [ ] A pacing check shows a modelled free player reaches stage 50 in ~1 day, stage 300 in ~2 months and stage 600 in 6+ months.
- [ ] The backend bounds gold income so it cannot be forged (AD-001).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Summoning Stone pricing | Monetization area |
| Season Cave normalization numbers | season-cave (uses this feature's curves) |
| Live-ops tooling (remote config) | Later; content ships with the build |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Pacing targets (free player) | Stage 50 ≈ 1 day, 300 ≈ 2 months, 600 ≥ 6 months, each within ±25% | Developer: "slow and grindy" | y |
| Modelled player | 2 sessions per day of 20 min active play (clicking ~3/s during bosses), the rest offline at the 12 h cap; enchants and buys greedily by a fixed policy | Pacing needs a defined player; the policy lives in content | n |
| Offline cap | 12 h | Developer | y |
| Curve form | Monster HP and gold per stage grow geometrically per stage band (`base × growth^stage`), with growth per band in content | Genre standard; satisfies FR-27 when gold growth ≥ cost growth per band | n |
| FR-27 check | For every band, the stages needed to afford the next meaningful upgrade (scroll at the band's average success rate, or a shop item) stay within a content-defined range | Turns "costs feel cheaper" into a test | n |
| Hero power per star | `basePower × starMultiplier[tier]` with the 12-entry table in content | FR-6 tiers; replaces the placeholder `basePower × starTier` | n |
| Fusion cost curve (FR-8) | Moves from code (`tier + 1`) to content, same values initially | Backend `CardFusionCostCurve` reads the same table (vectors keep both in sync) | n |
| Gold income validation | Backend rejects `GoldEarned` beyond (max gold/second of the account's furthest stage × elapsed time since last accepted income + offline cap) | AD-001; closes the client-reported gold gap | n |
| Where the pacing check runs | `npm run pacing` (sim over the modelled player), part of CI as a non-flaky deterministic job (fixed seed) | Terminal-verifiable (refactor RFR-13) | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Economy as content ⭐ MVP

**User Story**: As the developer, I want every balance number in content files so that tuning is a data change, not a code change.

**Why P1**: Every other core-loop feature reads these values.

**Acceptance Criteria**:

1. The system SHALL read monster HP, gold per kill, boss HP, boss damage, boss timer, hero star multipliers, fusion costs, drop chances, potion drop chance, scroll price, shop prices, sell ratio, enchant success table, enchant affix step and offline cap from `content/economy/*.json`.
2. IF any economy file is missing a field, has a negative value, a probability outside [0, 1] or a boss timer above 60 s THEN `validate:content` SHALL fail naming the file and field.
3. The system SHALL contain no economy literal outside content (lint check over `domain/` and `services/` for known economy identifiers).

**Independent Test**: negative content tests (like RFR-10); lint fixture.

---

### P1: Pacing proven by simulation ⭐ MVP

**User Story**: As the developer, I want a command that shows how long the modelled player takes to reach key stages so that I can tune by data.

**Why P1**: Developer's pacing targets must be verifiable.

**Acceptance Criteria**:

1. WHEN `npm run pacing` runs THEN the system SHALL simulate the modelled player and print the in-game time to reach stages 50, 100, 300 and 600.
2. IF any milestone falls outside its target range THEN `npm run pacing` SHALL exit non-zero naming the milestone, the measured time and the target.
3. IF any band breaks the FR-27 affordability range THEN `npm run pacing` SHALL exit non-zero naming the band.
4. The pacing run SHALL be deterministic: two runs with the same seed SHALL print identical output.

**Independent Test**: run twice in CI; deliberately broken content fails with the named milestone.

---

### P2: Gold income is bounded by the server

**User Story**: As the operator, I want the backend to reject impossible gold income so that the economy cannot be inflated by a modified client.

**Why P2**: AD-001; today any non-negative `GoldEarned` is accepted.

**Acceptance Criteria**:

1. IF a `GoldEarned` event exceeds the account's maximum possible income since the last accepted income event THEN the backend SHALL reject it with "Gold income exceeds the possible maximum."
2. WHEN a rejected income event is reconciled THEN the client SHALL show the existing correction toast.

**Independent Test**: backend event-validation vectors; sync-e2e case.

---

## Edge Cases

- IF the device clock jumps backwards THEN the backend SHALL use server receive time for income bounds.
- WHEN the content changes curves between versions THEN saves SHALL keep their progress (curves never rewrite owned state).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TUNE-01 | P1: Economy as content | - | Pending |
| TUNE-02 | P1: Pacing proven by simulation | - | Pending |
| TUNE-03 | P2: Gold income bounded | - | Pending |
| TUNE-04 | Edge cases | - | Pending |

**Coverage:** 4 total, 0 mapped to tasks, 4 unmapped ⚠️

---

## Success Criteria

- [ ] `npm run pacing` passes with the shipped content: stage 50 ≈ 1 day, 300 ≈ 2 months, 600 ≥ 6 months (±25%).
- [ ] Zero economy literals in code.
