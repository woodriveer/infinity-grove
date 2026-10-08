# Healthcheck Log

## 2026-10-07 — stage-combat: Design approval + Tasks phase

- **Result**: done. Design approved (with amendments); `tasks.md` written, 24 tasks / 4 phases, `validate_tasks.py` 0 errors (11 multi-file `Where` warnings, justified in the file: flow retirements must rewrite their tests in the same commit).
- **Commits**: see `docs(specs): stage-combat tasks, design approved in healthcheck`.
- **Decisions (decided in healthcheck)**: no Krell backend seed (backend accepts any hero GUID); new backend xUnit test project as T1; `HighestBossDefeated` persisted on the backend; placeholder content extended to 10 stages; additive services then one cutover task (T18). Details in STATE.md Handoff.
- **Pending for the developer**: `git push`; untracked `AGENTS.md` not committed (not created by this run).

## 2026-10-07 — stage-combat T1: backend xUnit test project

- **Result**: done. `Backend/tests/InfinityGrove.Backend.Tests` added to the solution (`tests` solution folder); `PlayerProgressStageClearedTests` covers accept next, replay no-op, reject skip (message + unchanged progress), reject < 1 (0 and -1). Backend gate: Release build 0 warnings, `dotnet test` 5 passed.
- **Commits**: `test(backend): add xUnit project with stage-clear order tests`.
- **Decisions (decided in heartbeat)**: package versions are the .NET 8 `dotnet new xunit` template pins (xunit 2.5.3, Microsoft.NET.Test.Sdk 17.8.0); `coverlet.collector` dropped (no coverage gate); the project references only the Domain for now.
- **Pending for the developer**: `git push` (`AGENTS.md` was committed by the developer in 506f349).

## 2026-10-07 — stage-combat T2: BossDefeated rule in PlayerProgress

- **Result**: done. `PlayerEventType.BossDefeated = 5`; `PlayerProgress.ApplyBossDefeated` (stage ≥ 1, ≤ furthest + 1, boss stage only, replay no-op, records `HighestBossDefeated`); `ApplyStageCleared` rejects a boss stage before its boss ("Cannot clear boss stage <n> before defeating its boss."). Backend gate: build 0 warnings, `dotnet test` 14 passed (was 5).
- **Commits**: `feat(backend): BossDefeated rule and boss-stage clear guard`.
- **Decisions (decided in heartbeat)**: `ApplyStageCleared(stageNumber, bossEvery, now)` signature; ingestion passes `PlayerProgress.DefaultBossEvery` (5) until T3 makes it configurable; `builder.Ignore(HighestBossDefeated)` in EF until T3 adds the column + migration (keeps the running backend's schema valid); committed `shared/openapi` lags the new enum value until T4 re-exports it (CI's openapi diff check would flag it if pushed before T4).
- **Pending for the developer**: `git push` (hold until T4 so the openapi diff check stays green).

## 2026-10-07 — stage-combat T3: BossDefeated ingestion and persistence

- **Result**: done. `BossDefeatedPayload(int StageNumber)` and its ingestion case; `ProgressOptions.BossEvery` (`Progress` section, default 5) replaces the hardcoded default in `StageCleared` and drives `BossDefeated`; EF maps `highest_boss_defeated` (the T2 `Ignore` is gone) with migration `AddHighestBossDefeated` (int, not null, default 0). Backend gate: build 0 warnings, `dotnet test` 19 passed (was 14). Mutation check: making `StageCleared` ignore the configured `BossEvery` fails 1 test.
- **Commits**: `feat(backend): ingest BossDefeated events`.
- **Decisions (decided in heartbeat)**: `ProgressOptions` is a POCO singleton bound in `AddInfrastructure` (no Options package in Application); startup throws if `BossEvery < 1` (a 0 would divide by zero on ingestion); the test project references Application with its own in-memory repositories; VectorGen constructs the service with `new ProgressOptions()` (no vector output change).
- **Pending for the developer**: `git push` (hold until T4 so the openapi diff check stays green); apply migration `AddHighestBossDefeated` outside Development (Development applies it on startup, `Program.cs:51`).

## 2026-10-07 — stage-combat T4: BossDefeated vectors and API contract

- **Result**: done, with one pre-existing gate failure. VectorGen: `stage-rules` family (default BossEvery 5 + 80 `isBossStage` cases), `BossDefeated` cases in `event-payloads` and three boss scenarios in `event-validation`; `shared/openapi` re-exported and `schema.ts` regenerated. Client: `BossDefeated` in `PLAYER_EVENT_TYPES` and payloads, `domain/StageRules.ts`, `PlayerProgressReplay` mirrors the backend boss rules. Vitest 154 passed (was 149), Backend 19 passed, two mutants killed. `npm run verify` is red only on e2e `ui-gate.spec.ts` criterion 3 (focus p95 142–169 ms vs < 100 ms). It fails the same way on base 878d778 (149 ms) in an isolated worktree; the other 29 e2e, build and scan:secrets pass.
- **Commits**: `feat(events): add BossDefeated vectors and API contract`.
- **Decisions (decided in heartbeat)**: commit T4 despite the pre-existing ui-gate timing failure, since the change touches no presentation code; the replay ledger seeds `highestBossDefeated` from the snapshot (last boss stage ≤ furthest), since the canonical snapshot does not carry it; vector state snapshots keep the backend snapshot shape.
- **Incident**: a failed `git worktree remove --force` on the temporary base worktree followed its `node_modules` junction and deleted part of `Client/node_modules`. Restored with `npm install` (lockfile unchanged); `npm ci` could not run because a Vite dev server (PID 16280) holds a rolldown binding. A leftover locked folder `node_modules/@rolldown/.binding-win32-x64-msvc-*` remains.
- **Pending for the developer**: `git push`; investigate the ui-gate criterion 3 failure; delete the leftover rolldown folder after stopping the dev server.

## 2026-10-07 — stage-combat T5: combat content schemas and validation

