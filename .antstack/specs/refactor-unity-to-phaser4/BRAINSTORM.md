# Refactor: Unity Client → Phaser 4 — Brainstorm

## Session

- **Stance:** Ideate for me. Claude ran the full session alone; the user reacts to the result.
- **Topic:** *how* to re-platform the Infinity Grove client from Unity to Phaser 4 + TypeScript
  so that Claude Code can take any PRD feature to working, tested code with zero editor steps,
  while staying a drop-in client for the existing backend.
- **Out of scope:** game design, PRD, and backend behavior (inherited from `../infinity-grove/`).

## Findings from the codebase that shaped the session

These came from reading the repo, not from assumptions. Several of them change the Briefing.

1. **The backend compiles a file out of the Unity project.**
   `Backend/src/InfinityGrove.Backend.Domain/InfinityGrove.Backend.Domain.csproj` links
   `InfinityGrove/Assets/Scripts/Shared/BreakInfinity.cs`. If the Unity folder is archived or
   removed, **the backend build breaks.** That file has to move into `Backend/` (or a neutral
   `shared/dotnet/`) before Unity is retired.
2. **There are no tests to port.** No test assemblies exist under `InfinityGrove/Assets` or
   `Backend/`. The Briefing's "tests ported or rewritten" is really "tests written for the
   first time". Parity can't be checked against an existing suite, so an oracle has to be
   built (see Direction B).
3. **The Unity code was already halfway to "UI in code".** `UiFactory` builds list rows at
   runtime, and presenters only need one Inspector-assigned container each. The pain sat in
   `GameLifetimeScope` (`[SerializeField]` data arrays plus `RegisterComponentInHierarchy`
   presenters that must exist in a scene). That's the exact surface the new composition root
   has to remove.
4. **The Steam surface is bigger than "auth + cloud".** AD-12 (Summoning Stones through
   ISteamMicroTxn) needs the client to show the **Steam overlay** and receive the
   `MicroTxnAuthorizationResponse` callback. Overlay injection into Chromium/WebView is the
   most fragile part of shipping a web runtime on Steam. That makes the overlay a
   **monetization blocker**, not a cosmetic issue.
5. **Phaser 4 skills already exist in this environment** (`phaser-scenes`, `phaser-loading-assets`,
   `phaser-v4-new-features`, …). That partly offsets the risk that Phaser 4 is a newer major
   version with less training-data coverage than v3.

## Ideas generated, by technique

### 1. Role-play: Claude Code as the primary user of the codebase

*"I'm the agent. What do I need to prove a feature works without a human looking at it?"*

- **Headless simulator CLI:** `npm run sim -- --script scenarios/fusion-basic.json`. It runs
  Domain and Service code with no Phaser, an injected clock and a seeded RNG, and prints a JSON
  state diff. Most features can be verified this way without rendering anything.
- **Boot-anywhere dev URLs:** `?scene=Fusion&save=fixtures/late-game.json&seed=42`. The agent
  (or a human) jumps straight to any screen in any state. This replaces "open the scene and
  press Play".
- **Save-fixture library:** checked-in save states (`new-player`, `mid-game`, `fusion-ready`,
  `pending-reconciliation`, …) used by sim tests, dev URLs and screenshot tests alike.
- **Semantic scene snapshot:** each presenter exposes `describe()`, which returns a tree of
  `{role, label, enabled, value}`, a kind of accessibility tree for the game. Tests assert on
  meaning ("Fuse button is disabled, label says 'Need 3 copies'") instead of pixels.
- **Screenshot loop:** Playwright drives the Vite build through a debug hook (`window.__ig`)
  and saves PNGs that the agent can read back. Used for visual checks; it doesn't gate CI.
- **Architecture enforced by lint:** `dependency-cruiser` / `no-restricted-imports` fails the
  build if `domain/` or `services/` import `phaser`, `electron` or `fetch`. The layering rule
  then lives in the toolchain, not in a reviewer's head.
- **Rewritten CLAUDE.md** for the TS client: commands, layer rules, how to add a hero/monster/
  stage, how to verify. The current CLAUDE.md says "no CLI build or test commands", and that
  is exactly the line this refactor removes.

### 2. Reversal: how would we make this *maximally hard* for an agent?

Hidden editor state, magic-string asset keys, wall-clock timing in tests, hand-placed
absolute-pixel UI, globals. The inverses:

- **Generated asset manifest:** a script walks `assets/` and emits `assets.gen.ts` with typed
  keys. A typo in a texture key becomes a compile error.
- **Content as typed, validated data:** heroes, monsters, stages and equipment live in JSON
  validated by `zod` (`npm run validate:content`). TS types are inferred from the schemas, so
  cross-references like `stage.monsterIds` are checked at load time and in CI.
- **Clock and RNG injected everywhere:** no `Date.now()` or `Math.random()` in Domain. Every
  test is deterministic.
- **A layout primitive instead of coordinates:** a small row/column/stack helper (the TS
  version of `UiFactory`) so screens are declared, not hand-positioned.

### 3. Provocation: "Don't build the menus in Phaser at all"

