# STATE

## Decisions

### AD-001
- **Decision**: Every transaction whose outcome a modified client could forge (random rolls, drops, enchanting, shop stock/purchase/sale, fusion, potion consumption, ranked results, gold income bounds) is decided or validated by the backend; the client only requests and displays.
- **Reason**: Hero cards carry real-money value (Summoning Stones, Steam Market) and rankings carry status; anything decided in the front end can be edited by cheaters. Developer directive, brainstorm 2026-10-06.
- **Trade-off**: These actions need a connection. Offline play keeps combat, gold accrual and navigation; rewards earned offline are granted when the events sync. More backend work per feature.
- **Scope**: All game features; extends refactor ARCHITECTURE AD-22 (server-side affix rolls) to every valuable outcome.
- **Date**: 2026-10-06
- **Status**: active

### AD-002
- **Decision**: Stages are played as continuous progression (always fighting at the current stage: 10 monsters per stage, a timed boss every 5 stages, auto-advance), replacing the instant "Attempt" classifier screen; Stage Select becomes "jump to a cleared stage".
- **Reason**: One loop for combat, idle income and progress (Clicker-Heroes style), and it closes PORT_MAP B6 (the squad earned nothing in real time). The developer wants fast, dynamic fights: a boss fight lasts at most 60 s.
- **Trade-off**: The Unity-parity `StageService.attemptStage` flow is retired; FR-11 classification becomes the label of a boss failure instead of the whole mechanic.
- **Scope**: stage-combat, boss-drops, boss-potions, economy-tuning, season-cave.
- **Date**: 2026-10-06
- **Status**: active

### AD-003
- **Decision**: Gold is the general in-game currency (enchant scrolls, rotating shop, crafting); there is no gold-bought account level. Squad power comes from heroes (base power × star tier) and their equipment (including enchant level). This replaces the game PRD's FR-5 reading of "a shared account-level power stat bought with gold".
- **Reason**: Developer's economy vision: gold buys items and their upgrades; heroes come from boss drops and Summoning Stones.
- **Trade-off**: The PRD's single account-power curve disappears; balancing moves to item and hero curves (economy-tuning). Needs a game-PRD update for FR-5/FR-26.
- **Scope**: stage-combat, equipment-enchant, rotating-shop, economy-tuning.
- **Date**: 2026-10-06
- **Status**: active

### AD-004
- **Decision**: Boss damage is split across the living Active Squad heroes; if the squad has no hero of the boss's favored type (Composition Mismatch), all boss damage goes to the leader (Active Squad slot 1).
- **Reason**: Developer's design: more heroes make the team sturdier, and the wrong composition collapses on the leader, making FR-11's Mismatch a physical outcome of the fight.
- **Trade-off**: Heroes gain hit points and can be knocked out, a new combat dimension to tune.
- **Scope**: stage-combat, boss-potions, season-cave, economy-tuning.
- **Date**: 2026-10-06
- **Status**: active

### AD-005
- **Decision**: Hero art is frame-by-frame in Aseprite per hero (body once), while equipment is composed at runtime: weapons are single static images attached to per-frame Aseprite slices (`grip`/`tip`), armor is grayscale layers (`armor_chest`, `armor_gloves`, `armor_boots`) tinted with each item's colors, and enchant levels are runtime effects. Process: docs/HERO_ART_GUIDE.md.
- **Reason**: The developer wants many items visible on heroes and already works in Aseprite; skeletal rigs (Spine/DragonBones) would add a new toolchain and per-hero rigging, and drawing every item into every frame does not scale. This makes a new weapon one drawing and new armor zero drawings.
- **Trade-off**: Every hero must follow the layer/slice rules from the start; armor variety is limited to recoloring (plus optional socket overlays); runtime composition (layered synced sprites, tint, socket placement) and an `art:export` tool must be built. Krell's legacy sheets keep their two fixed variants until redrawn. Art style moves to Japanese anime, which the game DESIGN.md still describes as painted fantasy.
- **Scope**: All hero and equipment art; extends refactor ARCHITECTURE AD-9 (Aseprite JSON stays the single animation format).
- **Date**: 2026-10-06
- **Status**: active

### AD-006
- **Decision**: An account plays on one device at a time: each login creates a new session and invalidates the previous one; clients renumber pending events above the server cursor on login, and the backend rejects stale unknown events instead of silently accepting them.
- **Reason**: Fixes PORT_MAP B7 (events silently dropped when two devices played the same account). Developer rule: logging in elsewhere disconnects the other device; credentials may stay saved.
- **Trade-off**: A player cannot keep the game open on two machines; a disconnected device shows a modal and must log in again to continue.
- **Scope**: Backend auth/session and event ingestion; client sync and boot; spec `single-active-session`.
- **Date**: 2026-10-06
- **Status**: active

## Handoff

- **Feature**: specs written for starter-selection, stage-combat, boss-drops, equipment-enchant, rotating-shop, boss-potions, economy-tuning, season-cave, hero-art-pipeline, single-active-session (all pass validate_spec.py)
- **Phase / Task**: Next: **Design for stage-combat** (`.specs/features/stage-combat/spec.md`), then Design for hero-art-pipeline
- **Completed**: Specify for all ten features; refactor-unity-to-phaser4 T001–T007 + T008 (except the Unity archive)
- **In-progress** (file:line): none
- **Next step**: Ask the developer to review or accept the spec assumptions marked `n` (they asked to start the stage-combat Design after clearing context), then write `.specs/features/stage-combat/design.md` following references/design.md of the tlc-spec-driven skill.
- **Blockers**: none. Steam App ID deferred to pre-launch (SPIKE_G0.md G0b); Unity archive waits for G3 (playthroughs; G4 approved).
- **Queued**: align the game DESIGN.md and docs/README.md / docs/UI_PROMPTS.md with the anime style (AD-005); implement single-active-session (B7).
- **Uncommitted files**: none (commit 524d596 not pushed yet)
- **Branch**: main
