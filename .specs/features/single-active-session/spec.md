# Single Active Session Specification

## Problem Statement

Two devices on one account both number their events from the same server cursor, so the
backend accepts the second device's events as stale no-ops and silently drops them (PORT_MAP
B7, found by the RFR-29 sync-e2e run). The developer's rule: an account plays on one device at
a time. Logging in on another device disconnects the first; credentials may stay saved, but the
game never runs in two places at once (AD-006).

## Goals

- [ ] At most one device holds a live session per account; a new login ends the previous one.
- [ ] No event is lost when a device takes over or comes back after being disconnected.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Account linking or multiple Steam accounts | Steam identity is the account (parent AD-5) |
| Preventing offline play on a disconnected device | Not enforceable without a connection; handled by rebasing events on next login |
| Server-side fusion and other AD-001 features | Their own specs |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Session ownership | Each successful `POST /api/v1/auth/steam` gives the account a new session id; the token carries it; older session ids become invalid immediately | Developer: logging in elsewhere disconnects the other device | y |
| Rejecting an old session | Requests with a replaced session return HTTP 401 with problem type `session-replaced` | Distinguishes a takeover from an expired token | n |
| Saved credentials | The client keeps its Steam identity and local save; a disconnected device can log in again, which takes the session back | Developer: credentials may stay saved | y |
| Disconnected device UX | Combat pauses and a modal says "Infinity Grove was opened on another device." with "Play here" (logs in again, disconnecting the other device) and "Quit"; focus on Quit | Developer: the game must not run in two places | n |
| Unsynced events on takeover | On every login the client renumbers its pending events above the server's `lastAppliedSequence` before sending them | Stops B7 even when a device played offline while another was online | n |
| Stale unknown events (backend) | The backend rejects an event whose sequence is at or below its cursor and whose `clientEventId` it has never seen, with reason "Stale sequence; resend after login." instead of accepting it silently | Defense in depth for B7 | n |
| Offline play | Still allowed (RFR-30); it simply has no session until the next login | Idle game must work offline | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: One device at a time ⭐ MVP

**User Story**: As a player, I want logging in on a new device to end the old session so that my progress never splits between two machines.

**Why P1**: Fixes B7's root cause per the developer's rule.

**Acceptance Criteria**:

1. WHEN an account logs in THEN the backend SHALL invalidate every previous session of that account.
2. IF a request carries a replaced session THEN the backend SHALL answer HTTP 401 with problem type `session-replaced`.
3. WHEN the client receives `session-replaced` THEN the system SHALL stop combat and syncing and show the "opened on another device" modal with focus on "Quit".
4. WHEN the player chooses "Play here" THEN the system SHALL log in again and resume play and syncing.
5. WHEN the player chooses "Quit" THEN the system SHALL save locally and close the game.

**Independent Test**: sync-e2e: device A logs in, device B logs in, A's next sync gets `session-replaced`; A's "Play here" makes B get it.

---

### P1: No lost events ⭐ MVP

**User Story**: As a player, I want progress made on a device before it was disconnected to still count so that nothing I did vanishes.

**Why P1**: B7 lost events silently.

**Acceptance Criteria**:

1. WHEN the client logs in and has pending events THEN the system SHALL renumber them consecutively from the server's `lastAppliedSequence + 1`, preserving their order, before sending them.
2. IF the backend receives an event with a sequence at or below its cursor and an unknown `clientEventId` THEN the backend SHALL reject it with reason "Stale sequence; resend after login."
3. WHEN the client receives that rejection THEN the system SHALL keep the event pending and resend it after the next login instead of showing a correction.

**Independent Test**: the RFR-29 two-device scenario without the workaround in `tests/sync-e2e`: every event from both devices is either applied or rejected by game rules, none silently dropped.

---

## Edge Cases

- IF both devices log in within the same second THEN the backend SHALL keep only the later login's session.
- IF the disconnected device is offline when the takeover happens THEN the system SHALL show the modal on its next sync attempt.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SESSION-01 | P1: One device at a time (AC 1–2) | - | Pending |
| SESSION-02 | P1: One device at a time (AC 3–5) | - | Pending |
| SESSION-03 | P1: No lost events | - | Pending |
| SESSION-04 | Edge cases | - | Pending |

**Coverage:** 4 total, 0 mapped to tasks, 4 unmapped ⚠️

---

## Success Criteria

- [ ] The two-device sync-e2e scenario loses zero events.
- [ ] A second login always disconnects the first device within one sync interval.
