# Validation: Stage Combat - PASS

**Date**: 2026-10-07
**Spec**: `.specs/features/stage-combat/spec.md`
**Diff range**: `69b1474^..7b72023` (T1..T24; first stage-combat code commit 69b1474 to HEAD 7b72023)
**Verifier**: independent sub-agent (author != verifier), heartbeat run

**Verdict**: PASS (with one documented pre-existing gate failure, see Gate Check)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1-T24 | Done | All 24 tasks carry `Status: Done (heartbeat ...)` in tasks.md; no `[ ]` left, none blocked |

---

## Spec-Anchored Acceptance Criteria

### P1: The squad fights on its own

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 per-step DPS x 0.1 s, typeBonus on favored | squad DPS x dt, bonus only favored type | `Client/tests/unit/combatAdvance.test.ts:97` (applies squad DPS x 0.1 per step with typeBonus); `Client/tests/unit/combatRules.test.ts:83` (typeBonus on favored only) | PASS |
| AC2 benched heroes deal nothing | none | `Client/tests/unit/combatRules.test.ts:102` (only Active Squad in params), `Client/tests/unit/combatParamsBuilder.test.ts` (benched excluded) | PASS |
| AC3 click / Space / pad A = clickDpsShare x squad DPS | 5% of squad DPS | `Client/tests/unit/combatRules.test.ts:125`; Space `Client/tests/e2e/menu-and-combat.spec.ts:50`; pad A `:26`; mouse `:57` | PASS |
| AC4 kill pays stage gold, next spawn within 500 ms | gold per kill; delay <= 500 ms | `Client/tests/unit/combatAdvance.test.ts:108`, `:78`, `:85`; content cap `Client/tests/unit/content.test.ts:152` (spawnDelayMs 600 rejected) | PASS |
| AC5 every squad hero on field, attack per interval | one field node per hero | `Client/tests/e2e/menu-and-combat.spec.ts:93-97` (`game.field.ranger`, attacks follow interval) | PASS |
| AC6 portrait fallback with lunge | flagged fallback | `Client/tests/e2e/menu-and-combat.spec.ts:101` (`portraitFallback` true) | PASS |
| AC7 normal monster damage split evenly, reduced by defense | even split, def/(def+K) | `Client/tests/unit/combatAdvance.test.ts:118`; `Client/tests/unit/combatRules.test.ts:114` | PASS |
| AC8 all fallen on normal stage restarts at full HP | restart, full HP | `Client/tests/unit/combatAdvance.test.ts:137` | PASS |

### P1: Continuous stage progression

| Criterion | Spec-defined outcome | Evidence | Result |
| --- | --- | --- | --- |
| AC1 10th monster starts next stage | next stage | `Client/tests/unit/combatAdvance.test.ts:172`; e2e `Client/tests/e2e/menu-and-combat.spec.ts:64` | PASS |
| AC2 auto-advance without input | none needed | `Client/scenarios/p13-progression.json` (600 s, no input, furthest 4, clicks 0) run by `Client/tests/sim/scenarios.test.ts` | PASS |
| AC3 select cleared stage moves combat, auto off | stage changes, autoAdvance false | `Client/tests/unit/stageCombatService.test.ts:162`; e2e `Client/tests/e2e/equipment-stages.spec.ts:58-67` (gamepad jump, `game.current`) | PASS |
| AC4 list = cleared + next, favored type on boss rows | `furthest + 1` rows | `Client/tests/unit/services.test.ts:144-146` (selectableStages); e2e `Client/tests/e2e/equipment-stages.spec.ts:74` (boss risk line) | PASS |
| AC5 first clear appends one StageCleared | exactly one, replay none | `Client/tests/unit/stageCombatService.test.ts:91` and `:100` | PASS |

### P1: Timed boss fights

