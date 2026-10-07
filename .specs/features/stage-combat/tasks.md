# Stage Combat Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/stage-combat/design.md`
**Status**: Approved (decided in healthcheck, 2026-10-07)

Healthcheck runs execute one task per run, in order (CLAUDE.md, Healthcheck). Every task keeps
`npm run verify` green on its own: a task that retires a flow rewrites that flow's scenario, unit
test and e2e in the same commit (CLAUDE.md, Tests are mandatory).

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CLAUDE.md` (Tests are mandatory, Verifying a feature without a human, Layer rules), `AGENTS.md`, `Client/package.json` (`verify`), `.github/workflows/ci.yml` (`dotnet test` on the solution, vectors/openapi `git diff --exit-code`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client domain (`src/domain/**`) | unit | All branches; 1:1 to spec ACs; every listed edge case; step-vs-jump equivalence over random seeds | `Client/tests/unit/*.test.ts` | `npm test` |
| Client services (`src/services/**`) | unit + sim scenario | Every command and outcome path (happy, refusal, edge); each new or changed game flow has a `scenarios/*.json` with an `expect` block | `Client/tests/unit/services*.test.ts`, `Client/scenarios/*.json` (run by `tests/sim/scenarios.test.ts`) | `npm test`, `npm run sim -- --script scenarios/<f>.json` |
| Client content + schemas (`content/**`, `src/services/content/**`, `tools/validate-content.ts`) | unit | Each new validation rule: accepting case + rejecting case naming file and field | `Client/tests/unit/content.test.ts` | `npm test`, `npm run validate:content` |
| Client presentation (`src/presentation/**`) | e2e | Every new or changed screen: `describe()` nodes, gamepad reachability, happy + edge (empty squad, last stage, boss failure) | `Client/tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Shared rules (client ↔ backend) | vectors | New VectorGen family or cases; TS matches within the RFR-21 tolerance | `Backend/tools/InfinityGrove.VectorGen/*.cs` → `shared/test-vectors/*.json`, `Client/tests/vectors/*.test.ts` | `pwsh Backend/tools/generate-vectors.ps1`, `npm test` |
| Backend domain + application (`Backend/src/**`) | unit (xUnit) | Every new or changed rule including rejection paths | `Backend/tests/InfinityGrove.Backend.Tests/**/*Tests.cs` | `dotnet test Backend/InfinityGrove.Backend.sln` |
| Backend persistence (EF config, migration) | none | build gate + migration applies in the sync-e2e compose | - | `dotnet build Backend/InfinityGrove.Backend.sln` |

## Gate Check Commands

> Generated from codebase - confirm before Execute. Client commands run in `Client/`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Client domain/content tasks with unit tests only | `npm run typecheck && npm run lint && npm test` |
| Backend | Backend-only tasks | `dotnet build Backend/InfinityGrove.Backend.sln && dotnet test Backend/InfinityGrove.Backend.sln` |
| Full | Tasks touching services flows, scenarios, presentation, generated files or vectors | `npm run verify` (+ the Backend gate when the backend changed) |
| Build | Last task of each phase | `npm run verify` and the Backend gate |

---

## Execution Plan

Phases run in order; tasks inside a phase run in order.

### Phase 1: Backend rules

```
T1 → T2 → T3 → T4
```

### Phase 2: Content and combat domain

```
T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
```

### Phase 3: Services and cutover

```
T13 → T14 → T15 → T16 → T17 → T18 → T19 → T20 → T21
```

### Phase 4: Field and screens

```
T22 → T23 → T24
```

---

## Task Breakdown

### T1: Backend xUnit test project

**What**: Create the backend test project (none exists yet; CI already runs `dotnet test` on the solution) with baseline tests of the existing `PlayerProgress.ApplyStageCleared` order rule (accept next, replay no-op, reject skip, reject < 1).
**Where**: `Backend/tests/InfinityGrove.Backend.Tests/InfinityGrove.Backend.Tests.csproj` (new, added to `InfinityGrove.Backend.sln`)
**Depends on**: None
**Reuses**: xUnit on net8.0 (CI `dotnet-version: 8.0.x`); in-memory repositories already used by `BackendFamilies.EventValidation`
**Requirement**: COMBAT-04 (backend substrate)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Project builds in the solution and `dotnet test Backend/InfinityGrove.Backend.sln` discovers and passes ≥ 4 tests
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `test(backend): add xUnit project with stage-clear order tests`

---

### T2: BossDefeated rule in PlayerProgress

**What**: Add `PlayerEventType.BossDefeated = 5`, `PlayerProgress.ApplyBossDefeated(stageNumber, bossEvery, now)` (order rule: stage ≥ 1, ≤ furthest + 1, must be a boss stage; records `HighestBossDefeated`) and make `ApplyStageCleared` reject a boss stage without its `BossDefeated` ("Cannot clear boss stage <n> before defeating its boss.").
**Where**: `Backend/src/InfinityGrove.Backend.Domain/Progress/PlayerProgress.cs`
**Depends on**: T1
**Reuses**: `ApplyStageCleared` shape (`PlayerProgress.cs:92`)
**Requirement**: COMBAT-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] xUnit: accept in order, replay no-op, reject skip ahead, reject non-boss stage, reject boss `StageCleared` before `BossDefeated`, accept it after
- [ ] Backend gate passes; test count grows, none removed

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): BossDefeated rule and boss-stage clear guard`

