# Validation: Single Active Session - PASS

**Date**: 2026-10-08
**Spec**: `.specs/features/single-active-session/spec.md`
**Diff range**: `7cb7ed7..4a7942d` (feature commits 1be0438, cc17259, f0b6a52, bb5a275, 4e7c4cc, cfb59b6, 1ef1ff2, 3d31c97, 75a93c1, b972f34, 4a7942d)
**Verifier**: independent sub-agent (author != verifier), heartbeat run

**Verdict**: PASS (no blocker; two boundary-test gaps and one untested wiring layer, all listed below)

The working tree has unrelated uncommitted floating-damage changes (`dev-hooks.ts`, `WorldScene.ts`, `StageCombatService.ts`, `SaveSyncService.ts`, `tests/e2e/helpers.ts`, `menu-and-combat.spec.ts`). They were not touched. `git status --porcelain` is byte-identical before and after this run. Note that `SaveSyncService.ts` and `dev-hooks.ts` are both feature files and carry unrelated WIP, so the gates below ran against the feature plus that WIP (all green). The mutation sensor ran on a clean checkout of `4a7942d`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | Done | `1be0438`; `AccountSessionTests.cs` |
| T2 | Done | `cc17259`; `SessionTokenTests.cs` |
| T3 | Done | `f0b6a52`; `SessionValidatorTests.cs`; `Program.cs` wiring has no automated test (task note says sync-e2e) |
| T4 | Done | `bb5a275`; `StaleSequenceIngestionTests.cs` |
| T5 | Done | `4e7c4cc`; `services.test.ts` |
| T6 | Done | `cfb59b6`; `backend-session-replaced.test.ts` |
| T7 | Done | `1ef1ff2`; `session-replaced-sync.test.ts` |
| T8 | Done | `3d31c97`; `app-lifecycle.test.ts`; bridge allowlist change. `test:shell` not re-run here |
| T9 | Done | `75a93c1`; `dev-backend.test.ts` |
| T10 | Done | `b972f34`; `session-replaced.spec.ts`. No `p16-session-replaced.json` scenario: allowed by the task ("otherwise covered by e2e") |
| T11 | Done | `4a7942d`; sync-e2e rewritten, compiles, unrun (needs Docker) |

All 11 `Done when` boxes are ticked, no task is blocked. Bookkeeping: spec traceability says Done for all four requirements (correct).

---

## Spec-Anchored Acceptance Criteria