| Criterion | Spec-defined outcome | Evidence | Result |
| --- | --- | --- | --- |
| AC1 countdown = stage boss timer | timer steps | `Client/tests/unit/combatRules.test.ts:69` (boss timer on boss stage only); `Client/tests/unit/combatAdvance.test.ts:197` | PASS |
| AC2 timer > 60 s rejected naming file+field | `stages/bramble-throne.json: boss.timerSeconds: must be at most 60 s` | `Client/tests/unit/content.test.ts:125-126` (61 rejected, exact message), `:134` default timer | PASS |
| AC3 boss damage split evenly, defense-reduced | even split | `Client/tests/unit/combatAdvance.test.ts:229` | PASS |
| AC4 no favored type: all to leader | leader takes all | `Client/tests/unit/combatAdvance.test.ts:236` | PASS |
| AC5 KO stops damage, leaves split | excluded | `Client/tests/unit/combatAdvance.test.ts:149` | PASS |
| AC6 boss dies in time: clear + one BossDefeated | event, then StageCleared | `Client/tests/unit/stageCombatService.test.ts:107-113`; `Client/tests/unit/combatAdvance.test.ts:205` | PASS |
| AC7 timer 0 or leader KO fails | failure either cause | `Client/tests/unit/combatAdvance.test.ts:218` (timer), `:243` (leader), `:257` (non-leader KO does not fail) | PASS |
| AC8 HP restored on boss end / new stage | full HP | `Client/tests/unit/combatAdvance.test.ts:205`, `:218`; `Client/tests/unit/combatRules.test.ts:54` | PASS |

### P1: Failure is labelled by FR-11

| Criterion | Spec-defined outcome | Evidence | Result |
| --- | --- | --- | --- |
| AC1 below floor = POWER GATE | Power Gate any composition | `Client/tests/unit/bossFailureLabel.test.ts:6`; e2e `Client/tests/e2e/combat-hud.spec.ts:15` (`'⚠ POWER GATE - Stage 5 boss'`) | PASS |
| AC2 at floor, no favored = COMPOSITION MISMATCH | Mismatch | `Client/tests/unit/bossFailureLabel.test.ts:10`; `Client/scenarios/p14-boss-mismatch.json` (outcome CompositionMismatch); `Client/tests/unit/stageCombatService.test.ts:127` | PASS |
| AC3 at floor with favored = POWER GATE | Power Gate | `Client/tests/unit/bossFailureLabel.test.ts:14` | PASS |
| AC4 failure returns to previous stage, auto off | stage n-1, autoAdvance false | `Client/tests/unit/stageCombatService.test.ts:116`; `Client/tests/e2e/combat-hud.spec.ts:16-18` | PASS |
| AC5 Fight boss restarts at full HP and timer | full | `Client/tests/unit/stageCombatService.test.ts:174`; e2e `Client/tests/e2e/combat-hud.spec.ts:20-23` | PASS |
| AC6 matching squad at floor wins, non-matching loses, all boss stages, sizes 1-5 | sim check | `Client/tests/sim/fr11-tuning.test.ts:66-78` (bossDefeated / bossFailed + CompositionMismatch), `:81-86` (<= 60 s) | PASS |

### P2: Idle gold from the squad

| Criterion | Spec-defined outcome | Evidence | Result |
| --- | --- | --- | --- |
| AC1 offline gold at squad rate, cap 12 h | `elapsedCreditedMs` 12 h | `Client/tests/unit/services.test.ts:304-307`, `Client/scenarios/p10-offline-accrual.json` (gold 57918, notice 57,600.00 over 8h) | PASS |
| AC2 gap beyond 60 s cap via same formula | excess farmed | `Client/tests/unit/services.test.ts:315-328` | PASS |
| AC3 offline never advances or drops | furthest unchanged | `Client/tests/unit/services.test.ts:308`; `Client/tests/unit/stageCombatService.test.ts:229-233` | PASS |
| Success: 10 min steps vs gap within 1e-6 | rel < 1e-6 | `Client/tests/unit/stageCombatService.test.ts:213-224` (`toBeLessThan(1e-6)`) | PASS |

