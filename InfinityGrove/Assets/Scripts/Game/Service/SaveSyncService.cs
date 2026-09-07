using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BreakInfinity;
using InfinityGrove.Domain;
using UnityEngine;

namespace InfinityGrove.Service
{
    /// <inheritdoc cref="ISaveSyncService"/>
    public class SaveSyncService : ISaveSyncService
    {
        private readonly ISaveFileStore _fileStore;
        private readonly ISteamCloudStore _cloudStore;
        private readonly ISteamIdentityProvider _steamIdentity;
        private readonly IBackendApiClient _backendApi;
        private readonly IPlayerEventLog _eventLog;
        private readonly ICombatService _combatService;
        private readonly IStageService _stageService;
        private readonly IRosterService _rosterService;
        private readonly BackendSyncSettings _settings;
        private readonly Dictionary<Guid, HeroData> _heroByServerId = new Dictionary<Guid, HeroData>();

        private SaveGameData _saveData;
        private bool _initialized;
        private bool _suppressLocalEventCapture;
        private int _lastKnownGold;
        private readonly Dictionary<string, int> _previousOwnedByHeroId = new Dictionary<string, int>();
        private readonly HashSet<string> _previousActiveSquadHeroIds = new HashSet<string>();

        public event Action<ReconciliationCorrection> OnCorrectionSurfaced;
        public event Action<OfflineAccrualResult> OnOfflineAccrualApplied;

        public SaveSyncService(
            ISaveFileStore fileStore,
            ISteamCloudStore cloudStore,
            ISteamIdentityProvider steamIdentity,
            IBackendApiClient backendApi,
            IPlayerEventLog eventLog,
            ICombatService combatService,
            IStageService stageService,
            IRosterService rosterService,
            HeroData[] heroPool,
            BackendSyncSettings settings)
        {
            _fileStore = fileStore;
            _cloudStore = cloudStore;
            _steamIdentity = steamIdentity;
            _backendApi = backendApi;
            _eventLog = eventLog;
            _combatService = combatService;
            _stageService = stageService;
            _rosterService = rosterService;
            _settings = settings;

            foreach (var hero in heroPool ?? Array.Empty<HeroData>())
            {
                if (hero != null && hero.TryGetServerHeroId(out var id))
                {
                    _heroByServerId[id] = hero;
                }
            }
        }

        public async Task InitializeAsync(CancellationToken cancellationToken)
        {
            if (_initialized) return;
            _initialized = true;

            _cloudStore.PullIfNewer(_fileStore.FilePath, _settings.saveFileName);
            _saveData = _fileStore.Load() ?? SaveGameData.CreateNew(DateTimeOffset.UtcNow);

            using (Suppress())
            {
                ApplyStateToLiveServices(_saveData.CanonicalState);
            }

            _eventLog.SeedSequence(_saveData.NextSequenceNumber);
            _eventLog.LoadPending(_saveData.PendingEvents);

            ResetBaselines();
            SubscribeToGameplayEvents();

            ApplyOfflineAccrual();

            var ticket = _steamIdentity.TryGetAuthTicketHex();
            var authenticated = await _backendApi.AuthenticateWithSteamAsync(ticket, cancellationToken);
            if (authenticated)
            {
                var serverState = await _backendApi.GetStateAsync(cancellationToken);
                if (serverState != null)
                {
                    ApplyCanonicalStateSilently(serverState);
                }

                await FlushPendingEventsAsync(cancellationToken);
            }

            PersistLocalAndCloud();
        }

        public async Task SyncNowAsync(CancellationToken cancellationToken)
        {
            if (!_initialized) return;

            if (!_backendApi.IsAuthenticated)
            {
                var ticket = _steamIdentity.TryGetAuthTicketHex();
                var authenticated = await _backendApi.AuthenticateWithSteamAsync(ticket, cancellationToken);
                if (!authenticated)
                {
                    PersistLocalAndCloud();
                    return;
                }
            }

            await FlushPendingEventsAsync(cancellationToken);
            PersistLocalAndCloud();
        }

        public void PersistLocalAndCloud()
        {
            if (_saveData == null) return;

            _saveData.LastSeenUtc = DateTimeOffset.UtcNow;
            _saveData.PendingEvents = _eventLog.PendingEvents.ToList();
            _saveData.NextSequenceNumber = _eventLog.NextSequenceNumber;

            _fileStore.Save(_saveData);
            _cloudStore.Push(_fileStore.FilePath, _settings.saveFileName);
        }

