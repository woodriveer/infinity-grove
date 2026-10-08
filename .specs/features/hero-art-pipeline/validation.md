# Validation: Hero Art Pipeline - PASS

**Date**: 2026-10-08
**Spec**: `.specs/features/hero-art-pipeline/spec.md`
**Diff range**: `d6d08c1^..fc6faac` (T3..T18 code; T1/T2 are the docs commits 4336845 and 2c10165 before it)
**Verifier**: independent sub-agent (author != verifier), heartbeat run

**Verdict**: PASS (two minor gaps, no blocker)

The working tree has unrelated uncommitted changes (floating damage numbers: `dev-hooks.ts`, `WorldScene.ts`, `StageCombatService.ts`, `tests/e2e/helpers.ts`, `menu-and-combat.spec.ts`, `HEALTHCHECK_LOG.md`). They were not touched. The gates below ran with them present and were fully green.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1-T2 | Done (docs) | Commits 4336845, 2c10165 present. `Done when` boxes of T1-T4 (5 items, `tasks.md:87,108,129,150,151`) were left `[ ]` while T5-T18 are `[x]`. The work exists (spec amended, guide amended, types and schemas with tests), so this is bookkeeping only. |
| T3-T4 | Done | `b0ee4ef` types, `d6d08c1` schemas; `content.test.ts:193-247` |
| T5-T7 | Done | AsepriteSheet reader, HeroArtRules, validate:content wiring |
| T8-T11 | Done | LayerOrder, HeroLook, WeaponPose, Playback (enchantBand, attackSpeed) |
| T12-T13 | Done | Aseprite runner, `art:export` |
| T14-T18 | Done | LayeredHeroView, FieldHeroView paths, equipment look, enchant and hit event, two-color tint |

No task is blocked.

---

