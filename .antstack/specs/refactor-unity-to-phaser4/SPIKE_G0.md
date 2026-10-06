# G0 Shell Spike Report (RFR-31)

**Date:** 2026-10-06
**Machine:** developer workstation, Windows 11 Pro 10.0.26200 (x64). No Steam Deck available to the agent.
**Build:** `Client/` at T003, Electron 44.5.1, upstream `steamworks.js@0.4.0` (PORT_MAP amendment A4),
Steam config `Client/steam/steam.json` with the placeholder App ID 480.

## Verdict

**G0 is not passed yet.** The shell is built and its automated checks pass, but criteria 1–5 need
things the agent could not use in this session: the project's own Steam App ID and publisher key,
Steam sandbox microtransaction access, a Steam Deck, and a signed-in Steam client used on purpose for
the game. Per RFR-31 they are recorded as **not run**, not as passing. Phase 1+ work continued in
this session as code only; nothing here should be read as G0 sign-off.

## Criteria

| # | Criterion | Windows | Steam Deck | Evidence / how to run |
|---|---|---|---|---|
| 1 | Steam auth ticket accepted by the real `/api/v1` auth endpoint | not run | not run | Needs the real App ID in `steam/steam.json` and its publisher key in the backend (`Steamworks__PublisherKey`). The client side exists: `SteamAdapter.getAuthTicketHex` → `getAuthTicketForWebApi(webApiIdentity)`. **Open question:** the backend calls `AuthenticateUserTicket/v1` without an `identity` parameter, so `webApiIdentity` stays empty; confirm the ticket is accepted that way. |
| 2 | Steam Cloud write → read round trip | not run | not run | `SteamAdapter.cloudWrite/cloudRead` (base64 over `ISteamRemoteStorage`). Needs Cloud enabled for the App ID (byte quota + `save.bin`). |
| 3 | Overlay renders over the game and responds to input | not run | not run | Overlay flags are set before `ready` (`in-process-gpu`, `disable-direct-composition` on Windows, `electronEnableSteamOverlay()`). **Known gap:** upstream steamworks.js exposes no `GameOverlayActivated` callback, so `igPlatform.steam.onOverlayActivated` never fires and input is not suspended while the overlay is open (AD-16). Fixing it is the reason to keep the project fork plan. |
| 4 | Sandbox microtransaction authorization callback reaches the client with the overlay shown | not run | not run | `MicroTxnAuthorizationResponse` is registered and forwarded to the renderer as `onMicroTxnAuthorization`. Needs sandbox MicroTxn on the App ID. |
| 5 | Window minimized/hidden for 1 hour loses no progress | partially verified | not run | Shell flags: `backgroundThrottling: false`, `disable-renderer-backgrounding`, `disable-background-timer-throttling`, `disable-features=CalculateNativeWinOcclusion`. Independently of throttling, progress is computed from elapsed clock time (TickDriver catch-up + accrual beyond 60 s), proven headless by `tests/unit/services.test.ts` (TickDriver) and `npm run soak`. The real 1-hour hidden-window run was not done. |
| 6 | Installed size, idle RAM, idle CPU recorded | recorded | not run | See below. |

## Criterion 6 baseline (RNFR-5)

Measured by `npm run test:shell` (`artifacts/shell-metrics.json`) after 5 s idle on the empty-game build,
and `npm run build:desktop` output sizes:

| Measure | Windows x64 | Linux x64 |
|---|---|---|
| Unpacked package (`release/*-unpacked`) | 350 MB | 305 MB |
| of which the app (`resources/app.asar`) | 27 MB | 27 MB |
| Idle working set, all processes | 478 MB (browser 249, GPU/utility 46 + 78, renderer 105) | not measured |
| Idle CPU (per process, Electron metrics) | 0% | not measured |

Size is dominated by Electron 44 itself; the game bundle is 27 MB (8.8 MB of it the menu music WAV).
Renderer libraries are devDependencies bundled by Vite, so only `steamworks.js` ships as a node
module (macOS binaries excluded) and only the `en-US` locale is packaged.

## Automated shell checks that pass

- `npm run test:shell`: sandboxed renderer (`require` and `process` undefined), `app:` protocol,
  `window.igPlatform` keys exactly equal to `BRIDGE_ALLOWLIST`, atomic save round trip through main.
- `npm run build:desktop`: Windows and Linux `dir` targets matching `steam/depot_build_*.vdf`.

## To finish G0 (developer)

1. Put the real App ID in `Client/steam/steam.json` and `steam/app_build.vdf` (+ depot ids).
2. Run the backend with the real publisher key; `npm run desktop` with Steam running; check criteria 1–4 on Windows.
3. `npm run build:desktop` + `npm run steam:upload` to a beta branch; repeat 1–6 on the Deck in Game Mode.
4. Leave the window minimized for an hour (criterion 5) on both platforms.
5. Record results here. If 3 or 4 fail, reopen AD-3/AD-13 (fork with `GameOverlayActivated`, or another shell).
