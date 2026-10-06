# Playable Vertical Slice Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The
skill is the source of truth for the full flow (per-task cycle, sub-agent delegation,
adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/playable-vertical-slice/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling. Guidelines found: none - no `AGENTS.md`/`CONTRIBUTING.md`,
> no existing test files anywhere in `InfinityGrove/Assets` or `Backend/` (confirmed by
> search). Strong defaults applied, narrowed by the user's explicit choice: EditMode unit
> tests for new pure C# logic; everything else (content assets, scene wiring, MonoBehaviour
> presentation) verified by a scripted end-to-end smoke pass plus the existing batchmode
> build gate, not a new automated UI/integration test framework.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain (pure logic): `StarterSelectGate`, `DropTable` | unit (EditMode) | 1:1 to each ACs' branch + every listed edge case (empty pool, 0%/100% chance) | `InfinityGrove/Assets/Tests/EditMode/*.cs` | `Unity.exe -batchmode -nographics -projectPath InfinityGrove -runTests -testPlatform EditMode -testResults TestResults/editmode-results.xml -quit` |
| Service layer glue (`CombatService` drop-roll wiring) | none (covered indirectly) | Branching logic lives in `DropTable` (unit-tested above); `CombatService`'s own change is thin orchestration glue verified by the end-to-end smoke pass, not a duplicate unit suite | - | covered by smoke pass (Phase 6) |
| Content assets (`HeroData`/`StageData`/`EquipmentItemData` instances), scene wiring, Presentation MonoBehaviours | none | Build gate + scripted end-to-end smoke pass exercising the wired services through their real data (Phase 6) | - | build gate only |

**Coverage Expectation values** - strong defaults, narrowed per user decision above:

| Layer type | Applied default |
| --- | --- |
| Domain / pure business-logic (new this feature) | All branches; 1:1 to spec ACs; every listed edge case has a test |
| Service / Presentation / content | none - build gate + scripted smoke pass only (no existing test infra to extend; user declined adding integration/e2e machinery for this pass) |

## Gate Check Commands

