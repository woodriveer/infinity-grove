using InfinityGrove.Presentation;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;
using VContainer.Unity;

namespace InfinityGrove.Bootstrap
{
    /// <summary>
    /// Single composition root for the Unity client. Wires Data-layer assets into
    /// the Service layer and injects the existing Presentation MonoBehaviours
    /// already placed in the scene. No other place in the game may hand-wire
    /// these dependencies with [SerializeField] cross-references.
    /// </summary>
    public class GameLifetimeScope : LifetimeScope
    {
        [Header("Data")]
        [SerializeField] private MonsterData[] _monsterPool;
        [SerializeField] private PlayerStats _playerStats;
        [SerializeField] private Equipment _startingEquipment;

        [Header("Data - Roster, Fusion & Stages (T007)")]
        [SerializeField] private HeroData[] _heroPool;
        [SerializeField] private StageData[] _stagePool;

        [Header("Data - Save Cache, Cloud Sync & Backend Reconciliation (T008)")]
        [SerializeField] private BackendSyncSettings _backendSyncSettings;

        protected override void Configure(IContainerBuilder builder)
        {
            if (_backendSyncSettings == null)
            {
                // Falls back to the class's field defaults rather than crashing the
                // composition root - matches this project's early-development state
                // where data assets aren't all content-authored/wired yet. Assign a
                // "Backend Sync Settings" asset in the Inspector once one exists.
                Debug.LogWarning($"{nameof(GameLifetimeScope)}: no BackendSyncSettings assigned, using defaults (local-only save, no backend URL override).");
                _backendSyncSettings = ScriptableObject.CreateInstance<BackendSyncSettings>();
            }

            builder.RegisterInstance(_monsterPool);
            builder.RegisterInstance(_playerStats);
            builder.RegisterInstance(_startingEquipment);
            builder.RegisterInstance(_heroPool);
            builder.RegisterInstance(_stagePool);
            builder.RegisterInstance(_backendSyncSettings);

            builder.Register<IEquipmentService, EquipmentService>(Lifetime.Singleton);
            builder.Register<IPlayerCombatService, PlayerCombatService>(Lifetime.Singleton);
            builder.Register<ICombatService, CombatService>(Lifetime.Singleton);

            builder.Register<IRosterService, RosterService>(Lifetime.Singleton);
            builder.Register<IFusionService, FusionService>(Lifetime.Singleton);
            builder.Register<IEquipmentInventoryService, EquipmentInventoryService>(Lifetime.Singleton);
            builder.Register<ILoadoutPresetService, LoadoutPresetService>(Lifetime.Singleton);
            builder.Register<ICraftingService, CraftingService>(Lifetime.Singleton);
            builder.Register<IStageService, StageService>(Lifetime.Singleton);

            // Save cache, Steam Cloud sync, offline accrual & backend reconciliation (T008).
            // LocalOnlyCloudStore/DevSteamIdentityProvider are the default, SDK-free
            // implementations - swap them for FacepunchSteamCloudStore/
            // FacepunchSteamIdentityProvider once Facepunch.Steamworks is imported
            // (see those classes' doc comments for the enablement steps).
            builder.Register<ISaveFileStore, EncryptedSaveFileStore>(Lifetime.Singleton)
                .WithParameter("fileName", _backendSyncSettings.saveFileName);
            builder.Register<ISteamCloudStore, LocalOnlyCloudStore>(Lifetime.Singleton);
            builder.Register<ISteamIdentityProvider, DevSteamIdentityProvider>(Lifetime.Singleton);
            builder.Register<IBackendApiClient, BackendApiClient>(Lifetime.Singleton);
            builder.Register<IPlayerEventLog, PlayerEventLog>(Lifetime.Singleton);
            builder.Register<ISaveSyncService, SaveSyncService>(Lifetime.Singleton);

            builder.RegisterComponentInHierarchy<CombatPresenter>();
            builder.RegisterComponentInHierarchy<KrellPresenter>();
            builder.RegisterComponentInHierarchy<MonsterPresenter>();

            builder.RegisterComponentInHierarchy<RosterPresenter>();
            builder.RegisterComponentInHierarchy<FusionPresenter>();
            builder.RegisterComponentInHierarchy<EquipmentPresenter>();
            builder.RegisterComponentInHierarchy<CraftingPresenter>();
            builder.RegisterComponentInHierarchy<LoadoutPresetPresenter>();
            builder.RegisterComponentInHierarchy<StageSelectPresenter>();

            // Neither of these needs an Inspector-wired container reference (unlike
            // the presenters above), so they're spawned on their own GameObject at
            // container build time rather than requiring a scene-authored placement.
            builder.RegisterComponentOnNewGameObject<SaveSyncDriver>(Lifetime.Singleton, nameof(SaveSyncDriver));
            builder.RegisterComponentOnNewGameObject<ReconciliationNotificationPresenter>(Lifetime.Singleton, nameof(ReconciliationNotificationPresenter));
        }
    }
}
