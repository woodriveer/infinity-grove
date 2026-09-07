# Infinity Grove — Architecture (v1 / Launch)

## Status

Launch-grade, matching [PRD.md](./PRD.md) v1 scope. Builds on the existing vertical
slice (`InfinityGrove/Assets/Scripts/Game/*`: `CombatManager`, `KrellController`,
`Monster`, `MonsterData`, `Equipment`, `PlayerStats`) — plain `MonoBehaviour` +
`ScriptableObject` + C# events, no DI, no backend, no persistence. This document
specifies the target architecture the PRD's full system (backend authority,
itemization, fusion, Steam Market) requires, and how the existing slice migrates
into it incrementally rather than via a rewrite.

Decisions below reflect explicit choices made with the user during this session:
backend resourced and owned by the team (not solo-unsupported), full server-side
authoritative progress (not just Market-relevant card state), ASP.NET Core +
PostgreSQL backend, AWS as the eventual cloud target (starting local), Facepunch.
Steamworks client-side, and VContainer-based layering for the Unity client.

## Componentes

- Unity Game Client (PC/Steam)
- Backend API Service

## AD-N Decisions

### AD-1 — Unity client adopts VContainer + layered composition, migrated incrementally
- **Decision:** New gameplay code is organized into Data / Domain / Service /
  Presentation layers, wired through a single `LifetimeScope` composition root
  (Bootstrap scene). `MonoBehaviour`s become presentation-only: they read from and
  call injected service interfaces, never hold gameplay state themselves and never
  reference each other directly.
- **Reason:** The PRD adds backend sync, fusion, itemization, and Market state —
  systems that need to be testable and mockable in isolation. The user chose to
  introduce DI now rather than let direct-reference wiring (today's
  `CombatManager`-style `[SerializeField]` links) scale into this surface area.
- **Trade-off:** More interface/DI ceremony than the current quick wiring; a new
  package dependency (`VContainer`) and a composition-root discipline the whole
  team must follow.
- **Impact:** `CombatManager`, `KrellController`, `Monster`, `Equipment` are
  migrated to this pattern as each is touched by a PRD feature (e.g.
  `CombatManager` becomes a `CombatService` + a thin presentation `MonoBehaviour`),
  not rewritten up front. No new gameplay code may use `FindObjectOfType` or a
  hand-rolled singleton to reach another system.

### AD-2 — Backend is ASP.NET Core + PostgreSQL, layered Controllers → Application → Domain → Infrastructure
- **Decision:** The backend is a single ASP.NET Core (.NET 8 LTS) Web API project
  against PostgreSQL via EF Core, layered as Controllers (HTTP) → Application
  (use-case orchestration) → Domain (rules: fusion curves, drop validation, market
  ledger invariants, crafting/affix-roll rules — see AD-15) → Infrastructure (EF
  Core repositories, Steamworks Web API client).
- **Reason:** Sharing C# with the Unity client lets rules that must match exactly
  on both sides (big-number math, fusion cost curves) reuse the same types instead
  of two independent reimplementations drifting apart. PostgreSQL's transactions
  are required for atomic multi-row operations like fusion (consume N duplicates
  as one commit).
- **Trade-off:** A relational schema needs explicit migrations as itemization
  affixes and card definitions evolve, vs. a schemaless NoSQL store's flexibility.
- **Impact:** All server-authoritative state (account, roster, star tiers, gear,
  crafted affixes, gold, stage progress, Market ledger) lives in Postgres tables
  owned exclusively by this service. The Unity client never writes authoritative
  state directly to any datastore.

### AD-3 — Local Docker Compose now, AWS ECS Fargate + RDS at pre-launch
- **Decision:** Local development runs the API + PostgreSQL via `docker-compose`.
  The production target is AWS: ECS Fargate for the API container(s), RDS for
  PostgreSQL, Secrets Manager for the Steamworks publisher key and DB credentials,
  behind an ALB. AWS CDK is the IaC tool for this environment; it remains a
  pre-launch deliverable, not a day-one one.