| Req | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| SESSION-01 AC1 | Login invalidates every previous session | `Backend/tests/.../Accounts/AccountSessionTests.cs:11` (non-empty id), `:17` (StartSession changes id and login time), `:30` (two calls, two ids); `Auth/SessionTokenTests.cs:26` (second login gets new `sid`, first token's `sid` no longer equals the account's); `:40`, `:56` (failed or empty ticket changes no session); `Auth/SessionValidatorTests.cs:19` (old id rejected, new accepted) | PASS |
| SESSION-01 AC1 (token) | Token carries the session | `SessionTokenTests.cs:14` (`sid` equals `account.SessionId`) | PASS |
| SESSION-01 AC2 | Replaced session gets HTTP 401 `session-replaced` | Validator logic: `SessionValidatorTests.cs:11,19,31` (current, replaced, unknown account). The HTTP mapping (`Api/Program.cs` `OnTokenValidated`/`OnChallenge`: status 401, `application/problem+json`, `type = "session-replaced"`, missing `sid` stays plain 401) has **no automated test**; the only coverage is the unrun sync-e2e (`sync.e2e.test.ts` asserts `sessionReplaced` on A) | PASS (logic) / GAP (wiring, mutants B6 and B7 survived) |
| SESSION-02 AC3 (transport) | Client detects `session-replaced` | `Client/tests/unit/backend-session-replaced.test.ts:23` (typed 401 sets flag, drops token), `:33` (plain 401), `:41` (unparsable or other typed body is plain), `:51` (login clears), `:60`, `:69` (NoBackend) | PASS |
| SESSION-02 AC3 | Stop combat and syncing; modal with focus on Quit | `session-replaced-sync.test.ts:55` (flag only after a typed 401), `:70` (no authenticate or flush, still persists), `:84` (TickDriver does not step, resumes); `Client/tests/e2e/session-replaced.spec.ts:15` (modal appears, `focused === 'session.quit'`, label `Play here`, combat state equal after `advance(10_000)`) | PASS |
| SESSION-02 AC4 | "Play here" logs in again, resumes play and syncing | `session-replaced-sync.test.ts:98` (authenticates, clears flag, resends pending), `:113` (offline keeps flag); e2e `:15` (gamepad Right then A, modal gone, kills increase after `advance`); `dev-backend.test.ts:26` (double recovers after `playHere`) | PASS |
| SESSION-02 AC5 | "Quit" saves locally and closes the game | `session-replaced-sync.test.ts:123` (persist, then lifecycle quit); `app-lifecycle.test.ts:8` (bridge), `:14` (`window.close`); e2e `:37` (A on Quit, `window.close` called once). Shell/IPC path (`ig:app:quit` to `app.quit()`) only via `test:shell` allowlist, not re-run here | PASS |
| SESSION-03 AC1 | Pending events renumbered from `lastAppliedSequence + 1`, order kept, before sending | `Client/tests/unit/services.test.ts` "PlayerEventLog.rebase is a no-op above the cursor and renumbers in order" (11, 12, nextSequenceNumber 13, ids kept); "a login with pending events at or below the server cursor sends them renumbered" (sent sequences `51+i`, same ids, none stale-rejected, pending empty) | PASS |
| SESSION-03 AC2 | Backend rejects unknown id at or below cursor with the exact reason | `StaleSequenceIngestionTests.cs:40` (Rejected, exact string "Stale sequence; resend after login.", no row persisted, cursor stays 3); `:55` (same id renumbered above cursor then Accepted); `:68` (known id returns prior verdict). Test uses sequences 2 and 1 against cursor 3 only; the `==` boundary is not exercised (mutant B4 survived) | PASS (boundary gap) |
| SESSION-03 AC3 | Client keeps the stale-rejected event pending, no correction, resends after next login | `services.test.ts` "a stale rejection keeps the event, shows no notice, and the next sync resends it renumbered" (`notices` empty, kept sequence above cursor and different from the old one, pending empty after next sync). Game-rule rejection still notifies: sync-e2e double-spend assertion (unrun) | PASS |
| SESSION-04 edge 1 | Same-second logins keep only the later session | `StartSession` assigns a fresh `Guid` independent of the time (`AccountSessionTests.cs:30` uses distinct timestamps; no test with an identical `nowUtc`, no concurrency test). Correct by construction; DB last-write-wins on concurrent logins is not tested | PASS (by construction, thin) |
| SESSION-04 edge 2 | Offline device shows the modal on its next sync attempt | e2e `session-replaced.spec.ts:8` (replace armed, `advance(40_000)` with no failing call... no modal); `session-replaced-sync.test.ts:55` (flag only on a real typed 401); e2e `:15` (modal after the next sync interval, `advance(61_000)`). The literal "device offline during takeover, then comes online" sequence is not a distinct test; it is the same code path as the 401 on next call | PASS |
| Success criteria | Two-device sync-e2e loses zero events | `Client/tests/sync-e2e/sync.e2e.test.ts` rewritten (A replaced with pending preserved, `playHere`, pending 0, B replaced next). **Not run** (Docker) | UNRUN |
| Traceability | SESSION-01..04 mapped | spec table lists T1-T10 correctly | PASS |

**Status**: 4/4 requirements and 8/8 ACs have evidence; the Program.cs HTTP mapping and the real two-device run have none that executed.

### Gaps (ranked)

1. **HTTP 401 `session-replaced` wiring untested** (SESSION-01 AC2). `Program.cs` `OnTokenValidated`/`OnChallenge` has no unit or integration test; changing the problem `type` string or dropping the missing-`sid` `Fail` passes all 32 backend tests (mutants B6, B7). Only the unrun Docker sync-e2e would catch it. Suggest a `WebApplicationFactory` (or an extracted helper) test.
2. **Stale boundary `==` untested on both sides** (SESSION-03). Backend `<=` to `<` (B4) and client `rebase` `>` to `>=` (C2) both survive: no test has a sequence exactly equal to the cursor. Equality is the realistic case (two devices each at the same cursor, the original B7).
3. **sync-e2e unrun** (needs Docker and the fake-Steam compose). Pending for the developer.
4. `test:shell` not re-run in this validation (bridge allowlist for `app.quit`); T8 recorded it green.

---

## Discrimination Sensor

Mutants applied with `sed` in a temporary git worktree at `4a7942d` (`/tmp/sas-wt`, `Client/node_modules` junctioned), tested with the matching test project or vitest files, each file reverted with `git checkout`, worktree removed afterwards. No stash. The main working tree was never mutated.