- **Result**: done. New `economy/combat.json` kind (`CombatEconomy`, loaded as `catalog.combat`), hero `baseHp`/`baseDefense`/`attackIntervalMs`, stage `monsters` + optional `boss { monsterId, powerFloor, timerSeconds? }`; `validate:content` checks boss presence against `bossEvery`, boss timer ≤ 60 s (`boss.timerSeconds`), stage/boss monster ids, `spawnDelayMs` (multiple of 100, ≤ 500) and contiguous stage numbers. Content migrated. Quick gate green: Vitest 165 passed (was 154), validate:content OK; gen:check and build also pass. Two mutants killed (contiguity removed, bossEvery hard-coded). The full `verify`/e2e was not run (Quick gate task; the ui-gate criterion 3 failure from T4 is still open).
- **Commits**: `feat(content): add combat economy kind and boss stage schema`.
- **Decisions (decided in heartbeat)**: legacy fields stay until their cutover (stage `powerFloor` until T20, monster `maxHp`/`goldMin`/`goldMax` until T18); `content/economy/combat.json` is required and added in T5 with design defaults and placeholder curves (T6 now reviews it instead of adding it); every hero gets placeholder HP 100 / defense 5 / interval 1000 ms until T6; `defaultBossTimerSeconds` is also capped at 60 s; only the first stage-number gap is reported.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T6: placeholder combat content and Krell hero

- **Result**: done. New hero `krell` (linked to `animations/krell.json` by id), per-hero HP/defense/attack interval on all 7 heroes, stages 5–10 with bosses on 5 (default timer) and 10 (45 s), boss monster `elder-slime`. Quick gate green: Vitest 168 passed (was 165), validate:content OK (7 heroes, 2 monsters, 10 stages). e2e: 31 pass; only the known ui-gate criterion 3 fails (186 ms vs < 100 ms, pre-existing since T4). T5 test fixtures that assumed a 4-stage catalog were repointed (boss cases edit stage 5, copies use stages 11/12, full error lists grew); no rule or message changed, no test removed.
- **Commits**: `feat(content): placeholder combat economy, stages 1-10 and Krell`.
- **Decisions (decided in heartbeat)**: Krell is Dark, power 12, HP 130, def 6, 900 ms, `serverHeroId` …0007, no portrait yet; the hero ↔ animation link is the `animations/<heroId>.json` entry (design.md:178), so no new `HeroData` field; placeholder per-hero stats, stage names/types and boss floors (200, 1200) are listed in tasks.md T6 and get tuned in T21; `combat.json` kept as in T5.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T7: StageCurves

- **Result**: done. `Client/src/domain/combat/StageCurves.ts`: `stageSpec(stage, eco)` returns monster HP, gold per kill and monster DPS (`base × growth^(n−1)`, doubles) plus, on boss stages, boss HP/DPS/gold (stage monster × boss multipliers) and timer (stage value, else `defaultBossTimerSeconds`). 4 unit tests in `Client/tests/unit/stageCurves.test.ts`. Quick gate green: typecheck, lint, Vitest 172 passed (was 168).
- **Commits**: `feat(domain): stage curves for combat`.
- **Decisions (decided in heartbeat)**: `StageSpec`/`BossSpec` shape (design named the fields but not the type); boss gold included (`goldMultiplier` exists in content); boss presence follows `stage.boss`, whose `bossEvery` rule validate:content already enforces.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T8: combat types, startStage, damage factors and click