        private void ApplyOfflineAccrual()
        {
            var nowUtc = DateTimeOffset.UtcNow;
            var squadPower = CalculateActiveSquadPower();
            var cap = TimeSpan.FromHours(Math.Max(_settings.offlineAccrualCapHours, 0f));

            var accrual = OfflineAccrualCalculator.Calculate(
                _saveData.LastSeenUtc, nowUtc, squadPower, _settings.idleGoldPerSquadPowerPerHour, cap);

            if (accrual.GoldAccrued.Sign() <= 0) return;

            var goldToAdd = ConvertToInt(accrual.GoldAccrued);
            if (goldToAdd <= 0) return;

            // Not suppressed: this is a real earn, and should sync like any other (FR-41).
            _combatService.AddGold(goldToAdd);
            OnOfflineAccrualApplied?.Invoke(accrual);
        }

        private int CalculateActiveSquadPower() =>
            _rosterService.ActiveSquad.Sum(h => h.Data.basePower * h.StarTier);

        private async Task FlushPendingEventsAsync(CancellationToken cancellationToken)
        {
            if (!_backendApi.IsAuthenticated) return;

            var pending = _eventLog.PendingEvents;
            if (pending.Count == 0) return;

            var wireEvents = pending.Select(ToWireEvent).ToList();
            var response = await _backendApi.IngestBatchAsync(wireEvents, cancellationToken);
            if (response == null) return; // Unreachable - pending events stay queued for the next attempt.

            foreach (var result in response.Results)
            {
                var original = pending.FirstOrDefault(e => e.ClientEventId == result.ClientEventId);
                var accepted = string.Equals(result.Status, "Accepted", StringComparison.OrdinalIgnoreCase);
                var status = accepted ? PlayerEventSyncStatus.Accepted : PlayerEventSyncStatus.Rejected;

                if (!accepted && original != null)
                {
                    OnCorrectionSurfaced?.Invoke(new ReconciliationCorrection(
                        original.Type, result.RejectionReason ?? "Unknown reason.", DateTimeOffset.UtcNow));
                }

                _eventLog.ApplyResult(result.ClientEventId, status, result.RejectionReason);
            }

            if (response.State != null)
            {
                ApplyCanonicalStateSilently(response.State);
            }
        }

        private void ApplyCanonicalStateSilently(PlayerStateWireDto wire)
        {
            var snapshot = ToSnapshot(wire);

            using (Suppress())
            {
                ApplyStateToLiveServices(snapshot);
            }

            _saveData.CanonicalState = snapshot;
            _eventLog.SeedSequence(snapshot.LastAppliedSequence + 1);
            ResetBaselines();
        }

        private void ApplyStateToLiveServices(PlayerStateSnapshot state)
        {
            _combatService.SetGold(ConvertToInt(state.Gold));
            _stageService.ReconcileFurthestClearedStage(state.FurthestStageCleared);

            foreach (var entry in state.Roster)
            {
                if (_heroByServerId.TryGetValue(entry.HeroDefinitionId, out var heroData))
                {
                    // Backend star tiers are 0-based (first copy, not yet fused); the
                    // client's HeroEntity star tiers are 1-based (PRD FR-6) - see
                    // RosterEntrySnapshot's doc comment.
                    _rosterService.ReconcileHero(heroData, entry.OwnedCount, entry.StarTier + 1);
                }
            }

            var activeHeroes = new List<HeroEntity>();
            foreach (var id in state.ActiveSquadHeroIds)
            {
                if (_heroByServerId.TryGetValue(id, out var heroData))
                {
                    var hero = _rosterService.FindByHeroId(heroData.heroId);
                    if (hero != null) activeHeroes.Add(hero);
                }
            }
            _rosterService.ReconcileActiveSquad(activeHeroes);
        }

        private void SubscribeToGameplayEvents()
        {
            _combatService.OnGoldChanged += HandleGoldChanged;
            _stageService.OnStageAttempted += HandleStageAttempted;
            _rosterService.OnRosterChanged += HandleRosterChanged;
        }

        private void HandleGoldChanged(int newGold)
        {
            if (_suppressLocalEventCapture)
            {
                _lastKnownGold = newGold;
                return;
            }

            var delta = newGold - _lastKnownGold;
            _lastKnownGold = newGold;
            if (delta == 0) return;

            if (delta > 0)
            {
                var big = (BigDouble)(double)delta;
                _eventLog.Append(PlayerEventType.GoldEarned, new GoldEarnedPayload { GoldMantissa = big.Mantissa, GoldExponent = big.Exponent });
            }
            else
            {
                var big = (BigDouble)(double)(-delta);
                _eventLog.Append(PlayerEventType.GoldSpent, new GoldSpentPayload { GoldMantissa = big.Mantissa, GoldExponent = big.Exponent });
            }
        }