| # | File | Mutation | Killed? |
| - | ---- | -------- | ------- |
| B1 | `Application/Auth/SessionValidator.cs` | validator ignores the session id (`account is not null` only) | Killed (1 test) |
| B2 | `Application/Events/PlayerEventIngestionService.cs` | stale unknown event accepted again (old silent behavior) | Killed (2 tests) |
| B3 | `Domain/Accounts/Account.cs` | `StartSession` stops changing `SessionId` | Killed (4 tests) |
| B4 | `PlayerEventIngestionService.cs` | stale check `<=` to `<` | **Survived** (32/32) |
| B5 | `Infrastructure/Auth/JwtSessionTokenService.cs` | `sid` claim is `Guid.Empty` | Killed (2 tests) |
| B6 | `Api/Program.cs` | problem type `session-replaced` to `session_replaced` | **Survived** (32/32; wiring untested) |
| B7 | `Api/Program.cs` | token without `sid` no longer fails | **Survived** (32/32; wiring untested) |
| C1 | `services/events/PlayerEventLog.ts` | rebase numbers from `cursor + i` | Killed (3 tests) |
| C2 | `PlayerEventLog.ts` | rebase guard `>` to `>=` | **Survived** (26/26) |
| C3 | `services/sync/SaveSyncService.ts` | `applyCanonical` does not rebase | Killed (2 tests) |
| C4 | `SaveSyncService.ts` | stale rejection no longer skipped in `flush` (shows correction, drops event) | Killed (1 test) |
| C5 | `presentation/UiController.ts` | modal `initialFocus` on `session.playHere` | Killed (2 e2e tests) |
| C6 | `services/tick/TickDriver.ts` | combat steps while replaced | Killed (1 test) |
| C7 | `services/backend/BackendApiClient.ts` | typed 401 type string never matches | Killed (3 tests) |
| C8 | `SaveSyncService.ts` | successful login does not clear the flag | Killed (2 tests) |
| C9 | `SaveSyncService.ts` | `syncNow` ignores the replaced gate | Killed (1 test) |
| C10 | `SaveSyncService.ts` | `quitGame` does not call `lifecycle.quit` | Killed (1 test) |

**Sensor depth**: standard (backend session, stale rejection, client rebase/applyCanonical, modal focus, tick pause)
**Result**: 14/17 killed. Survivors: B4 and C2 (boundary equality), B6 and B7 (HTTP wiring); B6 and B7 are one gap.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | OK. `SessionValidator` is 18 lines; client changes are small and local. Minor: a stray blank line added in `Program.cs` after `var app = builder.Build();`. |
| Surgical changes | OK. Diff stays in auth, ingestion, sync, ports, modal; `InfinityGrove/` not touched. `RecordLogin` renamed to `StartSession` (one caller). |
| No scope creep | OK. Offline play, account linking, fusion stay out. |
| Matches patterns | OK. Dependency-cruiser: 142 modules, 0 violations; `AppLifecycle` is a new port in `services/ports.ts` implemented in `platform/` (CLAUDE.md rule); `dev-backend.ts` is dev/test-only. Domain stays pure. `UiController` casts `this.models.at(-1) as ScreenModel` (works, slightly loose). |
| Tests on both sides | OK. Backend: 4 new test files for session, token, validator, stale ingestion including rejection paths. Client: unit, e2e, sync-e2e. Shared rule has the exact reason string asserted on both sides, but no VectorGen family was added for it (the string is matched literally; `STALE_SEQUENCE_REASON` duplicated by hand in `PlayerEventLog.ts` and `EventRejections.cs`, no cross-check test). |
| Every test maps to a requirement | OK. |
| Migration | `20261008013127_AddAccountSessionId` present with snapshot; not applied in this validation (needs Postgres; applied only in the sync-e2e compose). |

---

## Gate Check

Run individually with the unrelated dirty changes present.

- **Backend** `dotnet test tests/InfinityGrove.Backend.Tests`: 32 passed, 0 failed
- **typecheck** (app + desktop): pass
- **lint** (ESLint, dependency-cruiser 142 modules / 0 violations, 15 lint-fixture tests): pass
- **npm test** (Vitest): 34 files, 389 passed, 0 failed
- **build:test + e2e `tests/e2e/session-replaced.spec.ts`**: 3/3 passed (modal opens on Quit and pauses combat, Play here by gamepad resumes, Quit closes via lifecycle; offline edge shows no modal)
- **Not run**: `test:sync-e2e` (needs Docker), `test:shell`, full `test:e2e` (known ui-gate criterion 3 and combatJump flake not investigated), `npm run verify`, EF migration against Postgres.

---

## Fix Plans

No blocking fix tasks. Recommended, non-blocking:

1. Add a backend API test (WebApplicationFactory, or extract the challenge writer) for 401 `type: "session-replaced"` and for plain 401 on a missing `sid` (kills B6, B7).
2. Add boundary cases: backend sequence exactly equal to the cursor is rejected as stale; client `rebase` with `first.sequenceNumber === cursor` renumbers (kills B4, C2).
3. Run `test:sync-e2e` once with Docker and `test:shell` before closing B7 for good.
4. Optional: one cross-side check of the stale reason string (shared vector or a test reading both constants).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SESSION-01 | Done | Verified (HTTP mapping covered only by unrun sync-e2e) |
| SESSION-02 | Done | Verified |
| SESSION-03 | Done | Verified (equality boundary untested) |
| SESSION-04 | Done | Verified (same-second by construction) |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 4/4 requirements, 8/8 ACs matched by file:line; 1 wiring gap (Program.cs), 1 boundary gap, sync-e2e unrun
**Sensor**: 14/17 mutations killed (B4, C2, and B6/B7 wiring survive)
**Gate**: Backend 32/32; typecheck, lint clean; Vitest 389/389; session-replaced e2e 3/3

**Issues found**: none blocking.

**Next steps**: add the two test gaps above, then run `test:sync-e2e` with Docker.
