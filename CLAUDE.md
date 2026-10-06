# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Infinity Grove** is a clicker incremental RPG set in a forest, shipped on Steam (Windows and
Steam Deck). The game client is **Phaser 4 + TypeScript** in `Client/`, packaged as an
**Electron** desktop app. The authoritative **ASP.NET Core + PostgreSQL** backend is in `Backend/`.
Everything is code or plain data and is built, run, tested and packaged from the terminal.

The previous Unity client (`InfinityGrove/`) is kept only until the cutover (refactor RFR-50,
after gates G3 + G4). **Do not change it**; it is a reference for parity and fidelity checks.

Specs: `.antstack/specs/infinity-grove/` (the game) and `.antstack/specs/refactor-unity-to-phaser4/`
(the re-platform: PRD, ARCHITECTURE, SPIKE_G0, UI_GATE, PARITY, FIDELITY).

## Repository layout

```
Backend/                  ASP.NET Core API (src/), VectorGen + fake Steam + scripts (tools/)
shared/openapi/           openapi.json exported from the backend (contract for gen:api)
shared/test-vectors/      parity oracle written by VectorGen (big numbers, rules, events)
Client/
  src/domain/             pure rules and entities (1:1 port of the Unity Domain)
  src/services/           state store, ports, commands, event log, sync, save, content loading
  src/presentation/       Phaser world scene, screen controllers, Preact DOM menus, input, theme
  src/platform/           port implementations: browser/, electron/, node/, shared/
  src/app/                compose() root, config, boot, dev hooks (dev/test only)
  src/generated/          assets.gen.ts, api/schema.ts (never hand-edited)
  desktop/                Electron main + preload (bridge allowlist in desktop/bridge.ts)
  content/<kind>/*.json   heroes, monsters, stages, items, equipment, animations, effects, frames, settings
  assets/                 runtime PNG/JSON/audio/fonts (served as-is)   art-src/  art inputs + slice specs
  fixtures/saves/         save-fixture library        scenarios/  sim scripts (P2–P12)
  tests/{unit,vectors,sim,lint,e2e,shell,sync-e2e}/
  steam/                  steam.json (App ID), app_build.vdf, depot_build_*.vdf
  PORT_MAP.md             Unity → TS file map, amendments, behavior notes for the game PRD
```

## Commands (run in `Client/`)

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server; offline (NoBackend, dev identity) by default |
| `npm run verify` | **The CI gate**: typecheck, lint (+ layer rules and their negative fixtures), validate:content, gen:check, test, test:e2e, build, scan:secrets |
| `npm test` | Vitest: unit, vectors, sim scenarios (fast, deterministic) |
| `npm run test:e2e [-- --screenshots]` | Playwright on the test build; `--screenshots` writes `artifacts/screenshots/` (never asserted) |
| `npm run test:shell` | Electron smoke: sandboxed renderer, exact `igPlatform` allowlist |
| `npm run test:sync-e2e` | Real backend sync (needs `IG_SYNC_E2E_BACKEND`, see below) |
| `npm run typecheck` / `npm run lint` | tsc; ESLint + dependency-cruiser + lint fixture tests |
| `npm run validate:content` | Schemas, ids, cross-references, asset keys; errors name file and field |
| `npm run gen:assets` / `npm run gen:api` / `npm run gen:check` | Asset manifest; API client from `shared/openapi`; staleness check |
| `npm run sim -- --script scenarios/<f>.json [--seed n] [--save <fixture>]` | Headless scenario → state + events JSON; fails on unmet `expect` |
| `npm run soak [-- --hours 24]` | Long-run simulation with RNFR-3 bounds (heap, unsynced log) |
| `npm run fixtures:gen` | Rebuild `fixtures/saves/*.json` through the real services |
| `npm run art:slice -- <spec.json>` | Wrap legacy sheets in Aseprite JSON / crop 9-slice frames |
| `npm run build` / `npm run build:desktop` | Web bundle; Electron Windows + Linux `dir` packages in `release/` |
| `npm run desktop` | Build and run the Electron shell locally |
| `npm run steam:upload` | Developer-only depot upload with steamcmd (never in CI) |

Backend (in `Backend/`): `dotnet build InfinityGrove.Backend.sln`; `pwsh tools/export-openapi.ps1`
(→ `shared/openapi`), `pwsh tools/generate-vectors.ps1` (→ `shared/test-vectors`). Local backend
with fake Steam: `docker compose -f docker-compose.yml -f tools/fake-steam/docker-compose.sync-e2e.yml up -d --build`,
then `IG_SYNC_E2E_BACKEND=http://localhost:8080 npm run test:sync-e2e` in `Client/`.

## Layer rules (enforced by `npm run lint`)

- `domain/` imports only `domain/`. No I/O, time or randomness except through arguments.
- `services/` imports `domain/`, `services/`, `src/generated/`, `zod`, and `openapi-fetch` (only in `services/backend/`).
- `presentation/` imports `services/`, domain **types** (values only from `domain/bignum/format`), `generated/assets.gen`, `phaser`, `preact`.
- `platform/` implements ports; it never imports `presentation/` or `app/`. Nothing imports `app/`.
- Only `services/` and `app/` import the writable `GameStore`; presentation gets a `ReadonlyStore`.
- In `domain/` and `services/`: no `Date.now`, `Math.random`, `performance`, `fetch`, timers, `crypto`, DOM or `process`. Use the injected `Clock`, `Rng`, `IdGenerator` and ports.
- Colors only from `presentation/theme/tokens.ts`. Affix rolls only from the server (`BackendAffixRollSource`).

Every persisted change is a service command that appends its `PlayerEvent` (AD-5). New I/O means a
new port in `services/ports.ts` first, implemented in `platform/`.

## Adding content (no code change, RFR-12)

1. Add `content/<kind>/<id>.json` (file name = kebab-case id). Heroes need a `serverHeroId` GUID to sync.
2. Put any new art in `assets/` and run `npm run gen:assets`; reference it by manifest key.
3. `npm run validate:content`, then `npm test`.

## Verifying a feature without a human

1. Domain/service behavior: unit tests, and a `scenarios/*.json` with an `expect` block (`npm run sim`).
2. Screens: e2e via boot URLs `?scene=<menu|settings|game|roster|fusion|equipment|stages>&save=<fixture|none>&seed=<n>&clock=manual[&hero=<id>]`,
   asserting on `window.__ig.describe()` (never pixels/DOM). Drive input with `__ig.input({gamepad:'A'})` / `{key:'Enter'}`,
   time with `__ig.advance(ms)`. Every interactive element must be in `describe()` and reachable by gamepad.
3. Rules shared with the backend: add or extend a VectorGen family; TS must match the RFR-21 tolerance.
4. `npm run verify` green. Screenshots (`--screenshots`) are for looking, not for gating.

## Design freeze (refactor S6)

A port/infra change never changes game behavior. A behavior change goes to the game PRD first and
lands as its own change. Behavior found wrong in Unity is ported as-is and logged in `PORT_MAP.md`.

## Platform notes

- Windows is the dev machine: use forward slashes in scripts; the CI matrix also runs Linux (stands in for SteamOS).
- Node 24 per `.nvmrc`; TypeScript stays on 5.x until typescript-eslint and openapi-typescript support 7.
- Steam: upstream `steamworks.js` in the Electron main process only (`desktop/main/steam.ts`). `Client/steam/steam.json`
  holds a placeholder App ID (480) until the real one is set.
