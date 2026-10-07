# Stage Combat Specification

## Problem Statement

Today combat and stages are two unrelated mechanics: the player clicks a Slime for gold, while a
stage "Attempt" instantly compares squad power with a floor. The Active Squad never fights,
idle time earns nothing online (PORT_MAP B6), and the game PRD's FR-9 ("all 5 heroes attack
automatically and simultaneously on screen") is unmet. AD-002 decides the replacement:
continuous stage progression with fast, timed boss fights.

## Goals

- [ ] The Active Squad fights automatically on screen; clicks add damage on top (FR-9).
- [ ] Progress is continuous: clearing monsters advances stages; bosses gate progress with fights of at most 60 s.
- [ ] A boss failure is labelled Power Gate or Composition Mismatch by the FR-11 rules, and Mismatch emerges from the fight itself (AD-004).
- [ ] Online gold income and offline accrual come from the same squad rate (closes B6).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Drops of heroes, items and potions | boss-drops and boss-potions |
| Exact curves (HP, gold, damage, timers) | economy-tuning; this spec fixes the rules and data shapes |
| Hero art production | Art pipeline; this spec defines the fallback until sheets exist |
| Season Cave rules | season-cave |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Stage structure | 10 monsters per normal stage; every 5th stage is a boss stage with one boss | Genre standard; tunable in content | y (brainstorm) |
| Boss timer | Per-stage content value, default 30 s, hard maximum 60 s enforced by `validate:content` | Developer: boss fights ≤ 60 s | y |
| Auto-advance | On by default; after a boss failure the game farms the previous stage and stops advancing until the player retries the boss | No cost to failing beyond time (FR-12) | y |
| Stage Select | Becomes "jump to stage": any cleared stage (and the next uncleared one) can be selected to farm (FR-13) | AD-002 | y |
| Squad presence on screen | Each Active Squad hero stands on the field as a sprite, attacking continuously (idle/attack Aseprite tags) | Developer choice | y |
| Heroes without a sprite sheet | Use the hero's portrait as a cut-out sprite with a tween lunge per attack | Art does not exist yet; must not block the feature | y |
| Normal monsters fight back | Yes, with damage far below a boss's (curve in economy-tuning), split evenly across living heroes; no leader redirect (AD-004 is boss-only) | Developer, review 2026-10-07 | y |
| Hero hit points and defense | Each hero has its own base HP and base defense in content (not derived from power); defense reduces damage taken by a percentage (`def / (def + K)`, K in economy content); more heroes means a smaller share of boss damage each | Developer, review 2026-10-07 | y |
| Hero HP restore | Every hero returns to full HP at the start of each stage and when a boss fight ends; if every hero falls on a normal stage, that stage restarts at full HP | Failing a normal stage costs only time (FR-12) | y |
| Boss damage distribution | Split evenly across living squad heroes; with no hero of the boss's favored type, all damage goes to the leader (slot 1) | AD-004 | y |
| Knocked-out hero | Deals no damage until its HP is restored; only living heroes attack and share damage | Developer, review 2026-10-07 | y |
| Damage model | Continuous: each 100 ms step deals squad DPS × dt; per-hero attack intervals only pace the attack animations | Exact catch-up equivalence and a rate the backend can bound (AD-007) | y |
| Failure conditions | Timer reaches 0, or the leader is knocked out | Mismatch kills the leader; weak squads run out of time | y |
| Failure label | Always the FR-11 classifier (power below floor → Power Gate, checked first; otherwise no favored type → Composition Mismatch; otherwise Power Gate), regardless of how the fight ended | Keeps FR-11 guarantees independent of how the fight physically ended | y |
| Click damage | Each click deals a share of the Active Squad's total DPS (`clickDpsShare` in economy-tuning content, default 5%); there is no player avatar or click-specific gear | Developer: clicks are influenced by the team's total damage | y |
| Krell | Krell is a regular hero in content (the only one with a full sprite sheet today), not a special character | Developer: Krell was only an example | y |
| Type bonus | Every stage has a favored type; heroes of that type deal `typeBonus` × their damage (economy content, default 1.5) against its monsters and its boss | Developer, review 2026-10-07: makes FR-11 Mismatch hold for any squad size | y |
| Gold per kill | Each monster pays the stage's gold value (curve in economy-tuning); offline accrual uses the current stage's gold/second at the squad's DPS, capped at 12 h | One rate online and offline | y (cap) |
| Backend validation of progress | Boss victories are `BossDefeated` events; the backend accepts a stage only in order (existing StageCleared rule) and bounds gold income per AD-001 (economy-tuning) | AD-001 | y |
| Retired Unity behavior | `StageService.attemptStage` and the instant classifier screen are removed; PORT_MAP records the change | Design freeze S6 is lifted by an explicit game-PRD change (AD-002) | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: The squad fights on its own ⭐ MVP

