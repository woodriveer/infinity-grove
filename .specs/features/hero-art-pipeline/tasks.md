# Hero Art Pipeline Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/hero-art-pipeline/design.md`
**Status**: Approved (decided in heartbeat, 2026-10-07)

Healthcheck runs execute one task per run, in order (CLAUDE.md, Heartbeat). Every task keeps its gate green on its own. Backend: no task here, because nothing the backend must accept or reject changes (art is presentation only; no `PlayerEvent`, no new rule shared with the backend, so no VectorGen family either).

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `CLAUDE.md` (Tests are mandatory, Verifying a feature without a human, Layer rules), `AGENTS.md`, `Client/package.json` (`verify`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client domain (`src/domain/**`) | unit | All branches; 1:1 to spec ACs; boundaries (+6/+7/+9/+10/+14/+15), degenerate inputs | `Client/tests/unit/*.test.ts` | `npm test` |
| Client content + schemas + art rules (`content/**`, `src/services/content/**`, `tools/validate-content.ts`) | unit | Each rule: accepting case + one negative fixture naming file and field | `Client/tests/unit/content.test.ts`, `Client/tests/unit/heroArtRules.test.ts` | `npm test`, `npm run validate:content` |
| Client tools (`tools/**`) | unit | Against a stub Aseprite executable: determinism, failure paths, messages | `Client/tests/unit/artExport.test.ts` | `npm test` |
| Client presentation (`src/presentation/**`) | e2e | Layered, legacy and art-less heroes; equip/unequip by gamepad; enchant band; effects off; failed sheet fallback | `Client/tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Client services flows | sim scenario | Equip/unequip flow with `expect` block | `Client/scenarios/*.json` | `npm run sim -- --script scenarios/<f>.json` |
| Docs, specs | none | - (traceability updated in the same commit) | - | typecheck only |
| Backend | none | No change (stated above) | - | - |

## Gate Check Commands

> Client commands run in `Client/`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Domain, content, tools tasks with unit tests only | `npm run typecheck && npm run lint && npm test` |
| Full | Tasks touching presentation, scenarios, generated files | `npm run verify` (ui-gate criterion 3 is a known pre-existing failure, see STATE Blockers) |
| Build | Last task of each phase | `npm run verify` |

---

## Execution Plan

### Phase 1: Contracts and rules

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

### Phase 2: Layout rules (domain)

```
T8 → T9 → T10 → T11
```

### Phase 3: Export tool

```
T12 → T13
```

### Phase 4: Runtime composition

```
T14 → T15 → T16 → T17 → T18
```

---

## Task Breakdown

### T1: Amend the spec for the design decisions

**What**: Update `spec.md`: ART-05 AC 3 (weapon is behind the body in frames where the `grip_behind` slice has a key), ART-03 AC 7 (each layer PNG ≤ 4096 × 4096), assumptions row for `behind`, traceability.
**Where**: `.specs/features/hero-art-pipeline/spec.md`
**Depends on**: None
**Reuses**: design.md Risks table
**Requirement**: ART-03, ART-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] The two ACs and the assumption read as in the design; `validate_spec.py hero-art-pipeline` exits 0

**Tests**: none
**Gate**: quick
**Commit**: `docs(hero-art-pipeline): amend spec for grip_behind and sheet size cap`

---

### T2: Amend the art guide

**What**: Update guide §5.2 and §9 for the `grip_behind` slice (key only on behind frames, no user data) and the 4096 px layer cap.
**Where**: `docs/HERO_ART_GUIDE.md`
**Depends on**: T1
**Reuses**: design.md Risks table
**Requirement**: ART-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] §5.2 and §9 describe `grip_behind`; no remaining mention of `behind` user data

**Tests**: none
**Gate**: quick
**Commit**: `docs(art): grip_behind slice and layer size cap in the hero art guide`

---

### T3: Content types for hero art and item visuals

**What**: Add optional `HeroData.art`, `EquipmentItemData.visual`, `HexColor` and the `EnchantBandsData` type.
**Where**: `Client/src/domain/content/types.ts`
**Depends on**: T2
**Reuses**: existing optional-field pattern in the same file
**Requirement**: ART-06, ART-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Types match the design's Data Models; typecheck passes (schema `satisfies` checks added in T4)

**Tests**: none
**Gate**: quick
**Commit**: `feat(content): types for hero art and item visuals`

---

### T4: Zod schemas for `art`, `visual` and `enchant-bands`

**What**: Strict schemas: hero `art` (`mode`, `neutral`), item `visual` (`weaponModel` only on Weapon slot, `color`/`colorDark` only on Chest/Gloves/Boots, hex regex), new `art` content kind with sorted non-overlapping bands (`minLevel` ≥ 1); `ContentLoader` reads the `art` kind.
**Where**: `Client/src/services/content/schema.ts` (ContentLoader kind registration included, same cohesive change)
**Depends on**: T3
**Reuses**: existing kinds and `satisfies` checks
**Requirement**: ART-06, ART-08, ART-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Accept and reject cases for each field (bad hex, weaponModel on armor, color on weapon, unsorted or overlapping bands, `minLevel` 0), each error naming file and field
- [ ] Quick gate passes; test count grows, none removed

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): schemas for hero art, item visuals and enchant bands`

---

### T5: Aseprite sheet reader

**What**: `AsepriteSheet.ts` parses the used subset of Aseprite json-array (frames, durations, sizes, tags, slices with keys) into `SheetInfo`.
**Where**: `Client/src/services/content/AsepriteSheet.ts`
**Depends on**: T4
**Reuses**: zod patterns in `schema.ts`
**Requirement**: ART-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Recorded Aseprite JSON fixture parses to the expected frame count, durations, tags and slice keys; malformed JSON reports the field
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): Aseprite sheet reader`

---

### T6: Hero and weapon art rules

**What**: `validateHeroArt(heroes, items, sheets, assetKeys)` with one function per rule: required tags, `attack` ≤ 600 ms, 512 × 512 canvas, equal frame count and durations across layers, `grip`/`tip` keys on every frame, `body` present, layer PNG ≤ 4096, weapon model `grip`/`tip` and ≤ 256 × 256, `visual.weaponModel` resolves.
**Where**: `Client/src/services/content/HeroArtRules.ts`
**Depends on**: T5
**Reuses**: `SheetInfo` from T5; problem-string form of `ContentLoader`
**Requirement**: ART-03, ART-04, ART-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] One negative fixture per rule asserts the exact message (hero, file, frame/field) and one accepting fixture returns no problems
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(content): enforce the hero art guide rules`

---

### T7: Wire art rules into validate:content and the loader

**What**: `validate-content` reads each layered hero's sheet JSON from `assets/` and passes it to `loadContent`, which calls `validateHeroArt`; runtime `loadContent(entries, assetKeys)` unchanged (art rules are build-time). Krell's content gets `art: {mode: "legacy"}`.
**Where**: `Client/tools/validate-content.ts`
**Depends on**: T6
**Reuses**: `FsContentSource` helper in `platform/node`
**Requirement**: ART-03, ART-04, ART-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `npm run validate:content` passes on the repo; a unit test drives the same path with a broken fixture hero and sees the failure
- [x] Phase 1 build gate passes (`npm run verify`; only the known ui-gate criterion 3 and a load-flaky combatJump timing test fail)

**Tests**: unit
**Gate**: build
**Commit**: `feat(content): validate layered hero art in validate:content`

---

### T8: Layer order

**What**: `LAYER_ORDER` and `layerOrder(weaponBehind)`: body, armor_boots, armor_gloves, armor_chest, weapon, fx; weapon under body when behind.
**Where**: `Client/src/domain/art/LayerOrder.ts`
**Depends on**: None (phase 1 complete)
**Reuses**: pure-domain style of `domain/combat`
**Requirement**: ART-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Both orders asserted exactly; quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(art): layer stacking order`

---

### T9: Hero look from equipment

**What**: `heroLook(equipped, items, art)` returns weapon model, per-slot tint and enchant level; empty slot or missing color gives the neutral color; `enchantLevelOf(instance)` returns 0 when absent.
**Where**: `Client/src/domain/art/HeroLook.ts`
**Depends on**: T8
**Reuses**: `EquipmentInstance`, `EquipmentSlot`
**Requirement**: ART-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Tests: all slots filled, each slot empty, item without `visual.color`, no weapon, weapon without model, enchant level absent and present
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(art): derive hero look from equipped items`

---

### T10: Weapon pose

**What**: `weaponPose(heroGrip, heroTip, weaponGrip, weaponTip)` returns position at the hero grip and rotation `atan2(tip-grip) - atan2(weaponTip-weaponGrip)`; degenerate tip equal to grip returns rotation 0.
**Where**: `Client/src/domain/art/WeaponPose.ts`
**Depends on**: T9
**Reuses**: none
**Requirement**: ART-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Tests: aligned axes (0), quarter turns, negative angles, degenerate hero and weapon vectors
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(art): weapon pose from grip and tip sockets`

---

### T11: Enchant band and attack speed

**What**: `enchantBand(level, bands)` and `attackSpeed(tagDurationMs, intervalMs) = max(1, duration / interval)`.
**Where**: `Client/src/domain/art/Playback.ts`
**Depends on**: T10
**Reuses**: band type from T3
**Requirement**: ART-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Band boundaries +6 (none), +7, +9, +10, +14, +15 and above; speed never below 1, equal values give 1, interval 0 handled without Infinity
- [x] Phase 2 build gate passes

**Tests**: unit
**Gate**: build
**Commit**: `feat(art): enchant band and attack playback speed rules`

---

### T12: Aseprite runner

**What**: `findAseprite(env, exists)` (order `ASEPRITE_PATH`, PATH, Steam path; error lists the three tried) and `exportLayer(exe, file, layer, outBase)` with the design's command.
**Where**: `Client/tools/lib/aseprite.ts`
**Depends on**: None (phase 2 complete)
**Reuses**: child-process pattern in `tools/e2e.ts`
**Requirement**: ART-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Tests: each lookup order case, not-found message lists three locations and `ASEPRITE_PATH`, command arguments exact (stub executable records them)
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(tools): locate and run the Aseprite CLI`

---

### T13: art:export command

**What**: `npm run art:export -- <file.aseprite>`: derive heroId from the folder, require hero content, list layers, warn on unknown, skip `ref*`/`guide*`, export to a temp dir, move into `assets/heroes/<heroId>/` only when every call succeeded, normalize JSON for byte-identical output, copy portrait, run `gen:assets`, print keys; weapon models take the same path without content lookup. Add the committed code-generated `test-hero` source and golden outputs, excluded from the release manifest by a `test-` prefix rule in `gen:assets`.
**Where**: `Client/tools/art-export.ts`
**Depends on**: T12
**Reuses**: `tools/lib/aseprite.ts`, `tools/gen-assets.ts`, `tools/lib/png.ts`
**Requirement**: ART-01, ART-02, ART-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Against the stub Aseprite: outputs match goldens; second export is byte-identical; missing Aseprite exits non-zero with the message; a failing call leaves `assets/` unchanged; unknown layer warns; missing hero content names the file
- [ ] Phase 3 build gate passes

**Tests**: unit
**Gate**: build
**Commit**: `feat(tools): art:export for layered hero sheets`

---

### T14: LayeredHeroView

**What**: One Container per hero with a Sprite per exported layer, namespaced animations built from parsed tags, body-driven frame sync, weapon image posed from `grip`/`tip` (behind from `grip_behind`), multiply tint per armor layer, `hit` event on the first `hit` frame, `create` returns null on any missing texture or animation.
**Where**: `Client/src/presentation/scenes/LayeredHeroView.ts`
**Depends on**: None (phase 3 complete)
**Reuses**: `domain/art/*`, `AsepriteSheet`, `Assets`, `phaserColor`
**Requirement**: ART-05, ART-06

**Tools**:
- MCP: NONE
- Skill: `phaser-sprites-and-images`

**Done when**:
- [ ] Not wired yet; covered by the T15 e2e. Typecheck, lint (layer rules) and build pass

**Tests**: none
**Gate**: full
**Commit**: `feat(world): layered hero view`

---

### T15: FieldHeroView chooses the art path

**What**: Choose by `hero.art?.mode` (`layered` to the new view, `legacy` to the existing path, none to the portrait), map combat state to tags (`idle`, `attack` with `attackSpeed`, `hurt`, `ko`), portrait fallback with one log line on load failure, `look()` exposed; `WorldScene.fieldState()` and the dev hook report tag, weapon model, tints and band. Fixture save `layered-squad` and `test-hero` content for tests.
**Where**: `Client/src/presentation/scenes/FieldHeroView.ts`
**Depends on**: T14
**Reuses**: Krell variant path, `world()` hook in `src/app/dev-hooks.ts`
**Requirement**: ART-05, ART-07, ART-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] e2e on `?scene=game&save=layered-squad`: `__ig.world()` shows layered, legacy and art-less heroes; a deleted sheet falls back to the portrait and logs the hero id once
- [ ] Gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(world): heroes render by art mode`

---

### T16: Equipment changes the look

**What**: Scenario `p15-hero-look.json` (equip and unequip through services, `expect` on equipped state) and an e2e that equips and unequips weapon and armor on the Equipment screen by gamepad and asserts tint, weapon model and neutral fallback in `__ig.world()` on the next frames.
**Where**: `Client/tests/e2e/hero-look.spec.ts`
**Depends on**: T15
**Reuses**: `equipment-stages.spec.ts` flow, `scenarios/` runner
**Requirement**: ART-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Scenario passes with `expect`; e2e passes; fixes to the view only if the tests expose a defect
- [ ] Gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `test(world): equipment drives the hero look`

---

### T17: Enchant effects and hit event

**What**: Glow, aura and particles from `enchant-bands.json` content (placeholder bands as in the spec assumptions), skipped when `effects` is off; `attack` plays at `attackSpeed`; `hit` event emitted on the hit frame.
**Where**: `Client/content/art/enchant-bands.json` (view changes in the same change)
**Depends on**: T16
**Reuses**: effect schema, `enchantBand`, `attackSpeed`
**Requirement**: ART-08

**Tools**:
- MCP: NONE
- Skill: `phaser-particles`

**Done when**:
- [ ] e2e: fixture weapon at +6/+7/+10/+15 reports the right band; effects off reports none; attack speed reported for a short interval; hit event counted once per attack
- [ ] `validate:content` passes with the bands file

**Tests**: e2e
**Gate**: full
**Commit**: `feat(world): enchant effects, attack speed and hit event`

---

### T18: Two-color armor and traceability

**What**: `visual.colorDark` maps the gray ramp from dark to light color (ART-10), then set spec traceability to Done for ART-01..ART-11.
**Where**: `Client/src/presentation/scenes/LayeredHeroView.ts` (modify; spec traceability in the same commit)
**Depends on**: T17
**Reuses**: tint code from T14, `phaserColor`
**Requirement**: ART-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] e2e asserts `__ig.world()` reports both colors for a fixture item; screenshot taken for review (not asserted)
- [ ] `npm run verify` green apart from the known ui-gate criterion 3; Verifier runs next

**Tests**: e2e
**Gate**: build
**Commit**: `feat(world): two-color armor tint`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6 → T7
Phase 2:  T8 → T9 → T10 → T11
Phase 3:  T12 → T13
Phase 4:  T14 → T15 → T16 → T17 → T18
```

Execution is strictly sequential; healthcheck runs take one task each.
