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

## Handoff

- **Feature**: brainstorm → specs for starter-selection, stage-combat, boss-drops, equipment-enchant, rotating-shop, boss-potions, economy-tuning, season-cave
- **Phase / Task**: Specify (specs written, awaiting developer confirmation)
- **Completed**: none
- **In-progress** (file:line): none
- **Next step**: Developer reviews the eight specs; then Design for stage-combat (first in dependency order after starter-selection).
- **Blockers**: none
- **Uncommitted files**: .specs/
- **Branch**: main