**Backend (rules the client relies on)**: `Backend/tests/InfinityGrove.Backend.Tests/Progress/PlayerProgressBossDefeatedTests.cs:34-119` (accept in order, replay no-op, skip ahead rejected, non-boss stage rejected, boss `StageCleared` before `BossDefeated` rejected, after accepted, earlier boss does not unlock later), `Events/BossDefeatedIngestionTests.cs:42-90` (batch accepted, rejected alone, malformed payload theory, configured BossEvery). Vectors: `Client/tests/vectors/stage-rules.test.ts`, `Client/tests/unit/domain.test.ts:141`.

**Status**: All ACs have evidence. One spec-precision gap (below).

### Edge cases

- [x] Empty squad: `Client/tests/e2e/combat-hud.spec.ts:36` label `'Add a hero to your Active Squad to fight'`, `combat` value `no squad`; `Client/tests/unit/combatAdvance.test.ts:57`
- [x] Leader benched mid-boss fails the fight: `Client/tests/unit/stageCombatService.test.ts:140`; squad lock `:199-208`
- [x] Last stage keeps farming and shows "More stages coming soon": `Client/tests/unit/gameScreenController.test.ts:24`, `Client/tests/unit/combatAdvance.test.ts:188`
- [~] BossDefeated while backend-offline is queued, rewards only after acceptance: events go through the existing event log (`stageCombatService.test.ts:107`), but no test asserts queueing while offline and no rewards exist yet (drops are out of scope). Spec-precision gap, not a failure.

---

## Discrimination Sensor

Scratch: temporary git worktree `../ig-sensor` (node_modules junction), removed afterwards; `git status --porcelain` identical before and after (clean).

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| 1 | `Client/src/domain/combat/CombatRules.ts:293` | boss timer `bossStepsLeft <= 0` to `< 0` (off by one) | Killed (1 test: expected `bossFailed`) |
| 2 | `Client/src/domain/combat/CombatRules.ts:315` | AD-004 `leaderOnly` forced false | Killed (2 tests) |
| 3 | `Client/src/services/combat/StageCombatService.ts:191` | removed `BossDefeated` event append | Killed (3 tests) |
| 4 | `Client/src/domain/combat/CombatRules.ts:139` | click kill `hp <= 0` to `hp < 0` | Killed (2 tests) |
| 5 | `Client/src/domain/combat/CombatRules.ts:338` | farming mode emits stageCleared / drops kill-only branch (inverted `farming`) | Killed (10 tests) |
| 6 | `Backend/.../Progress/PlayerProgress.cs:~88` | boss-stage clear guard removed | Killed (2 tests) |
| 7 | `Backend/.../Progress/PlayerProgress.cs:~118` | `BossDefeated` accepted on non-boss stage | Killed (1 test) |
| 8 | `Backend/.../Progress/PlayerProgress.cs` `EnsureStageReachable` | reachability `+ 1` to `+ 2` | Killed (1 test) |

**Sensor depth**: lightweight plus extra backend mutations (progress integrity)
**Result**: 8/8 killed

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | OK. Legacy `CombatService`/`PlayerCombatService` removed, `attemptStage` retired. |
| Surgical changes | OK. Diff stays in combat/stages/save/sync/content; Unity untouched (`InfinityGrove/` not in diff). |
| No scope creep | OK. Drops, gold bounding (AD-001) and equipment power are deferred to their features and documented in task notes. |
| Matches patterns | OK. Layer rules enforced by `npm run lint` (127 modules, no violations); events go through `withEvent`. |
| Spec-anchored outcome check | OK, one spec-precision gap above. |
| Per-layer Coverage Expectation | Domain: 1:1 ACs plus 220-seed step-vs-jump property test (`combatJump.test.ts:71`). Services: every command incl. refusals. Screens: e2e with `describe()`. Backend: reject paths covered. |
| Every test maps to a requirement | OK. |
| Guidelines followed | `CLAUDE.md` (tests on both sides, layer rules), `AGENTS.md`. |

