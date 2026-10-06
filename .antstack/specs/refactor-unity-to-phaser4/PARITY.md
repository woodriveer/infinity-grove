# Parity Checklist (RFR-49)

An item is **green** only when all four hold: (a) its sim scenario and/or e2e test passes in CI;
(b) its rows in `Client/PORT_MAP.md` are `done`; (c) the developer played it once on Windows and
once on a Steam Deck; (d) differences from Unity are zero, or listed and accepted.

Status on 2026-10-06. (a) and (b) are verified by the agent; (c) and (d) need the developer.
**No item is green yet**, because (c) is pending for all of them, and P7 also waits for the
backend crafting endpoint (RFR-41).

| # | Capability | (a) automated evidence | (b) PORT_MAP | (c) Windows / Deck | (d) differences from Unity |
|---|---|---|---|---|---|
| P1 | Main menu → game | e2e `main menu: Play enters the game…` | done | pending / pending | Config button opens Settings (music volume) instead of doing nothing |
| P2 | Combat loop | sim `p02-combat-loop`; e2e combat tests (gamepad, keyboard, mouse) | done | pending / pending | Slime drawn as a placeholder (Unity had no sprite, B8) |
| P3 | Equipment bonus | sim `p03-equipment-bonus`; e2e asserts 15 damage per hit | done | pending / pending | none |
| P4 | Roster and Active Squad | sim `p04-roster-squad`; e2e roster + tap-to-swap | done | pending / pending | + tap-to-swap when the squad is full (EXPERIENCE) |
| P5 | Fusion | sim `p05-fusion`; e2e fusion (gamepad + keyboard) | done | pending / pending | + confirm dialog (focus on Cancel); fusion still reverts on reconcile (B3, as in Unity) |
| P6 | Equipment inventory | sim `p06-equipment-inventory`; e2e equip/unequip | done | pending / pending | bag and loadouts now persist locally (Unity kept them in memory) |
| P7 | Crafting | sim `p07-crafting-unavailable`; e2e crafting preview | done | pending / pending | **blocked:** re-rolls are server-side (AD-22) and the backend endpoint does not exist; the local roll was dropped |
| P8 | Loadout presets | sim `p08-loadout-presets`; e2e presets | done | pending / pending | none |
| P9 | Stage select | sim `p09-stage-select`; e2e Power Gate / Mismatch / Success | done | pending / pending | none (placeholder stages, B5) |
| P10 | Offline accrual | sim `p10-offline-accrual`; e2e welcome-back toast | done | pending / pending | none |
| P11 | Local save | sim `p11-save-reload`; unit atomic-write and corrupt-save tests | done | pending / pending | new encrypted format (PRD S1); unsynced events are shown after a restart (B4, needs acceptance) |
| P12 | Event log + sync + reconciliation | sim `p12-sync-reconcile`; `tests/sync-e2e` against the real backend (G2, passed locally) | done | pending / pending | backend sequence collision across devices found (B7); fix decided: single active session (AD-006, spec `single-active-session`) |
| P13 | Steam identity + cloud, dev stubs | unit Steam Cloud resolution; shell smoke; dev/NoBackend stubs in every test | done | pending / pending | real Steam not exercised yet (SPIKE_G0.md criteria 1–2) |
| P14 | Big numbers | 100% bit-exact on `bignum-*` vectors | done | n/a | B1 (subnormal hang) and B2 (`10.00e-1`) ported/guarded |
| P15 | Hero-type display | e2e roster asserts `NAT · Nature` text badges | done | pending / pending | type name added next to the abbreviation |

## Gates

- **G1** (Domain port): passed — all Domain rows `done`, vector suite green.
- **G2** (end-to-end sync): passed locally against Docker PostgreSQL + API + fake Steam; CI job `sync-e2e` added.
- **G3** (parity): **not passed** — needs (c) for every item and the backend crafting endpoint for P7.
- **G0** (shell spike): **not passed** — see SPIKE_G0.md.
- **G4** (fidelity): **passed** on 2026-10-06 — developer approved every item in FIDELITY.md.
