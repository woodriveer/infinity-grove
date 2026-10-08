# Boss and Monster Drops Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/boss-drops/design.md`
**Status**: Approved (decided in heartbeat, 2026-10-08)

Heartbeat runs execute one task per run, in order (CLAUDE.md, Heartbeat). Every task keeps its gate green on its own.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines and spec - confirm before Execute. Guidelines found: `CLAUDE.md` (Tests are mandatory, Layer rules), `Client/package.json` (`verify`), CI (`dotnet test`, openapi diff).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Backend domain + application | unit (xUnit) | Every new rule including rejection paths; rolls with a scripted `IDropRandom` plus one seeded statistical test | `Backend/tests/InfinityGrove.Backend.Tests/**/*Tests.cs` | `dotnet test Backend/InfinityGrove.Backend.sln` |
| Backend EF migration, API wiring | none (build gate; covered by ingestion tests and sync-e2e) | Builds | - | `dotnet build Backend/InfinityGrove.Backend.sln` |
| Shared numbers (kill interval, bucket cap, chances) | VectorGen family `drop-rules` + TS vector test | TS content equals backend options | `Backend/tools/**`, `Client/tests/vectors/*.test.ts` | `pwsh Backend/tools/generate-vectors.ps1`, `npm test` |
| Client domain/content, tools | unit | Schema, validation rules, catalog generator | `Client/tests/unit/*.test.ts` | `npm test` |
| Client services (`src/services/**`) | unit + scenario | Each command/path incl. refusal, offline and resend | `Client/tests/unit/*.test.ts`, `Client/scenarios/*.json` | `npm test`, `npm run sim` |
| Client presentation | e2e | Nodes in `describe()`, gamepad reachability | `Client/tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Real backend flow | sync-e2e | Boss first defeat grants a hero once | `Client/tests/sync-e2e/sync.e2e.test.ts` | `IG_SYNC_E2E_BACKEND=... npm run test:sync-e2e` (Docker; written, not run in heartbeat) |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Backend | Backend-only tasks | `dotnet build Backend/InfinityGrove.Backend.sln && dotnet test Backend/InfinityGrove.Backend.sln` |
| Quick | Client domain/services/tools tasks | `npm run typecheck && npm run lint && npm test` (in `Client/`) |
| Full | Presentation, generated files, shared contract | `npm run verify` (in `Client/`; ui-gate criterion 3 is a known pre-existing failure) |

---

## Execution Plan

```
Phase 1 (content + catalog):  T1 → T2 → T3
Phase 2 (backend):            T3 → T4 → T5 → T6 → T7 → T8 → T9
Phase 3 (client):             T9 → T10 → T11 → T12 → T13 → T14
Phase 4 (proof):              T14 → T15 → T16
```

---

## Task Breakdown

### T1: Drop content and hero `minStage`

**What**: Optional `minStage` (default 1) on hero content; new `content/economy/drops.json` (`normalChance` 0.03, `bossChance` 0.25, `bagCapacity` 100, `itemBands`) with schema, types and loader; six placeholder heroes get `minStage` 1/1/1/3/6/9; item bands reference existing items.
**Where**: `Client/src/domain/content/types.ts`, `Client/src/services/content/**` (schemas, loader), `Client/content/heroes/*.json`, `Client/content/economy/drops.json`
**Depends on**: None
**Requirement**: DROP-01 (AC 4), DROP-03

**Done when**:
- [x] Unit: schema accepts the new file and `minStage`; rejects `minStage` 0, a chance outside 0..1, an unknown item id in a band
- [x] `validate:content` rules: every boss stage has an eligible hero in some type; bands cover stage 1; errors name file and field
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): drop tables and hero minStage`

---

### T2: Catalog generator

**What**: `npm run gen:drops` (`Client/tools/gen-drops.ts`) writes `shared/drop-catalog/drop-catalog.json` (shape in the design) from content and `CraftingRules`; `gen:check` fails when it is stale.
**Where**: `Client/tools/gen-drops.ts`, `Client/package.json`, `shared/drop-catalog/drop-catalog.json`
**Depends on**: T1
**Requirement**: DROP-01, DROP-03, DROP-04

**Done when**:
- [ ] Unit: catalog lists every hero with `serverHeroId`, boss flags and favored types per stage, slot affix ranges equal `CraftingRules`
- [ ] Unit: `gen:check` detects a changed hero `minStage` without regeneration
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(tools): generate the drop catalog from content`

---

### T3: Backend drop catalog

**What**: Backend `DropCatalog` (Domain) and `EmbeddedDropCatalogLoader` (Infrastructure) embedding `shared/drop-catalog/drop-catalog.json`; registered in DI.
**Where**: `Backend/src/InfinityGrove.Backend.Domain/Drops/DropCatalog.cs`, `Backend/src/InfinityGrove.Backend.Infrastructure/Drops/**`, csproj
**Depends on**: T2
**Requirement**: DROP-01, DROP-03

**Done when**:
- [ ] xUnit: the embedded catalog loads, heroes and bands are non-empty, a malformed catalog is refused with a clear error
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): embedded drop catalog`

---

### T4: DropRules (pure)

**What**: `IDropRandom`, `RandomNumberGenerator` implementation, and `DropRules` with `RollHero`, `HeroDropChance`, `RollItem`, `CountNormalDrops` as in the design (weights 0.40/0.15, renormalized when the type has no eligible hero).
**Where**: `Backend/src/InfinityGrove.Backend.Domain/Drops/DropRules.cs`, `Backend/tests/InfinityGrove.Backend.Tests/Drops/DropRulesTests.cs`
**Depends on**: T3
**Requirement**: DROP-01 (AC 1-5), DROP-03 (AC 1-3)

**Done when**:
- [ ] xUnit with a scripted `IDropRandom`: favored type at 0.39 vs 0.41, each other type band, eligibility by `minStage`, empty-type reroll, affix values at both range ends, item template within the band
- [ ] xUnit: 100 000 seeded rolls keep type shares within +-1 point of 40/15/15/15/15
- [ ] `HeroDropChance` is 1.0 for first defeat and 0.01 otherwise
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): drop rules`

---

### T5: Kill allowance and options

**What**: `ProgressOptions` (`MinKillIntervalMs` 400, `KillBucketCap` 108000, `MaxKillsPerEvent` 1000); `PlayerProgress.KillAllowance`/`KillAllowanceAtUtc` with a token-bucket `TryConsumeKills(count, nowUtc)`; EF mapping and migration `AddKillAllowance`.
**Where**: `Backend/src/**/Progress/**`, `Backend/src/InfinityGrove.Backend.Infrastructure/Persistence/**`
**Depends on**: T4
**Requirement**: DROP-04 (AC 2)

**Done when**:
- [ ] xUnit: first call starts with a full bucket capped at `KillBucketCap`; refills by elapsed/400 ms; a count above the allowance is refused and leaves the bucket unchanged; a clock going backwards grants nothing
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): kill allowance token bucket`

---

### T6: RewardGrants storage

**What**: `RewardGrant` entity, `IRewardGrantRepository` (add, list by `SourceClientEventId`), EF table `RewardGrants` with index `(AccountId, SourceClientEventId)`, migration `AddRewardGrants`, `RewardGrantDto`.
**Where**: `Backend/src/**/Rewards/**`, `Backend/src/InfinityGrove.Backend.Infrastructure/Persistence/**`
**Depends on**: T5
**Requirement**: DROP-04 (AC 1), DROP-05

**Done when**:
- [ ] xUnit (in-memory/fake repository contract): stored grants come back by source event id, only for the owning account
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): reward grants table`

---

### T7: MonsterKillsBatch event

**What**: `PlayerEventType.MonsterKillsBatch = 6`, payload `(StageNumber, Count)`; `ApplyMonsterKillsBatch` validates stage window (`<= furthest + 1`), non-boss stage, `1 <= count <= MaxKillsPerEvent`, the bucket; then `CountNormalDrops`, `RollItem` per drop, grants stored with server-minted ids; `EventIngestionResult.Grants`; a resent event returns its stored grants.
**Where**: `Backend/src/**/Events/PlayerEventIngestionService.cs`, `EventRejections.cs`, API DTOs
**Depends on**: T6
**Requirement**: DROP-03 (AC 1, 3), DROP-04 (AC 2)

**Done when**:
- [ ] xUnit accepted path: count 10 with scripted rolls yields the expected grants; nothing granted at chance 0
- [ ] xUnit rejection paths: kill rate "Kill rate exceeds the possible maximum.", stage beyond furthest + 1, boss stage, count 0, count 1001 (all rejected whole, nothing persisted)
- [ ] xUnit: resend of a recorded event returns the same grant ids and rolls nothing new
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): monster kill batches and item drops`

