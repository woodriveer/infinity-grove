# Rotating Shop Specification

## Problem Statement

Gold needs places to go and items need a market outside drops. The developer wants an in-game
shop: enchant scrolls always for sale at a fixed price, a rotating random stock of items that
renews on a timer or for gold, and the ability to sell items back for gold. Stock and prices
are generated and validated on the server (AD-001). This shop is not in the game PRD and is
recorded as a game-PRD addition (AD-003).

## Goals

- [ ] Players can buy scrolls and rotating items with gold and sell items for gold.
- [ ] Stock, prices and every transaction are server-authoritative.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Real-money purchases (Summoning Stones) | Monetization area |
| Selling or buying hero cards | Hero cards trade only on the Steam Market (FR-32) |
| Potions in the shop | Developer: potions come only from boss drops |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Permanent offer | Enchant scroll at a fixed price, unlimited quantity | Developer | y |
| Rotating stock size | 6 item offers | Readable on one screen | n |
| Stock content | Templates from the item table of the player's furthest stage band; affixes rolled; level +0 | Matches drop rules (boss-drops) | n |
| Automatic refresh | Every 6 h of real time, aligned to the account's first shop open | Developer chose rotating stock; 6 h fits 2 daily visits | n |
| Paid refresh | Refresh now for a gold price that doubles with each paid refresh until the next automatic refresh | Common pattern; prevents spamming | n |
| Purchase | Each offer can be bought once per stock | Rotating stock is scarce by design | n |
| Sell price | 25% of the item template's shop value, enchant level adds nothing | Avoids enchant arbitrage | n |
| Prices | Defined by economy-tuning content per band | Single tuning source | n |
| Offline | Shop needs a connection; the screen says "The shop needs a connection" | AD-001 | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Buy scrolls and items ⭐ MVP

**User Story**: As a player, I want to buy enchant scrolls and items with gold so that my gold turns into power.

**Why P1**: Scrolls are the only source of enchanting (equipment-enchant).

**Acceptance Criteria**:

1. WHEN the player opens the shop THEN the system SHALL show the scroll offer, the rotating offers with name, slot, affixes and price, and the time until the next refresh.
2. WHEN the player buys an offer THEN the system SHALL send a purchase request and apply the backend's result to gold and inventory.
3. WHILE the player's gold is below an offer's price the system SHALL disable its button with "Buy — need <price> gold".
4. WHEN an offer is bought THEN the system SHALL mark it "Sold" until the next refresh.
5. IF the backend rejects a purchase THEN the system SHALL show its reason and leave gold and inventory as the backend reports them.

**Independent Test**: e2e with a stubbed backend: buy a scroll and an item; describe() shows gold reduced and the offer marked Sold.

---

### P1: Server owns stock and transactions ⭐ MVP

**User Story**: As the operator, I want stock and purchases decided by the server so that no one can buy items that were never offered or pay less.

**Why P1**: AD-001.

**Acceptance Criteria**:

1. WHEN the account's refresh time passes THEN the backend SHALL generate a new stock of 6 offers from the furthest-stage band.
2. WHEN the backend receives a purchase for an offer in the current stock that is unsold and affordable THEN the backend SHALL debit the price and grant the item or scroll.
3. IF the offer is not in the current stock, already sold, or unaffordable THEN the backend SHALL reject with "Offer unavailable." or "Not enough gold." and change nothing.
4. WHEN a purchase request id is replayed THEN the backend SHALL return the original result without charging again.

**Independent Test**: backend unit and integration tests; sync-e2e extension with one rejected purchase.

---

### P2: Paid refresh

**User Story**: As a player, I want to refresh the stock for gold so that I can hunt for a better item now.

**Why P2**: Extra gold sink; optional.

**Acceptance Criteria**:

1. WHEN the player confirms a paid refresh THEN the backend SHALL debit the current refresh price and generate new offers.
2. WHEN a paid refresh succeeds THEN the system SHALL double the next paid refresh price until the next automatic refresh.

**Independent Test**: backend tests for the price progression; e2e refresh flow.

---

### P2: Sell items

**User Story**: As a player, I want to sell items I do not need so that my bag stays useful and I get some gold back.

**Why P2**: Bag management; complements drops.

**Acceptance Criteria**:

1. WHEN the player sells a bag item THEN the backend SHALL remove it and credit 25% of its template's shop value.
2. IF the item is equipped THEN the system SHALL disable "Sell" with "Sell — unequip first".
3. WHEN the player sells an item above +0 THEN the confirm dialog SHALL state "Enchant levels are lost when selling." with focus on Cancel.

**Independent Test**: e2e sell flow; backend credit test.

---

## Edge Cases

- IF the shop is opened offline THEN the system SHALL show "The shop needs a connection" and no offers.
- WHEN a refresh time passes while the shop is open THEN the system SHALL replace the offers and keep focus on the same row index.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SHOP-01 | P1: Buy scrolls and items | - | Pending |
| SHOP-02 | P1: Server owns stock and transactions | - | Pending |
| SHOP-03 | P2: Paid refresh | - | Pending |
| SHOP-04 | P2: Sell items | - | Pending |
| SHOP-05 | Edge cases | - | Pending |

**Coverage:** 5 total, 0 mapped to tasks, 5 unmapped ⚠️

---

## Success Criteria

- [ ] Every purchase, refresh and sale is decided by the backend (no client-side gold or inventory change without a response).
- [ ] A replayed purchase never charges twice.