        private void HandleStageAttempted(StageData stage, StageOutcome outcome)
        {
            if (_suppressLocalEventCapture) return;
            if (outcome != StageOutcome.Success) return;

            _eventLog.Append(PlayerEventType.StageCleared, new StageClearedPayload { StageNumber = stage.stageNumber });
        }

        private void HandleRosterChanged()
        {
            if (_suppressLocalEventCapture)
            {
                ResetBaselines();
                return;
            }

            foreach (var hero in _rosterService.AllHeroes)
            {
                var currentOwned = hero.DuplicatesOwned + 1;
                _previousOwnedByHeroId.TryGetValue(hero.Data.heroId, out var previousOwned);

                if (currentOwned <= previousOwned) continue;

                if (!hero.Data.TryGetServerHeroId(out var serverId))
                {
                    Debug.LogWarning($"SaveSyncService: hero '{hero.Data.heroId}' has no serverHeroId mapping; acquisition will not sync to the backend.");
                    continue;
                }

                for (var i = previousOwned; i < currentOwned; i++)
                {
                    _eventLog.Append(PlayerEventType.HeroAcquired, new HeroAcquiredPayload { HeroDefinitionId = serverId });
                }
            }

            var currentActiveIds = _rosterService.ActiveSquad.Select(h => h.Data.heroId).ToHashSet();
            if (!currentActiveIds.SetEquals(_previousActiveSquadHeroIds))
            {
                var mappedIds = new List<Guid>();
                var allMapped = true;
                foreach (var hero in _rosterService.ActiveSquad)
                {
                    if (hero.Data.TryGetServerHeroId(out var id)) mappedIds.Add(id);
                    else allMapped = false;
                }

                if (allMapped)
                {
                    _eventLog.Append(PlayerEventType.ActiveSquadChanged, new ActiveSquadChangedPayload { HeroDefinitionIds = mappedIds });
                }
                else
                {
                    Debug.LogWarning("SaveSyncService: Active Squad contains a hero with no serverHeroId mapping; squad change will not sync to the backend.");
                }
            }

            ResetBaselines();
        }

        /// <summary>Re-reads current live-service state into the diff baselines, without emitting any events. Called after any server-driven (silent) state change, and once at startup.</summary>
        private void ResetBaselines()
        {
            _lastKnownGold = _combatService.Gold;

            _previousOwnedByHeroId.Clear();
            foreach (var hero in _rosterService.AllHeroes)
            {
                _previousOwnedByHeroId[hero.Data.heroId] = hero.DuplicatesOwned + 1;
            }

            _previousActiveSquadHeroIds.Clear();
            foreach (var hero in _rosterService.ActiveSquad)
            {
                _previousActiveSquadHeroIds.Add(hero.Data.heroId);
            }
        }

        private IDisposable Suppress() => new SuppressScope(this);

        private sealed class SuppressScope : IDisposable
        {
            private readonly SaveSyncService _owner;

            public SuppressScope(SaveSyncService owner)
            {
                _owner = owner;
                _owner._suppressLocalEventCapture = true;
            }

            public void Dispose() => _owner._suppressLocalEventCapture = false;
        }

        private static int ConvertToInt(BigDouble value)
        {
            var asDouble = value.ToDouble();
            if (double.IsNaN(asDouble)) return 0;
            if (asDouble <= 0) return 0;
            // T007's CombatService.Gold is still `int` (AD-7: big-number types migrate
            // in as the systems that own them are touched, not in a blanket pass) -
            // clamp rather than overflow until that migration happens.
            if (asDouble >= int.MaxValue) return int.MaxValue;
            return (int)Math.Round(asDouble);
        }

        private static IngestEventWireDto ToWireEvent(PlayerEventRecord record) => new IngestEventWireDto
        {
            ClientEventId = record.ClientEventId,
            SequenceNumber = record.SequenceNumber,
            Type = record.Type.ToString(),
            OccurredAtUtc = record.OccurredAtUtc,
            Payload = new JsonRawPayload(record.PayloadJson),
        };

        private static PlayerStateSnapshot ToSnapshot(PlayerStateWireDto wire) => new PlayerStateSnapshot
        {
            GoldMantissa = wire.GoldMantissa,
            GoldExponent = wire.GoldExponent,
            FurthestStageCleared = wire.FurthestStageCleared,
            LastAppliedSequence = wire.LastAppliedSequence,
            Roster = wire.Roster.Select(r => new RosterEntrySnapshot
            {
                HeroDefinitionId = r.HeroDefinitionId,
                OwnedCount = r.OwnedCount,
                StarTier = r.StarTier,
            }).ToList(),
            ActiveSquadHeroIds = new List<Guid>(wire.ActiveSquadHeroIds),
        };
    }
}
