# Equipment Enchanting Specification

## Problem Statement

Gold has almost no use and items cannot grow stronger. The developer wants a Lineage-style
enchant: buy an enchant scroll at a fixed price, try to raise an item's level; the higher the
level the lower the chance, and a failure drops the item back to +5. Enchant levels raise the
item's existing affixes, so it becomes the main long-term gold sink (AD-003). Rolls happen on
the server (AD-001).

## Goals

- [ ] Any hero equipment item can be enchanted from +0 to +15 with scrolls.
- [ ] Success chances, the failure rule and the affix growth are exact, visible before committing, and server-decided.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Selling scrolls / where scrolls are bought | rotating-shop |
| Affix re-roll (crafting) | Existing feature (AD-22); unchanged |
| Item destruction or protection scrolls | Not requested; failure only resets to +5 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Enchant scroll | One consumable item type, fixed gold price (rotating-shop), one scroll per attempt | Developer | y |
| Level range | +0 to +15 | Developer | y |
| Success table (current → next) | +0…+4 → next: 100%; +5→+6 and +6→+7: 70%; +7→+8, +8→+9, +9→+10: 50%; +10→+11 … +14→+15: 5% | Developer chose fixed bands | y |
| Failure | Item level becomes +5; item is never destroyed | Developer | y |
| Affix growth | Each enchant level multiplies every affix value the item rolled by (1 + 0.10 × level), e.g. Crit chance 12% at +15 = 30%; the 10% step lives in economy-tuning content | "Upgrades raise the item's affix values" | n |
| Base stat | Items keep their existing stats; enchant scales affixes only (crit, attack%, defense, speed, precision) | Developer described affix growth | n |
| Hero base affix stats | None: a hero's crit chance, crit damage, speed etc. are the sum of its items' affixes | Developer: "multiplies the affix, but no base" | y |
| Crit chance cap | Total crit chance is capped at 100%; at 100% every attack is a critical hit. Other affixes (e.g. crit damage 200%) are uncapped | Developer | y |
| Where it runs | Backend endpoint `POST /api/v1/items/{id}/enchant` consumes one scroll, rolls, persists, returns the new level and affixes | AD-001 | y |
| Equipped items | Can be enchanted while equipped | Avoids pointless unequip steps | n |
| Display | Enchant panel shows: current level, next level, success chance, current and next affix values, scrolls owned, and the failure rule text | FR-22-style "show before committing" | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Enchant an item ⭐ MVP

**User Story**: As a player, I want to spend a scroll to try to raise an item's level so that my heroes get stronger.

**Why P1**: The core gold sink and item progression.

**Acceptance Criteria**:

1. WHEN the player opens an item's Enchant panel THEN the system SHALL show its level, next level, success chance, current and next value of every affix, and scrolls owned.
2. WHILE the player owns no scroll the system SHALL disable "Enchant" with the label "Enchant — no scrolls".
3. WHILE an item is at +15 the system SHALL disable "Enchant" with the label "Enchant — max level (+15)".
4. WHEN the player confirms an enchant THEN the system SHALL send one enchant request to the backend and show the result it returns.
5. WHEN the backend reports success THEN the system SHALL show the new level and affix values.
6. WHEN the backend reports failure THEN the system SHALL show "Enchant failed — item returned to +5" and the item at +5.
7. WHILE the attempt would go above +5 the confirm dialog SHALL state "If it fails, this item returns to +5." with focus on Cancel.

**Independent Test**: e2e with a fixture holding scrolls and a stubbed backend result; describe() asserts labels and values for success and failure.

---

### P1: Server decides the roll ⭐ MVP

**User Story**: As the operator, I want enchant results decided on the server so that no client can force a success.

**Why P1**: AD-001.

**Acceptance Criteria**:

1. WHEN the backend receives an enchant request for an item the account owns and a scroll is available THEN the backend SHALL consume exactly one scroll.
2. WHEN the backend rolls an enchant from level L THEN the backend SHALL succeed with the table probability for L.
3. WHEN an enchant from L succeeds THEN the backend SHALL set the item level to L + 1.
4. IF an enchant from L ≥ 5 fails THEN the backend SHALL set the item level to 5.
5. IF the account has no scroll THEN the backend SHALL reject with "No enchant scroll." and change nothing.
6. IF the item is at +15 or not owned by the account THEN the backend SHALL reject and change nothing.
7. WHEN the same request id is replayed THEN the backend SHALL return the original result without consuming another scroll.

**Independent Test**: backend unit tests with a seeded RNG; statistical test (100 000 attempts per band within ±1 point); VectorGen vectors for the affix multiplier.

---

### P2: Enchant level drives power

**User Story**: As a player, I want enchanted items to raise my heroes' combat power so that enchanting matters in fights.

**Why P2**: Connects to stage-combat and AD-003.

**Acceptance Criteria**:

1. The system SHALL compute each affix value as the item's rolled value × (1 + step × level), with step from content (default 0.10).
2. The system SHALL compute a hero's total for each affix as the sum of its equipped items' affix values, with no hero base value.
3. The system SHALL cap a hero's total crit chance at 100%.
4. WHILE a hero's total crit chance is 100% the system SHALL make every attack of that hero a critical hit.
5. WHEN an equipped item's level changes THEN the system SHALL update the hero's power and DPS on the next combat step.

**Independent Test**: unit test on the formula; sim: enchanting an equipped weapon raises squad DPS by the expected factor.

---

## Edge Cases

- IF the connection fails during an enchant THEN the system SHALL show "Enchanting needs a connection" and keep the scroll and item unchanged locally until the backend answers.
- IF an item is sold or equipped elsewhere while a request is pending THEN the system SHALL disable actions on that item until the response arrives.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ENCH-01 | P1: Enchant an item (AC 1–3, 7) | - | Pending |
| ENCH-02 | P1: Enchant an item (AC 4–6) | - | Pending |
| ENCH-03 | P1: Server decides the roll (AC 1–4) | - | Pending |
| ENCH-04 | P1: Server decides the roll (AC 5–7) | - | Pending |
| ENCH-05 | P2: Enchant level drives power | - | Pending |
| ENCH-06 | Edge cases | - | Pending |

**Coverage:** 6 total, 0 mapped to tasks, 6 unmapped ⚠️

---

## Success Criteria

- [ ] Measured success rates over 100 000 backend attempts per band are within ±1 point of the table.
- [ ] A failed attempt above +5 never leaves an item at anything but +5.
- [ ] No enchant outcome is computed in the client (lint rule like AD-22).
