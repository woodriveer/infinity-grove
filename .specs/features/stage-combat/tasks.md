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
- [x] Project builds in the solution and `dotnet test Backend/InfinityGrove.Backend.sln` discovers and passes ≥ 4 tests
- [x] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `test(backend): add xUnit project with stage-clear order tests`
**Status**: Done (heartbeat 2026-10-07): 5 tests (4 facts + a 2-case theory), Release build 0 warnings

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
- [x] xUnit: accept in order, replay no-op, reject skip ahead, reject non-boss stage, reject boss `StageCleared` before `BossDefeated`, accept it after
- [x] Backend gate passes; test count grows, none removed

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): BossDefeated rule and boss-stage clear guard`
**Status**: Done (heartbeat 2026-10-07): 14 tests (9 new BossDefeated cases incl. a 2-case theory), 0 warnings. Decided in heartbeat: `ApplyStageCleared` takes `bossEvery` too; ingestion passes `PlayerProgress.DefaultBossEvery` (5) until T3 adds `Progress:BossEvery`; EF ignores `HighestBossDefeated` until the T3 column/migration; `shared/openapi` enum gains `BossDefeated` only at T4 re-export.

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
- [x] xUnit over in-memory repositories: a batch `BossDefeated(5)` + `StageCleared(5)` is accepted; `StageCleared(5)` alone is rejected with the message; malformed payload rejected
- [x] Migration generated with `dotnet ef migrations add AddHighestBossDefeated`; Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): ingest BossDefeated events`
**Status**: Done (heartbeat 2026-10-07): 19 tests (5 new ingestion cases incl. a 2-case malformed theory and a BossEvery=3 case), 0 warnings; mutant "StageCleared ignores configured BossEvery" killed. Decided in heartbeat: `ProgressOptions` (Application, section `Progress`) is a plain POCO bound in `AddInfrastructure` and injected as a singleton (the Application project has no Options dependency); startup fails if `BossEvery < 1`; the test project now references Application and carries its own in-memory repositories; VectorGen passes `new ProgressOptions()` (vector outputs unchanged).

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
- [x] `pwsh Backend/tools/generate-vectors.ps1` and `export-openapi.ps1` produce the committed files (CI diff clean)
- [x] Client vector tests pass for `BossDefeated` payload/validation and `stage-rules`
- [x] Full gate + Backend gate pass