---

### T3: BossDefeated ingestion and persistence

**What**: `BossDefeatedPayload(int StageNumber)`, the ingestion `case`, `Progress:BossEvery` option (default 5) passed to the domain, EF column `HighestBossDefeated` with its migration.
**Where**: `Backend/src/InfinityGrove.Backend.Application/Events/PlayerEventIngestionService.cs` (plus `EventPayloads.cs`, `PlayerProgressConfiguration.cs`, new migration)
**Depends on**: T2
**Reuses**: the `StageCleared` case and `Deserialize<T>`
**Requirement**: COMBAT-04, COMBAT-08 (queued boss events accepted only by the backend)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] xUnit over in-memory repositories: a batch `BossDefeated(5)` + `StageCleared(5)` is accepted; `StageCleared(5)` alone is rejected with the message; malformed payload rejected
- [ ] Migration generated with `dotnet ef migrations add AddHighestBossDefeated`; Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): ingest BossDefeated events`

---

### T4: Vectors and API contract for BossDefeated

**What**: Extend VectorGen `event-payloads` and `event-validation` with `BossDefeated` cases, add a `stage-rules` family (`isBossStage(n, bossEvery)`), regenerate `shared/test-vectors`, re-export `shared/openapi`, run `gen:api`, add `BossDefeated` to the client `PlayerEventType` and payloads, and the client vector tests for the new family.
**Where**: `Backend/tools/InfinityGrove.VectorGen/BackendFamilies.cs` (plus generated outputs and `Client/src/domain/PlayerEventType.ts`, `Client/src/services/events/payloads.ts`, `Client/tests/vectors/event-payloads.test.ts`)
**Depends on**: T3
**Reuses**: `EventPayloads()` / `EventValidation()` families
**Requirement**: COMBAT-04 (shared rule)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `pwsh Backend/tools/generate-vectors.ps1` and `export-openapi.ps1` produce the committed files (CI diff clean)
- [ ] Client vector tests pass for `BossDefeated` payload/validation and `stage-rules`
- [ ] Full gate + Backend gate pass

**Tests**: unit
**Gate**: build
**Commit**: `feat(events): BossDefeated vectors and API contract`

---

### T5: Combat content schemas and validation

**What**: Add the `economy/combat.json` kind (`CombatEconomy`), new hero fields (`baseHp`, `baseDefense`, `attackIntervalMs`), the new `StageData` shape (`stageNumber`, `monsters`, optional `boss { monsterId, powerFloor, timerSeconds? }`) and `MonsterData.sprite`; migrate the existing content files to it; `validate:content` rules: boss present iff `stageNumber % bossEvery === 0`, timer ≤ 60 s naming file and `boss.timerSeconds`, monster/boss ids exist, `spawnDelayMs` multiple of 100 and ≤ 500, contiguous stage numbers. Old `GameSettings` fields stay until T18.
**Where**: `Client/src/services/content/schema.ts` (plus `src/domain/content/types.ts`, `tools/validate-content.ts`, `content/**`)
**Depends on**: T4
**Reuses**: zod schemas and the error format of `validate-content.ts`
**Requirement**: COMBAT-04 (AC 2)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `content.test.ts`: one accepting and one rejecting case per rule; the timer case asserts the file name and `boss.timerSeconds` in the message
- [ ] `npm run validate:content` passes on the repository content; Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): combat economy kind and boss stage schema`

---

### T6: Placeholder combat content and Krell hero

**What**: Add `content/economy/combat.json` (design defaults), `content/heroes/krell.json` (new `serverHeroId` GUID, `animations: krell`), HP/defense/interval on every hero, and stages up to 10 so that stages 5 and 10 are boss stages with favored types; regenerate assets if new keys are used. The backend needs no seed: `HeroAcquired` accepts any hero GUID (design amendment).
**Where**: `Client/content/economy/combat.json` (plus `content/heroes/*.json`, `content/stages/*.json`)
**Depends on**: T5
**Reuses**: existing stage and hero files
**Requirement**: COMBAT-02 (Krell regular hero), COMBAT-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `content.test.ts` asserts the loaded catalog has ≥ 10 contiguous stages, boss stages 5 and 10, and Krell as a regular hero
- [ ] `npm run validate:content` and Quick gate pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): placeholder combat economy, stages 1-10 and Krell`

---

### T7: StageCurves

**What**: `stageSpec(stage, eco)` returning monster HP, gold per kill, monster DPS and boss HP/DPS/timer (default timer when absent) from the placeholder geometric curves, in doubles.
**Where**: `Client/src/domain/combat/StageCurves.ts`
**Depends on**: T6
**Reuses**: content types
**Requirement**: COMBAT-01, COMBAT-04 (AC 1)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: stage 1 values equal the bases; growth per stage; boss multipliers; default vs explicit timer
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): stage curves for combat`

---

### T8: Combat types, startStage, damage factors and click

**What**: `Encounter`, `FieldHero`, `Foe`, `CombatParams`, `CombatOutcome`; `startStage` (full HP, spawn counter, boss timer), `squadDpsVsFoe` (living heroes only, `typeBonus` for the favored type), `damageTakenFactor`, `click` (`clickDpsShare × squadDpsVsFoe`, opens a segment, may kill).
**Where**: `Client/src/domain/combat/CombatRules.ts`
**Depends on**: T7
**Reuses**: `HeroType`
**Requirement**: COMBAT-01 (AC 1–3)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: benched/knocked-out heroes add no DPS; type bonus only on favored-type heroes; click = 5% of squad DPS; click kill emits `kill` with gold; `def/(def+K)` values
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): combat encounter model and click`

---

### T9: CombatRules.advance, live mode

**What**: The fixed step order of the design (spawn → squad strikes first → foe damage split / AD-004 leader redirect → kill → knock-outs → leader knock-out → timer → squad wipe), stage clear after `monstersPerStage` kills, auto-advance, HP restore on stage start and boss end, outcomes `kill`/`stageCleared`/`bossDefeated`/`bossFailed`/`squadWiped`, segment form `hp0 − k × perStep`.
**Where**: `Client/src/domain/combat/CombatRules.ts` (modify)
**Depends on**: T8
**Reuses**: T8 helpers
**Requirement**: COMBAT-01 (AC 1, 4, 7, 8), COMBAT-03 (AC 1, 2), COMBAT-04 (AC 1, 6–8), COMBAT-05, COMBAT-08 (empty squad idle, last stage stays)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] One unit test per listed AC and edge case (empty squad spawns nothing; last stage keeps farming; spawn within 500 ms; killed foe deals no damage that step; leader takes all boss damage without the favored type; knocked-out hero neither attacks nor shares damage; timer failure; leader failure; wipe restarts at full HP)
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): segment-based combat advance`

---

### T10: Event jumping and farming mode

**What**: `advance` jumps from event to event (`ceil` adjusted ±1 against the single-step predicate) and supports `mode: 'farming'` (no boss victory, no stage advance, no first-clear outcomes; boss stage farms the stage before it).
**Where**: `Client/src/domain/combat/CombatRules.ts` (modify)
**Depends on**: T9
**Reuses**: T9 step predicate
**Requirement**: COMBAT-07 (AC 3), AD-007

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Property-style unit test over ≥ 200 seeded random squads/stages: N single steps and one N-step jump give bit-identical `Encounter` and outcomes
- [ ] 12 h farming jump runs in < 50 ms and emits no `stageCleared`/`bossDefeated`
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): event-jumping combat and farming mode`

---

### T11: FarmRate

**What**: `farmRate(stage, p)` → `goldPerCycle`, `cycleMs`, `goldPerSecond` by running one farming cycle through `advance`.
**Where**: `Client/src/domain/combat/FarmRate.ts`
**Depends on**: T10
**Reuses**: `CombatRules.advance`
**Requirement**: COMBAT-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: rate equals gold of 10 kills over (kill time + spawn delays); empty squad → 0; weak squad that wipes still yields the farmed gold rate of the cycle
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): farm rate from the combat function`

---

### T12: BossFailureLabel

**What**: `label(squadPower, powerFloor, favoredType, squadTypes)` → `PowerGate` | `CompositionMismatch`, mapping the classifier's `Success` to `PowerGate`.
**Where**: `Client/src/domain/combat/BossFailureLabel.ts`
**Depends on**: T11
**Reuses**: `StageOutcomeClassifier.classify`
**Requirement**: COMBAT-06 (AC 1–3)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: below floor with and without favored type → PowerGate; at floor without → CompositionMismatch; at floor with → PowerGate
- [ ] Build gate passes (end of phase)

**Tests**: unit
**Gate**: build
**Commit**: `feat(domain): FR-11 label for boss failures`

---

### T13: CombatParamsBuilder

**What**: `build(state, stageNumber)` → `CombatParams` (field heroes in squad order with power × `dpsPerPower`, HP, defense, interval; stage spec; economy constants).
**Where**: `Client/src/services/combat/CombatParamsBuilder.ts`
**Depends on**: T12
**Reuses**: `RosterService.activeSquadOf`, `RosterRules`, `StageCurves`
**Requirement**: COMBAT-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: slot order (leader = slot 0), benched heroes excluded, empty squad → no heroes, star tier scales power
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): combat params from content and squad`

---

### T14: Combat snapshot in state and save v2

**What**: `StageCombatSnapshot` in `GameState` (added beside the legacy `combat` until T18), save `formatVersion` 2 with `local.combat { stageNumber, autoAdvance }` and the v1 → v2 migration (`furthest + 1` capped to content, `autoAdvance: true`), projection, `npm run fixtures:gen`.
**Where**: `Client/src/services/save/migrations.ts` (plus `src/services/state/types.ts`, `src/domain/SaveGameData.ts`, `src/services/state/projection.ts`, `fixtures/saves/*.json`)
**Depends on**: T13
**Reuses**: existing migration step pattern
**Requirement**: COMBAT-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: v1 fixture migrates with the capped stage; v2 round-trips; encounter is not persisted
- [ ] Full gate passes (p11 save-reload scenario still green)

**Tests**: unit
**Gate**: full
**Commit**: `feat(save): v2 with persisted combat stage and auto-advance`

---

### T15: StageCombatService step, click and outcomes

**What**: `step(dtMs)` and `click()` over `CombatRules`; outcome handling: kill gold to state + `pendingIncome`; first clear → `furthestStageCleared` + `StageCleared`; boss victory → `BossDefeated` then `StageCleared`; boss failure → `lastBossResult` label, previous stage, auto-advance off; leader missing mid-boss fails the fight.
**Where**: `Client/src/services/combat/StageCombatService.ts`
**Depends on**: T14
**Reuses**: `withEvent`, `BossFailureLabel`, `CombatParamsBuilder`
**Requirement**: COMBAT-01, COMBAT-03 (AC 5), COMBAT-04 (AC 6), COMBAT-06 (AC 4), COMBAT-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests per outcome, including event order `BossDefeated` before `StageCleared` and no duplicate `StageCleared` on replays
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): stage combat step, click and outcomes`

---

### T16: Stage navigation commands and squad lock

**What**: `jumpToStage` (cleared stages and furthest + 1 only, auto-advance off), `fightBoss` (full HP and timer), `setAutoAdvance`; `RosterService` refuses squad changes during a boss fight with "Squad changes are locked during a boss fight."
**Where**: `Client/src/services/combat/StageCombatService.ts` (modify; plus `src/services/roster/RosterService.ts`)
**Depends on**: T15
**Reuses**: roster refusal pattern
**Requirement**: COMBAT-03 (AC 2, 3), COMBAT-06 (AC 5), COMBAT-08 (leader benched)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: jump to cleared/next allowed, beyond refused; fight boss restarts timer; squad change refused mid-boss and allowed after
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): stage jump, boss retry and squad lock`

---

### T17: Fast-forward, income flush and wallet

**What**: `fastForward(ms)` in farming mode returning gold and kills; `flushIncome()` appends one `GoldEarned` for `pendingIncome`; `trySpendGold`/`addGold` move here and a spend flushes income first.
**Where**: `Client/src/services/combat/StageCombatService.ts` (modify)
**Depends on**: T16
**Reuses**: `withGold`, `CombatRules.advance` farming mode
**Requirement**: COMBAT-07 (AC 1–3)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit tests: 10 min of steps vs. `fastForward(10 min)` gold within relative 1e-6; fast-forward never clears stages; spend after kills logs `GoldEarned` before `GoldSpent`; zero income flushes nothing
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): fast-forward and batched gold income`

---

### T18: Game loop cutover

**What**: `TickDriver.step` drives `StageCombatService` and flushes income before each sync; `compose()` wires it; the click input and `GameScreenController` combat target move to the new service; `CombatService`/`PlayerCombatService` walk-click loop, `CombatSnapshot`, legacy `GameSettings` fields (`monsterPool`, `playerStats`, `idleGoldPerSquadPowerPerHour`) are removed; scenarios `p02-combat-loop.json` and `p03-equipment-bonus.json`, `services.test.ts` and `menu-and-combat.spec.ts` are rewritten for the new loop; PORT_MAP amendment for the retired Unity combat loop.
**Where**: `Client/src/services/tick/TickDriver.ts` (cutover; plus `src/app/compose.ts`, `src/services/combat/*`, `src/presentation/screens/GameScreenController.ts`, scenarios, tests, `PORT_MAP.md`)
**Depends on**: T17
**Reuses**: `TickDriver` loop
**Requirement**: COMBAT-01, COMBAT-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Rewritten p02: squad of 2, no clicks, 60 s → kills and gold match `DPS × 60 / HP` (spec Independent Test); p03 asserts the equipment power raises the kill rate
- [ ] `menu-and-combat.spec.ts` drives clicks via `__ig.input` and asserts gold and monster progress in `describe()`
- [ ] Soak bound (unsynced log) holds: `npm run soak -- --hours 1`
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(combat)!: squad-driven stage combat replaces the click loop`

---

### T19: Offline and gap gold through fast-forward

**What**: `SaveSyncService.applyOfflineAccrual` keeps the cap math of `OfflineAccrualCalculator` and credits `fastForward(elapsedCreditedMs).gold`; the gap beyond 60 s uses the same path; the Unity gold term of `offline-accrual` vectors is retired with a PORT_MAP amendment (cap/hours cases stay); `p10-offline-accrual.json` rewritten.
**Where**: `Client/src/services/sync/SaveSyncService.ts` (plus `tests/vectors/domain.test.ts`, `scenarios/p10-offline-accrual.json`, `PORT_MAP.md`)
**Depends on**: T18
**Reuses**: `OfflineAccrualCalculator` cap math
**Requirement**: COMBAT-07 (AC 1, 2), closes PORT_MAP B6

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit: 12 h cap applied; notice text unchanged; no stage advance offline
- [ ] p10 scenario: 10 min online vs. 10 min gap gold within relative 1e-6
- [ ] Full gate passes

**Tests**: unit
**Gate**: full
**Commit**: `feat(sync): offline gold from the squad farm rate`

---

### T20: StageService reduced to stage selection

**What**: `selectableStages()` (cleared + furthest + 1, favored type, boss power floor and predicted label); `attemptStage` and `lastStageAttempt` removed (consumers move to `combat.lastBossResult`); `p09-stage-select.json` rewritten as a jump-to-stage scenario.
**Where**: `Client/src/services/stages/StageService.ts` (plus `src/services/state/projection.ts`, `scenarios/p09-stage-select.json`)
**Depends on**: T19
**Reuses**: `getPreview`
**Requirement**: COMBAT-03 (AC 3, 4)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Unit: list contents for new and advanced players; boss rows carry floor and predicted label
- [ ] p09: jump to stage 2 turns auto-advance off and moves combat there
- [ ] Full gate passes

**Tests**: unit
**Gate**: full
**Commit**: `refactor(stages)!: stage select lists stages to jump to`

---

### T21: Progression and FR-11 sim checks

**What**: New scenarios `p13-progression.json` (new player reaches stage 4 with no input), `p14-boss-fights.json` (seeded: matching squad at the floor wins; same power without the favored type loses with the leader down; below the floor loses on the timer) and a sim test that checks spec P1 FR-11 AC 6 for every boss stage in content and squad sizes 1–5.
**Where**: `Client/tests/sim/fr11-tuning.test.ts` (plus `scenarios/p13-progression.json`, `scenarios/p14-boss-fights.json`)
**Depends on**: T20
**Reuses**: `tools/lib/simRunner.ts`
**Requirement**: COMBAT-03, COMBAT-04, COMBAT-05, COMBAT-06 (AC 6); Success Criteria

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Both scenarios pass with `npm run sim`; the FR-11 check passes for 100% of boss stages (placeholder content tuned if needed, without changing rules)
- [ ] No boss fight exceeds 60 s of game time in any check
- [ ] Build gate passes (end of phase)

**Tests**: unit
**Gate**: build
**Commit**: `test(sim): progression, boss fights and FR-11 tuning check`

---

### T22: Field heroes in WorldScene

**What**: `FieldHeroView` per Active Squad hero (Aseprite `idle`/`attack` when the hero has an `animations` entry, otherwise portrait cut-out with a 120 ms forward tween), attack cadence from `floor(elapsedMs / attackIntervalMs)`, hero HP bars, boss HP bar and timer; Krell hard-coding removed; `game.field.<heroId>` nodes in `describe()`.
**Where**: `Client/src/presentation/scenes/FieldHeroView.ts` (new; plus `WorldScene.ts`)
**Depends on**: T21
**Reuses**: Krell sprite creation, `hitFlash`, slime drawing
**Requirement**: COMBAT-02 (AC 5, 6)

**Tools**:
- MCP: NONE
- Skill: `phaser-sprites-and-images`, `phaser-tweens`

**Done when**:
- [ ] e2e: one field node per squad hero with HP and alive; attack counter grows with `__ig.advance`; portrait fallback flagged for heroes without sheets
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(world): squad heroes fight on the field`

---

### T23: Combat HUD

**What**: `GameScreenController` nodes `game.stage`, `game.progress` (monster n/10 or boss timer), `game.goldRate`, `game.auto`, `game.fightBoss`, `game.result` (FR-11 wording), empty-squad text and "More stages coming soon"; all gamepad-reachable.
**Where**: `Client/src/presentation/screens/GameScreenController.ts`
**Depends on**: T22
**Reuses**: existing HUD nodes
**Requirement**: COMBAT-03, COMBAT-04, COMBAT-06, COMBAT-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] e2e (`tests/e2e/combat-hud.spec.ts`): boss failure shows the label and `Fight boss`; auto toggle by gamepad; empty squad text; last-stage text
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(hud): stage, boss timer and failure label`

---

### T24: Stage Select jump screen

**What**: `StageSelectController` lists `selectableStages()` with a `Go` per row (→ `jumpToStage`), boss rows with favored type, floor vs. squad power and predicted label; `equipment-stages.spec.ts` rewritten for jumping; spec traceability set to Done.
**Where**: `Client/src/presentation/screens/StageSelectController.ts`
**Depends on**: T23
**Reuses**: existing list layout
**Requirement**: COMBAT-03 (AC 3, 4)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] e2e: jump to stage 2 from Stage Select by gamepad and see `game.stage` change (spec Independent Test)
- [ ] Build gate passes; Verifier runs after this task

**Tests**: e2e
**Gate**: build
**Commit**: `feat(stages): jump to a cleared stage from Stage Select`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
Phase 3:  T13 → T14 → T15 → T16 → T17 → T18 → T19 → T20 → T21
Phase 4:  T22 → T23 → T24

Phase boundaries:
  T4 → T5
  T12 → T13
  T21 → T22
```

## Pre-approval checks

**Granularity**: one deliverable per task. T3, T4, T5, T14, T18, T19 and T20 name several files: T4 and T5 are one contract change with its generated/migrated outputs; T14, T18, T19 and T20 retire a flow and must rewrite its scenario/test in the same commit (CLAUDE.md); T3 is one event type end to end. Accepted.

**Diagram ↔ Depends on**: every task depends on its predecessor in the chain; each phase's first task depends on the previous phase's last task. All match; no forward dependencies.

**Test co-location**:

| Task | Layer | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T1–T3 | backend | unit (xUnit) | unit | ✅ |
| T4 | shared rules | vectors | unit (vector tests) | ✅ |
| T5–T6 | content | unit | unit | ✅ |
| T7–T12 | client domain | unit | unit | ✅ |
| T13, T15–T17 | services | unit | unit | ✅ |
| T14, T19–T21 | services + scenarios | unit + sim | unit + scenarios | ✅ |
| T18 | services + presentation | e2e (highest) | e2e | ✅ |
| T22–T24 | presentation | e2e | e2e | ✅ |
