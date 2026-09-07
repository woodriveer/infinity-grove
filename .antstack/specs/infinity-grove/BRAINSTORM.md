# Infinity Grove — Brainstorm

## Session framing

Starting from the Briefing's open tension — "can an idle clicker also be a strategy
game, worth paying for once?" — this session worked system by system through the
Briefing's explicit "known unknowns," using analogical thinking (borrowing proven
patterns from FTL, Genshin, Diablo, Path of Exile, League of Legends, CS:GO/Steam
economy) and stress-testing each choice against the project's two hard constraints:
**no pay-to-win**, and **cards are real-money assets on the Steam Community Market**,
which rules out several standard genre patterns (permadeath, RNG loot boxes, full
economy wipes) that would otherwise be obvious choices.

The strongest, most load-bearing decision made this session: differentiation comes
from an **FTL-style rotating roster** (no fixed protagonist) rather than the more
common "prestige/reset" or "Pokémon evolution" idle-genre patterns — everything
below builds on that choice.

## Core roster model

- **No fixed protagonist.** Krell is simply the first hero created, not a special
  narrative anchor. At game start the player picks a main character from 3-5
  starter options; other starters (and all other heroes) are obtained later
  through normal card drops like any other hero.
- **5 active slots, hard cap.** The roster can grow arbitrarily, but only 5 heroes
  fight at once — deciding who's in those 5 slots for a given stage *is* the
  strategy layer.
- **Bench heroes have zero passive value.** A benched hero contributes nothing to
  the shared economy. This is deliberate: it's what makes bench heroes genuinely
  worth selling on the Market instead of being hoarded as dead weight.
- **Single shared account-level power stat**, not per-hero leveling. All heroes
  scale off one account-wide level (the earlier "Krell's level" framing from the
  prototype was legacy naming, not a design intent to special-case one hero).
- **"Evolution" is duplicate-fusion, not stage-reset.** Collecting 2-3+ copies of
  the same hero fuses them up a star tier (1★→2★→3★...); higher star tiers unlock
  new or upgraded special abilities. This is structurally Genshin Impact's
  Constellation system, but the Steam Market removes Genshin's core complaint —
  since any needed duplicate can be bought directly, dupe-hunting is never purely
  gated by RNG luck. **Pitch line worth keeping: "the most compelling character-
  investment loop from gacha games, without the part that makes gacha games
  predatory."**

## Combat & stage design

- **Stage modifiers rotate on purpose**, specifically to prevent the single
  "solved meta" team that kills strategic choice in comparable games (Melvor Idle,
  Idle Champions of the Forgotten Realms both suffer from this once a community
  converges on one BiS setup).
- **Failure has exactly two distinct, legible causes** — never ambiguous:
  1. **Power gate** — account level / gear / hero quality too low. Correct
     response: go grind (level, gear, quality upgrades). A stage should never be
     losable purely on strategy below the intended power floor.
  2. **Composition mismatch** — enough power, wrong team for this stage's
     modifier (e.g., fire team vs. water-favored stage). Correct response: swap
     the loadout, not grind.
  This dual-cause design is what makes the strategic layer feel like a real
  decision instead of randomness or a bug.