---

### T8: Boss defeat grants

**What**: In the `BossDefeated` case, compute `firstDefeat = stage > HighestBossDefeated` before applying; roll hero (always on first, 1% on repeat) through the `HeroAcquired` path (`ApplyHeroAcquired` + `CardInstance.Mint`) and independently an item (boss chance); grants stored and returned; the existing out-of-order boss rejection stays.
**Where**: `Backend/src/**/Events/PlayerEventIngestionService.cs`
**Depends on**: T7
**Requirement**: DROP-01 (AC 1-2), DROP-03 (AC 2), DROP-04 (AC 3), DROP-05 (two devices)

**Done when**:
- [ ] xUnit: first defeat always grants one hero card and the canonical roster contains it; repeat grants at 0.009 and not at 0.011 (scripted roll)
- [ ] xUnit: boss item rolled independently (hero yes/item no and the reverse)
- [ ] xUnit rejection: boss beyond furthest + 1 keeps the exact message "Cannot defeat boss of stage <n> before stage <m>.", no grant
- [ ] xUnit: the same first defeat sent twice (second device) grants once; resent event returns stored grants
- [ ] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): boss defeat drops`

---

### T9: Contract, vectors, openapi

**What**: Re-export `shared/openapi` (new event type, `grants` on results) and regenerate `gen:api`; VectorGen `drop-rules` family (kill interval, bucket cap, chances, weights) and extend `event-validation` with kill-batch and boss cases; TS vector test comparing client content to the backend numbers.
**Where**: `Backend/tools/**`, `shared/openapi/openapi.json`, `shared/test-vectors/**`, `Client/src/generated/api/schema.ts`, `Client/tests/vectors/drop-rules.test.ts`
**Depends on**: T8
**Requirement**: DROP-04

**Done when**:
- [ ] `pwsh tools/export-openapi.ps1` and `generate-vectors.ps1` run; `gen:check` clean
- [ ] Vector test fails when the content `normalChance`/`bossChance` or the sim kill interval differs from the backend options (checked once by editing a value locally)
- [ ] Backend and Full gates pass

**Tests**: vectors
**Gate**: full
**Commit**: `feat(contract): drop grants in the API and drop-rules vectors`

---

### T10: Kill counting in combat

**What**: `StageCombatService` keeps `pendingKills {stageNumber, count}`; `flushIncome` appends `MonsterKillsBatch` events (split at 1000); `fastForward` counts offline farming kills the same way; a stage change flushes first; new `PlayerEvent` type in the client event schema.
**Where**: `Client/src/services/combat/StageCombatService.ts`, `Client/src/services/events/**`
**Depends on**: T9
**Requirement**: DROP-03, DROP-04 (AC 2)

**Done when**:
- [ ] Unit: 25 kills then a flush produce one event with count 25; 2 300 kills split into 1000/1000/300; a stage change never mixes stages; boss kills are not counted
- [ ] Unit: `fastForward` of a known duration counts the same kills as the live loop over that duration
- [ ] Scenario p17 with an `expect` on the event log shows batches during farming
- [ ] Quick gate passes

**Tests**: unit + scenario
**Gate**: quick
**Commit**: `feat(combat): report monster kills in batches`

---

### T11: RewardService and bag queue

**What**: `RewardService.applyGrants` (idempotent by `grantId`, `local.appliedGrantIds` last 500); hero grants add nothing by themselves (canonical roster brings the card) but raise "New hero"/"Duplicate" notices; item grants go to the bag or `local.grantQueue`; selling or discarding drains the queue; save `formatVersion` 3 with migration; `SaveSyncService` parses `grants` from event results and calls the service.
**Where**: `Client/src/services/rewards/RewardService.ts`, `Client/src/services/sync/SaveSyncService.ts`, `Client/src/services/state/{types,migrations}.ts`, `Client/src/services/EquipmentInventoryService.ts`
**Depends on**: T10
**Requirement**: DROP-02, DROP-03 (AC 4), DROP-05

**Done when**:
- [ ] Unit: the same grant applied twice adds one item; bag at capacity sends the item to the queue and shows the bag-full notice once; a sale drains the queue in order
- [ ] Unit: hero grant of a known id notices "New hero: <name>!", an owned one "Duplicate: <name> +1", an unknown id "New hero (update the game to see it)" and logs the id
- [ ] Unit: v2 saves migrate to v3; fixtures regenerate with `fixtures:gen`
- [ ] Unit: offline sync keeps events pending and shows "Rewards pending sync" once per session
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(rewards): apply backend grants to the bag and roster`

---

### T12: Lint rule for the grant path

**What**: dependency-cruiser/ESLint rule: only `services/rewards/RewardService.ts` (called from `SaveSyncService`) may add granted items or heroes; negative fixture shows another service or presentation doing it fails; the starter hero path is the documented exception.
**Where**: `Client/.dependency-cruiser.cjs` or ESLint config, `Client/tests/lint/**`
**Depends on**: T11
**Requirement**: DROP-04 (AC 1)

**Done when**:
- [ ] Negative fixtures fail for presentation and for a non-sync service; positive path passes
- [ ] `npm run lint` passes
- [ ] Quick gate passes

**Tests**: lint fixtures
**Gate**: quick
**Commit**: `chore(lint): items and heroes enter state only through grants`

---

### T13: Sim double for scenarios

**What**: `InProcessDrops` in `app/dev-backend.ts` (dev/test only, never composed in production) grants deterministically from the sim seed; `sim` and the e2e `?backend=fake` use it; `game.grantQueue` node in `describe()`.
**Where**: `Client/src/app/dev-backend.ts`, `Client/src/presentation/screens/**` (node only)
**Depends on**: T12
**Requirement**: DROP-02, DROP-03, DROP-05

**Done when**:
- [ ] Unit: same seed gives the same grants; the double is absent from the production bundle (bundle check like the other dev hooks)
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `test(rewards): deterministic in-process drop double`

---

### T14: Scenarios and e2e

**What**: Scenario p18 (first boss defeat grants a hero, item drops fill the bag, bag-full queues, duplicate hero adds a copy) with `expect` blocks; e2e that reads toasts, `game.grantQueue` and roster nodes after a boss kill via the fake backend, gamepad reachable.
**Where**: `Client/scenarios/p18-drops.json`, `Client/tests/e2e/drops.spec.ts`
**Depends on**: T13
**Requirement**: DROP-01..05

**Done when**:
- [ ] `npm run sim -- --script scenarios/p18-drops.json` passes its `expect`
- [ ] e2e: new hero toast and bench card, duplicate toast and +1 copy, bag-full notice and queue length, offline "Rewards pending sync"
- [ ] Full gate passes

**Tests**: scenario + e2e
**Gate**: full
**Commit**: `test(rewards): drop scenarios and e2e`

---

### T15: Sync-e2e for the real backend

**What**: Extend `sync.e2e.test.ts`: first boss defeat grants exactly one hero (card in canonical roster), a resend returns the same grant, an over-rate kill batch is rejected with the exact reason.
**Where**: `Client/tests/sync-e2e/sync.e2e.test.ts`
**Depends on**: T14
**Requirement**: DROP-01, DROP-04, DROP-05

**Done when**:
- [ ] Test compiles and typechecks; skipped without `IG_SYNC_E2E_BACKEND`; run only with the Docker backend (recorded as pending for the developer)
- [ ] Full + Backend gates pass

**Tests**: sync-e2e
**Gate**: full
**Commit**: `test(sync): boss drops against the real backend`

---

### T16: Close the feature

**What**: PORT_MAP/docs note (drop path guaranteed, save-file tampering out of scope), spec traceability set to Done, STATE handoff updated; Verifier runs next.
**Where**: `Client/PORT_MAP.md`, `.specs/features/boss-drops/spec.md`, `.specs/STATE.md`
**Depends on**: T15
**Requirement**: DROP-01..05

**Done when**:
- [ ] Spec traceability table Done for DROP-01..05
- [ ] Full + Backend gates pass

**Tests**: none (docs)
**Gate**: full
**Commit**: `docs(specs): boss-drops traceability`
