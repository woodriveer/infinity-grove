# PORT_MAP: Unity → Phaser client

Tracks every Unity `.cs` under `Scripts/Game` and `Scripts/Shared` (refactor PRD RFR-22,
ARCHITECTURE AD-19). Status: `todo` / `in-progress` / `done` / `dropped`.
Paths are relative to `Client/` unless noted. Domain is ported 1:1 by file and public
name; C# classes with behavior become immutable values plus functions (AD-5), and
C# `out`/`Try*` shapes become `T | null` returns.

**Gates:** G1 needs every Domain row `done`; G3 needs every row `done` or `dropped`.

## Shared

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Shared/BreakInfinity.cs | moved to `Backend/src/InfinityGrove.Backend.Domain/Shared/BreakInfinity.cs` (RFR-18); ported to `src/domain/bignum/BigDouble.ts` (+ `precise.ts`, `format.ts`, `wire.ts`) | done | Bit-exact on all `bignum-*` vectors. See amendments A2, A3. |

## Domain

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Domain/AffixType.cs | src/domain/AffixType.ts | done | enum → string-literal union, same order |
| Domain/Archetype.cs | src/domain/Archetype.ts | done | |
| Domain/CombatState.cs | src/domain/CombatState.ts | done | |
| Domain/CraftingPreview.cs | src/domain/CraftingPreview.ts | done | |
| Domain/CraftingRules.cs | src/domain/CraftingRules.ts | done | preview only; rolls are server-side (AD-22) |
| Domain/DamageCalculator.cs | src/domain/DamageCalculator.ts | done | int32 arithmetic kept |
| Domain/EquipmentInstance.cs | src/domain/EquipmentInstance.ts | done | references the template by `itemId`; GUID-N id generation moved to services (IdGenerator) |
| Domain/EquipmentSlot.cs | src/domain/EquipmentSlot.ts | done | |
| Domain/FusionPreview.cs | src/domain/FusionPreview.ts | done | |
| Domain/FusionRules.cs | src/domain/FusionRules.ts | done | also hosts `preview()` (was FusionService.GetPreview) |
| Domain/HeroEntity.cs | src/domain/HeroEntity.ts | done | C# events dropped: the store notifies (AD-5); `IsInActiveSquad` kept |
| Domain/HeroType.cs | src/domain/HeroType.ts | done | |
| Domain/LoadoutPreset.cs | src/domain/LoadoutPreset.ts | done | |
| Domain/MonsterEntity.cs | src/domain/MonsterEntity.ts | done | `Sprite` → asset key; `OnDefeated` → `takeDamage().defeated` |
| Domain/OfflineAccrualCalculator.cs | src/domain/OfflineAccrualCalculator.ts | done | epoch ms in, .NET tick math for hours |
| Domain/OfflineAccrualResult.cs | src/domain/OfflineAccrualResult.ts | done | `TimeSpan` → ms |
| Domain/PlayerEventRecord.cs | src/domain/PlayerEventRecord.ts | done | `DateTimeOffset` → epoch ms; ISO-8601 on the wire |
| Domain/PlayerEventSyncStatus.cs | src/domain/PlayerEventSyncStatus.ts | done | |
| Domain/PlayerEventType.cs | src/domain/PlayerEventType.ts | done | |
| Domain/PlayerStateSnapshot.cs | src/domain/PlayerStateSnapshot.ts | done | GUIDs as lower-case strings |
| Domain/ReconciliationCorrection.cs | src/domain/ReconciliationCorrection.ts | done | |
| Domain/RosterEntrySnapshot.cs | src/domain/RosterEntrySnapshot.ts | done | |
| Domain/RosterRules.cs | src/domain/RosterRules.ts | done | also hosts `squadPower()` (was inline in StageService and SaveSyncService) |
| Domain/SaveGameData.cs | src/domain/SaveGameData.ts | done | new envelope (AD-12, PRD S1); see B4 |
| Domain/StageAttemptPreview.cs | src/domain/StageAttemptPreview.ts | done | |
| Domain/StageOutcome.cs | src/domain/StageOutcome.ts | done | |
| Domain/StageOutcomeClassifier.cs | src/domain/StageOutcomeClassifier.ts | done | |
| (new) | src/domain/HeroData.ts | done | `HeroData.GetAbilityDescription` / `TryGetServerHeroId` |
| (new) | src/domain/PlayerProgressReplay.ts | done | mirror of the backend replay; see B4 |
| (new) | src/domain/rng.ts | done | seedable sfc32 + UUIDv4 IdGenerator (AD-6) |

