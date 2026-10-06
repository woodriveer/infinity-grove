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
| Data/BackendSyncSettings.cs | content/settings/game.json, `GameSettings` in src/domain/content/types.ts + schema | todo | |
| Data/Equipment.cs | content/equipment/*.json (`Equipment`) | todo | WCLAW01.asset → wclaw01.json |
| Data/EquipmentItemData.cs | content/items/*.json (`EquipmentItemData`) | todo | no Unity assets existed |
| Data/HeroData.cs | content/heroes/*.json (`HeroData`) | todo | no Unity assets existed; see B5 |
| Data/MonsterData.cs | content/monsters/*.json (`MonsterData`) | todo | Slime.asset → slime.json |
| Data/PlayerStats.cs | `playerStats` in content/settings/game.json | todo | PlayerStats.asset |
| Data/StageData.cs | content/stages/*.json (`StageData`) | todo | no Unity assets existed; see B5 |

## Service

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Service/BackendApiClient.cs | src/services/backend/BackendApiClient.ts | todo | generated client over HttpPort (AD-10) |
| Service/BackendSyncDtos.cs | src/generated/api/schema.ts + src/services/events/payloads.ts | todo | DTOs generated; payloads zod (AD-11) |
| Service/CombatService.cs | src/services/combat/CombatService.ts | todo | `Task.Delay` walk → TickDriver time |
| Service/CraftingService.cs | src/services/crafting/CraftingService.ts | todo | local roll dropped (AD-22) |
| Service/DevSteamIdentityProvider.cs | src/services/identity/DevSteamIdentity.ts | todo | |
| Service/EncryptedSaveFileStore.cs | src/services/save/SaveCodec.ts + platform SaveStore | todo | AES-GCM envelope (AD-12) |
| Service/EquipmentInventoryService.cs | src/services/equipment/EquipmentInventoryService.ts | todo | |
| Service/EquipmentService.cs | src/services/equipment/EquipmentService.ts | todo | |
| Service/FacepunchSteamCloudStore.cs | src/platform/electron/SteamCloudStore.ts | todo | steamworks.js (AD-13) |
| Service/FacepunchSteamIdentityProvider.cs | src/platform/electron/SteamIdentity.ts | todo | |
| Service/FusionService.cs | src/services/roster/FusionService.ts | todo | |
| Service/I*.cs (interfaces) | src/services/ports.ts and each service's exported type | todo | |
| Service/LoadoutPresetService.cs | src/services/equipment/LoadoutPresetService.ts | todo | |
| Service/LocalOnlyCloudStore.cs | src/services/sync/LocalOnlyCloudStore.ts | todo | |
| Service/PlayerCombatService.cs | src/services/combat/PlayerCombatService.ts | todo | |
| Service/PlayerEventLog.cs | src/services/events/PlayerEventLog.ts | todo | |
| Service/RosterService.cs | src/services/roster/RosterService.ts | todo | |
| Service/SaveSyncService.cs | src/services/sync/SaveSyncService.ts (+ SteamCloudSync.ts) | todo | |
| Service/StageService.cs | src/services/stages/StageService.ts | todo | |
| Service/UnityWebRequestAwaiter.cs | — | dropped | replaced by the HttpPort (AD-19) |

## Presentation and Bootstrap

| Unity file | Destination | Status | Notes |
|---|---|---|---|
| Bootstrap/GameLifetimeScope.cs | src/app/compose.ts | dropped | replaced by the code composition root (AD-4) |
| Presentation/CombatPresenter.cs | src/presentation/screens/CombatController.ts | todo | |
| Presentation/CraftingPresenter.cs | src/presentation/screens/EquipmentController.ts (crafting panel) | todo | |
| Presentation/EquipmentPresenter.cs | src/presentation/screens/EquipmentController.ts | todo | |
| Presentation/FusionPresenter.cs | src/presentation/screens/FusionController.ts | todo | |
| Presentation/HeroTypeDisplay.cs | src/presentation/HeroTypeDisplay.ts | todo | |
| Presentation/KrellPresenter.cs | src/presentation/world/KrellView.ts | todo | Animator → Aseprite tags |
| Presentation/LoadoutPresetPresenter.cs | src/presentation/screens/EquipmentController.ts (preset tabs) | todo | |
| Presentation/MainMenuPresenter.cs | src/presentation/scenes/MainMenuScene.ts | todo | |
| Presentation/MonsterPresenter.cs | src/presentation/world/MonsterView.ts | todo | |
| Presentation/ReconciliationNotificationPresenter.cs | src/presentation/screens/ToastController.ts | todo | |
| Presentation/RosterPresenter.cs | src/presentation/screens/RosterController.ts | todo | |
| Presentation/SaveSyncDriver.cs | — | dropped | replaced by TickDriver sync interval + lifecycle hooks (AD-19) |
| Presentation/StageSelectPresenter.cs | src/presentation/screens/StageSelectController.ts | todo | |
| Presentation/UiFactory.cs | src/presentation/ui/* | todo | Preact components (hybrid, pending RFR-48) |

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