The roster, fusion, crafting, equipment, loadout and stage-select screens are **list- and
form-heavy UI**. HTML/CSS is the UI medium that LLMs author most reliably, and it gets
testing-library and Playwright for free.

- **Hybrid client:** Phaser owns the world canvas (combat, Krell, monsters, fireflies,
  backgrounds). Menus and HUD are a DOM layer over the canvas, either plain TS + CSS or a
  tiny view library (Preact/Lit).
- **Side effects that help:** Cinzel Decorative works as a CSS web font with no SDF atlas. The
  TMP gradient button becomes `background-clip: text`. Responsive layout comes for free.
- **Costs:** two rendering mental models, gamepad/Steam Deck navigation must be built for DOM
  focus, and the canvas and DOM must stay visually consistent.
- This is a **genuine fork in the road**, recorded as a decision under Converging.

### 4. Provocation on AD-2: "What if we don't implement the rules twice?"

- **Backend as the oracle, not Unity:** add a small .NET test/console project that runs the
  *backend's* domain rules (big numbers, fusion costs, offline accrual, event validation) over
  generated inputs and writes `shared/test-vectors/*.json`. The TS suite consumes them. The
  backend is the authority (AD-6/AD-9), so it is the right source of truth, and it outlives
  Unity.
- **Shrink the "must match exactly" set:** the client already *predicts* and the backend
  *reconciles* (AD-6, `ReconciliationCorrection`). Most client-side rules only need to be
  close enough for prediction. Rule of thumb: bit-exact only for wire formats (big-number
  serialization, event shapes). Everything else is prediction plus tolerance. This cuts the
  parity burden sharply.
- **Contract drift caught at compile time:** generate the TS API client and DTO types from
  the ASP.NET OpenAPI document (`openapi-typescript` or NSwag) via `npm run gen:api`.
- *Explored and set aside:* compiling the C# rules to WASM so both sides share one binary.
  Single source of truth, but it brings in an exotic toolchain the agent would struggle to
  drive, and startup cost. Vectors plus a smaller exactness scope get most of the benefit.

### 5. Analogy: web-runtime games already on Steam

- Several well-known incremental/indie games have shipped on Steam inside Chromium wrappers
  (Electron/NW.js), and Vampire Survivors began life as a Phaser game. Idle games are the
  genre where the web runtime fits best: few sprites, lots of UI, long sessions.
- Lessons borrowed:
  - **Background throttling:** Chromium throttles timers on hidden windows. Set
    `backgroundThrottling: false` *and* keep the game loop delta-based, so throttling only
    delays work and never loses it. Offline accrual already provides the catch-up math.
  - **Hours-long sessions leak:** add `npm run soak`, an accelerated sim of N hours in
    headless mode that checks heap growth and event-log size.
  - **Overlay quirks:** Chromium wrappers usually need GPU/compositing flags for the Steam
    overlay to render. This must be proven on Windows *and* Steam Deck early (see finding 4).

### 6. Worst possible idea → inversion

| Worst idea | Inverted into |
|---|---|
| Write a C#→TS transpiler | **Agent-driven 1:1 port of Domain**, file for file and name for name, tracked in `PORT_MAP.md` (each `.cs` → `.ts` with status). The Unity code becomes a Rosetta stone. |
| Keep both clients alive "until it feels done" | **Hard cutover criterion:** the parity checklist is derived from the existing SPEC tasks (T00x). When all are green in Phaser, Unity is archived the same week. |
| Redesign little things while porting | **Design freeze:** any behavior change goes back to the infinity-grove PRD, never into a port PR. |
| Migrate old encrypted Unity saves | **Declare no save migration.** The project is pre-launch and has no players. The new save format can be chosen freely. `[ASSUMPTION — confirm]` |

### 7. Forced connections: Unity-only presentation → Phaser equivalents

- **Krell's Animator → Aseprite pipeline.** Phaser can build animations directly from
  Aseprite JSON (`anims.createFromAseprite`). With the Aseprite CLI
  (`aseprite -b --sheet … --data …`) behind `npm run art:export`, art goes from source file to
  game without any editor step. Fallback: re-slice the existing sheets into an atlas JSON once.
- **Firefly Shader Graph →** the cheap path is the particle emitter with additive blend and a
  glow filter. The faithful path is hand-porting the shader as a Phaser 4 filter/GLSL (the
  agent can write GLSL). Start cheap and upgrade only if it looks wrong.
- **URP 2D lighting →** the Phaser 4 Lighting component where it is actually used. Otherwise
  baked into the art.
- **TMP gradient text →** CSS (if hybrid UI) or a canvas-gradient `Text` fill (if Phaser-only).
- **Unity editor tooling (`AudioEditor`, `BuildScript`) →** dropped. Audio trims become an
  `ffmpeg` npm script if they're ever needed again. The build is `npm run build:electron`.

### 8. Migration-shape provocation: layer-by-layer vs. risk-first

- The Briefing's plan (Domain → Services → screens) pushes **every big unknown to the end**:
  Electron vs. Tauri, the Steam overlay, Steam Deck, microtransactions, and build size.