## Spec-Anchored Acceptance Criteria

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| ART-01 AC1 | one PNG + JSON per exportable layer in `assets/heroes/<id>/` | `Client/tests/unit/artExport.test.ts:58` (every known layer plus portrait, skips ref/guide), `:70` (matches committed goldens) | PASS |
| ART-01 AC2 | heroId from folder; missing content file named | `artExport.test.ts:127` (names the missing hero content file) | PASS |
| ART-01 AC3 | tags and slices in each JSON | `artExport.test.ts:88` (normalized JSON), `:98` (exports satisfy guide rules incl. tags/slices); `aseprite.test.ts:47` (exact CLI args) | PASS |
| ART-02 AC4 | byte-identical on re-export | `artExport.test.ts:79` | PASS |
| ART-02 AC5 | no Aseprite: three locations + `ASEPRITE_PATH` | `Client/tests/unit/aseprite.test.ts:30`, `:40`; lookup order `:14`, `:19`, `:26` | PASS |
| ART-02 AC6 | runs gen:assets and prints keys | `Client/tools/art-export.ts` (33 lines) calls gen-assets; `gen:check` green. No unit test asserts the call or printed keys (CLI wiring only) | PASS (code evidence, thin test) |
| ART-03 AC1 | missing tag named | `Client/tests/unit/heroArtRules.test.ts:72` | PASS |
| ART-03 AC2 | attack > 600 ms | `heroArtRules.test.ts:77` | PASS |
| ART-03 AC3 | canvas not 512 x 512 | `heroArtRules.test.ts:85` (`armor_chest.json: frame 0 canvas is 256x256`) | PASS |
| ART-03 AC4 | frame count / duration mismatch | `heroArtRules.test.ts:93`, `:102` | PASS |
| ART-03 AC5 | grip/tip key per frame | `heroArtRules.test.ts:110` | PASS |
| ART-03 AC6 | body missing | `heroArtRules.test.ts:66`; `Client/tests/unit/artCheck.test.ts:33` (from disk) | PASS |
| ART-03 AC9 | layer PNG > 4096 | `heroArtRules.test.ts:121` | PASS |
| ART-04 AC7 | weapon model lacks grip/tip | `heroArtRules.test.ts:126` | PASS |
| ART-04 AC8 | `weaponModel` resolves | `heroArtRules.test.ts:142` | PASS |
| ART-05 AC1 | one display object per layer, same tag/frame | `Client/tests/e2e/hero-art.spec.ts:7` (layered hero art mode, `tag` reported) and `:18` (plays attack tags while fighting) | PASS |
| ART-05 AC2 | order body, boots, gloves, chest, weapon, fx | `Client/tests/unit/layerOrder.test.ts:6` | PASS (pure function; the view calling it at `LayeredHeroView.ts:368` has no render assertion) |
| ART-05 AC3 | weapon below body when `grip_behind` keyed | `layerOrder.test.ts:11`, `:15` | PASS (same caveat) |
| ART-06 AC4 | armor slot tinted by `visual.color` | `Client/tests/unit/heroLook.test.ts:26`; e2e `Client/tests/e2e/hero-look.spec.ts:27` (`Chest: '#c04040'`) | PASS |
| ART-06 AC5 | empty slot uses neutral | `heroLook.test.ts:39` (each slot), `:46`; e2e `hero-look.spec.ts:16` (`#808080` after unequip) | PASS |
| ART-06 AC6 | weapon at hero grip, rotated to tip | `Client/tests/unit/weaponPose.test.ts:8`, `:14`, `:18`, `:23`; e2e `hero-look.spec.ts:27` (`weaponModel: 'test-blade'`) | PASS (pose math unit only) |
| ART-06 AC7 | no weapon, none drawn | `heroLook.test.ts:51`; e2e `hero-look.spec.ts:16` (`weaponModel: null`) | PASS |
| ART-06 AC8 | equipment change reflected next frame | `hero-look.spec.ts:7` (equip/unequip through Equipment screen via gamepad, then `advance(200)`); scenario `Client/scenarios/p15-hero-look.json` (bag and equipped state) | PASS |
| ART-07 AC9 | `__ig.world()` reports tag, model, tints, band | `hero-art.spec.ts:13`, `hero-look.spec.ts:16`, `Client/tests/e2e/hero-enchant.spec.ts:18` (`enchantBand`, `effects`) | PASS |
| ART-08 AC1 | band effect by level | `Client/tests/unit/playback.test.ts:11`, `:15`, `:23`; e2e `hero-enchant.spec.ts:15` (+6 none, +7 glow, +10 glow+aura, +15 +particles) | PASS |
| ART-08 AC2 | effects off shows none | `hero-enchant.spec.ts:22` (band 15 reported, `effects: []`) | PASS |
| ART-08 AC3 | speed = duration / interval, never slower | `playback.test.ts:29`, `:32`, `:35`, `:38`; e2e `hero-enchant.spec.ts:37` (`attackSpeed >= 1`) | PASS |
| ART-08 AC4 | hit frame emits one presentation event | `hero-enchant.spec.ts:28-36` (`hits` is 1 for one attack) | PASS |
| ART-09 AC1 | no `art`: portrait fallback | `hero-art.spec.ts:15` (`ranger` art `portrait`, `portraitFallback: true`) | PASS |
| ART-09 AC2 | `legacy`: Krell as today | `hero-art.spec.ts:14` (`krell` legacy, no fallback) | PASS |
| ART-09 AC3 | sheet load failure: portrait + log id | `hero-art.spec.ts:27` (portrait fallback, `'test-hero'` ... `failed to load` logged once) | PASS |
| ART-09 content | `art`/`visual`/bands schemas | `Client/tests/unit/content.test.ts:200-247` (accept, bad mode/neutral, unsorted/overlapping/0 bands, unknown art file) | PASS |
| ART-10 AC1 | `colorDark` to `color` ramp | `hero-look.spec.ts:30-34` (`tintDark: { Chest: '#400808' }`, absent for other slots); `heroLook.test.ts:34` (null when absent) | PASS (reported colors asserted; shader ramp itself is screenshot-reviewed per spec) |
| ART-11 | unknown layer warns, not exported | `artExport.test.ts:110` | PASS |
| ART-11 | Aseprite error: non-zero, files unchanged | `artExport.test.ts:134`, `:144`; `aseprite.test.ts:66`, `:82` | PASS |
| ART-11 | weapon model > 256 x 256 | `heroArtRules.test.ts:134` | PASS |

**Status**: 11/11 requirements have evidence. Test counts: unit +9 art files (about 70 tests), e2e +3 spec files (7 tests), 1 scenario.

### Gaps

1. The stacking order and weapon pose are verified through pure functions (`layerOrder`, `weaponPose`) only. No test asserts the actual Phaser display list order or the weapon sprite transform in `LayeredHeroView.ts` (it is `Tests: none` per T14, and e2e checks only the described state). A regression in how the view applies them would pass.
2. `art:export` printing generated keys and invoking gen:assets (ART-02 AC6) has no automated assertion.
3. Bookkeeping: five `[ ]` boxes in T1-T4 of `tasks.md`.

---

## Discrimination Sensor

Mutants applied in place with `sed` (the target files had no uncommitted changes, checked via `git status` first), tested with the matching vitest file, then reverted with `git checkout -- <file>`. Final `git status` shows only the six pre-existing unrelated modifications.