**User Story**: As a player, I want my Active Squad to attack automatically so that the game progresses while I watch or click.

**Why P1**: FR-9 and the core idle promise.

**Acceptance Criteria**:

1. WHILE a monster is alive the system SHALL apply, every 100 ms step, the sum of each living Active Squad hero's DPS × 0.1 s, multiplied by `typeBonus` for heroes of the stage's favored type.
2. The system SHALL apply no damage from benched heroes (FR-4).
3. WHEN the player clicks the combat area, presses Space, or presses gamepad A on the Combat View THEN the system SHALL apply damage equal to `clickDpsShare` × the Active Squad's current total DPS to the current monster.
4. WHEN a monster's HP reaches 0 THEN the system SHALL award that stage's gold per kill and spawn the next monster within 500 ms of game time.
5. The system SHALL show every Active Squad hero on the field and play its attack animation once per its content attack interval while it is alive and a monster is present.
6. WHERE a hero has no sprite sheet the system SHALL render its portrait as a sprite and tween it forward on each attack.
7. WHILE a normal monster is alive the system SHALL deal its damage to the squad, split evenly across living heroes and reduced by each hero's defense.
8. IF every Active Squad hero is knocked out on a normal stage THEN the system SHALL restart that stage with every hero at full HP.

**Independent Test**: sim: squad of 2 heroes, no clicks, advance 60 s → kills and gold match `DPS × 60 / monster HP`; e2e: `describe()` lists one field node per squad hero.

---

### P1: Continuous stage progression ⭐ MVP

**User Story**: As a player, I want clearing monsters to move me through stages automatically so that progress feels constant.

**Why P1**: AD-002 replaces the attempt-based flow.

**Acceptance Criteria**:

1. WHEN the 10th monster of a normal stage dies THEN the system SHALL start the next stage.
2. WHILE auto-advance is on the system SHALL move from a cleared stage to the next one without player input.
3. WHEN the player selects a cleared stage in Stage Select THEN the system SHALL move combat to that stage and turn auto-advance off.
4. The Stage Select screen SHALL list every cleared stage plus the next uncleared stage, each with its favored type for boss stages.
5. WHEN a stage is cleared for the first time THEN the system SHALL append one `StageCleared` event with that stage number.

**Independent Test**: sim from new-player: advance until stage 4 is reached with no input; e2e: jump to stage 2 from Stage Select and see the HUD stage change.

---

### P1: Timed boss fights ⭐ MVP

**User Story**: As a player, I want bosses to be short, tense fights so that progress has a challenge without slowing the game.

**Why P1**: Bosses gate progress and carry the FR-11 promise.

**Acceptance Criteria**:

1. WHEN a boss stage starts THEN the system SHALL start a countdown equal to that stage's boss timer.
2. The system SHALL reject at content validation any boss timer above 60 s, naming the stage file and field.
3. WHILE a boss fight runs the system SHALL deal the boss's damage to the squad, split evenly across living heroes and reduced by each hero's defense.
4. WHILE a boss fight runs and no Active Squad hero has the boss's favored type the system SHALL deal all boss damage to the leader (slot 1).
5. WHEN a hero's HP reaches 0 THEN the system SHALL stop that hero's damage until its HP is restored, and exclude it from the damage split.
6. WHEN the boss's HP reaches 0 before the timer ends and before the leader falls THEN the system SHALL clear the stage and append one `BossDefeated` event with the stage number.
7. IF the timer reaches 0 or the leader's HP reaches 0 THEN the system SHALL end the fight as a failure.
8. WHEN a boss fight ends or a new stage starts THEN the system SHALL restore every hero to full HP.

