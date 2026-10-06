# Hero Art Pipeline Specification

## Problem Statement

AD-005 and `docs/HERO_ART_GUIDE.md` define how heroes are drawn so any item shows on them:
a frame-by-frame body in Aseprite, grayscale armor layers tinted per item, weapons attached to
per-frame `grip`/`tip` slices, and enchant levels as effects. None of the tooling exists:
there is no export command for layered sheets and slices, no validation of the artist's
rules, and the game can only play single-sheet sprites (Krell's two fixed variants). Until it
exists, no hero drawn by the guide can enter the game and equipment never changes how a hero
looks.

## Goals

- [ ] One terminal command turns a hero `.aseprite` file into checked-in runtime sheets, with every guide rule checked.
- [ ] In game, each hero is composed from its layers, wears the colors of its equipped armor, holds its equipped weapon on the `grip`/`tip` sockets, and shows its weapon's enchant effect.
- [ ] Adding a weapon model costs one image; adding armor costs only colors in content (RFR-12 spirit).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Drawing the heroes and weapon models | Art production; follows `docs/HERO_ART_GUIDE.md` |
| Skeletal animation (Spine/DragonBones) | Rejected by AD-005 |
| Redrawing Krell to the new standard | Art task; Krell keeps the legacy two-variant path until then |
| Two-color armor gradients | P3 below; P1 tints with one color per slot |
| Running Aseprite in CI | Needs a local license (refactor AD-9); CI validates the exported files |
| Combat timing (attack rate, damage) | stage-combat; this feature only plays the animations it is told to |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Locating Aseprite | `ASEPRITE_PATH` environment variable, else `aseprite` on PATH, else the Steam path `C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe`; otherwise fail with instructions | Developer's Aseprite 1.3.18 is installed via Steam and not on PATH | n |
| Export shape | One PNG + JSON (Aseprite `json-array` with `--list-tags --list-slices`) per exportable layer, via `--layer <name>`, into `Client/assets/heroes/<heroId>/<layer>.png/.json`, plus `portrait.png` | Matches AD-9 (Aseprite JSON is the animation format) and the existing `gen:assets` aseprite detection | n |
| Exportable layers | `body`, `armor_chest`, `armor_gloves`, `armor_boots`, `fx`; layers named `ref*`/`guide*` are never exported | Guide §5.1 | y (guide) |
| Portrait source | `art-src/heroes/<heroId>/portrait.png` (or `.aseprite`), copied/exported as-is | Guide §6 | n |
| Weapon models | `art-src/items/weapons/<modelId>.aseprite` exported to `assets/items/weapons/<modelId>.png/.json` (one frame, slices `grip` and `tip`) | Guide §6 | y (guide) |
| Hero art opt-in | Hero content gains an optional `art: "layered"` field; heroes without it use the portrait fallback from stage-combat; Krell uses `art: "legacy"` (current animation content) | Lets heroes migrate one at a time | n |
| Item visuals in content | Weapon items get `visual.weaponModel`; armor items get `visual.color` (one color token or hex in content); missing visual → neutral look | Guide §6 | n |
| Empty armor slot | Tinted with the hero's `art.neutral` color (content), default the `inkDim` token | Guide §8 step 2 | n |
| Tint method | Phaser multiply tint of the grayscale layer by the item color | Grayscale × color keeps the cel shading (AD-005) | n |
| Weapon placement | Weapon image origin at its own `grip`; position = hero `grip` key of the current frame; rotation = angle from hero `grip` to hero `tip` minus the weapon's own `grip`→`tip` angle | Guide §5.2/§6 | n |
| Weapon behind the body | When the current frame's hero `grip` slice user data is `behind`, the weapon renders under `body` | Guide §5.2 | y (guide) |
| Enchant effects | Bands from content: +7–+9 glow on the weapon, +10–+14 glow + hero aura, +15 glow + aura + particles; off when effects are off (tests, low-spec) | Guide §6; refactor RFR-46 | n |
| Attack playback speed | When the hero's attack interval is shorter than the `attack` tag duration, play it faster by `duration / interval`; never slower than authored | Guide §4 | n |
| Performance budget | At most 5 heroes × 8 display objects; combat holds 60 fps on the Steam Deck target (refactor RNFR-4) | Bounded composition | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Export a hero from Aseprite ⭐ MVP

**User Story**: As the artist, I want one command that exports my hero file into game-ready sheets so that I never hand-edit runtime data.

**Why P1**: No hero drawn by the guide can enter the game without it.

**Acceptance Criteria**:

1. WHEN the artist runs `npm run art:export -- <path>.aseprite` THEN the system SHALL write one PNG and one JSON per exportable layer present in the file into `Client/assets/heroes/<heroId>/`.
2. The system SHALL derive `<heroId>` from the file's folder name and fail if no `content/heroes/<heroId>.json` exists, naming the missing file.
3. WHEN exporting THEN the system SHALL include tags and slices (with per-frame keys and user data) in every layer's JSON.
4. The system SHALL produce byte-identical outputs when the same `.aseprite` file is exported twice.
5. IF Aseprite cannot be found THEN the command SHALL exit non-zero and print the three locations it tried and how to set `ASEPRITE_PATH`.
6. WHEN the export succeeds THEN the command SHALL run `gen:assets` and print the generated asset keys.

**Independent Test**: export a small fixture hero (`art-src/heroes/test-hero/`, committed for tests) and compare outputs with checked-in goldens; run twice and diff.

---

### P1: Enforce the guide's rules ⭐ MVP

**User Story**: As the developer, I want every rule of the art guide checked automatically so that a broken hero never reaches the game.

**Why P1**: Composition depends on exact names, sizes and slices.

**Acceptance Criteria**:

1. IF a layered hero's sheets lack any of the tags `idle`, `attack`, `hit`, `hurt`, `ko` THEN `validate:content` SHALL fail naming the hero and the missing tag.
2. IF the `attack` tag lasts more than 600 ms THEN `validate:content` SHALL fail naming the hero and the measured duration.
3. IF a frame's canvas size is not 512 × 512 THEN `validate:content` SHALL fail naming the layer file and frame.
4. IF the layer sheets of one hero differ in frame count or in any frame's duration THEN `validate:content` SHALL fail naming the first differing layer and frame.
5. IF the `grip` or `tip` slice lacks a key for any frame THEN `validate:content` SHALL fail naming the hero, slice and frame.
6. IF the `body` layer is missing THEN `validate:content` SHALL fail naming the hero.
7. IF a weapon model lacks the `grip` or `tip` slice THEN `validate:content` SHALL fail naming the model file.
8. IF an item's `visual.weaponModel` names no exported weapon model THEN `validate:content` SHALL fail naming the item file and field.

**Independent Test**: negative fixtures (one per rule) under `tests/` produce the named failures, like refactor RFR-10.

---

### P1: Compose the hero in game ⭐ MVP

**User Story**: As a player, I want my heroes to look like the gear I equip so that collecting and enchanting items is visible.

**Why P1**: The point of AD-005.

**Acceptance Criteria**:

1. WHERE a hero's content has `art: "layered"` the system SHALL render it as one display object per exported layer, all playing the same tag and frame.
2. The system SHALL stack layers in the order body → armor_boots → armor_gloves → armor_chest → overlays → weapon → fx.
3. WHILE the current frame's `grip` user data is `behind` the system SHALL render the weapon below `body`.
4. WHEN a hero has an armor item equipped in a slot THEN the system SHALL tint that slot's layer with the item's `visual.color`.
5. WHILE a hero has no armor item in a slot the system SHALL tint that slot's layer with the hero's neutral color.
6. WHEN a hero has a weapon equipped THEN the system SHALL draw its weapon model at the hero's `grip` key for the current frame, rotated toward the `tip` key as defined in the Assumptions.
7. WHILE a hero has no weapon equipped the system SHALL draw no weapon.
8. WHEN equipment changes THEN the system SHALL update tint and weapon on the next rendered frame.
9. The dev hook `__ig.world()` SHALL report, per hero on the field, the tag playing, the weapon model, each armor slot's tint and the enchant band.

**Independent Test**: e2e with a fixture hero and fixture items: equip and unequip through the Equipment screen and assert `__ig.world()`; screenshots for visual review (never asserted).

---

### P2: Enchant effects and attack speed

**User Story**: As a player, I want highly enchanted weapons to glow and fast heroes to swing faster so that power is visible.

**Why P2**: Feedback for equipment-enchant and stage-combat; composition works without it.

**Acceptance Criteria**:

1. WHEN the equipped weapon's enchant level is within a content band THEN the system SHALL show that band's effect (glow, aura, particles).
2. WHILE effects are off the system SHALL show no enchant effect.
3. WHEN a hero's attack interval is shorter than its `attack` tag duration THEN the system SHALL play `attack` at speed `duration / interval`.
4. WHEN the `hit` frame of an attack is shown THEN the system SHALL emit a presentation event used for hit flashes and damage numbers.

**Independent Test**: e2e via `__ig.world()` enchant band; unit test on the playback-speed rule.

---

### P2: Migration and fallbacks

**User Story**: As the developer, I want heroes to move to the new art one at a time so that the game stays complete while art is produced.

**Why P2**: Only Krell has animation today.

**Acceptance Criteria**:

1. WHERE a hero has no `art` field the system SHALL render the portrait fallback defined by stage-combat.
2. WHERE a hero has `art: "legacy"` the system SHALL render its animation content as today (Krell's two variants by weapon).
3. IF a layered hero's sheets fail to load at runtime THEN the system SHALL render the portrait fallback and log the hero id.

**Independent Test**: e2e fixture with one layered, one legacy and one art-less hero on the field.

---

### P3: Two-color armor

**User Story**: As the artist, I want armor to use a light and a dark color so that pieces look richer than a single tint.

**Why P3**: Single-color tint already works; this is polish.

**Acceptance Criteria**:

1. WHERE an armor item defines `visual.colorDark` the system SHALL map the layer's gray values onto a gradient from `visual.colorDark` (black) to `visual.color` (white).

**Independent Test**: screenshot review of a fixture item with both colors.

---

## Edge Cases

- IF an `.aseprite` file has a layer name the guide does not know (other than `ref*`/`guide*`) THEN `art:export` SHALL warn naming it and not export it.
- IF Aseprite reports an error or writes no files THEN `art:export` SHALL exit non-zero, print Aseprite's output and leave previously exported files unchanged.
- WHEN a weapon model is larger than 256 × 256 THEN `validate:content` SHALL fail naming the model file.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ART-01 | P1: Export a hero (AC 1–3) | - | Pending |
| ART-02 | P1: Export a hero (AC 4–6) | - | Pending |
| ART-03 | P1: Enforce the guide's rules (hero rules, AC 1–6) | - | Pending |
| ART-04 | P1: Enforce the guide's rules (weapon/item rules, AC 7–8) | - | Pending |
| ART-05 | P1: Compose the hero (layers, order, behind, AC 1–3) | - | Pending |
| ART-06 | P1: Compose the hero (tint, weapon, updates, AC 4–8) | - | Pending |
| ART-07 | P1: Compose the hero (dev hook, AC 9) | - | Pending |
| ART-08 | P2: Enchant effects and attack speed | - | Pending |
| ART-09 | P2: Migration and fallbacks | - | Pending |
| ART-10 | P3: Two-color armor | - | Pending |
| ART-11 | Edge cases | - | Pending |

**Coverage:** 11 total, 0 mapped to tasks, 11 unmapped ⚠️

---

## Success Criteria

- [ ] A hero drawn by the guide goes from `.aseprite` to on-screen with one command and zero hand edits.
- [ ] A new weapon model needs exactly one exported image; a new armor item needs only content colors.
- [ ] Five composed heroes in combat hold 60 fps on the Steam Deck target.