Notes: `combatJump.test.ts:129` asserts a wall-clock bound (12 h in < 50 ms), which flakes under machine load (see Gate Check); it is a perf budget, not behavior.

---

## Gate Check

- **Gate command**: `npm run verify` in `Client/` (steps run individually after the first run stopped at `npm test`), plus `dotnet build` / `dotnet test Backend/InfinityGrove.Backend.sln`
- **Client typecheck, lint (+ dependency-cruiser, 15 lint-fixture tests), validate:content, gen:check**: pass
- **Vitest (`npm test`)**: 286 passed, 1 failed on the full run (`combatJump.test.ts` "runs 12 h in under 50 ms", 677 ms under load, known flake). Re-run alone: 5/5 pass (twice). Total 287.
- **Playwright e2e (`npm run test:e2e`)**: 26 passed, 1 failed, 8 did not run. The failure is the known pre-existing `ui-gate.spec.ts` criterion 3 (focus p95 144 ms vs < 100 ms); the 8 not-run tests are serial-mode skips behind it in the same file. Verifier ran them with `--grep-invert "criterion 3"`: 10/10 pass. Not caused by this feature (fails on base commit 878d778 per T4 note).
- **build**: pass. **scan:secrets dist**: clean.
- **Backend**: `dotnet build` 0 warnings, 0 errors; `dotnet test`: 19 passed, 0 failed, 0 skipped (was 0 before T1).
- **Test count before feature**: Vitest 149 (T4 note) / Backend 0. **After**: Vitest 287, Backend 19, e2e 35 (incl. combat-hud 3 new).
- **Skipped**: none authored; 8 e2e serial-skips are a side effect of the ui-gate failure.
- **Docker/sync-e2e**: `npm run test:sync-e2e` not run (needs a running backend container); not part of `verify`.

---

## Fix Plans

No blocking fix tasks. Recommended follow-ups (non-blocking):

1. Minor: `Client/tests/unit/combatJump.test.ts:129` wall-clock 50 ms budget is load-sensitive; measure in a bench/soak or widen the bound with a CPU-relative baseline.
2. Minor: add a service-level test that `BossDefeated` + `StageCleared` stay queued while the backend is unreachable (edge case 4) when boss-drops lands.
3. Pre-existing (not this feature): `ui-gate.spec.ts` criterion 3 focus p95; also consider `test.describe.configure({ mode: 'parallel' })` so one failure does not skip the 8 RFR-43 reachability tests in `verify`.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| COMBAT-01 | Done | Verified |
| COMBAT-02 | Done | Verified |
| COMBAT-03 | Done | Verified |
| COMBAT-04 | Done | Verified |
| COMBAT-05 | Done | Verified |
| COMBAT-06 | Done | Verified |
| COMBAT-07 | Done | Verified |
| COMBAT-08 | Done | Verified (one spec-precision gap) |

---

## Summary

**Overall**: Ready (with the pre-existing ui-gate gate failure documented)

**Spec-anchored check**: 31/31 ACs matched spec outcome by file:line; 1 spec-precision gap (edge case: offline BossDefeated queueing)
**Sensor**: 8/8 mutations killed
**Gate**: Vitest 286/287 (flake passes alone), e2e 26 + 10 pass (criterion 3 pre-existing), Backend 19/19, build and secrets scan clean

**What works**: squad auto-combat, continuous progression, timed bosses with AD-004 targeting, FR-11 labels (sim-checked over all boss stages and sizes 1-5), idle/offline gold from one farm rate, backend boss-order rules with reject paths, vectors.

**Issues found**: none blocking.

**Next steps**: developer review of the follow-ups above; run `test:sync-e2e` against a local backend before cutover.
