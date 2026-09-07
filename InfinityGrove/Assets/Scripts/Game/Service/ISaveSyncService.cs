using System;
using System.Threading;
using System.Threading.Tasks;
using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Orchestrates the local save cache, Steam Cloud sync, offline gold accrual
    /// and backend reconciliation (PRD FR-41/FR-43/FR-44, Architecture AD-6/AD-9).
    /// A plain service class per AD-1 - InfinityGrove.Presentation.SaveSyncDriver
    /// is the thin MonoBehaviour that calls this from Unity lifecycle events.
    /// </summary>
    public interface ISaveSyncService
    {
        /// <summary>Raised only when the backend rejects a locally-applied action (AD-6) - every other reconciliation happens silently.</summary>
        event Action<ReconciliationCorrection> OnCorrectionSurfaced;

        /// <summary>Raised once at startup if any offline gold was credited (FR-41), so the UI can show a "welcome back" summary.</summary>
        event Action<OfflineAccrualResult> OnOfflineAccrualApplied;

        /// <summary>Loads the local cache (pulling a newer Steam Cloud copy first), seeds live services, applies offline accrual, and attempts an initial backend reconciliation. Safe to call once at boot; playable immediately even if the backend is unreachable.</summary>
        Task InitializeAsync(CancellationToken cancellationToken);

        /// <summary>Flushes any pending local events to the backend, applies the returned canonical state, and persists locally + to Steam Cloud. Called periodically and on pause/quit.</summary>
        Task SyncNowAsync(CancellationToken cancellationToken);

        /// <summary>Persists the current state to the local encrypted file and pushes it to Steam Cloud, without contacting the backend. Used as a fast, synchronous-feeling save on quit before an async flush can complete.</summary>
        void PersistLocalAndCloud();
    }
}