**Independent Test**: sim with a fixed seed: a matching squad at the boss's power floor wins; the same power with no favored type loses with the leader knocked out; a squad below the floor loses on the timer.

---

### P1: Failure is labelled by FR-11 ⭐ MVP

**User Story**: As a player, I want to know whether I lost because I am too weak or because my team is wrong so that I know what to fix.

**Why P1**: FR-11 is a core design promise.

**Acceptance Criteria**:

1. IF a boss fight fails and squad power is below the boss's power floor THEN the system SHALL show "⚠ POWER GATE" with the Unity wording, regardless of composition.
2. IF a boss fight fails, squad power is at or above the floor, and no hero has the favored type THEN the system SHALL show "⇄ COMPOSITION MISMATCH" naming the favored type.
3. IF a boss fight fails, power is at or above the floor and a hero has the favored type THEN the system SHALL show "⚠ POWER GATE".
4. WHEN a boss fight fails THEN the system SHALL return combat to the previous stage and turn auto-advance off.
5. WHEN the player chooses "Fight boss" after a failure THEN the system SHALL restart that boss fight at full HP and full timer.
6. The economy-tuning content SHALL make a matching squad at exactly the power floor win, and a non-matching squad at exactly the floor lose, for every boss stage and every squad size from 1 to 5, verified by a sim check.

**Independent Test**: unit tests on the label rules; sim check over all boss stages for AC 6.

---

### P2: Idle gold from the squad

**User Story**: As a player, I want my squad's real-time gold rate to match what I earn offline so that idle play is consistent.

**Why P2**: Closes B6; FR-41.

**Acceptance Criteria**:

1. WHEN the game resumes after an absence THEN the system SHALL credit offline gold at the squad's gold per second on its current farming stage, capped at 12 h.
2. WHEN a gap beyond the 60 s catch-up cap is applied while running THEN the system SHALL credit the excess through the same offline formula.
3. The system SHALL never credit offline time with boss victories, drops or stage advancement.

**Independent Test**: sim: 10 min of steps vs. a 10 min gap produce gold within relative 1e-6 (restores RFR-8 catch-up equivalence, refactor RFR-21).

---

## Edge Cases

- IF the Active Squad is empty THEN the system SHALL show "Add a hero to your Active Squad to fight" and spawn no monsters.
- IF the leader is benched during a boss fight THEN the system SHALL end the fight as a failure (squad changes are not allowed mid-boss; the Roster shows the reason).
- WHEN the furthest stage is the last stage in content THEN the system SHALL keep farming it and show "More stages coming soon".
- IF a boss is defeated while offline from the backend THEN the system SHALL queue `BossDefeated` and grant its rewards only after the backend accepts it (AD-001).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| COMBAT-01 | P1: Squad fights (AC 1–4, 7–8) | - | Pending |
| COMBAT-02 | P1: Squad fights (AC 5–6, field sprites) | - | Pending |
| COMBAT-03 | P1: Continuous progression | - | Pending |
| COMBAT-04 | P1: Timed boss fights (AC 1–2, 6–8) | - | Pending |
| COMBAT-05 | P1: Timed boss fights (AC 3–5, damage + AD-004) | - | Pending |
| COMBAT-06 | P1: Failure labels | - | Pending |
| COMBAT-07 | P2: Idle gold from the squad | - | Pending |
| COMBAT-08 | Edge cases | - | Pending |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped ⚠️

---

## Success Criteria

- [ ] A boss fight never lasts more than 60 s of game time.
- [ ] The FR-11 sim check passes for 100% of boss stages in content.
- [ ] Catch-up equivalence (10 min of steps vs. a 10 min gap) holds within relative 1e-6.
