# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Do not gate on wall-clock performance budgets in the unit suite; assert behavior and track timing in a bench or soak run
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: stage-combat
- evidence: Client/tests/unit/combatJump.test.ts:129 (tests)
- last seen: 2026-10-07T17:39:42Z

### L-002 - Edge cases that depend on a not-yet-built reward path need a stated observable outcome or an explicit deferral to the feature that builds it
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `specs` · harmful: 0
- features: stage-combat
- evidence: spec.md Edge Cases: BossDefeated offline queue (specs)
- last seen: 2026-10-07T17:39:43Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