> Generated from codebase - confirm before Execute. No existing CLI test/build commands were
> documented anywhere (CLAUDE.md explicitly says "no CLI build or test commands... use Unity
> Editor"); the commands below are the standard Unity CLI equivalents, run via the `unity-cli`
> skill against this project's installed Unity 6.0.5.1f1.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks that only add/modify EditMode-tested pure logic | `Unity.exe -batchmode -nographics -projectPath InfinityGrove -runTests -testPlatform EditMode -testResults TestResults/editmode-results.xml -quit` (via `unity-cli`) |
| Build | After phase completion, content-only tasks, or scene-wiring tasks | `Unity.exe -batchmode -nographics -projectPath InfinityGrove -executeMethod InfinityGrove.Editor.BuildScript.BuildWindows -quit` (existing `BuildScript.cs`, via `unity-cli`) |
| Full (feature close-out only) | End of Phase 6 | Quick gate + Build gate + the scripted end-to-end smoke pass described in T12 |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and
tasks within a phase execute in order.

### Phase 1: Repo Hygiene & Hero Content Foundation

```
T1 → T2 → T3
```

### Phase 2: Stage Content

```
T4 → T5
```

### Phase 3: Equipment Content

```
T6 → T7
```

### Phase 4: Starter Hero Selection

```
T8 → T9
```

### Phase 5: Combat Drops

```
T10 → T11
```

### Phase 6: Verification

```
T12
```

---

## Task Breakdown

### T1: Commit pre-existing untracked MainMenuPresenter.cs and BuildScript.cs

**What**: Stage and commit the two untracked, already-functional files left over from the
prior session (`MainMenuPresenter.cs`, `BuildScript.cs`) as a clean baseline before adding
new work, per investigation confirming both already work as-is (Main Menu → Game Scene
transition; successful batchmode Windows build).
**Where**: `InfinityGrove/Assets/Scripts/Game/Presentation/MainMenuPresenter.cs`,
`InfinityGrove/Assets/Scripts/Editor/BuildScript.cs` (+ their `.meta` files)
**Depends on**: None
**Reuses**: N/A (files already exist and are unmodified by this task)
**Requirement**: N/A (repo hygiene, not a spec AC)

**Tools**:
- MCP: NONE
- Skill: NONE (plain git)

**Done when**:
- [ ] Both files (and their `.meta` companions) are committed with no other changes bundled in
- [ ] `git status` shows them no longer untracked

**Tests**: none
**Gate**: none (no code behavior changed)

**Commit**: `chore(client): commit MainMenuPresenter and BuildScript from prior session`

---

### T2: Author HeroData assets for Krell, Ranger, and Druid

**What**: Create 3 `HeroData` ScriptableObject assets (`CreateAssetMenu` path "Infinity
Grove/Hero Data") under a new `InfinityGrove/Assets/Data/Heroes/` folder:
- Krell: `heroId="krell"`, `displayName="Krell"`, `heroType=Nature`, `basePower=10`, `portrait` = an existing Krell sprite (e.g. an idle frame from `Assets/Art/Characters/Krell/Sprites/`)
- Ranger: `heroId="ranger"`, `displayName="Forest Ranger"`, `heroType=Light`, `basePower=10`, `portrait` = the existing `concept_ranger_0` sprite already sliced in `Assets/Art/Characters/Ranger/concept_ranger.jpg`
- Druid: `heroId="druid"`, `displayName="Forest Druid"`, `heroType=Dark`, `basePower=10`, `portrait` = the existing `concept_druid_0` sprite already sliced in `Assets/Art/Characters/Druid/concept_druid.jpg`

Leave `serverHeroId` empty and `abilityByStarTier` with at least index 0 filled with a short
placeholder ability line per hero (non-empty, satisfies FR-6's ability-preview AC without a
real balancing pass).

**Where**: `InfinityGrove/Assets/Data/Heroes/Krell.asset`, `Ranger.asset`, `Druid.asset` (new files)
**Depends on**: None
**Reuses**: `HeroData.cs` (existing class, no code change); existing Krell sprite sheet; existing Ranger/Druid concept-art sprites
**Requirement**: PLAY-01

**Tools**:
- MCP: NONE
- Skill: `unity-cli` (create the ScriptableObject assets and assign sprite/enum fields in the live Editor rather than hand-authoring YAML)

**Done when**:
- [ ] Exactly 3 `HeroData` assets exist, each with a unique non-empty `heroId`, non-empty `displayName`, a `heroType`, `basePower > 0`, and non-null `portrait`
- [ ] Opening each asset in the Inspector shows the assigned portrait rendering correctly (no missing-sprite icon)

**Tests**: none
**Gate**: Build

---

### T3: Wire the hero pool into GameLifetimeScope in Game Scene

**What**: In `Game Scene.unity`, select the `Bootstrap` GameObject (the one carrying
`GameLifetimeScope`) and assign its `_heroPool` array field to reference all 3 `HeroData`
assets from T2.
**Where**: `InfinityGrove/Assets/Scenes/Game Scene.unity` (scene data only, no script change)
**Depends on**: T2
**Reuses**: `GameLifetimeScope.cs` (existing `_heroPool` field, no code change)
**Requirement**: PLAY-02

**Tools**:
- MCP: NONE
- Skill: `unity-cli` (edit the scene's serialized field in the live Editor)

**Done when**:
- [ ] `Bootstrap`'s `_heroPool` field in the Inspector lists all 3 authored `HeroData` assets in a fixed order
- [ ] Entering Play Mode and inspecting the resolved `HeroData[]` instance (e.g. via a temporary Debug.Log or the Editor's Play Mode Inspector) shows all 3 heroes, not an empty array

**Tests**: none
**Gate**: Build

---

### T4: Author 15 StageData assets

**What**: Create 15 `StageData` assets under `InfinityGrove/Assets/Data/Stages/` with
`stageNumber` 1 through 15, `favoredType` cycling through all 5 `HeroType` values
(Fire, Water, Nature, Light, Dark) three times in a fixed rotation, and `powerFloor` rising
roughly geometrically from a value at or below the starting squad's power (so stage 1 is
always clearable with any single starter hero) up to a value clearly exceeding a 1-2 hero
squad's power by stage 15 (so a late stage reliably produces a Power Gate result against a
small squad).
**Where**: `InfinityGrove/Assets/Data/Stages/Stage01.asset` … `Stage15.asset` (new files)
**Depends on**: None
**Reuses**: `StageData.cs` (existing class, no code change)
**Requirement**: PLAY-06

**Tools**:
- MCP: NONE
- Skill: `unity-cli`

**Done when**:
- [ ] Exactly 15 `StageData` assets exist with unique `stageNumber` 1-15
- [ ] `favoredType` values cover all 5 `HeroType` entries at least twice across the 15 stages
- [ ] `powerFloor` is non-decreasing as `stageNumber` increases, with stage 1 at or below a single starter hero's power and stage 15 clearly above a 1-2 hero squad's power

**Tests**: none
**Gate**: Build

---

### T5: Wire the stage pool into GameLifetimeScope in Game Scene

**What**: Assign `Bootstrap`'s `_stagePool` array field to reference all 15 `StageData`
assets from T4, in `stageNumber` order.
**Where**: `InfinityGrove/Assets/Scenes/Game Scene.unity`
**Depends on**: T4
**Reuses**: `GameLifetimeScope.cs` (existing `_stagePool` field)
**Requirement**: PLAY-07

**Tools**:
- MCP: NONE
- Skill: `unity-cli`

**Done when**:
- [ ] `Bootstrap`'s `_stagePool` field lists all 15 `StageData` assets in ascending `stageNumber` order
- [ ] Entering Play Mode confirms `IStageService.Stages` resolves to all 15 stages

**Tests**: none
**Gate**: Build

---

### T6: Add an equipment content pool field to GameLifetimeScope

**What**: Add a new `[SerializeField] private EquipmentItemData[] _equipmentPool;` field to
`GameLifetimeScope` (alongside the existing `_heroPool`/`_stagePool` under the "Data -
Roster, Fusion & Stages (T007)" header) and register it via
`builder.RegisterInstance(_equipmentPool);` so later tasks (T11) can inject it into
`CombatService` for equipment drops. No existing field currently exposes droppable
equipment-item templates to the new architecture (`_startingEquipment` is the old system's
single starting `Equipment` object, unrelated).
**Where**: `InfinityGrove/Assets/Scripts/Game/Bootstrap/GameLifetimeScope.cs` (modify)
**Depends on**: None
**Reuses**: The existing `_heroPool`/`_stagePool` registration pattern in the same file
**Requirement**: PLAY-13 (equipment-drop AC's data dependency)

**Tools**:
- MCP: NONE
- Skill: NONE (plain C# edit)

**Done when**:
- [ ] `GameLifetimeScope` compiles with the new field and registration, matching the existing pool fields' style
- [ ] No other binding in `Configure` is altered

**Tests**: none
**Gate**: Build

---

### T7: Author EquipmentItemData assets and wire the equipment pool

**What**: Create 4 `EquipmentItemData` assets under `InfinityGrove/Assets/Data/Equipment/`,
one per `EquipmentSlot` (Weapon, Chest, Boots, Gloves), all `archetype = Strength`, each with
a unique `itemId`/`displayName` (icon may stay unassigned - no AC requires it). Then, in
`Game Scene.unity`, assign `Bootstrap`'s new `_equipmentPool` field (from T6) to reference
all 4 assets.
**Where**: `InfinityGrove/Assets/Data/Equipment/*.asset` (new files); `Game Scene.unity` (scene data)
**Depends on**: T6
**Reuses**: `EquipmentItemData.cs` (existing class, no code change)
**Requirement**: PLAY-13, PLAY-17 (Equipment/Crafting/Loadout Preset screens need real bag content)

**Tools**:
- MCP: NONE
- Skill: `unity-cli`

**Done when**:
- [ ] Exactly 4 `EquipmentItemData` assets exist, one per `EquipmentSlot`, each with a unique `itemId`
- [ ] `Bootstrap`'s `_equipmentPool` field lists all 4 assets

**Tests**: none
**Gate**: Build

---

### T8: Add StarterSelectGate pure predicate with EditMode tests

**What**: Add `InfinityGrove.Domain.StarterSelectGate` with a single pure static method
`ShouldShowStarterSelect(IReadOnlyList<HeroEntity> allHeroes) => allHeroes == null ||
allHeroes.Count == 0;` extracting the "show the starter-choice screen" predicate (spec AC
PLAY-04/PLAY-05: show when roster is empty, never again once it has an owned hero) into
independently testable pure logic ahead of the MonoBehaviour that will use it (T9).
**Where**: `InfinityGrove/Assets/Scripts/Game/Domain/StarterSelectGate.cs` (new);
`InfinityGrove/Assets/Tests/EditMode/StarterSelectGateTests.cs` (new)
**Depends on**: None
**Reuses**: `HeroEntity` (existing class)
**Requirement**: PLAY-04, PLAY-05

**Tools**:
- MCP: NONE
- Skill: NONE for the class; `unity-cli` only if creating the `Tests/EditMode` folder's
  `.asmdef` requires the live Editor to regenerate its `.meta`/GUID cleanly (otherwise a
  plain hand-authored `.asmdef` + `Write` is fine, this project has no other asmdef to
  collide with)

**Done when**:
- [ ] `StarterSelectGate.ShouldShowStarterSelect` returns `true` for an empty list and `false` for a list containing at least one `HeroEntity`
- [ ] `InfinityGrove/Assets/Tests/EditMode/InfinityGrove.Tests.EditMode.asmdef` exists, referencing `UnityEngine.TestRunner`/`UnityEditor.TestRunner`, editor-only, marked as a test assembly
- [ ] Quick gate passes: `Unity.exe -batchmode -nographics -projectPath InfinityGrove -runTests -testPlatform EditMode -testResults TestResults/editmode-results.xml -quit`
- [ ] Test count: at least 2 tests pass (empty-list case, non-empty-list case)

**Tests**: unit (EditMode)
**Gate**: Quick

---

### T9: Implement StarterSelectPresenter and place it in Game Scene

**What**: Add `InfinityGrove.Presentation.StarterSelectPresenter` (MonoBehaviour), injected
with `IRosterService` and the registered `HeroData[]` hero pool. On `OnEnable`, if
`StarterSelectGate.ShouldShowStarterSelect(rosterService.AllHeroes)` is true, build a list
(via the existing `UiFactory` helpers used by other presenters) showing each hero's
`displayName`, `heroType`, and `basePower` with a "Choose" button; on choose, call
`rosterService.AddHeroCard(data)` then `rosterService.TryActivate(...)` on the resulting
`HeroEntity`, then hide/disable the screen. If the gate is false, the presenter stays
hidden and does nothing. Register it in `GameLifetimeScope`
(`builder.RegisterComponentInHierarchy<StarterSelectPresenter>();`) and place a
`StarterSelect` GameObject + container `Transform` in `Game Scene.unity`, following the same
placement pattern already used for `RosterPresenter`/`StageSelectPresenter`.
**Where**: `InfinityGrove/Assets/Scripts/Game/Presentation/StarterSelectPresenter.cs` (new);
`InfinityGrove/Assets/Scripts/Game/Bootstrap/GameLifetimeScope.cs` (modify: one registration
line); `Game Scene.unity` (new GameObject)
**Depends on**: T8, T3 (needs a non-empty, wired hero pool to select from)
**Reuses**: `UiFactory.cs`, `IRosterService`, the existing Presenter registration/placement pattern
**Requirement**: PLAY-03, PLAY-04, PLAY-05

**Tools**:
- MCP: NONE
- Skill: `unity-cli` (place the GameObject/container in the scene and wire the Inspector reference)

**Done when**:
- [ ] With an empty roster, entering Play Mode shows the starter-choice screen listing all 3 heroes with name/type/power before Stage Select is usable
- [ ] Choosing a hero adds it to the roster, activates it into the Active Squad, and hides the screen
- [ ] With a non-empty roster (re-entering Play Mode after choosing), the screen does not appear
- [ ] `GameLifetimeScope` still compiles with the new registration

**Tests**: none (Presentation/MonoBehaviour layer; gating logic already unit-tested in T8; behavior verified in the Phase 6 smoke pass)
**Gate**: Build

---

### T10: Add DropTable pure roll logic with EditMode tests

**What**: Add `InfinityGrove.Domain.DropTable` with two pure static methods:
`HeroData RollHeroDrop(HeroData[] pool, float dropChance, System.Random rng)` and
`EquipmentItemData RollEquipmentDrop(EquipmentItemData[] pool, float dropChance, System.Random
rng)`. Each returns `null` when the pool is null/empty (spec Edge Case: skip silently, no
exception) or when the roll (using the injected `System.Random` for determinism in tests)
exceeds `dropChance`; otherwise returns a uniformly-random pool entry. Taking an injected
`System.Random` (rather than `UnityEngine.Random`) is what makes the boundary cases
deterministically testable in EditMode.
**Where**: `InfinityGrove/Assets/Scripts/Game/Domain/DropTable.cs` (new);
`InfinityGrove/Assets/Tests/EditMode/DropTableTests.cs` (new)
**Depends on**: None
**Reuses**: `HeroData`, `EquipmentItemData` (existing classes)
**Requirement**: PLAY-12, PLAY-13 (edge case: empty-pool guard)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `dropChance = 0` never returns a non-null result, for both methods, across multiple rng seeds
- [ ] `dropChance = 1` always returns a non-null result from the given pool when the pool is non-empty, for both methods
- [ ] A null or empty pool always returns `null` without throwing, for both methods, even at `dropChance = 1`
- [ ] Quick gate passes with the new tests included
- [ ] Test count: at least 6 tests pass (3 cases × 2 methods)

**Tests**: unit (EditMode)
**Gate**: Quick

---

### T11: Wire DropTable into CombatService's monster-defeat handler

**What**: Add `HeroData[] heroPool`, `EquipmentItemData[] equipmentPool`, `IRosterService
rosterService`, and `IEquipmentInventoryService equipmentInventoryService` constructor
parameters to `CombatService` (all already registered in the DI container by T3/T7's pool
wiring and the existing `RosterService`/`EquipmentInventoryService` registrations - no new
`RegisterInstance` calls needed beyond what T6 already added). In
`HandleMonsterDefeated`, after the existing gold award, call `DropTable.RollHeroDrop` (e.g.
20% chance) and, if non-null, `rosterService.AddHeroCard(hero)`; then call
`DropTable.RollEquipmentDrop` (e.g. 15% chance) and, if non-null, construct a new
`EquipmentInstance(item)` and call `equipmentInventoryService.AddToBag(instance)`. Use
`UnityEngine.Random`-seeded `System.Random` (or wrap `UnityEngine.Random.value` behind the
same `System.Random`-shaped call the tests already exercise) so the drop chance constants
are the only new tunable, matching the spec's placeholder-tuning assumption.
**Where**: `InfinityGrove/Assets/Scripts/Game/Service/CombatService.cs` (modify)
**Depends on**: T10, T3, T7
**Reuses**: `DropTable` (T10), `IRosterService.AddHeroCard`, `IEquipmentInventoryService.AddToBag`, existing `HandleMonsterDefeated` gold-award code path
**Requirement**: PLAY-12, PLAY-13, PLAY-14, PLAY-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `CombatService` still compiles and its existing gold-award behavior is unchanged (no regression to the walk/fight/gold timing)
- [ ] `GameLifetimeScope`'s existing `CombatService` registration resolves the new constructor parameters without additional wiring beyond T6/T7's pool registration
- [ ] Quick gate (EditMode tests from T8/T10) still passes
- [ ] Build gate passes

**Tests**: none (branching logic is covered by T10's `DropTable` unit tests; this task is orchestration glue per the Test Coverage Matrix's stated reasoning)
**Gate**: Build

---

### T12: End-to-end verification pass and validation write-up

**What**: Run the full Quick gate (EditMode tests from T8+T10) and the Build gate
(`BuildScript.BuildWindows`), then perform a scripted end-to-end smoke pass (via `unity-cli`
running C# in a live Editor Play Mode session, since no GUI-automation tool is available to
literally click UI buttons) that resolves the DI-built services directly and exercises every
spec Success Criterion: starter grant + activation, a Power Gate stage attempt, a
Composition Mismatch stage attempt, a successful stage attempt with `FurthestClearedStage`
advancement, at least one simulated hero-card drop and one equipment drop, a fusion once a
duplicate exists, an equip/unequip cycle, a crafting re-roll changing an affix within its
range, and a loadout-preset save+apply cycle. Record pass/fail per Success Criterion and any
Console errors observed. Recommend the user additionally click through the same flow by hand
in the Editor, since this task's script-driven pass proxies the service-level behavior, not
literal UI input.
**Where**: N/A (verification task; may produce a temporary scratch script under
`InfinityGrove/Assets/Editor` or the skill's scratchpad, removed after use if not meant to
ship)
**Depends on**: T1, T3, T5, T7, T9, T11 (everything else)
**Reuses**: All services/presenters wired by the prior tasks
**Requirement**: All of PLAY-01..19 (closing verification)

**Tools**:
- MCP: NONE
- Skill: `unity-cli`

**Done when**:
- [ ] Quick gate passes (all EditMode tests green)
- [ ] Build gate passes (batchmode Windows build succeeds)
- [ ] Every spec Success Criterion bullet is confirmed true or reported as a failure with evidence
- [ ] Zero unhandled exceptions logged in the Console during the smoke pass
- [ ] Any temporary verification-only script is removed from the project before this task is marked done (only production content/code from T1-T11 remains)

**Tests**: none (this task IS the verification; see Full gate)
**Gate**: Full

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 ------→ T2 ------→ T3
Phase 2:  T4 ------→ T5
Phase 3:  T6 ------→ T7
Phase 4:  T8 ------→ T9
Phase 5:  T10 -----→ T11
Phase 6:  T12
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or
batch worker) works one task at a time, in order.

**Batching:** 12 tasks total, exceeding the ~8-task inline threshold. Packed into 2
task-budgeted batches at phase boundaries: **Batch A** = Phases 1-3 (T1-T7, 7 tasks, content
+ scene-wiring heavy, low ambiguity); **Batch B** = Phases 4-6 (T8-T12, 5 tasks, new C#
logic + tests + final verification, higher ambiguity). Offered to the user before dispatch
per the skill's offer-then-confirm rule.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Commit pre-existing files | 2 already-finished files, 1 commit | ✅ Granular |
| T2: Author 3 HeroData assets | 1 asset type, 3 instances | ✅ Granular (cohesive batch of one content type) |
| T3: Wire hero pool in scene | 1 field assignment | ✅ Granular |
| T4: Author 15 StageData assets | 1 asset type, 15 instances | ✅ Granular (cohesive batch of one content type) |
| T5: Wire stage pool in scene | 1 field assignment | ✅ Granular |
| T6: Add `_equipmentPool` field | 1 file, 1 field + 1 registration line | ✅ Granular |
| T7: Author equipment assets + wire pool | 1 asset type (4 instances) + 1 field assignment | ✅ Granular (cohesive: content and its own wiring) |
| T8: StarterSelectGate + tests | 1 class + its unit tests | ✅ Granular |
| T9: StarterSelectPresenter + scene placement | 1 component + its DI registration + its scene placement | ✅ Granular (cohesive: a presenter and its placement, matching existing presenter precedent) |
| T10: DropTable + tests | 1 class (2 related methods) + its unit tests | ✅ Granular |
| T11: Wire DropTable into CombatService | 1 file modification | ✅ Granular |
| T12: End-to-end verification | 1 verification pass | ✅ Granular |

**Granularity check**: All 12 tasks are single-component/single-file (or one content-type +
its own wiring) deliverables. No task spans multiple unrelated components.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (start of Phase 1, no incoming arrow) | ✅ Match |
| T2 | None | T1 → T2 | ✅ Match (sequential within-phase order, not a data dependency - T2 doesn't need T1's output, but phase tasks run in order regardless) |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | (start of Phase 2, no incoming arrow) | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | None | (start of Phase 3, no incoming arrow) | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | None | (start of Phase 4, no incoming arrow) | ✅ Match |
| T9 | T8, T3 | T8 → T9 (in-phase); T3 is a cross-phase dependency satisfied by Phase 1 completing before Phase 4 starts | ✅ Match |
| T10 | None | (start of Phase 5, no incoming arrow) | ✅ Match |
| T11 | T10, T3, T7 | T10 → T11 (in-phase); T3/T7 are cross-phase dependencies satisfied by Phases 1/3 completing first | ✅ Match |
| T12 | T1, T3, T5, T7, T9, T11 | End of Phase 6, depends on everything - satisfied by strict phase sequencing | ✅ Match |

**Rule check**: No task depends on a later-phase task. All cross-phase dependencies point
backward only, satisfied by the phases' own sequential ordering.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | none (commit only) | - | none | ✅ OK |
| T2 | Content (`HeroData` assets) | none | none | ✅ OK |
| T3 | Scene wiring | none | none | ✅ OK |
| T4 | Content (`StageData` assets) | none | none | ✅ OK |
| T5 | Scene wiring | none | none | ✅ OK |
| T6 | `GameLifetimeScope.cs` (field + registration) | none (composition-root wiring, not business logic) | none | ✅ OK |
| T7 | Content (`EquipmentItemData` assets) + scene wiring | none | none | ✅ OK |
| T8 | Domain pure logic (`StarterSelectGate`) | unit | unit | ✅ OK |
| T9 | Presentation (`StarterSelectPresenter`) | none | none | ✅ OK |
| T10 | Domain pure logic (`DropTable`) | unit | unit | ✅ OK |
| T11 | Service glue (`CombatService`) | none (glue only, branching covered by T10) | none | ✅ OK |
| T12 | Verification only | Full gate | Full | ✅ OK |

**Rule check**: No task creates/modifies a "unit"-required layer while declaring
`Tests: none`. T8 and T10 (the only new pure-logic layers) both correctly declare
`Tests: unit`.

---

## Tools Summary (per task)

| Task | Skill |
| --- | --- |
| T1 | none (plain git) |
| T2, T3, T4, T5, T7, T9, T12 | `unity-cli` |
| T6, T8, T10, T11 | none (plain C# edits via Read/Edit/Write) |