- **Alternative, the walking skeleton first:** in week one, an empty Phaser scene runs inside
  Electron, gets a Steam auth ticket via steamworks.js, authenticates against the real
  `/api/v1` auth endpoint, opens the overlay, and builds an installable package from
  `npm run build:electron`. After that, layer-by-layer porting is low-risk, mechanical work.
- **Spike exit criteria** (so the Electron/Tauri choice gets *decided*, not drifted into):
  1. auth ticket accepted by the backend;
  2. Steam Cloud read/write round-trip;
  3. overlay renders on Windows and Steam Deck;
  4. a sandbox microtransaction authorization callback is received;
  5. idle for 1 hour with the window minimized loses no progress;
  6. installed size and RAM recorded.
- If steamworks.js can't do (4), that is found in week one, not at launch.

## Converging

### Direction A — Agent-native harness first *(the core of the "why")*

Build the verification loop before porting features: the Vite/TS/Vitest scaffold, the
composition root, the layer lint, clock/RNG injection, content schemas, the asset manifest,
the sim CLI, save fixtures, boot-anywhere URLs, semantic `describe()` snapshots and the new
CLAUDE.md. Every ported feature afterwards lands with terminal-verifiable proof.
**Trade-off:** about a week or more with no visible game progress. Skipping it, though,
recreates the Unity problem in a new engine.

### Direction B — Risk-first walking skeleton + backend-as-oracle parity

In parallel with A: the Electron + steamworks.js spike with the six exit criteria, moving
`BreakInfinity.cs` out of the Unity tree, the .NET vector generator, and the OpenAPI-generated
TS client. Then the Domain port 1:1 under `PORT_MAP.md`, validated against the vectors.
**Trade-off:** it front-loads the uncertain work. If the overlay/microtxn spike fails, the
whole shell choice (Electron vs. Tauri vs. something else) reopens, which is exactly why it
should come first.

### Direction C — UI technology: Phaser-only vs. hybrid DOM menus *(decision for PRD/Architecture)*

- **Phaser-only:** one rendering model, natural gamepad/Deck support, more custom layout code
  that is harder for an agent to verify.
- **Hybrid (Phaser world + DOM menus):** the best agent authoring and testing story, plus free
  fonts and gradients. The costs are DOM focus navigation for controllers and visual
  consistency between the two layers.
- **Recommendation:** hybrid, *conditional on* a one-screen spike (Roster) proving that
  controller navigation over DOM is acceptable on Steam Deck. If it isn't, fall back to
  Phaser-only with the `describe()` snapshot as the testing seam.

### Suggested ordering

1. B-spike and A-harness in parallel (they share the scaffold).
2. Domain 1:1 port against the vectors.
3. Services (save, event log, sync, backend client).
4. Screens, one per parity-checklist item, starting with combat, then the menus.
5. Presentation fidelity pass (fireflies, lighting, fonts).
6. Cutover: archive Unity, rewrite CLAUDE.md, retire Unity references in the specs.

## Explored and set aside

- **C#→WASM shared rules:** the toolchain is too exotic for an agent-driven loop. Vectors are
  enough.
- **Automated C#→TS transpiler:** brittle. An agent porting 1:1 with a port map does the job.
- **Keeping the Unity client alive in parallel:** doubles the maintenance cost. Use a hard
  cutover criterion instead.
- **Unity save migration:** pre-launch with no players, so not worth the cost (pending the
  user's confirmation).
- **Tauri as the default:** not rejected, but the system WebView differs between Windows
  (WebView2) and SteamOS (WebKitGTK). It stays a fallback that the spike can promote.
- **Pixel-diff screenshot tests as CI gates:** too flaky. Screenshots are for the agent's eyes;
  semantic snapshots are the gate.

## Solutions

**One solution.** The Phaser client, its Electron shell, the test harness and the parity
vectors are parts of a single deliverable: a drop-in game client. None of them is valuable on
its own. The .NET vector generator lives in `Backend/` as test tooling, not as a separate
product. No `SOLUTIONS.md`.

## Risks and assumptions to carry into PRD/Architecture

- **[BLOCKER-to-remove]** The backend links `BreakInfinity.cs` from the Unity tree. Relocate
  it before any Unity removal.
- **[RISK]** The Steam overlay inside Chromium is required for AD-12 microtransactions. It must
  be validated on Windows and Steam Deck in the spike.
- **[RISK]** The exact capabilities of steamworks.js (cloud, web-API auth tickets, microtxn
  callback) are assumed, not verified.
- **[RISK]** The numeric behavior of break_infinity.js (normalization and rounding of doubles)
  may differ subtly from BreakInfinity.cs at the edges. The vectors must cover huge and small
  exponents and the serialization round-trip.
- **[FACT]** There is no existing test suite on either side. The parity oracle must be built.
- **[ASSUMPTION]** No migration of existing Unity save files.
- **[ASSUMPTION]** The "bit-exact" requirement covers wire formats only; other client rules are
  predictions that the backend reconciles.
- **[OPEN]** Hybrid DOM UI vs. Phaser-only (Direction C), to be decided after the Roster spike.
- **[OPEN]** Art source of truth: Aseprite files plus the CLI export (preferred) vs. re-sliced
  Unity sheets.