- **Reason:** User confirmed AWS as the target but wants to start locally; Fargate
  fits a small team without dedicated infra/DevOps headcount better than
  self-managed EC2 or the cold-start/state constraints of Lambda for a
  stateful, EF-Core-migrated API.
- **Trade-off:** Containerizing from day one adds Docker as a local dev dependency;
  in exchange it removes "works on my machine" drift between local and the eventual
  AWS deploy.
- **Impact:** `docker-compose.yml` (API + Postgres) is the canonical local dev
  environment from the first line of backend code. IaC and the actual AWS account
  setup are explicitly deferred to a pre-launch infra pass (see Open Questions).

### AD-4 — Facepunch.Steamworks client-side; all inventory-mutating Steamworks calls are backend-only
- **Decision:** The Unity client uses Facepunch.Steamworks for Steam Cloud saves,
  obtaining Auth Session Tickets, and read-only Inventory queries. Any call that
  *mutates* Steam Inventory (grant, consume, exchange items) happens only on the
  backend via the Steamworks Web API using the publisher key — the client never
  makes a mutating Inventory call directly. Real-money purchase authorization
  (Summoning Stones) follows this same backend-only rule; see AD-12 for that flow.
- **Reason:** User chose Facepunch.Steamworks (actively maintained, modern C#
  API). NFR-4/FR-45 require server authority over anything Market-relevant, so a
  client-side mutating call would be a direct route around that authority.
- **Trade-off:** Every inventory-relevant action (fusion, card grant from a drop)
  now costs a network round-trip to the backend instead of a local Steamworks SDK
  call, and the backend must securely hold and never leak the publisher key.
- **Impact:** Fusion, drop-to-card grants, and any future item mint/consume path
  are backend-orchestrated: client requests the action → backend validates →
  backend mutates its own ledger and calls Steam Inventory Service → backend
  returns the canonical result → client updates its local view.

### AD-5 — Steam is the sole identity provider
- **Decision:** The client obtains a Steam Auth Session Ticket (Facepunch.
  Steamworks) and sends it to the backend on startup; the backend verifies it
  against the Steamworks Web API (`AuthenticateUserTicket`) and maps it to an
  account keyed by SteamID64, creating one on first sight.
- **Reason:** V1 is PC/Steam-exclusive (NFR-6) — a separate email/password account
  system would be unused scope.
- **Trade-off:** No login path exists outside Steam; the game requires at least an
  initial online Steam session to mint a ticket (Steam's own offline-ticket
  behavior applies afterward per Steamworks semantics).
- **Impact:** The backend's `Account` table is keyed by SteamID64. No credential
  storage, password reset, or email-verification code exists anywhere in the
  system.

### AD-6 — Full server-authoritative progress via batched event log, not lockstep
- **Decision:** All persisted progress (gold, star tiers, roster, gear, crafted
  affixes, stage progress) is authoritative on the backend, per the user's choice
  of a full server-side player-account model. The client stays fully playable
  offline and locally responsive (instant tap feedback, FR-9; offline gold accrual
  display, FR-41) by recording every state-changing action as a discrete event
  (stage cleared, fusion performed, item crafted, gold earned) in an append-only
  local log, which syncs to the backend opportunistically — periodically while
  online, and on pause/quit. The backend replays and validates each event against
  game rules and returns the canonical state; the client reconciles silently
  unless an event is rejected, in which case it corrects the client and surfaces
  why.
- **Reason:** A literal server round-trip per tap or per idle tick is infeasible
  for an idle clicker's UX and directly conflicts with FR-41's offline-accrual
  requirement; a batched, validated event log is how "full server authority" and
  "playable offline, responsive taps" coexist.
- **Trade-off:** A window exists where the client's local display is briefly ahead
  of confirmed server state; accepted because it is corrected on the next sync,
  not silently trusted forever, and the correction path is a first-class UX case
  (see EXPERIENCE.md state patterns), not an edge case bolted on later.
- **Impact:** Every gameplay system that changes persisted state must express the
  change as a discrete, independently validatable event — never as a raw
  "set gold to X" diff. This event shape is also what gives FR-33/FR-45's
  anti-tamper audit trail its data.

