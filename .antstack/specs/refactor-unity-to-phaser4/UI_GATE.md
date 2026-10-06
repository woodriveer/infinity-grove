# UI Technology Gate (RFR-48)

**Date:** 2026-10-06 · **Screen:** Roster spike (`?scene=roster&save=full-squad-plus-bench`)
**Approach measured:** hybrid — Preact DOM menus over the Phaser canvas (ARCHITECTURE AD-15 default).
**How:** `npm run test:e2e` → `tests/e2e/ui-gate.spec.ts`, Chromium (Playwright), test build,
manual clock; raw numbers in `Client/artifacts/ui-gate.json`.

| # | Criterion | Threshold | Measured | Result |
|---|---|---|---|---|
| 1 | Gamepad-only focus walk reaches the interactive nodes in `describe()` | 100% | 13 / 13 (0 missed) | **pass** |
| 2 | Scripted gamepad navigations without failure (focus lost, stuck, or on a node not in `describe()`) | 200 with 0 failures | 200, 0 failures | **pass** |
| 3 | Visible focus updates after the input (focus-ring class painted), p95 | < 100 ms | p50 57.6 ms, p95 63.6 ms, max 65.5 ms (120 samples) | **pass** |
| 4 | Steam overlay opened/closed 10× on a Steam Deck: input resumes within 1 s, no input leaks | on Deck | **not run** (no Deck; and upstream steamworks.js has no overlay-activated callback, see SPIKE_G0.md) | **open** |
| 5 | `describe()` covers every visible element and action | full coverage | 28 described = 28 rendered, 0 undescribed, 0 orphan text | **pass** |

Criterion 3's numbers include waiting for the next animation frame in a headless browser, so
they are an upper bound on the real input-to-paint latency.

## Decision

**Hybrid stays the menu technology, provisionally.** Criteria 1, 2, 3 and 5 pass. Criterion 4
can only be measured on a Steam Deck with the real shell, and it has a known gap: input
suspension during the overlay depends on a `GameOverlayActivated` callback that upstream
steamworks.js lacks. If criterion 4 fails on the Deck, RFR-48 says menus move to Phaser behind
the same `ScreenController`s; `describe()` stays the testing seam either way, so no test changes.

Other menu screens were built after this record, following the hybrid approach. The same
gamepad-only reachability check (criterion 1) runs for every parity screen in CI
(`RFR-43: every node on <screen> is reachable by gamepad alone`).

## Found by the gate

Criterion 5 caught a real defect before it shipped: the DOM view subscribed to UI changes after
paint, so a screen change made before that (a boot-URL `goto`) left the previous screen on
screen. Fixed by subscribing in a layout effect and re-rendering once on subscribe.
