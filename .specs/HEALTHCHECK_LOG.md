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