### AD-7 — BreakInfinity.cs big-number representation, shared client/server
- **Decision:** `BreakInfinity.cs` is the big-number type for all currency and
  cost math (FR-25/NFR-1), used identically on client and server. The backend
  stores canonical values in Postgres as a `(mantissa double, exponent int)` pair,
  not a native numeric column.
- **Reason:** It is the de facto standard library for idle-game big numbers —
  adopting it avoids re-deriving formatting, comparison, and overflow-safety edge
  cases the genre has already solved.
- **Trade-off:** BreakInfinity trades exact low-order precision for range at
  extreme magnitudes; acceptable because NFR-1 only requires no *visible*
  rounding artifact that changes a relative comparison, not exact integer gold.
- **Impact:** Any code path touching gold or costs uses this shared type
  end-to-end. Existing plain `int` fields (e.g. `PlayerStats.damagePerLevel`,
  `Equipment.bonusDamage`) migrate to it as those systems are touched by PRD
  features, not in a blanket pass.

### AD-8 — Fusion/Market mutations use an outbox-backed saga, not a naive two-phase commit
- **Decision:** Fusion is one backend transaction: validate duplicate count →
  decrement duplicate rows in Postgres → write an outbox record for the
  corresponding Steam Inventory mutation → commit. A background worker drains the
  outbox and calls the Steamworks Web API; on failure it retries with backoff. The
  fusion is only reported "complete" to the client once the outbox entry is
  confirmed applied. This relies on AD-8b's default-non-marketable item state to
  close the double-spend window during the async drain — see AD-8b.
- **Reason:** FR-33 requires no window where a card is both spent and separately
  listable; Postgres and Steam's API cannot share one atomic transaction, so the
  outbox pattern is what makes the two eventually-consistent without a client-
  visible inconsistent state.
- **Trade-off:** Requires an outbox table and a reconciliation worker from day
  one — more moving parts than a direct synchronous call, in exchange for no
  double-spend window even when Steam's API is briefly unreachable, given AD-8b.
- **Impact:** Any future operation touching both Postgres and Steam Inventory
  (not just fusion) must go through this same outbox mechanism, not a bespoke
  direct call.

### AD-8b — Cards are non-marketable by default; listing requires synchronous backend authorization; a "Listed" state blocks fusion until reconciled
- **Decision:** Every hero card's Steam Inventory item instance is minted with
  `marketable=false` and a Postgres card-instance state of `Owned`. It is never
  flipped to `marketable=true` by fusion, drops, or any client action directly.
  The only path that sets `marketable=true` is an explicit "prepare to list"
  backend call: the client asks to list a specific card, the backend
  synchronously checks that card's current Postgres state is `Owned` (not
  `Consumed` by fusion, not `PendingOutbox`, not already `Listed`) and, only if
  clear, calls the Steamworks Web API to flip that one item instance to
  `marketable=true` **and** transitions its Postgres state to `Listed` in the
  same transaction, before returning success to the client. Fusion (AD-8) and
  any other consuming action validate against this same state column and reject
  a duplicate that is `Listed`, exactly as they already reject `Consumed` or
  `PendingOutbox` — closing the reverse direction FR-33 didn't originally cover
  (listing → fusion, not just fusion → listing). A scheduled reconciliation job
  (same recurring-job pattern as AD-13/AD-14) polls the Steamworks Web API for
  every card currently `Listed`, and transitions it: to `Sold` (removed from
  the player's Steam Inventory — the sale completed on Valve's side) or back to
  `Owned` with `marketable=false` restored (the player cancelled the listing via
  Steam's native UI, outside the game, without a synchronous game-side call).
- **Reason:** User confirmed adding the `Listed` state plus a periodic
  reconciliation job over a webhook-based push mechanism (not confirmed
  available/reliable from Steamworks for this use case) or a game-UI-only
  cancel path (which alone doesn't cover a player cancelling via Steam's native
  Market UI, the exact gap the review identified). Reusing the AD-13/AD-14
  scheduled-job pattern avoids a new class of infrastructure for this.
- **Trade-off:** A card sold or delisted on Steam's side is only reflected in
  Postgres on the next reconciliation poll, not instantly — a small window
  where a just-sold card's Postgres state still reads `Listed` (harmless, since
  `Listed` already blocks fusion) and a small window where a just-cancelled
  listing still blocks fusion as `Listed` until the next poll confirms it's
  back to `Owned`. Acceptable because it only delays the player's own next
  action slightly; it never re-opens the double-spend/double-list risk this AD
  exists to close.