## Data (ScriptableObjects → content JSON + zod schemas, AD-8)

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Data/BackendSyncSettings.cs | content/settings/game.json (`GameSettings`, settingsSchema) | done | sync interval, timeout, accrual rate/cap, save name, plus new-game defaults |
| Data/Equipment.cs | content/equipment/wclaw01.json (`Equipment`, equipmentSchema) | done | WCLAW01.asset (animatorItemID 1, +10 damage) |
| Data/EquipmentItemData.cs | content/items/*.json (`EquipmentItemData`, itemSchema) | done | placeholder items (no Unity assets existed) |
| Data/HeroData.cs | content/heroes/*.json (`HeroData`, heroSchema) | done | placeholder heroes with backend GUIDs; see B5 |
| Data/MonsterData.cs | content/monsters/slime.json (`MonsterData`, monsterSchema) | done | Slime.asset (50 HP, 3–8 gold) |
| Data/PlayerStats.cs | `playerStats` in content/settings/game.json | done | PlayerStats.asset (level 1, 5 per level) |
| Data/StageData.cs | content/stages/*.json (`StageData`, stageSchema) | done | placeholder stages; see B5 |

## Service

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Service/BackendApiClient.cs | src/services/backend/BackendApiClient.ts (+ BackendApi.ts, NoBackend.ts) | done | generated openapi-fetch client over HttpPort; payloads spliced in raw |
| Service/BackendSyncDtos.cs | src/generated/api/schema.ts + src/services/events/payloads.ts | done | DTOs generated (RFR-25); payloads zod + byte-exact serializer (AD-11) |
| Service/CombatService.cs | src/services/combat/CombatService.ts | done | walk timer driven by TickDriver; Random.Range → seeded Rng |
| Service/CraftingService.cs | src/services/crafting/CraftingService.ts (+ AffixRollSource.ts, BackendAffixRollSource.ts) | done | local roll dropped (AD-22); requests return unavailable until the endpoint ships |
| Service/DevSteamIdentityProvider.cs | src/services/identity/DevSteamIdentity.ts | done | optional test ticket for the fake-Steam stub |
| Service/EncryptedSaveFileStore.cs | src/services/save/SaveCodec.ts + migrations.ts; platform FsSaveStore / IndexedDbSaveStore; WebCryptoCipher | done | AES-256-GCM, PBKDF2 app key; atomic temp + fsync + rename |
| Service/EquipmentInventoryService.cs | src/services/equipment/EquipmentInventoryService.ts | done | bag and loadouts persisted locally (save `local`) |
| Service/EquipmentService.cs | src/services/equipment/EquipmentService.ts | done |  |
| Service/FacepunchSteamCloudStore.cs | src/platform/electron/ElectronPorts.ts (SteamCloudStore) + desktop/main/steam.ts | done | steamworks.js in main only (AD-13); real-Steam check is G0 criterion 2 |
| Service/FacepunchSteamIdentityProvider.cs | src/platform/electron/ElectronPorts.ts (SteamWebApiIdentity) + desktop/main/steam.ts | done | Web API ticket; real-Steam check is G0 criterion 1 |
| Service/FusionService.cs | src/services/roster/FusionService.ts | done | preview composition moved to FusionRules.preview |
| Service/I*.cs (interfaces) | src/services/ports.ts and each service class | done | C# interfaces became ports (I/O) or the classes themselves |
| Service/LoadoutPresetService.cs | src/services/equipment/LoadoutPresetService.ts | done |  |
| Service/LocalOnlyCloudStore.cs | src/services/sync/LocalOnlyCloudStore.ts | done |  |
| Service/PlayerCombatService.cs | src/services/combat/PlayerCombatService.ts | done |  |
| Service/PlayerEventLog.cs | src/services/events/PlayerEventLog.ts | done | pending list lives in GameState.eventLog |
| Service/RosterService.cs | src/services/roster/RosterService.ts | done | + swap() for tap-to-swap (one ActiveSquadChanged) |
| Service/SaveSyncService.cs | src/services/sync/SaveSyncService.ts (+ SteamCloudSync.ts, state/projection.ts, tick/TickDriver.ts) | done | events emitted by commands instead of diffing (same events); B4 projection |
| Service/StageService.cs | src/services/stages/StageService.ts | done |  |
| Service/UnityWebRequestAwaiter.cs | — | dropped | replaced by the HttpPort (AD-19) |

## Presentation and Bootstrap

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Bootstrap/GameLifetimeScope.cs | src/app/compose.ts | dropped | replaced by the code composition root (AD-4) |
| Presentation/CombatPresenter.cs | src/presentation/screens/GameScreenController.ts + src/app/boot.ts (combat.begin on Play) | done | Start() → Begin() when the game is entered |
| Presentation/CraftingPresenter.cs | src/presentation/screens/EquipmentController.ts (crafting section) | done | preview + re-roll request; result is server-side (AD-22) |
| Presentation/EquipmentPresenter.cs | src/presentation/screens/EquipmentController.ts | done | hero selection became LB/RB tabs (EXPERIENCE) |
| Presentation/FusionPresenter.cs | src/presentation/screens/FusionController.ts | done | + irreversible-action confirm with focus on Cancel (EXPERIENCE) |
| Presentation/HeroTypeDisplay.cs | src/presentation/HeroTypeDisplay.ts | done | colors are theme tokens; label adds the full type name (NFR-3) |
| Presentation/KrellPresenter.cs | src/presentation/scenes/WorldScene.ts (Krell sprites) | done | Animator → Aseprite tags idle/walk/punch per weapon variant (content/animations/krell.json) |
| Presentation/LoadoutPresetPresenter.cs | src/presentation/screens/EquipmentController.ts (presets section) | done | same Save/Apply + confirm wording |
| Presentation/MainMenuPresenter.cs | src/presentation/screens/MenuControllers.ts + WorldScene menu backdrop | done | Config button → Settings (music volume, RFR-47) |
| Presentation/MonsterPresenter.cs | src/presentation/scenes/WorldScene.ts (monster) | done | Slime has no sprite in Unity; drawn as a placeholder body (FIDELITY item) |
| Presentation/ReconciliationNotificationPresenter.cs | GameScreenController notices + src/presentation/NoticeTimer.ts | done | toasts top-right, 6 s on the game clock |
| Presentation/RosterPresenter.cs | src/presentation/screens/RosterController.ts | done | + tap-to-swap when the squad is full (EXPERIENCE) |
| Presentation/SaveSyncDriver.cs | — | dropped | replaced by TickDriver sync interval + lifecycle hooks (AD-19) |
| Presentation/StageSelectPresenter.cs | src/presentation/screens/StageSelectController.ts | done | same risk and result wording |
| Presentation/UiFactory.cs | src/presentation/ui/App.tsx + model.ts + base.css | done | rows of labels/buttons rendered from semantic models (hybrid, RFR-48) |

## Amendments to the architecture (recorded per AD-3/AD-21)

- **A1. TypeScript 5.9, not 7.0.** typescript-eslint and openapi-typescript do not accept
  TypeScript 7 yet (peer ranges `<6.1` / `^5`). Revisit when they do.
- **A2. `break_infinity.js` is not used.** AD-7 named it as the library behind
  `domain/bignum`. Its normalization, addition threshold and formatting differ from
  `BreakInfinity.cs`, and S2 demands bit-exactness with the backend, so the C# type
  is ported directly instead. Same seam (only `domain/bignum` knows the representation).
- **A3. Correctly rounded math in `domain/bignum/precise.ts`.** V8's `Math.pow` and
  `Math.log10` differ from .NET's by an ulp on some inputs, and `toFixed` rounds ties
  half-up where .NET rounds half-to-even. The port uses double-double `exp10`/`log10`,
  parser-exact powers of ten (plus the 10^23 tie, which .NET rounds up), and BigInt
  exact decimal formatting. 100% of `bignum-*` vectors pass bit-exactly.
- **A4. Upstream `steamworks.js@0.4.0`, not a fork.** ARCH F4 assumed upstream lacked
  `getAuthTicketForWebApi` and a microtransaction callback; 0.4.0 has both. It still
  lacks a `GameOverlayActivated` callback (AD-16 input suspension), so the fork stays
  the plan if the G0 spike needs it.

## Behavior notes (ported as-is, S6; route to the game PRD)

- **B1. `BigDouble.FromDouble` hangs on subnormal input** (e.g. `5e-324`): `Normalize`
  loops forever on an infinite mantissa. The TS port throws instead of hanging. The
  backend should get the same guard.
- **B2. Notation glitch:** values whose mantissa normalizes just below 10 can print as
  `10.00e-1` (`BigDouble.ToString`). Ported exactly.
- **B3. Local fusion is reverted by reconciliation.** Unity fusion emits no event, and
  the backend's roster `StarTier` stays 0, so the next reconcile resets the hero to 1★.
  Ported as-is; the backend fusion endpoint (`/api/v1/cards/fuse`) is the real path.
- **B4. Unsynced progress was invisible after a restart in Unity.** The Unity save
  applied only the last reconciled state on load; pending events were re-sent but not
  shown, so offline progress vanished on screen until a sync succeeded. The TS client
  projects pending events onto the reconciled state with `PlayerProgressReplay` (a
  prediction the backend still reconciles, S2). This is the one deliberate deviation
  from Unity behavior so far and needs the developer's acceptance.
- **B5. No hero or stage content existed in Unity** (no `HeroData`/`StageData` assets).
  The content files under `content/heroes` and `content/stages` are placeholders,
  written so the parity screens and the RFR-14 fixtures have something to show.
- **B6. Catch-up equivalence (ARCH F3) does not hold by design.** In Unity, combat earns
  gold only from clicks; idle time earns nothing until offline accrual. So step
  simulation over a gap yields 0 gold while the accrual path yields squad-power gold.
  The `catch-up-equivalence` vector family is therefore not generated; this goes to
  the game PRD.
- **B7. Two devices on one account can silently lose events (backend).** Sequence
  numbers are per-device counters seeded from the account's `lastAppliedSequence`, so
  two devices that synced the same state both use N+1. The backend treats the second
  one as stale and *accepts it as a no-op* without applying or rejecting it. Found by
  the RFR-29 sync-e2e run (`tests/sync-e2e`). Unity had the same numbering; the fix
  (per-device sequence ranges, or rejecting stale-but-unknown events) is a backend and
  game-PRD change.
- **B8. The Unity Slime has no sprite.** `Slime.asset` has `sprite: {fileID: 0}`, so the Unity
  MonsterPresenter showed an empty Image. The Phaser client draws a placeholder slime body;
  real monster art is a content task (FIDELITY.md).
