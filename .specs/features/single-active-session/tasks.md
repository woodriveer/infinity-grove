# Single Active Session Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/single-active-session/design.md`
**Status**: Approved (decided in heartbeat, 2026-10-08)

Heartbeat runs execute one task per run, in order (CLAUDE.md, Heartbeat). Every task keeps its gate green on its own.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines and spec - confirm before Execute. Guidelines found: `CLAUDE.md` (Tests are mandatory, Layer rules), `Client/package.json` (`verify`), CI (`dotnet test`, openapi diff).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Backend domain + application | unit (xUnit) | Every new rule including rejection paths | `Backend/tests/InfinityGrove.Backend.Tests/**/*Tests.cs` | `dotnet test Backend/InfinityGrove.Backend.sln` |
| Backend API wiring, EF migration | none (build gate; wiring covered by sync-e2e) | Builds; migration applies in the sync-e2e compose | - | `dotnet build Backend/InfinityGrove.Backend.sln` |
| Client services (`src/services/**`) | unit | Each command/path incl. refusal and offline | `Client/tests/unit/*.test.ts` | `npm test` |
| Client platform + desktop bridge | unit + shell | Port impls; exact bridge allowlist | `Client/tests/unit`, `Client/tests/shell` | `npm test`, `npm run test:shell` |
| Client presentation | e2e | Nodes in `describe()`, gamepad reachability, focus, happy + offline edge | `Client/tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Two-device flow | sync-e2e | The RFR-29 scenario loses zero events | `Client/tests/sync-e2e/sync.e2e.test.ts` | `IG_SYNC_E2E_BACKEND=... npm run test:sync-e2e` (Docker; written, not run in heartbeat) |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Backend | Backend-only tasks | `dotnet build Backend/InfinityGrove.Backend.sln && dotnet test Backend/InfinityGrove.Backend.sln` |
| Quick | Client services tasks | `npm run typecheck && npm run lint && npm test` (in `Client/`) |
| Full | Presentation, bridge or generated files | `npm run verify` (in `Client/`) |

---

## Execution Plan

```
Phase 1 (backend):  T1 → T2 → T3 → T4
Phase 2 (client):   T5 → T6 → T7 → T8 → T9
Phase 3 (modal):    T10 → T11
```

---

## Task Breakdown

### T1: Account session id

**What**: `Account.SessionId` + `StartSession(now)` (replaces `RecordLogin`; `CreateForSteamId` starts a session), EF mapping and migration `AddAccountSessionId` (existing rows get a generated id).
**Where**: `Backend/src/InfinityGrove.Backend.Domain/Accounts/Account.cs`, `Backend/src/InfinityGrove.Backend.Infrastructure/Persistence/**`
**Depends on**: None
**Requirement**: SESSION-01

**Done when**:
- [x] xUnit: new account has a non-empty id; `StartSession` changes it and `LastLoginAtUtc`; two calls give two ids
- [x] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): account session id`

---

### T2: Token carries the session

**What**: `SteamAuthenticationService` calls `StartSession` for new and existing accounts; `JwtSessionTokenService` adds claim `sid`.
**Where**: `Backend/.../Application/Auth/SteamAuthenticationService.cs`, `Backend/.../Infrastructure/Auth/JwtSessionTokenService.cs`
**Depends on**: T1
**Requirement**: SESSION-01 (AC 1), SESSION-04

**Done when**:
- [x] xUnit (fake verifier/repository): a login returns a token whose `sid` equals the account's session; a second login yields a different `sid` and the first token's `sid` no longer matches
- [x] Failed ticket changes no session
- [x] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): session id in the access token`

---

### T3: Reject replaced sessions

**What**: `ISessionValidator.IsCurrentAsync` (Application, over `IAccountRepository`), JwtBearer `OnTokenValidated`/`OnChallenge` in `Program.cs`: mismatching `sid` -> 401 problem `type: "session-replaced"`; missing `sid` or expired token stays a plain 401.
**Where**: `Backend/.../Application/Auth/SessionValidator.cs`, `Backend/.../Api/Program.cs`
**Depends on**: T2
**Requirement**: SESSION-01 (AC 2)

**Done when**:
- [x] xUnit: validator accepts the current id, rejects an old id, rejects an unknown account
- [x] Program wiring builds; behavior verified by T10's sync-e2e (documented in the task note)
- [x] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): answer replaced sessions with 401 session-replaced`

---

### T4: Stale unknown events are rejected

**What**: In `PlayerEventIngestionService`, an event with sequence `<= LastAppliedSequence` and an unknown `clientEventId` returns `Rejected` with `EventRejections.StaleSequence` = "Stale sequence; resend after login."; nothing persisted, cursor unchanged.
**Where**: `Backend/.../Application/Events/PlayerEventIngestionService.cs`
**Depends on**: T1
**Requirement**: SESSION-03 (AC 2)

**Done when**:
- [x] xUnit: stale unknown -> Rejected with the exact reason, no row added, `LastAppliedSequence` unchanged; the same `clientEventId` renumbered above the cursor is then Accepted; a known id still returns its prior verdict; any existing test that expected the silent no-op is rewritten, not deleted
- [x] Backend gate passes

**Tests**: unit
**Gate**: backend
**Commit**: `feat(backend): reject stale unknown events instead of dropping them`

---

### T5: Rebase pending events

**What**: `PlayerEventLog.rebase(log, cursor)`; `SaveSyncService.applyCanonical` calls it; `flush()` keeps events rejected with `STALE_SEQUENCE_REASON` pending (no correction notice) and lets `applyCanonical` rebase them.
**Where**: `Client/src/services/events/PlayerEventLog.ts`, `Client/src/services/sync/SaveSyncService.ts`
**Depends on**: T4
**Requirement**: SESSION-03 (AC 1, 3)

**Done when**:
- [x] Unit: rebase is a no-op when pending are above the cursor; renumbers consecutively from `cursor + 1` in order, keeps `clientEventId`s, sets `nextSequenceNumber`
- [x] Unit (fake BackendApi): login with pending events at sequence <= server cursor sends them renumbered; a stale rejection leaves the event pending, no notice, and the next sync resends it renumbered; a game-rule rejection still notifies and drops
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(sync): rebase pending events above the server cursor`

---

### T6: Detect session-replaced in the API client

**What**: `BackendApi.sessionReplaced`; `BackendApiClient.call` parses a 401 body (`type === 'session-replaced'`); `authenticateWithSteam` success clears it; `NoBackend` returns false.
**Where**: `Client/src/services/backend/BackendApi.ts`, `BackendApiClient.ts`, `NoBackend.ts`
**Depends on**: None
**Requirement**: SESSION-02 (AC 3 transport)

**Done when**:
- [ ] Unit over a fake `HttpPort`: typed 401 sets the flag and drops the token; plain 401 drops the token only; a later successful login clears it; unparsable body is treated as plain
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(sync): detect replaced sessions in the backend client`

---

### T7: Replaced state, Play here, Quit

**What**: `GameState.sync.sessionReplaced`; `SaveSyncService` sets it after calls, gates `connect`/`syncNow` (no authenticate, no flush, still persists), adds `playHere()` and `quitGame()`; `AppLifecycle` port in `services/ports.ts` (+ `platform/node` fake); `TickDriver.advance` does nothing while replaced; wiring in `compose`.
**Where**: `Client/src/services/sync/SaveSyncService.ts`, `Client/src/services/ports.ts`, `Client/src/services/state/types.ts`, `Client/src/services/tick/TickDriver.ts`, `Client/src/app/compose.ts`, `Client/src/platform/node/`
**Depends on**: T5, T6
**Requirement**: SESSION-02 (AC 3-5), SESSION-04

**Done when**:
- [ ] Unit (fake BackendApi): a typed 401 on flush sets the flag; further `syncNow` calls do not authenticate; `playHere` authenticates, clears the flag, pulls state, rebases and flushes; offline `playHere` keeps the flag; `quitGame` persists then calls `AppLifecycle.quit`; `TickDriver` does not step while replaced and resumes after
- [ ] Offline edge: no flag set until a call actually returns the typed 401
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(sync): pause on session-replaced; Play here and Quit`

---

### T8: Quit through the shell

**What**: `platform/electron` and `platform/browser` `AppLifecycle` implementations; bridge `app.quit` + IPC `ig:app:quit` handled in `desktop/main` (`app.quit()`); allowlist and shell smoke test updated.
**Where**: `Client/desktop/bridge.ts`, `Client/desktop/main/main.ts`, `Client/desktop/preload*`, `Client/src/platform/electron/`, `Client/src/platform/browser/`, `Client/tests/shell/`
**Depends on**: T7
**Requirement**: SESSION-02 (AC 5)

**Done when**:
- [ ] Unit: each impl calls its mechanism (bridge mock / `window.close` spy)
- [ ] `npm run test:shell` passes with the exact allowlist including `app.quit`
- [ ] Full gate passes

**Tests**: unit + shell
**Gate**: full
**Commit**: `feat(shell): quit request from the renderer`

---

### T9: Dev hook to simulate a takeover

**What**: dev/test-only `__ig.sessionReplaced()` that makes the fake backend answer the typed 401 on the next sync, so e2e can drive the modal without a server (`app/dev-hooks.ts`, test `BackendApi` double in `platform/node` or dev module).
**Where**: `Client/src/app/dev-hooks.ts`, `Client/tests/e2e/helpers.ts`
**Depends on**: T7
**Requirement**: SESSION-02 (test seam)

**Done when**:
- [ ] Unit: the double returns the typed 401 once armed and recovers after `playHere`
- [ ] Full gate passes (hook absent from the production bundle, as with the other dev hooks)

**Tests**: unit
**Gate**: full
**Commit**: `test(sync): dev hook for a replaced session`

---

### T10: Session-replaced modal

**What**: `SessionReplacedModal` overlay with nodes `session.quit` (initial focus) and `session.playHere`, gamepad reachable, focus trapped; callbacks to `sync.quitGame` / `sync.playHere`; scenario `scenarios/p16-session-replaced.json` if the sim can drive the double, otherwise covered by e2e.
**Where**: `Client/src/presentation/ui/`, `Client/tests/e2e/session-replaced.spec.ts`
**Depends on**: T8, T9
**Requirement**: SESSION-02 (AC 3-5)

**Done when**:
- [ ] e2e: after `__ig.sessionReplaced()` + `advance` past the sync interval the modal appears, focus is on `session.quit`, combat state does not change while open; gamepad right + A on Play here closes it and combat resumes; Quit calls the lifecycle port (recorded by the node double)
- [ ] Offline edge e2e: no modal before the first failing sync
- [ ] Full gate passes (`verify` red only for the known ui-gate criterion 3)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): session-replaced modal`

---

### T11: Two-device sync-e2e and close B7

**What**: Rewrite the RFR-29 two-device scenario in `sync.e2e.test.ts` without the workaround: device A and B both log in, A gets `session-replaced`, A "Play here", B gets it; every event is applied or rejected by game rules, none dropped. `PORT_MAP.md` B7 marked closed; spec traceability set to Done; STATE handoff updated.
**Where**: `Client/tests/sync-e2e/sync.e2e.test.ts`, `Client/PORT_MAP.md`, spec
**Depends on**: T10
**Requirement**: SESSION-01..04

**Done when**:
- [ ] Test compiles and typechecks; skipped without `IG_SYNC_E2E_BACKEND` as today; runs only with the Docker backend (recorded as pending for the developer)
- [ ] Full + Backend gates pass

**Tests**: sync-e2e
**Gate**: full
**Commit**: `test(sync): two-device scenario without the B7 workaround`