- **Impact:** Card minting (drops, Summoning Stone grants, AD-12) must always
  set `marketable=false` and Postgres state `Owned` at creation. The Domain
  layer's card-instance state machine is now explicitly four states — `Owned`,
  `Listed`, `PendingOutbox` (fusion's async drain, AD-8), `Consumed` — and every
  consuming action (fusion, and any future one) must validate against all of
  them, not just the subset any single AD names. FR-33/FR-34's server-authority
  requirement now has concrete enforcement points on both directions: the
  "prepare to list" endpoint (blocks listing an already-committed-to-fusion
  card) and fusion's own validation (blocks fusing an already-`Listed` card).

### AD-9 — Local save is a cache, never authority
- **Decision:** The client persists an encrypted local file (Unity
  `Application.persistentDataPath`) holding the last reconciled server state plus
  any not-yet-synced events from the log in AD-6. Steam Cloud syncs this file
  across a player's devices. Postgres remains the source of truth used to resolve
  any conflict on next sync.
- **Reason:** FR-43/FR-44/NFR-2 require cross-device continuity and crash-safe
  writes; combined with AD-6, the file's job is instant load and offline play, not
  authority.
- **Trade-off:** Local encryption raises the bar against casual save editing but
  is not a security boundary — that boundary is server-side event validation
  (AD-6), not the file's secrecy.
- **Impact:** No gameplay code may treat the local file as authoritative for
  anything Market-relevant; a stale or edited local file is always corrected by
  the next server reconciliation, not trusted.

### AD-10 — REST+JSON over HTTPS, versioned, session-token auth
- **Decision:** Client-backend communication is REST+JSON over HTTPS under
  `/api/v1/...`. The Steam Auth Session Ticket (AD-5) is exchanged once for a
  short-lived backend session token, sent as a bearer credential on subsequent
  calls.
- **Reason:** AD-6's batched, non-per-frame sync model doesn't need gRPC or a
  persistent WebSocket; REST+JSON keeps the integration surface simple for a
  team that isn't solo but is still small.
- **Trade-off:** Not suited to anything genuinely latency-sensitive. Acceptable
  because Season Cave (FR-38) is a race-to-milestone/highest-damage metric, not a
  live spectator or real-time PvP feature.
- **Impact:** A future real-time feature (e.g. a live season leaderboard ticker)
  is an explicit deferred/open item requiring its own transport decision, not
  something assumed to fall out of this protocol.

### AD-11 — Observability without a third-party analytics vendor in v1
- **Decision:** The backend uses structured logging (Serilog) and a health-check
  endpoint. The §9 success metrics (Summoning Stone revenue mix, Season Cave entry
  rate, Market volume/price deviation, retention/time-to-clear) are computed from
  the backend's own event data (the AD-6 event log, persisted in Postgres),
  not a separate analytics SDK.
- **Reason:** Avoids adding a third-party data-collection dependency before
  NFR-5's legal/compliance review has run; reuses infrastructure already required
  for anti-cheat sync instead of duplicating it.
- **Trade-off:** Less turnkey dashboarding than a vendor product (Amplitude/
  GameAnalytics); querying/reporting tooling on top of Postgres is on the team to
  build.
- **Impact:** If a vendor analytics SDK is added later, it is an additive
  decision revisited post-NFR-5, not assumed here.

### AD-12 — Deterministic Summoning Stone purchases go through Steamworks Microtransactions (ISteamMicroTxn), backend-orchestrated
- **Decision:** A Summoning Stone purchase (FR-28/FR-29/FR-30) is processed via the
  Steamworks Microtransaction API. The client requests a purchase for a specific
  card; the backend first validates server-side that the requested hero's Hero
  Block (FR-49) is unlocked relative to the player's own furthest cleared stage —
  rejecting the request before any charge is initiated if not — then calls
  `InitTxn` against the Steamworks Web API with the price and the player's
  SteamID; Steam presents its own native payment UI (Steam Wallet or card on
  file); Steam calls back to a backend authorization endpoint; the backend calls
  `FinalizeTxn` to confirm the charge, then grants the chosen card via the same
  outbox-backed Steam Inventory mutation path as fusion (AD-8). The backend never
  exposes the publisher key to the client, and the client never finalizes a
  transaction itself.
- **Reason:** User confirmed this option. It reuses AD-4/AD-8's existing rule that
  all Steam Inventory-mutating calls are backend-only, so a real-money grant is
  handled by the same trusted path as a fusion or drop grant, rather than
  introducing a second, differently-shaped mutation path. It also avoids operating
  a separate payment processor outside the Steam ecosystem.
- **Trade-off:** Ties the purchase flow to Steam's own transaction UI/latency and
  to Valve's approval of the microtransaction integration (see NFR-5/§11 risk);
  the backend must implement and securely expose the `InitTxn` authorization
  callback endpoint.
- **Impact:** The backend owns a `Purchase`/transaction record keyed by Steam's
  transaction ID, reconciled with the AD-8 outbox entry that performs the actual
  card grant. No client code calls `ISteamMicroTxn` directly, and no purchase is
  reported "complete" to the player until `FinalizeTxn` succeeds and the outbox
  grant is confirmed applied — the same completion discipline AD-8 already uses
  for fusion.

### AD-13 — Market reference price is a backend-cached periodic snapshot via the unofficial `priceoverview` endpoint
- **Decision:** A background backend job polls Valve's unofficial, unsupported
  `steamcommunity.com/market/priceoverview` endpoint per tradeable card at a fixed
  interval (parameter TBD in tuning) and stores the last-known price plus its
  fetch timestamp in Postgres. The client never calls this endpoint directly and
  never gets a truly real-time quote; it reads the cached value and displays its
  age (FR-29's "updated Xh ago").
- **Reason:** User confirmed softening FR-29 to a periodic reference price rather
  than a live quote, since Valve has no officially supported API for Market
  pricing — `priceoverview` is the only viable source and is not covered by any
  SLA. Polling on a fixed backend-owned schedule (vs. an on-demand call per
  client request) keeps call volume bounded and predictable regardless of player
  count, reducing rate-limit/block risk.
- **Trade-off:** The displayed price can lag actual Market movement by up to the
  polling interval; acceptable because FR-29 only needs a *soft* price-ceiling
  reference for player comparison, not a transaction-grade quote — no purchase or
  balance decision in this system depends on this value being exact or current
  to the second.
- **Impact:** If Valve changes or blocks `priceoverview` at scale, this AD is the
  first thing that breaks — the price panel must degrade to "price unavailable"
  rather than blocking the Summoning Stone purchase flow (AD-12), which does not
  depend on this value.

### AD-14 — Market anti-bot detection (NFR-8) runs as a scheduled job over the AD-6 event log
- **Decision:** NFR-8's Market-scoped abuse detection (anomalous drop/farming
  rate, listing-rate patterns) runs as a periodic scheduled backend job that
  queries the same append-only event log AD-6 already requires for progress
  reconciliation — not a separate dedicated detection service.
- **Reason:** User confirmed this over standing up a dedicated service. It reuses
  data and job infrastructure the backend already has for AD-6/AD-11 instead of
  adding a new deployable component, which fits a small team without dedicated
  infra headcount (same reasoning as AD-3's Fargate choice) better than a
  bespoke real-time detection service for v1.
- **Trade-off:** Detection latency is bounded by the job's polling interval, not
  real-time/streaming — an abuse pattern is caught on the next scheduled run,
  not the instant it happens. Accepted because NFR-8 requires *some* Market-
  scoped detection to exist, not sub-second response.
- **Impact:** NFR-8 names two mechanisms; only the pattern-anomaly side (drop/
  farming-rate analysis) is this AD's scheduled-job decision. The listing
  rate-limit half of NFR-8 is a hard precondition, not an analysis, and so is
  enforced inline at request time in AD-8b's "prepare to list" endpoint
  regardless of this AD — the two mechanisms have different natural homes by
  their own nature, not because a hybrid architecture was chosen here. Exact
  interval, signals, and thresholds for the scheduled job remain a tuning/ops
  deliverable (see NFR-8 in PRD.md).

### AD-15 — Crafting/enchanting is a single server-side Postgres transaction, no outbox; affix RNG is server-only
- **Decision:** Crafting and re-rolling equipment affixes (FR-19–24) is one
  backend transaction: validate gold balance and the requested slot's affix
  range → debit the gold cost → generate the affix roll server-side → persist
  the new roll → append the corresponding event to the AD-6 event log → commit.
  Unlike fusion (AD-8), this has no outbox step and no Steam Inventory call,
  because equipment is account-bound and not Market-tradeable (FR-24) — there is
  no second external system to keep eventually consistent with. The affix roll
  itself is always computed and validated server-side; the client never
  pre-computes or predicts a roll locally, and only displays the value the
  server returns.
- **Reason:** User confirmed both: (a) crafting doesn't need AD-8's outbox/saga
  machinery since it never touches Steam Inventory, so a single atomic
  transaction is sufficient and simpler; (b) server-only RNG avoids exposing
  affix-roll logic or seed state to a client that could otherwise be tampered
  with to bias or predict favorable rolls, and crafting is a deliberate,
  network-available action (unlike a tap or idle tick) that doesn't need
  AD-6's offline-optimistic-then-reconciled pattern.
- **Trade-off:** Every craft/re-roll action requires a live round-trip to the
  backend — there is no offline crafting, unlike offline gold accrual (FR-41).
  Acceptable because FR-19–24 never claim offline crafting is supported, and
  the action already requires spending gold whose authoritative balance lives
  server-side.
- **Impact:** AD-2's Domain layer gains an explicit crafting rule set (affix
  ranges per slot type, re-roll cost formula, roll-odds table) alongside the
  "fusion curves, drop validation, market ledger invariants" it already names —
  "crafted affixes" stops being only a Postgres column name and becomes a real
  Domain concept with its own validation, matching the level of detail AD-8
  gives fusion.

## Open Questions / Deferred

- **Unity client CI/build pipeline** (Unity Cloud Build / Unity Build Automation
  vs. a self-hosted runner vs. manual Steam depot uploads) — not decided; needed
  before any real release cadence, but independent of the AD-1..AD-11 decisions
  above.
- **Admin/ops tooling** for season rule variants, drop tables, and Summoning
  Stone pricing (FR-29, FR-37) — no admin UI is scoped for v1; content changes are
  assumed to ship via direct data/config changes deployed with the backend. If
  this becomes a live-ops need before launch, it needs its own scoping pass.
- **Outbox worker operational detail** (retry backoff schedule, alerting on
  stuck entries) — deferred to implementation; AD-8 fixes the pattern, not the
  parameters.
- **NFR-5 legal/compliance review** is an external dependency this architecture
  does not resolve. A negative finding on Steam Market card trading in any target
  region would directly affect AD-4/AD-8's design and is the single biggest risk
  to this architecture holding as specified — carried forward from PRD §11 item 1,
  unchanged by this document.
- **Vendor analytics** for §9 metrics — deferred pending NFR-5 (see AD-11).
- **Animation/art production throughput vs. roadmap pacing** (PRD §10) — PRD.md
  explicitly names this "the most likely real bottleneck" on how much of this
  PRD can ship on schedule, and explicitly defers resolving it to "the
  Architecture/roadmap phase." This document does not resolve it: no AD above
  sequences hero count, Hero Block (FR-49) content pacing, or season cadence
  (FR-37/FR-40) against animation throughput, and FR-9's confirmed "5 heroes
  animate simultaneously" mechanic (vs. a single tappable hero) raises this
  cost further, not lower. This is carried forward unresolved from PRD §10,
  same as NFR-5 above, and needs a dedicated production/roadmap pass — not an
  architecture decision — before a launch date or hero/season count is locked.