**Tests**: unit
**Gate**: build
**Commit**: `feat(events): BossDefeated vectors and API contract`
**Status**: Done (heartbeat 2026-10-07): vectors `event-payloads` (+4 BossDefeated), `event-validation` (+3 scenarios: boss-stages, boss-across-batches, malformed-boss-payloads), new `stage-rules` (default BossEvery + 80 isBossStage cases); openapi + `schema.ts` regenerated. Client: `BossDefeated` type/payload, `domain/StageRules.ts`, `PlayerProgressReplay` mirrors `ApplyBossDefeated` and the boss-stage clear guard. Vitest 154 (was 149), Backend 19, mutants "replay ignores boss guard" and "isBossStage off by one" killed. Gate: everything green except e2e `ui-gate.spec.ts` criterion 3 (focus p95 142–169 ms vs < 100 ms), which fails the same way on the base commit 878d778 (149 ms): a pre-existing failure on this machine, not caused by T4; the other 29 e2e, build and scan:secrets pass. Decided in heartbeat: commit T4 anyway and leave that test for the developer; `ProgressLedger` gains `highestBossDefeated` + `bossEvery`, seeded from the snapshot as the last boss stage ≤ `furthestStageCleared` (the canonical snapshot does not carry HighestBossDefeated; the backend never clears a boss stage before its boss); vector state snapshots keep the backend's `PlayerProgressSnapshot` shape (boss progress is shown through the verdicts).

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
- [x] `content.test.ts`: one accepting and one rejecting case per rule; the timer case asserts the file name and `boss.timerSeconds` in the message
- [x] `npm run validate:content` passes on the repository content; Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): combat economy kind and boss stage schema`
**Status**: Done (heartbeat 2026-10-07): `content.test.ts` 15 tests (11 new: economy load/missing, hero fields, boss required/forbidden, bossEvery read from content, timer 60 accepted / 61 rejected as `stages/boss-den.json: boss.timerSeconds: must be at most 60 s`, default timer > 60, stage/boss monster refs, spawnDelayMs 500 ok / 250 / 600, gaps); Vitest 165 (was 154); validate:content, gen:check and build pass; mutants "contiguity check removed" and "bossEvery hard-coded to 5" killed. Decided in heartbeat: legacy fields stay until their cutover (stage top-level `powerFloor` until T20 retires `attemptStage`; monster `maxHp`/`goldMin`/`goldMax` until T18), so the old loop keeps working; `content/economy/combat.json` is required and is added here with the design defaults plus placeholder curves (`dpsPerPower` 1, `defenseK` 50, monster hp 50×1.15ⁿ, gold 5×1.12ⁿ, dps 2×1.12ⁿ, boss ×10 hp / ×3 dps / ×10 gold), because the boss-presence rule needs `bossEvery`; every hero gets placeholder `baseHp` 100, `baseDefense` 5, `attackIntervalMs` 1000 (T6 sets per-hero values); `defaultBossTimerSeconds` is also capped at 60; only the first stage-number gap is reported.

---

### T6: Placeholder combat content and Krell hero

**What**: Review `content/economy/combat.json` (added with design defaults in T5), `content/heroes/krell.json` (new `serverHeroId` GUID, `animations: krell`), HP/defense/interval on every hero, and stages up to 10 so that stages 5 and 10 are boss stages with favored types; regenerate assets if new keys are used. The backend needs no seed: `HeroAcquired` accepts any hero GUID (design amendment).
**Where**: `Client/content/economy/combat.json` (plus `content/heroes/*.json`, `content/stages/*.json`)
**Depends on**: T5
**Reuses**: existing stage and hero files
**Requirement**: COMBAT-02 (Krell regular hero), COMBAT-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `content.test.ts` asserts the loaded catalog has ≥ 10 contiguous stages, boss stages 5 and 10, and Krell as a regular hero
- [x] `npm run validate:content` and Quick gate pass

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): placeholder combat economy, stages 1-10 and Krell`
**Status**: Done (heartbeat 2026-10-07): `content.test.ts` 18 tests (3 new: ≥ 10 contiguous stages with bosses exactly on multiples of `bossEvery` incl. 5 and 10; Krell has a GUID `serverHeroId` and an animations entry; every hero has its own HP/defense/interval); Vitest 168 (was 165); validate:content OK (7 heroes, 2 monsters, 10 stages); e2e green except the known ui-gate criterion 3 (186 ms, pre-existing). T5 fixtures that assumed 4 stages were repointed, rules and messages unchanged: boss cases edit `stages/bramble-throne.json` (stage 5) instead of adding `boss-den`; the duplicate-id copy and the RFR-12 sim fixture use stage 11; the gap case adds stage 12; full error lists grew with the new stage files. Decided in heartbeat: Krell is `krell` (Dark, power 12, HP 130, def 6, 900 ms, `serverHeroId` …0007, no portrait yet); the `animations: krell` link is the existing `animations/krell.json` entry matched by hero id (design.md:178 "has an `animations` entry"), so `HeroData` gets no new field; per-hero placeholder stats (cleric 90/8/1200, druid 110/6/1100, ember-warden 120/4/900, ranger 95/4/800, shade-stalker 85/3/700, tide-caller 105/7/1000); new stages 5 Bramble Throne (Nature, boss, default timer), 6 Sunlit Glade (Light), 7 Cinder Hollow (Fire), 8 Mistwater Shallows (Water), 9 Duskroot Path (Dark), 10 Elder Heart (Light, boss, 45 s timer); boss monster `elder-slime` (no sprite; legacy maxHp/gold fields until T18); boss power floors 200 and 1200 and legacy `powerFloor` 200…1200 are placeholders that T21 tunes; `combat.json` reviewed and kept as in T5; no new asset keys, so no gen:assets.

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
- [x] Unit tests: stage 1 values equal the bases; growth per stage; boss multipliers; default vs explicit timer
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): stage curves for combat`
**Status**: Done (heartbeat 2026-10-07): 4 tests in `Client/tests/unit/stageCurves.test.ts`; quick gate 172 tests green. Decided in heartbeat: `StageSpec` (not shaped in design) = `{ stageNumber, favoredType, monsterHp, goldPerKill, monsterDps, boss?: { monsterId, powerFloor, hp, dps, gold, timerSeconds } }`; stage n = `base × growth^(n−1)`; boss = that stage's monster × `boss.*Multiplier` (boss gold included since `goldMultiplier` exists); boss presence follows `stage.boss` (validate:content enforces the `bossEvery` rule).

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
- [x] Unit tests: benched/knocked-out heroes add no DPS; type bonus only on favored-type heroes; click = 5% of squad DPS; click kill emits `kill` with gold; `def/(def+K)` values
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): combat encounter model and click`
**Status**: Done (heartbeat 2026-10-07): 15 tests in `Client/tests/unit/combatRules.test.ts`; quick gate 187 tests green. Decided in heartbeat: `CombatParams` (not shaped in design) = economy scalars `monstersPerStage`, `spawnDelayMs`, `typeBonus`, `clickDpsShare`, `dpsPerPower`, `defenseK` + `squad: SquadMember[]` (Active Squad only, slot order, `{ heroId, heroType, power, maxHp, defense, attackIntervalMs }`) + `stages: StageSpec[]` (index n−1, so auto-advance can read the next stage); `FieldHero.dps = power × dpsPerPower` set in `startStage`; a boss stage spawns only the boss, its timer `round(timerSeconds × 10)` steps set at stage start; a click on a non-fighting encounter is a no-op; a click kill moves to `spawning` with `monsterIndex + 1` (stage clear and boss victory on kill come in T9).

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
- [x] One unit test per listed AC and edge case (empty squad spawns nothing; last stage keeps farming; spawn within 500 ms; killed foe deals no damage that step; leader takes all boss damage without the favored type; knocked-out hero neither attacks nor shares damage; timer failure; leader failure; wipe restarts at full HP)
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): segment-based combat advance`
**Status**: Done (heartbeat 2026-10-07): 21 tests in `Client/tests/unit/combatAdvance.test.ts`; quick gate 208 tests green. Decided in heartbeat: `Encounter.autoAdvance` (with `startStage(stage, p, autoAdvance = true)`) carries auto-advance inside the rules, since a boss failure must turn it off mid-`advance` and a later clear must then restart the stage; T14 keeps `StageCombatSnapshot.autoAdvance` in sync with it. `StageSpec.monsterIds` (from `StageData.monsters`) names the normal foe, drawn as `monsters[monsterIndex % length]`. The boss timer runs only while the boss is on the field (not during the spawn delay). AD-004 checks the favored type over the whole Active Squad, knocked-out heroes included. Rules emit `stageCleared` on every normal clear and `kill` + `bossDefeated` (no `stageCleared`) on a boss kill; the service dedups first clears and appends `StageCleared` after `BossDefeated` (design). `advance` takes no `mode` yet; T10 adds it. The T8 click test on a boss kill now also expects `bossDefeated` (T8 deferred boss victory to T9).

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
- [x] Property-style unit test over ≥ 200 seeded random squads/stages: N single steps and one N-step jump give bit-identical `Encounter` and outcomes
- [x] 12 h farming jump runs in < 50 ms and emits no `stageCleared`/`bossDefeated`
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): event-jumping combat and farming mode`

**Status**: Done (heartbeat 2026-10-07): `advance(enc, steps, p, mode = 'live')` jumps event to event (spawn, kill, knock-out, boss timer; `ceil` adjusted against the exact step expression) in both modes; `farming` farms the stage before a boss stage, emits `kill` only (no `stageCleared`/`bossDefeated`/`bossFailed`) and restarts the stage on a clear. 5 tests in `Client/tests/unit/combatJump.test.ts` (220 seeded setups per mode, step vs jump and split equivalence; 12 h farming bound measured best of 7 after warm-up since a cold JIT run is 50–100 ms on this machine). Quick gate green: typecheck, lint, Vitest 213 passed. Decided in heartbeat: a stale T10 lock with uncommitted work was discarded and redone (patch kept only in the session scratchpad).

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
- [x] Unit tests: rate equals gold of 10 kills over (kill time + spawn delays); empty squad → 0; weak squad that wipes still yields the farmed gold rate of the cycle
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): farm rate from the combat function`


**Status**: Done (heartbeat 2026-10-07): `farmRate(stage, p)` steps `advance(..., 1, p, 'farming')` from the stage start until the 10th kill or a `squadWiped`, summing `kill` gold; empty squad and a cycle with no progress after 1 h of combat give zeros; a boss stage reports the stage before it (as farming does). 5 unit tests in `Client/tests/unit/farmRate.test.ts`.
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
- [x] Unit tests: below floor with and without favored type → PowerGate; at floor without → CompositionMismatch; at floor with → PowerGate
- [x] Build gate passes (end of phase)

**Tests**: unit
**Gate**: build
**Commit**: `feat(domain): FR-11 label for boss failures`

**Status**: Done (heartbeat 2026-10-07): `BossFailureLabel.label` wraps `StageOutcomeClassifier.classify`, `Success` → `PowerGate`. 3 unit tests in `Client/tests/unit/bossFailureLabel.test.ts`. Phase 2 build gate green (typecheck, lint, Vitest, build).

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
- [x] Unit tests: slot order (leader = slot 0), benched heroes excluded, empty squad → no heroes, star tier scales power
- [x] Quick gate passes

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
- [x] Unit tests: v1 fixture migrates with the capped stage; v2 round-trips; encounter is not persisted
- [x] Full gate passes (p11 save-reload scenario still green)

**Tests**: unit
**Gate**: full
**Commit**: `feat(save): v2 with persisted combat stage and auto-advance`

**Status**: Done (heartbeat 2026-10-07): 3 tests in `Client/tests/unit/saveV2.test.ts` (v1 fixture kept in `fixtures/legacy/save-v1-mid-game.json`); fixtures regenerated. Full gate: everything green except the known ui-gate criterion 3 e2e (pre-existing) and the machine-load-sensitive 12 h farming timing in combatJump (passes alone; failed 2 of 3 full runs here, 70 ms vs 50 ms). Decided in heartbeat: `GameState.stageCombat` is added with `encounter: Encounter | null` (null until T15 starts the stage) and its own `stageNumber`; the migration stores furthest + 1 and the cap to content and furthest + 1 happens in `stateFromSave` (the migration is pure and has no content).

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
- [x] Unit tests per outcome, including event order `BossDefeated` before `StageCleared` and no duplicate `StageCleared` on replays
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): stage combat step, click and outcomes`


**Status**: Done (heartbeat 2026-10-07): 9 tests in `Client/tests/unit/stageCombatService.test.ts`. Quick gate green except the known load-sensitive combatJump 12 h timing test (passes alone). Decided in heartbeat: kill gold is rounded to whole gold and the same amount goes to the wallet and `pendingIncome` (no event yet; T17 flushes); `BossDefeated` is emitted only for a boss stage above `furthestStageCleared` (right before its `StageCleared`); the encounter restarts when the squad ids change (non-boss) and a boss stage whose leader changed or vanished fails as `cause: 'leader'`; `step(dtMs)` runs `round(dtMs/100)` steps (min 1).
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
- [x] Unit tests: jump to cleared/next allowed, beyond refused; fight boss restarts timer; squad change refused mid-boss and allowed after
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): stage jump, boss retry and squad lock`

**Status**: Done (heartbeat 2026-10-07): 5 new tests in `Client/tests/unit/stageCombatService.test.ts`; lint, typecheck, `npm test` green. Decided in heartbeat: `fightBoss` starts stage `furthest + 1` and is refused (false) unless that is a boss stage, auto-advance on; `jumpToStage` returns false beyond `furthest + 1`; the squad lock is `RosterService.squadLocked()` (an encounter with a boss timer) and refused commands log `SQUAD_LOCKED_MESSAGE` and return false/no-op, the screen shows the message in T23.

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
- [x] Unit tests: 10 min of steps vs. `fastForward(10 min)` gold within relative 1e-6; fast-forward never clears stages; spend after kills logs `GoldEarned` before `GoldSpent`; zero income flushes nothing
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): fast-forward and batched gold income`

**Status**: Done (heartbeat 2026-10-07): 5 new tests in `Client/tests/unit/stageCombatService.test.ts`; lint, typecheck, `npm test` green. Decided in heartbeat: `fastForward(ms)` returns `{gold, kills}`, runs `floor(ms/100)` farming steps on the prepared encounter and keeps the stored encounter untouched when it is a boss stage (farming uses the stage before); `flushIncome` only appends the event (the wallet already holds kill gold); `addGold` is a plain `withGold` (own `GoldEarned`). `CombatService` keeps its own copies until T18.

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
- [x] Rewritten p02: squad of 2, no clicks, 60 s → kills and gold match `DPS × 60 / HP` (spec Independent Test); p03 asserts the equipment power raises the kill rate
- [x] `menu-and-combat.spec.ts` drives clicks via `__ig.input` and asserts gold and monster progress in `describe()`
- [x] Soak bound (unsynced log) holds: `npm run soak -- --hours 1`
- [x] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(combat)!: squad-driven stage combat replaces the click loop`
**Status**: Done (heartbeat 2026-10-07): p02 (squad of 2, no clicks, 60 s: 30 kills, 150 gold, matches the discretized DPS model) and p03 rewritten; e2e menu-and-combat drives clicks and asserts `game.combat`/`game.progress`/`game.current`; soak 1 h OK; Vitest 250 (the 12 h farming timing in combatJump is the known load flake), e2e green except the known ui-gate criterion 3. Decided in heartbeat: `app.combat` now is `StageCombatService` (same `addGold`/`trySpendGold` callers), no `begin()` (the encounter starts lazily on the first tick, so combat also runs behind the menu); `flushIncome` runs before each periodic sync, in `syncNow` and in `persist`, and the sim flushes at the end of a run; Krell's weapon bonus no longer feeds combat (equipment power belongs to equipment-enchant) so p03 became `p03-squad-power` (the "equipment raises kill rate" check waits for that feature); sim steps `begin`/`attack`/`attackUntilKill` became `click`/`clickUntilKill` plus `setAutoAdvance`; `idleGoldPerSquadPowerPerHour` stays until T19 (offline accrual still uses it), `monsterPool`/`playerStats` removed, legacy monster `maxHp`/`goldMin`/`goldMax` stay (cleanup with T20); a click on a 50 HP foe shows `ceil(hp)`, so one ranger click is invisible in the label (asserted through `state().combat.foe.hp`).

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
- [x] Unit: 12 h cap applied; notice text unchanged; no stage advance offline
- [x] p10 scenario: 10 min online vs. 10 min gap gold within relative 1e-6
- [x] Full gate passes

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