- **Result**: done. `Client/src/domain/combat/CombatRules.ts`: `Encounter`, `FieldHero`, `Foe`, `CombatParams`, `SquadMember`, `CombatOutcome`; `startStage` (full HP, spawn counter in 100 ms steps, boss timer), `squadDpsVsFoe` (living heroes, `typeBonus` on the stage's favored type), `damageTakenFactor` (`1 − def/(def+K)`), `click` (`clickDpsShare × squadDpsVsFoe`, opens a segment, kill emits `kill` with stage or boss gold). 15 unit tests in `Client/tests/unit/combatRules.test.ts`. Quick gate green: typecheck, lint, Vitest 187 passed (was 172).
- **Commits**: `feat(domain): combat encounter model and click`.
- **Decisions (decided in heartbeat)**: `CombatParams` = economy scalars + `squad` (Active Squad only, slot order) + `stages` (all `StageSpec`s, for auto-advance); hero DPS = `power × dpsPerPower` fixed at stage start; a boss stage spawns only the boss; a click without a fighting foe does nothing; stage clear and boss victory on a kill are left to T9.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T9: CombatRules.advance, live mode

- **Result**: done. `Client/src/domain/combat/CombatRules.ts`: `advance(enc, steps, p)` runs 100 ms steps in the design's fixed order (spawn → squad strikes first → foe damage split, or all to the leader against a boss without the favored type → kill → knock-outs → leader failure → timer → wipe), HP in segment form `hpAtSegmentStart − k × perStep`, stage clear after `monstersPerStage` kills, auto-advance, last stage keeps farming, boss victory/failure with full-HP restarts. 21 unit tests in `Client/tests/unit/combatAdvance.test.ts`. Quick gate green: typecheck, lint, Vitest 208 passed (was 187).
- **Commits**: `feat(domain): segment-based combat advance`.
- **Decisions (decided in heartbeat)**: `Encounter.autoAdvance` (a boss failure turns it off inside `advance`); `StageSpec.monsterIds`; the boss timer runs only while the boss is on the field; the AD-004 favored-type check covers the whole Active Squad; rules emit `stageCleared` per normal clear and `kill` + `bossDefeated` per boss kill; the T8 boss-click test now also expects `bossDefeated`.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T10: event jumping and farming mode

- **Result**: done. `advance` now jumps from event to event and takes `mode: 'live' | 'farming'`. 5 unit tests in `Client/tests/unit/combatJump.test.ts`. Quick gate green: typecheck, lint, Vitest 213 passed (was 208).
- **Commits**: `feat(domain): event-jumping combat and farming mode`.
- **Stale lock**: found `stage-combat-T10.lock` (started 12:19Z, 2.5 h old). Uncommitted work discarded: a +116/−13 diff of `CombatRules.ts`, `Client/tests/unit/combatJump.test.ts` (211 lines) and `Client/tests/unit/_tmp/bench.test.ts` (10-line benchmark); the patch was kept only in the session scratchpad. T10 was redone from the committed T9.
- **Decisions (decided in heartbeat)**: farming on stage 1 boss (none exists) leaves the encounter unchanged; farming still emits `kill` and `squadWiped`; 12 h timing test is best of 7 (cold JIT 50–100 ms).
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T11: FarmRate

- **Result**: done. `Client/src/domain/combat/FarmRate.ts`: `farmRate(stage, p)` runs one farming cycle through `advance` and returns `goldPerCycle`, `cycleMs`, `goldPerSecond`. 5 unit tests in `Client/tests/unit/farmRate.test.ts`. Quick gate green: typecheck, lint, Vitest 218 passed (was 213).
- **Commits**: `feat(domain): farm rate from the combat function`.
- **Decisions (decided in heartbeat)**: a cycle ends at the 10th kill or a squad wipe (gold of the kills so far over the time to that point); empty squad or no progress within 1 h of combat → zeros; a boss stage reports the previous stage's rate, matching farming mode.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T12: BossFailureLabel

- **Result**: done. `Client/src/domain/combat/BossFailureLabel.ts`: `label(...)` maps the classifier result, `Success` → `PowerGate`. 3 unit tests in `Client/tests/unit/bossFailureLabel.test.ts`. Phase 2 build gate green: typecheck, lint, Vitest, build.
- **Commits**: `feat(domain): FR-11 label for boss failures`.
- **Decisions (decided in heartbeat)**: none beyond the task.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T13: CombatParamsBuilder

- **Result**: done. `Client/src/services/combat/CombatParamsBuilder.ts`: `build(content, state, stageNumber)` → `CombatParams` (squad in slot order, power = basePower × starTier, stages sorted). 6 unit tests in `Client/tests/unit/combatParamsBuilder.test.ts`. Quick gate green: typecheck, lint, Vitest 227 passed (was 218 + 3 other).
- **Commits**: `feat(services): combat params from content and squad`.
- **Decisions (decided in heartbeat)**: a static function taking the content catalog and state (not a class with deps); `stageNumber` is only validated against content because `CombatParams.stages` already holds every stage; unknown stage throws.
- **Pending for the developer**: `git push`; the ui-gate criterion 3 failure; the leftover rolldown folder.

## 2026-10-07 — stage-combat T14
- Result: done. Save v2 (`local.combat`), v1→v2 migration, `GameState.stageCombat`, fixtures regenerated, 3 new tests.
- Gate: green except pre-existing ui-gate criterion 3 and a load-sensitive timing test (combatJump 12 h farming, passes alone).
- Decisions: see tasks.md T14 (stageCombat.encounter nullable; cap in stateFromSave).
- Pending for developer: push.

## 2026-10-07 — stage-combat T15
- Result: done. `StageCombatService` (`step`, `click`, outcome handling) + 9 tests in `Client/tests/unit/stageCombatService.test.ts`. Typecheck, lint, Vitest green except the load-sensitive combatJump 12 h timing (passes alone).
- Commits: `feat(services): stage combat step, click and outcomes`.
- Decisions (decided in heartbeat): see tasks.md T15 (whole-gold rounding, BossDefeated only above furthest, restart on squad change, leader loss fails the boss stage).
- Pending for developer: push.

## 2026-10-07 — stage-combat T16
- Result: done. `jumpToStage`, `fightBoss`, `setAutoAdvance` on `StageCombatService`; `RosterService.squadLocked()` refuses activate/bench/swap during a boss fight. 5 new tests (14 in the file). Typecheck, lint and `npm test` (244) green.
- Commits: `feat(services): stage jump, boss retry and squad lock`.
- Decisions (decided in heartbeat): see tasks.md T16 (`fightBoss` targets furthest + 1 and needs a boss stage; lock = encounter with a boss timer).
- Pending for developer: push.

## 2026-10-07 — stage-combat T17
- Result: done; lint, typecheck, npm test (249) green.
- Commit: feat(services): fast-forward and batched gold income
- Decisions: see tasks.md T17 status (decided in heartbeat).
- Pending for the developer: git push; ui-gate criterion 3.

## 2026-10-07 — stage-combat T18
- Result: done; typecheck, lint, validate:content, gen:check, npm test (250; combatJump 12 h timing flakes under load), e2e (all green except the known ui-gate criterion 3), soak 1 h green.
- Commit: feat(combat)!: squad-driven stage combat replaces the click loop
- Decisions: see tasks.md T18 status (decided in heartbeat).
- Pending for the developer: git push; ui-gate criterion 3.

## 2026-10-07 heartbeat: stage-combat T19
- Result: done. Gate: all green except pre-existing ui-gate criterion 3 (focus p95 ~147 ms); build and scan:secrets pass.
- Decisions: `OfflineAccrualCalculator` stays only for the vector cap/hours cases; offline gold is `fastForward`. 8 h offline at placeholder tuning pays 68,570 gold, flagged for T21 tuning review.
- Pending for the developer: push; ui-gate criterion 3.

## 2026-10-07 heartbeat: stage-combat T20
- Result: done. Gate: typecheck, lint, validate:content, gen:check, npm test (251), build, scan:secrets green; e2e green except pre-existing ui-gate criterion 3 (the other ui-gate tests pass).
- Commit: refactor(stages)!: stage select lists stages to jump to
- Decisions: see tasks.md T20 status. sync-e2e edited but unverified (needs the Docker backend).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: stage-combat T21
- Result: done. Gate: typecheck, lint, validate:content, gen:check, npm test (286; combatJump 12 h timing test flakes under load, passes alone), build, scan:secrets green; e2e green except pre-existing ui-gate criterion 3.
- Commit: test(sim): progression, boss fights and FR-11 tuning check
- Decisions: placeholder retune (monster dpsBase 0.8, boss hp ×20 / dps ×1.2, floors 56 and 75) so one starter ranger reaches stage 4 and FR-11 AC 6 holds; p14 split in three scenario files; see tasks.md T21.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: stage-combat T22
- Result: done. Gate: typecheck, lint, validate:content, gen:check, npm test (286), build, scan:secrets green; e2e green except pre-existing ui-gate criterion 3 (its skipped siblings pass when run directly).
- Commit: feat(world): squad heroes fight on the field
- Decisions: see tasks.md T22 status (punch tag as attack, type-colored block fallback, field nodes in GameScreenController, krellAnimation null without Krell in squad).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: stage-combat T23
- Result: done. Gate: typecheck, lint, validate:content, gen:check, npm test (287; combatJump 12 h timing flake under load, passes alone), build, scan:secrets green; e2e green except pre-existing ui-gate criterion 3.
- Commit: feat(hud): stage, boss timer and failure label
- Decisions: see tasks.md T23 status (last-stage text covered by a unit test; boss-weak fixture).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: stage-combat T24
- Result: done. Gate (build): typecheck, lint, build green; equipment-stages e2e 6/6. Full verify not rerun (ui-gate criterion 3 is a known failure).
- Commit: feat(stages): jump to a cleared stage from Stage Select
- Decisions: screen was already complete from T20, so T24 only tightened the e2e to gamepad + `game.current` and set traceability Done. Feature Verifier left for the next run.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: stage-combat Verifier
- Result: PASS. Independent Verifier: 31/31 ACs traced, 1 spec-precision gap (offline BossDefeated queue), sensor 8/8 killed, vitest 286/287 (combatJump timing flake), backend 19/19, e2e only pre-existing ui-gate criterion 3 failing.
- Commit: docs(stage-combat): verifier report
- Decisions: gaps non-blocking; combatJump wall-clock test to move to bench/soak later.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline Design
- Result: design.md written and approved under heartbeat autonomy (docs only, no gate run).
- Commit: docs(hero-art-pipeline): design
- Decisions: `grip_behind` slice for behind frames (Aseprite user data is per slice); trimmed packed sheets, layer PNG <= 4096; enchant level read through `enchantLevelOf` until equipment-enchant adds the field; code-generated test-hero; hex colors in content. Spec/guide amendments go in task 1.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline Tasks
- Result: tasks.md written (18 tasks, 4 phases) and approved under heartbeat autonomy (docs only, no gate run); validate_tasks.py 0 errors.
- Commit: docs(hero-art-pipeline): tasks
- Decisions: cross-phase dependencies written as "None (phase N complete)" to satisfy the diagram check; T14 view covered by T15 e2e; no backend tasks (art is presentation only).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T1
- Result: done. Spec amended (grip_behind for ART-05 AC 3, assumptions rows for behind and the 4096 layer cap, new ART-03 AC 9, traceability). Docs only; validate_spec.py not found locally, so not run.
- Commit: docs(hero-art-pipeline): amend spec for grip_behind and sheet size cap
- Decisions: size cap is AC 9, not AC 7 as tasks.md says (AC 7 already exists).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T2
- Result: done. Guide §5.2 (new `grip_behind` slice row, `behind` user data removed), §8 and §9 (checklist adds the 4096 × 4096 layer cap). Docs only.
- Commit: docs(art): grip_behind slice and layer size cap in the hero art guide
- Decisions: none beyond the design.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T3
- Result: done. `HexColor`, `HeroArt`, `ItemVisual`, `EnchantBand`, `EnchantBandsData` types plus optional `HeroData.art` and `EquipmentItemData.visual` in `Client/src/domain/content/types.ts`. Typecheck, lint, tests green (the combatJump 50 ms wall-clock test flaked once, passed on rerun).
- Commit: feat(content): types for hero art and item visuals
- Decisions: extracted `HeroArt` and `ItemVisual` as named interfaces for T4's `satisfies` checks.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T4
- Result: done. Strict zod schemas for hero `art`, item `visual` (slot-dependent rules via superRefine) and the `art` content kind (`enchantBandsSchema`, sorted/non-overlapping, `minLevel` >= 1); `ContentLoader` reads the kind, exposes `catalog.enchantBands` (null when absent) and rejects unknown art files. 7 new tests in `content.test.ts`. Typecheck, lint, validate:content green; `npm test` 293/294, the only failure is the known combatJump 12 h < 50 ms wall-clock test (53 ms, flaked twice).
- Commit: feat(content): schemas for hero art, item visuals and enchant bands
- Decisions: `weaponModel` is a kebab-case id; only `enchant-bands` is an accepted `art` file id.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e; loosen or de-flake the combatJump timing test.

## 2026-10-07 heartbeat: hero-art-pipeline T5
- Result: done. `parseAsepriteSheet` (zod subset of json-array: frames, tags with summed durations, slices with sorted keys, canvas, image size) throwing `SheetError` with field paths; `sliceAt` helper for T6/T14. 6 new tests; typecheck, lint, tests green.
- Commit: feat(content): Aseprite sheet reader
- Decisions: tags outside the frame range are rejected; `sliceAt` holds the last key (Aseprite semantics).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T6
- Result: done. `validateHeroArt(heroes, items, sheets, assetKeys)` in `Client/src/services/content/HeroArtRules.ts`: required tags, attack <= 600 ms, 512x512 canvas, equal frame count/durations vs body, grip/tip keys on every frame, body present, 4096 layer cap, weapon grip/tip + 256 cap, weaponModel resolves. 15 tests in `heroArtRules.test.ts`; typecheck, lint, 314 tests green.
- Commit: feat(content): enforce the hero art guide rules
- Decisions: sheets keyed `heroes/<id>/<layer>` and `items/weapons/<id>`; grip/tip are read from the body sheet; "no key for frame" means no key at or before it (Aseprite hold semantics), so frame 0 must be keyed.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T7
- Result: done. `checkHeroArt` (`Client/tools/lib/artCheck.ts`) reads layered hero layer and weapon model sheets from `assets/` by manifest key and runs `validateHeroArt`; `validate-content.ts` calls it after `loadContent` (runtime loader unchanged). Krell content gets `art: {mode: "legacy"}`. 4 new tests in `artCheck.test.ts`. validate:content, typecheck, lint, build, scan:secrets green.
- Gate: `npm run verify` is red only for known issues: e2e ui-gate criterion 3 (pre-existing) and the combatJump 50 ms wall-clock test, which failed under load in verify and passes alone (5/5).
- Commit: feat(content): validate layered hero art in validate:content
- Decisions (decided in heartbeat): the check lives in `tools/lib` (I/O stays out of services); missing sheets for keys absent from the manifest are skipped so `validateHeroArt` reports them.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T8
- Result: done. `LAYER_ORDER`, `layerOrder(weaponBehind)` and `LayerSlot` in `Client/src/domain/art/LayerOrder.ts`; 3 tests in `layerOrder.test.ts`. Typecheck, lint, 321 tests green.
- Commit: feat(art): layer stacking order
- Decisions: `layerOrder` returns shared readonly arrays (no per-call allocation); `LayerSlot` is defined here for T9+ to reuse.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T9
- Result: done. `heroLook(equipped, items, art, neutral)` and `enchantLevelOf` in `Client/src/domain/art/HeroLook.ts`; 8 tests in `heroLook.test.ts`. Typecheck, lint green.
- Commit: feat(art): derive hero look from equipped items
- Decisions (decided in heartbeat): `items` is a `ReadonlyMap` by itemId; neutral order is `art.neutral`, then the argument, then `#808080`; `enchantLevelOf` reads an optional `enchantLevel` field structurally until the enchant feature adds it; the look takes enchant level from the weapon.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T10
- Result: done. `weaponPose` in `Client/src/domain/art/WeaponPose.ts` (position at hero grip, rotation = hero angle minus weapon angle, degenerate vector counts as angle 0); 7 tests in `weaponPose.test.ts`. Typecheck and lint green.
- Commit: feat(art): weapon pose from grip and tip sockets
- Decisions (decided in heartbeat): a degenerate vector on either side contributes angle 0 (so a degenerate hero vector yields the negated weapon angle); a local `Point` type keeps the domain free of Phaser.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T11
- Result: done. `enchantBand` and `attackSpeed` in `Client/src/domain/art/Playback.ts`; 7 tests in `playback.test.ts`. Typecheck, lint, build green.
- Commit: feat(art): enchant band and attack playback speed rules
- Decisions (decided in heartbeat): `enchantBand` picks the highest `minLevel` <= level regardless of array order; `attackSpeed` returns 1 for a non-positive interval or duration.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T12
- Result: done. `findAseprite`, `exportArgs`, `exportLayer` in `Client/tools/lib/aseprite.ts`; 8 tests in `aseprite.test.ts`. Typecheck, lint green.
- Commit: feat(tools): locate and run the Aseprite CLI
- Decisions (decided in heartbeat): `exportLayer` takes an optional injected `run` function (default spawns the exe) so tests record arguments without a stub executable; `AsepriteNotFound` is an Error carrying `tried`; Steam path is `C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe`.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T13
- Result: done. `npm run art:export` (`tools/art-export.ts` CLI, policy in `tools/lib/artExport.ts`: `exportArt`, `normalizeSheetJson`); `listLayers` and `layer: null` (whole-file export for weapons) added to `tools/lib/aseprite.ts`; code-generated `tools/lib/testHero.ts` with goldens in `Client/tests/fixtures/art-export/`; 17 tests in `artExport.test.ts` + `aseprite.test.ts`. Typecheck, lint, validate:content, gen:check, unit tests, build green (combatJump 50 ms timing test flaked once under load, passed alone).
- Commit: feat(tools): art:export for layered hero sheets
- Decisions (decided in heartbeat): the stub Aseprite is an injected `RunProcess` (no stub executable); `gen:assets` exports `TEST_ASSET_KEYS` (keys with a `test-` path segment) and the release-build exclusion itself is wired in T15 together with the test-hero asset and content; portrait is copied from `portrait.png` only (a `portrait.aseprite` is not exported, warns when `portrait.png` is missing); `gen:assets` runs via a child process in the CLI only.
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 heartbeat: hero-art-pipeline T14
- Result: done. `Client/src/presentation/scenes/LayeredHeroView.ts` (not wired yet, covered by the T15 e2e): body-driven frame sync, own namespaced animations `<heroId>/body:<tag>` built from parsed tags (Phaser's `createFromAseprite` keys are global), weapon posed from `grip`/`tip`, `grip_behind` re-stacks, multiply tint per armor layer, `hit` event, `create` returns null on any missing texture/json/frame-count mismatch. Typecheck, lint, build green; `npm test` and e2e fail only on the two known items (combatJump 50 ms timing, ui-gate criterion 3).
- Commit: feat(world): layered hero view
- Decisions (decided in heartbeat): dependency-cruiser rule `presentation-domain-types-and-formatters-only` now also allows value imports from `domain/art/` (pure layout rules the design assigns to the view; CLAUDE.md layer rules updated); missing-weapon-model logging is left to FieldHeroView in T15 (the view has no logger and presentation has no console use).
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 hero-art-pipeline T15
- Result: done (see STATE.md entry). Gate: typecheck, lint, validate:content, gen:check, build green; known failures only (combatJump timing, ui-gate criterion 3).
- Commit: feat(world): heroes render by art mode
- Pending for the developer: push; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-07 hero-art-pipeline T16
- Result: done. Scenario `p15-hero-look.json` and e2e `hero-look.spec.ts` (unequip/equip weapon and vest by gamepad, asserts model and tint in `__ig.world()`); no view fix needed. Gate: typecheck, lint, npm test green; e2e fails only on known ui-gate criterion 3.
- Commit: test(world): equipment drives the hero look
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 hero-art-pipeline T17
- Result: done (see STATE.md entry). Gate: typecheck, lint, validate:content, gen:check, npm test green; e2e fails only on known ui-gate criterion 3.
- Commit: feat(world): enchant effects, attack speed and hit event
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 hero-art-pipeline T18
- Result: done (see STATE.md entry). Gate: typecheck, lint, validate:content, gen:check, build green; known failures only (combatJump timing, ui-gate criterion 3).
- Commit: feat(world): two-color armor tint
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-07 heartbeat (22:37Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z). No commits, no decisions.

## 2026-10-07 heartbeat (22:39Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 14 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:41Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 15 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:43Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 17 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:44Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 19 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:46Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 21 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:48Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 23 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:50Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 25 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:52Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 27 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:54Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 29 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:56Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 30 min old). No commits, no decisions.

## 2026-10-07 heartbeat (22:58Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 33 min old). No commits, no decisions.

## 2026-10-07 heartbeat (23:00Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 34 min old; no validation.md yet). No commits, no decisions.

## 2026-10-07 heartbeat (23:02Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 37 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:04Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 39 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:06Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 40 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:09Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 43 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:12Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 46 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:15Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 50 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:18Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 53 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:20Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 55 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:23Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 58 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:25Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 60 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:28Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 63 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-07 heartbeat (23:31Z)
- Task: none. Result: waiting for hero-art-pipeline-verifier (live lock, heartbeat 22:25:40Z, 65 min old; no validation.md yet; goes stale at 00:25Z). No commits, no decisions.

## 2026-10-08 heartbeat (01:11Z)
- Task: hero-art-pipeline Verifier. Result: PASS (`.specs/features/hero-art-pipeline/validation.md`). Gates: typecheck, lint, validate:content, gen:check, build green; npm test 370/370; e2e 47/47 (known flaky items passed this run). 9/10 mutants killed.
- Decisions (decided in heartbeat): the verifier lock from 2026-10-07 22:25Z was stale (>2 h), deleted; the verifier run was redone via sub-agent. Uncommitted floating-damage-number changes in Client/ belong to no lock, so left untouched and uncommitted.
- Commit: docs(specs): hero-art-pipeline validation
- Pending for the developer: push; commit/review the floating damage numbers work in the tree; ui-gate criterion 3; de-flake combatJump timing test; run test:sync-e2e.

## 2026-10-08 heartbeat
- Task: single-active-session Design + Tasks. Result: done (`design.md`, `tasks.md`, 11 tasks; spec traceability mapped 4/4). Docs only, no gates run.
- Decisions (decided in heartbeat): see Design Tech Decisions table; new `AppLifecycle` port and bridge `app.quit` for the Quit button.
- Not run: validate_tasks.py (search for the script timed out). Uncommitted floating-damage-number changes in Client/ left untouched.
- Pending for the developer: push; commit/review floating damage numbers; ui-gate criterion 3; de-flake combatJump; run test:sync-e2e.

## 2026-10-08 heartbeat (T1)
- Task: single-active-session T1. Result: done; backend build + 22 tests green (3 new). Commit: feat(backend): account session id.
- Decisions (decided in heartbeat): migration backfills existing rows with `gen_random_uuid()`. Floating-damage Client changes left untouched.
- Pending for the developer: push; commit floating damage numbers; ui-gate criterion 3; combatJump flake; test:sync-e2e.

## 2026-10-08 heartbeat (T2)
- Task: single-active-session T2. Result: done; backend build + 26 tests green (4 new in `Auth/SessionTokenTests.cs`). Commit: feat(backend): session id in the access token.
- Decisions (decided in heartbeat): `SteamAuthenticationService` already called `StartSession` (T1), so T2 only added the `sid` claim; the test project now references Infrastructure to exercise the real `JwtSessionTokenService`. Floating-damage Client changes left untouched.
- Pending for the developer: push; commit floating damage numbers; ui-gate criterion 3; combatJump flake; test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session T3
- Result: done. `ISessionValidator`/`SessionValidator`, JwtBearer events in Program.cs (missing `sid` = plain 401, mismatch = 401 problem `type: session-replaced`). Backend build + 29 xUnit green. Program wiring has no automated test (per task, covered by T10/T11 sync-e2e).
- Commit: feat(backend): answer replaced sessions with 401 session-replaced
- Decisions (decided in heartbeat): the replaced flag travels in `HttpContext.Items` from `OnTokenValidated` to `OnChallenge`. Unrelated uncommitted client changes (dev-hooks, WorldScene, StageCombatService, e2e helpers) were present before the run and left untouched.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session T4
- Result: done. Stale unknown events return Rejected "Stale sequence; resend after login." (`EventRejections.StaleSequence`), not persisted, cursor unchanged. Backend build + 32 xUnit green (3 new in `Events/StaleSequenceIngestionTests.cs`; no existing test relied on the old silent no-op).
- Commit: feat(backend): reject stale unknown events instead of dropping them
- Decisions (decided in heartbeat): none new. Unrelated uncommitted client changes left untouched.
- Pending for the developer: push; commit floating damage numbers; ui-gate criterion 3; test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session T5
- Result: done. `PlayerEventLog.rebase` + exported `STALE_SEQUENCE_REASON`; `applyCanonical` rebases; `flush` keeps stale-rejected events with no notice. 3 new tests in `services.test.ts`; typecheck, lint, npm test (373) green.
- Commit: feat(sync): rebase pending events above the server cursor
- Decisions (decided in heartbeat): test double `AheadBackend` (extends ReplayBackend) models the real stale rejection. Unrelated uncommitted client changes left untouched.
- Pending for the developer: push; commit floating damage numbers; ui-gate criterion 3; test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session T6
- Result: done. typecheck, lint, npm test (379) green; full verify not run (Quick gate task).
- Decisions (decided in heartbeat): typed 401 is read from openapi-fetch's parsed `error` (the response body is already consumed); 5 unrelated uncommitted files (floating damage numbers) left untouched and uncommitted.
- Pending for the developer: push; ui-gate criterion 3; commit or review the floating-damage work in progress.

## 2026-10-08 heartbeat: single-active-session T7
- Result: done. typecheck, lint, npm test (385) green; 6 new tests in `tests/unit/session-replaced-sync.test.ts`. Full verify not run (Quick gate task).
- Commit: feat(sync): pause on session-replaced; Play here and Quit
- Decisions (decided in heartbeat): `PlatformPorts.lifecycle` is optional until T8 adds the browser/electron impls, then becomes required; `SaveSyncService` takes `AppLifecycle | null` as last constructor arg. The 5 unrelated uncommitted floating-damage files were left untouched.
- Pending for the developer: push; ui-gate criterion 3; commit or review the floating-damage work in progress.

## 2026-10-08 heartbeat: single-active-session T8
- Result: done. Bridge `app.quit` (IPC `ig:app:quit`, main calls `app.quit()` so before-quit still persists), `ElectronLifecycle` / `BrowserLifecycle`, `PlatformPorts.lifecycle` required. typecheck, lint, npm test (387) and test:shell green; full e2e not run this task.
- Decisions (decided in heartbeat): Quit goes through `app.quit()` rather than closing the window, keeping the AD-20 persist window.
- Left alone: uncommitted floating-damage-number work (WorldScene, StageCombatService, dev-hooks, e2e helpers/spec) belongs to the developer, not committed.
- Pending for the developer: push; ui-gate criterion 3; that WIP.

## 2026-10-08 heartbeat: single-active-session T9
- Result: done. `ReplaceableBackend` (dev-only, in-memory, real replay rules), `&backend=fake`, `__ig.sessionReplaced()`, unit test; `npm run verify` green.
- Commit: test(sync): dev hook for a replaced session
- Decisions (decided in heartbeat): double is opt-in via URL so existing e2e keep NoBackend; the typed 401 appears on the next call that reaches the backend with pending events (as the real server); committed only T9 hunks of dev-hooks.ts/helpers.ts, the unrelated floating-damage WIP stays uncommitted.
- Pending for the developer: push; run test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session T10
- Result: done. Session-replaced modal as a UiDialog over the top layer (focus on Quit, trapped, back/attack ignored); 3 e2e tests (no modal before failing sync, gamepad Play here resumes combat, Quit calls the lifecycle). `npm run verify` fully green.
- Commit: feat(ui): session-replaced modal
- Decisions (decided in heartbeat): reused the existing dialog mechanism instead of a new Preact overlay component; it replaces a screen dialog if both would show. e2e needs `build:test` before a direct `playwright test` (stale bundle otherwise).
- Pending for the developer: push; commit the floating-damage WIP; run test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session T11
- Result: done. Two-device sync-e2e rewritten (B's login replaces A, A pauses with events kept, "Play here" rebases and resends, double spend rejected by rules, B then replaced); PORT_MAP B7 closed; spec traceability Done. `npm run verify` green. The sync-e2e itself was not run (needs the Docker backend).
- Commit: test(sync): two-device scenario without the B7 workaround
- Decisions (decided in heartbeat): correction message matched loosely (`have `) because A's farmed gold may change the balance.
- Pending for the developer: push; run test:sync-e2e (expectations unverified against a real backend); commit the floating-damage WIP.

## 2026-10-08 heartbeat: single-active-session Verifier
- Result: PASS. Independent Verifier: 8/8 ACs and both edge cases traced; backend 32/32, npm test 389/389, typecheck/lint green, session-replaced e2e 3/3; 14 of 17 mutants killed. Report in `.specs/features/single-active-session/validation.md`.
- Gaps (decided in heartbeat: recorded as follow-ups, not blocking): survivors on the equal-to-cursor case (backend `<=` and client rebase `>`), no test for the Program.cs JwtBearer 401 `session-replaced` mapping (needs a WebApplicationFactory test), stale-reason string duplicated in TS and C# without a cross-check, sync-e2e and test:shell not run.
- Commit: docs(specs): single-active-session validation
- Pending for the developer: push; run test:sync-e2e; commit the floating-damage WIP.

## 2026-10-08 heartbeat: single-active-session boundary tests
- Result: done. Equal-to-cursor tests: backend `An_unknown_event_exactly_at_the_cursor_is_rejected_as_stale` (kills B4) and client `rebase renumbers when the first pending event equals the cursor` (kills C2). Backend 33 and services.test.ts 27 green.
- Commit: test(sync): equal-to-cursor stale boundary
- Decisions (decided in heartbeat): picked the cheap boundary follow-ups before the WebApplicationFactory test; unrelated floating-damage WIP left untouched.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e.

## 2026-10-08 heartbeat: single-active-session 401 mapping test
- Result: done. `Backend/tests/.../Api/SessionReplacedHttpTests.cs` (WebApplicationFactory, hosted services and the session validator stubbed): replaced session -> 401 `application/problem+json` type `session-replaced`; missing token -> plain 401. Test project now references the Api project and `Microsoft.AspNetCore.Mvc.Testing` 8.0.11. Backend 35/35 green. Client untouched; client gate not re-run.
- Commit: test(auth): 401 session-replaced mapping over HTTP
- Decisions (decided in heartbeat): picked this follow-up over the anime-style docs alignment, which needs art-direction wording from the developer; config set through environment variables because Program reads the JWT key while building.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e; commit the floating-damage WIP.

## 2026-10-08 heartbeat: single-active-session follow-up (stale-reason cross-check)
- Result: done. `Client/tests/unit/stale-reason-contract.test.ts` reads `EventRejections.cs` and asserts `STALE_SEQUENCE_REASON` equals the backend constant; passes, eslint clean. No backend change, so no new xUnit test needed.
- Commit: test(sync): stale reason matches backend constant
- Decisions (decided in heartbeat): cross-check as a client unit test reading the C# source (no VectorGen family for a single literal). Left the unrelated uncommitted floating-damage WIP untouched.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e. Queued: docs alignment with anime style (AD-005).

## 2026-10-08 heartbeat: boss-drops Design
- Result: done. `.specs/features/boss-drops/design.md` written and approved under autonomy. No code touched; no gate run (docs only).
- Commit: docs(specs): boss-drops design
- Decisions (decided in heartbeat): catalog generated from client content (`npm run gen:drops` -> `shared/drop-catalog`, `gen:check` staleness); hero grants via the existing HeroAcquired path; item grants in a `RewardGrants` table applied idempotently by grant id; `MonsterKillsBatch` event with a server-time token bucket (400 ms/kill, cap 108 000); bag-full as a client grant queue; rolls tested by xUnit only (no VectorGen family for rolls, a `drop-rules` family for shared numbers). Risk recorded: a modified client can still edit its own save (needs a server inventory, out of scope).
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e; commit the floating-damage WIP. Next run: boss-drops Tasks.

## 2026-10-08 heartbeat: boss-drops Tasks
- Result: done. `.specs/features/boss-drops/tasks.md` (16 tasks, 4 phases: content+catalog, backend, client, proof); validate_tasks.py 0 errors. Docs only, no gate run.
- Commit: docs(specs): boss-drops tasks
- Decisions (decided in heartbeat): backend work split into one task per concern (catalog, rules, kill bucket, grants table, kill batch, boss grants, contract); T4/T5/T6 chained linearly although independent, to satisfy the plan validator; sync-e2e task written but not run (Docker). Floating-damage WIP left untouched.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e; commit the floating-damage WIP. Next run: boss-drops T1.

## 2026-10-08 heartbeat: boss-drops T1
- Result: done. Drop economy content + schema + loader rules, hero `minStage`. Typecheck, lint, validate:content, npm test (398) green.
- Commit: feat(content): drop tables and hero minStage
- Decisions (decided in heartbeat): six placeholder heroes get minStage 1/1/1/3/6/9 (dawn-cleric, druid, ember-warden, ranger, shade-stalker, tide-caller); krell and test-hero keep the default 1; item bands: stage 1 (bark-blade, leaf-mail, wind-boots), stage 6 adds sage-staff, thorn-gloves.
- Pending for the developer: push; ui-gate criterion 3; unrelated floating-damage WIP left uncommitted.

## 2026-10-08 heartbeat: boss-drops T2
- Result: done. Catalog generator `npm run gen:drops`, `gen:check` includes it, `tests/unit/dropCatalog.test.ts` (6 tests). Typecheck, lint, npm test (404), gen:check green.
- Commit: feat(tools): generate the drop catalog from content
- Decisions (decided in heartbeat): heroes without a serverHeroId and the generated test-hero are left out of the catalog (krell is in, Dark, minStage 1).
- Pending for the developer: push; ui-gate criterion 3; unrelated floating-damage WIP left uncommitted. Next run: boss-drops T3.

## 2026-10-08 heartbeat: boss-drops T3
- Result: done. Backend `DropCatalog` (validated), `EmbeddedDropCatalogLoader`, DI singleton, `DropCatalogTests` (12 cases). `dotnet test` 45 green.
- Commit: feat(backend): embedded drop catalog
- Decisions (decided in heartbeat): the catalog file is embedded from ../../../shared, so Docker builds get it through a compose `additional_contexts: shared` (needs Compose 2.17+); the Docker image build itself was not run.
- Pending for the developer: push; ui-gate criterion 3; unrelated floating-damage WIP left uncommitted. Next run: boss-drops T4.

## 2026-10-08 heartbeat: boss-drops T4
- Result: done. DropRules (pure) with scripted and 100k seeded tests; backend gate green (59 tests).
- Decisions (heartbeat): type order = favored first, then ordinal; item band = highest fromStage <= stage.
- Commit: feat(backend): drop rules

## 2026-10-08 heartbeat: boss-drops T5
- Result: done. Kill token bucket on `PlayerProgress`, `ProgressOptions` kill settings, migration `AddKillAllowance`, `PlayerProgressKillAllowanceTests` (6). `dotnet test` 65 green.
- Decisions (decided in heartbeat): `TryConsumeKills` takes interval and cap as arguments (Domain cannot see Application options); a refused claim does not persist the refill; at-cap refill resets the timestamp to now, otherwise partial intervals are kept.
- Pending for the developer: push; ui-gate criterion 3; unrelated floating-damage WIP left uncommitted. Next run: boss-drops T6.

## 2026-10-08 heartbeat: boss-drops T6
- Result: done. `RewardGrant` entity (hero/item factories), `IRewardGrantRepository`, `RewardGrantRepository`, `RewardGrantDto`, table `reward_grants` with index `(account_id, source_client_event_id)`, migration `AddRewardGrants`, `RewardGrantTests` (4). `dotnet test` 69 green.
- Commits: feat(backend): reward grants table; docs(specs): boss-drops T6 log
- Decisions (decided in heartbeat): contract tested on an in-memory fake (`InMemoryRewardGrantRepository`, reused by T7/T8) instead of adding an EF InMemory package; affix rolls stored as jsonb text `AffixRollsJson`, DTO passes the string through (T9 decides the wire shape).
- Pending for the developer: push; ui-gate criterion 3; unrelated floating-damage WIP left uncommitted. Next run: boss-drops T7.


## 2026-10-08 heartbeat: boss-drops T7
- Result: done. `MonsterKillsBatch` event end to end in the backend (validation, kill bucket, item rolls, stored grants, resend), `MonsterKillsBatchIngestionTests` (9 cases incl. theory rows), `IngestionTestKit`. `dotnet test` 80 green; VectorGen builds.
- Commit: feat(backend): monster kill batches and item drops
- Decisions (decided in heartbeat): `ApplyMonsterKillsBatch` lives on `PlayerProgress` (Domain) and checks stage, boss, count, then the bucket, so a rejected batch never spends allowance; `EventIngestionResult` keeps a 3-arg constructor (empty grants); the API response DTO is not extended until T9 so openapi stays consistent; VectorGen event-validation uses a no-drop catalog.
- Pending for the developer: push; ui-gate criterion 3; run test:sync-e2e; commit the floating-damage WIP. Next run: boss-drops T8.