- **No permadeath.** Failed stages can be retried at will; players can also drop
  back to farm easier, already-cleared stages for better resources before
  re-attempting a harder one. Permadeath (FTL's own signature mechanic) was
  explicitly considered and rejected — destroying a hero that represents a
  real-money Market asset is both a trust problem and a likely legal problem.

## Itemization (new scope beyond the original Briefing)

- **Equipment drops from stage clears**: weapon, chest, boots, gloves slots
  (ARPG-style gear), owned per-hero (each hero has its own equipped loadout).
- **Shared account bag**: unequipped items live in one account-wide inventory, so
  gear is never stranded on a benched hero — it can be freely moved to whichever
  hero is active.
- **Loadout presets by archetype** (Strength / Intelligence / Agility, in the
  spirit of Diablo 3 build presets) let a player instantly re-gear a
  newly-activated hero instead of manually re-equipping piece by piece. This is
  the resolution to the friction that per-hero gear ownership would otherwise add
  to the FTL-style fast team-swapping the whole roster model depends on.
- **Boss-fight consumables**: rare potions (e.g. +5% attack, attack speed, double
  attack, double projectile) used tactically mid-boss-fight. This reconnects to
  the original Briefing pitch ("tap accelerates the loop on top of automation") —
  timing a potion is an active execution decision layered on top of the
  pre-stage strategic loadout decision.
- **Crafting/enchanting**: rollable affixes on gear — crit chance / attack% / crit
  damage on weapons, defense on chest, speed on boots, precision/accuracy on
  gloves.
- **Scope flag (not resolved here, belongs in PRD):** drop + craft + affix +
  enchanting is, by itself, comparable in size to an entire ARPG's itemization
  system. Worth an explicit phasing decision — full system at launch vs. a
  simpler launch version with deeper crafting arriving as later seasonal content.

## Endgame & seasonal structure

- **Stage count is no longer a number to pin down.** ~600 stages ships as launch
  content, not a hard ceiling; each season adds a further permanent block (e.g.
  +100 stages). This reframes the Briefing's unresolved "59 vs 60 vs 600" question
  as moot — the total is meant to be open-ended by design, growing every season.
- **Season Cave (Diablo Greater-Rift-style) is the primary ranked mode.** Inside
  it, account power is normalized to a fixed level (e.g. everyone effectively
  level 300) — competitive differentiation comes purely from **hero star
  quality**, not raw grind time. This deliberately avoids "the account that's
  been playing longest always wins the leaderboard," while still rewarding real
  investment (a 5★ hero measurably outperforms a 1★ hero at the same normalized
  level).
- **Ranked entry gate = minimum total card count** (not specific cards), modeled
  on League of Legends' ranked-eligibility gates. Purpose: keep bots and
  throwaway fresh accounts off the leaderboard once ranking carries real rewards.
  Constraint worth keeping visible: this gate must be reachable through normal
  free play alone — if meeting it effectively requires buying cards, ranked
  access becomes pay-gated, which breaks the project's own fairness pillar.
- **Seasonal rule variants** deliberately rotate the competitive meta each season
  (e.g. elemental buffs/penalties specific to that season's ladder) and double as
  a natural release vehicle for new heroes designed around each season's rules.
- **Season race metric**: first to reach the season's new final stage / highest
  damage on the season's final boss.
- **Ranking rewards are cosmetic-only** (special frames, skins) — deliberately
  keeps competitive ranking decoupled from anything resembling cash prizes or
  sweepstakes/gambling law exposure, following the same model as League of
  Legends / Clash Royale seasonal reward tracks. (Light flag: if "prize" ever
  expands beyond cosmetics in the future, that needs its own legal check — not
  resolved here, just noted so it isn't lost.)

## Economy & monetization

The central tension this session had to resolve: the project's "single paid
purchase, no IAP/gacha" pledge collides with the real need for continuing revenue
to fund ongoing seasonal content (new heroes, new stages) after launch.

- **Rejected: random-reward paid "summoning stones."** Selling a stone for real
  money that yields a *random* card, which can then be cashed out again via the
  Steam Market, is structurally identical to the loot-box-for-cash-out pattern
  behind CS:GO skin-gambling controversies and the loot box legislation in
  Belgium and the Netherlands. Flagged as a serious legal/platform-approval risk,
  not a design nitpick — this pattern should not ship as designed.
- **Chosen: deterministic summoning stones.** Real money buys a *specific,
  player-chosen* low-tier card — no randomness anywhere in the transaction. This
  avoids the loot-box classification entirely (no chance-based reward for
  payment) while still producing repeatable revenue. It doubles as a **market
  price ceiling**: if a card gets speculatively overpriced on the Steam Market,
  players always have the official-shop price as a fallback, which caps runaway
  scarcity-driven pricing.
- **Trading is Steam Community Market only — no in-game direct trade.** Weighed
  explicitly against Diablo 2 (pure P2P trade, scam-prone), Diablo 3's real-money
  auction house (removed after making trading feel mandatory), and CS:GO's dual
  Market + free Trade Offer system (where free direct trades visibly cannibalize
  Market fee revenue and reintroduce fraud surface the studio would have to solve
  itself). Market-only keeps Valve's built-in fraud protections intact and
  protects any future Market-fee revenue share from leakage.
- **Steam Marketplace/Inventory Service feasibility remains unvalidated** (same
  open item as the Briefing) — whether Valve extends any transaction-fee share to
  a small/first-time studio, the approval path, and jurisdiction-specific
  real-money-trading exposure. Good risk posture: the chosen monetization model
  (deterministic stones) does **not** depend on this being true — if a revenue
  share does turn out to be possible, it becomes a bonus secondary revenue layer,
  not a load-bearing assumption.
- **Bot/multi-account grinding is an accepted trade-off, not a problem to
  eliminate.** Explicit call: heavy grinders keep the community active online,
  and the rarity-gating of late-stage heroes already bounds how fast anyone can
  weaponize grinding for market speculation. PRD should not over-engineer
  anti-bot measures beyond the ranked-mode entry gate above.

## Production risk: animation (flagged, not a system to brainstorm alternatives for)

Because Infinity Grove is 2D and combat feel is central to the pitch, animation
coverage is a critical production risk, not a nice-to-have polish item. The
current build has exactly one character (Krell) with idle/walk/punch. Every
system designed this session multiplies that scope:

- Every collectible hero needs its own animation kit.
- Star-quality tiers likely need visual differentiation (a 5★ hero should read as
  visibly stronger than a 1★ of the same hero, per genre convention).
- Equipment changes should ideally be visible on the character.
- Boss-fight potions and tactical timing need clear animated feedback to land as
  a real decision rather than an invisible stat change.

This is very plausibly the real bottleneck on how many heroes and seasons can
actually ship — more than code complexity. It should inform pacing and roadmap
decisions in the PRD and architecture phases explicitly, not be treated as a
generic "make it polished" note.

## Explored and set aside

- **Prestige/ascension reset** (classic idle-genre pattern, Cookie Clicker /
  AdVenture Capitalist style) — set aside as exactly the generic pattern the
  Briefing wanted to differentiate away from.
- **Pokémon-style hero transformation on stage clear** — set aside in favor of
  the FTL rotating-roster + star-fusion combination, which achieves "evolution"
  through a mechanism compatible with the Market economy.
- **Path of Exile-style ascendancy tree** — conceptually close to how star
  quality unlocks abilities, but not adopted as a separate system.
- **Bracket-based leaderboard segmentation** (an intermediate suggestion) —
  superseded by the better solution: the power-normalized Season Cave, which
  solves the "veteran always wins" problem more elegantly than brackets would.
- **Diablo 3-style real-money auction house** — examined and explicitly avoided,
  citing its own history of making trading feel mandatory and killing the
  loot-drop feeling.
- **In-game direct player trade** — considered and rejected in favor of
  Market-only trading (see Economy & Monetization above).
- **True PoE-style full economy wipe per season** — rejected because cards are
  real-money Market assets; replaced with "only the leaderboard resets, account
  and cards are permanent."

## Open risks / assumptions carried into PRD

- Steam Marketplace / Inventory Service feasibility for a small/first-time
  studio (approval path, any revenue-share possibility, jurisdiction-specific
  real-money-trading legal exposure) — unresolved, needs research outside of
  brainstorming.
- Full itemization/crafting system scope vs. launch timeline — needs an explicit
  phasing decision (full at launch vs. simplified launch, deeper crafting as
  seasonal content).
- Animation production throughput as the likely real constraint on
  hero/season cadence — should shape roadmap pacing, not just be a wishlist note.
- Exact fusion-cost curve (how many duplicates per star tier), gold/cost curves,
  and drop rates are intentionally left untuned here — the *shape* of the systems
  is settled, the numbers are PRD/spreadsheet work.
- Whether fused duplicate cards are consumed permanently or preserved as
  separate items has a real economic effect (deflationary card supply vs. stable
  supply) and was not fully pinned down numerically — needs a deliberate choice
  in PRD, not a default.
- Cosmetic-only ranked rewards are the current answer to the "future prize"
  question raised mid-session; if that scope grows beyond cosmetics later it
  needs its own legal review.

## One-line synthesis

Infinity Grove differentiates itself not through hero permanence or reset, but
through a **rotating 5-hero squad economy** where duplicate-fusion, gear, and a
power-normalized seasonal ladder create real strategic decisions — funded by a
deterministic (non-gacha) card-purchase model and a Market-only trading economy
designed specifically to avoid both pay-to-win and loot-box legal exposure.