| # | File | Mutation | Killed? |
| - | ---- | -------- | ------- |
| 1 | `Client/src/domain/art/Playback.ts` | `enchantBand` boundary `>=` to `>` | Killed (playback.test.ts "picks the band at each boundary") |
| 2 | `Playback.ts` | `attackSpeed` floor `Math.max(1,..)` to `0.5` | Killed ("never goes below 1") |
| 3 | `Client/src/domain/art/WeaponPose.ts` | rotation `heroAngle - weaponAngle` to `+` | Killed (2 tests) |
| 4 | `Client/src/domain/art/LayerOrder.ts` | swap chest and gloves in the order | Killed (1 test) |
| 5 | `LayerOrder.ts` | invert the `weaponBehind` selection | Killed (2 tests) |
| 6 | `Client/src/domain/art/HeroLook.ts` | empty-slot fallback ignores `art.neutral` | Killed (1 test) |
| 7 | `HeroLook.ts` | enchant level `+ 1` and `>= 0` | Killed (2 tests) |
| 8 | `Client/src/services/content/HeroArtRules.ts` | `MAX_ATTACK_MS` 600 to 601 | Killed (1 test) |
| 9 | `HeroArtRules.ts` | frame-count check `!==` to `<` (layer with more frames accepted) | **Survived** (14/14 pass) |
| 10 | `HeroArtRules.ts` | `MAX_LAYER_PX` 4096 to 4097 | Killed (1 test) |

**Sensor depth**: lightweight (domain rules plus content rules)
**Result**: 9/10 killed. Mutant 9 survives because `heroArtRules.test.ts:93` only exercises a layer with fewer frames than the body; add a case with more frames.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | OK. Pure rules in `domain/art/` (4 small files), tooling in `tools/lib/`. |
| Surgical changes | OK. Diff stays in art/content/presentation scenes/tools; `InfinityGrove/` not in the diff. |
| No scope creep | OK. Spine/skeletal and Krell redraw stay out; Krell kept on `legacy`. |
| Matches patterns | OK. Dependency-cruiser: 141 modules, 0 violations. Colors enter via content, not hardcoded. |
| Tests on both sides | Backend untouched and no backend rule changed (client and tooling only), so no backend test is required. |
| Every test maps to a requirement | OK. |

---

## Gate Check

Run in `Client/` individually, with the unrelated dirty changes present.

- **typecheck** (app + desktop): pass
- **lint** (ESLint, dependency-cruiser 141 modules / 0 violations, 15 lint-fixture tests): pass
- **validate:content**: OK (8 heroes, 2 monsters, 10 stages, 7 items, 1 equipment, 1 animations, 2 effects)
- **gen:check**: up to date
- **npm test** (Vitest): 30 files, 370 passed, 0 failed (the known `combatJump` 50 ms test passed this run, so it did not flake)
- **npm run test:e2e** (Playwright): 47 passed, 0 failed (ui-gate criterion 3 passed this run, so it did not flake)
- **build**: pass (dist 1,615 kB js). `scan:secrets` is part of `verify` and was not run separately.
- **Not run**: `npm run test:shell` and `test:sync-e2e` (not in this scope; no preload or backend change). `art:export` against real Aseprite was not run (tests use a stub executable and committed goldens).

---

## Fix Plans

No blocking fix tasks. Recommended, non-blocking:

1. Add a `heroArtRules` case where a layer has more frames than the body (kills mutant 9).
2. Add an e2e or unit assertion on `LayeredHeroView` display-list order and weapon transform (for example expose weapon `depth`/`rotation` in `__ig.world()`), covering gap 1.
3. Tick the `[ ]` boxes in T1-T4 of `tasks.md`.
4. Add a test that `art:export` triggers gen:assets (ART-02 AC6).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| ART-01 | Done | Verified |
| ART-02 | Done | Verified (AC6 thin test) |
| ART-03 | Done | Verified |
| ART-04 | Done | Verified |
| ART-05 | Done | Verified (view order via pure function only) |
| ART-06 | Done | Verified |
| ART-07 | Done | Verified |
| ART-08 | Done | Verified |
| ART-09 | Done | Verified |
| ART-10 | Done | Verified |
| ART-11 | Done | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 11/11 requirements matched by file:line; 2 test-depth gaps (view-level order/pose, export-to-gen:assets wiring)
**Sensor**: 9/10 mutations killed (frame-count direction survives)
**Gate**: typecheck, lint, validate:content, gen:check, build clean; Vitest 370/370; e2e 47/47

**Issues found**: none blocking.

**Next steps**: close the small test gaps above; run `art:export` once with the real Aseprite on a drawn hero before relying on it.
