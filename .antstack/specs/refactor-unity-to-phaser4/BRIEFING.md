# Refactor: Unity Client → Phaser 4 — Briefing

## Status

Engineering re-platform of an already-specified product, not a new product. The game
itself — design, scope, monetization, platform — is defined in
[`../infinity-grove/`](../infinity-grove/) (BRIEFING, PRD, ARCHITECTURE, SPEC) and is
**not** re-opened here. Stakes inherit from that goal: a real paid PC/Steam launch.
This briefing covers only *why* and *how far* the client changes engines.

## The problem being solved

In the user's words: the project moved to Phaser 4 "because it's easier to integrate
with Claude Code — I tried C# with Unity and it didn't give a good result." Pinned down
further: **scenes and prefabs were the problem.**

Development on this project is AI-assisted (Claude Code). Unity puts a large share of
the game's real wiring in places an agent can't reliably author or verify: serialized
scene/prefab YAML, Inspector-assigned references (`[SerializeField]`,
`RegisterComponentInHierarchy` presenters that must already exist in a scene),
ScriptableObject assets, Animator controllers, plus no CLI build/test loop (CLAUDE.md:
"there are no CLI build or test commands"). The C# code itself was workable; the
editor-bound glue around it was not.

**The core requirement that follows:** in the new client, *everything is code or plain
data files*. No visual-editor-only configuration, no scene graph assembled by hand,
and build, run and tests all driven from the terminal.

## Who this is for

- **Primary: the developer + Claude Code as the build team.** Success means an agent can
  take a feature from the PRD to working, tested code with no manual editor step.
- **Players: should notice nothing in the design.** The same game, PRD, and
  Steam distribution. The only differences they might see are in the fidelity of
  presentation (rendering, effects, fonts), and those should be equal or acceptable,
  never a design regression.

## Context: what exists today

- **Unity client** (`InfinityGrove/`, Unity 6, URP 2D): ~85 C# scripts layered
  Data / Domain / Service / Presentation behind a VContainer composition root
  (`GameLifetimeScope`). Implemented: combat loop, roster/active squad, fusion,
  equipment inventory, crafting, loadout presets, stage select + outcome classification,
  offline accrual, encrypted local save, player event log + backend sync/reconciliation,
  main menu. Steam is stubbed (`DevSteamIdentityProvider`, `LocalOnlyCloudStore`).
- **Backend** (`Backend/`, ASP.NET Core .NET 8 + PostgreSQL): auth via Steam ticket,
  event ingestion, fusion with outbox, Summoning Stones, Market. **Stays as-is.**
- **Assets:** sprite sheets (Krell, Ranger, Druid), backgrounds, card frames, icons,
  audio, Cinzel Decorative `.ttf`. Unity-specific artifacts that will not carry over:
  `.anim` clips + `Krell.controller`, the firefly Shader Graph, TMP SDF font assets,
  prefabs, `.unity` scenes.

## Product vision for this refactor

A new **Phaser 4 + TypeScript** game client that reaches feature parity with the current
Unity client, then becomes the only client the PRD is built on from here on.

- **Same layering, without the engine glue.** Domain and Service logic as plain,
  engine-free TypeScript modules (unit-testable without Phaser). Phaser scenes only as
  thin presentation, the role MonoBehaviours played. Composition happens in code
  (constructor injection / a simple composition root), never in a scene file.
  `[ASSUMPTION]`
- **Content as data.** Heroes, monsters, stages, and equipment (today ScriptableObjects)
  become JSON/TS data files under version control. `[ASSUMPTION]`
- **Steam via a desktop wrapper.** Phaser runs in a browser runtime, so shipping on Steam
  means packaging in **Electron** with **steamworks.js** replacing Facepunch.Steamworks
  for auth tickets and Steam Cloud. `[ASSUMPTION — Electron over Tauri, chosen for the
  maturity of its Steamworks bindings; to be confirmed in Architecture]` The
  backend-only rule for inventory mutations and microtransactions (AD-4/AD-12) is
  unchanged, so the client's Steam surface stays small.
- **Big numbers:** `break_infinity.js` (the library BreakInfinity.cs was ported from).
- **Backend contract unchanged:** same REST `/api/v1` endpoints, DTOs, and event shapes.
  The client is a drop-in replacement from the server's point of view.
- **Terminal-first toolchain:** e.g. Vite + TypeScript + Vitest; `npm run dev`,
  `npm test` and `npm run build` (including the Electron package) all headless.
  `[ASSUMPTION]`
- **Migration shape:** a client rewrite rather than an incremental mix (Unity and Phaser
  can't share a runtime). The rewrite is ported layer by layer: Domain first (pure
  logic, tests ported or rewritten), then Services, then presentation per screen. The
  Unity project stays in the repo as the reference until parity is reached, then gets
  archived/removed. `[ASSUMPTION]`

## Decisions from the existing architecture this reopens

Downstream phases must revise these explicitly rather than inherit them silently:

- **AD-1** (VContainer + MonoBehaviour presenters) → replaced by a TS composition root +
  Phaser scenes.
- **AD-2's rationale** ("client and server share C#") no longer holds. Rules that must
  match exactly on both sides (big-number math, fusion cost curves, offline accrual,
  event validation) are now **implemented twice**. They need a parity guarantee, e.g.
  shared test vectors (JSON fixtures) run by both the .NET and TS test suites.
  `[ASSUMPTION — the mechanism is open]`
- **AD-4 / AD-5** → Facepunch.Steamworks becomes steamworks.js inside Electron.
- **AD-7** → BreakInfinity.cs becomes break_infinity.js. The (mantissa, exponent) wire format
  stays the same.
- **AD-9** → encrypted save at `persistentDataPath` becomes a file in Electron's user-data
  dir. Atomic-write and crash-safety requirements (NFR-2) still apply.

## Success looks like

- The Phaser client does everything the Unity client does today, against the same
  backend.
- A new PRD feature can be implemented by Claude Code end-to-end (code + data + tests)
  with zero manual editor steps, and verified with terminal commands alone.
- A Steam-launchable Electron build exists that authenticates a real Steam user against
  the backend.

## Known unknowns

- **Visual fidelity of Unity-only effects:** the firefly Shader Graph, URP 2D lighting,
  and the TMP gradient buttons need Phaser equivalents (Phaser 4 filters/shaders,
  particles, web fonts/BitmapText). How close is "close enough" is not decided.
- **Animation pipeline:** Krell's Animator states need to become spritesheet/atlas
  animations defined in code. Whether art comes straight from Aseprite exports (the
  project already imports Aseprite) or from re-sliced Unity sheets is open.
- **Electron vs. Tauri** and the Steam overlay/Steam Deck behavior of a web-runtime game
  are not validated yet. This needs a technical spike before the choice is locked.
- **Build size / performance** of an Electron idle game running for hours is assumed
  acceptable, not measured.
- **Fate of the Unity editor tooling** (`AudioEditor`, `BuildScript`): assumed dropped
  or replaced by scripts/CLI tools. Not discussed.
