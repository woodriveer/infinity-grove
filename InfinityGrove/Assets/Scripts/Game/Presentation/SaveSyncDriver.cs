using System;
using System.Collections;
using System.Threading;
using System.Threading.Tasks;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Thin MonoBehaviour driving <see cref="ISaveSyncService"/> from Unity's
    /// lifecycle (AD-1: presentation holds no gameplay state, it only forwards
    /// engine events to the service layer). Runs the initial load/reconcile at
    /// startup, syncs periodically while the game is running, and flushes on
    /// pause/quit (AD-6/AD-9).
    /// </summary>
    public class SaveSyncDriver : MonoBehaviour
    {
        private ISaveSyncService _saveSyncService;
        private BackendSyncSettings _settings;
        private CancellationTokenSource _cts;

        [Inject]
        public void Construct(ISaveSyncService saveSyncService, BackendSyncSettings settings)
        {
            _saveSyncService = saveSyncService;
            _settings = settings;
        }

        private async void Start()
        {
            _cts = new CancellationTokenSource();

            try
            {
                await _saveSyncService.InitializeAsync(_cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogError($"SaveSyncDriver: initialization failed, continuing with local-only state. {ex}");
            }

            StartCoroutine(PeriodicSyncLoop());
        }

        private IEnumerator PeriodicSyncLoop()
        {
            var wait = new WaitForSeconds(Mathf.Max(5f, _settings.syncIntervalSeconds));
            while (true)
            {
                yield return wait;
                _ = SyncSafelyAsync();
            }
        }

        private async Task SyncSafelyAsync()
        {
            if (_cts == null || _cts.IsCancellationRequested) return;

            try
            {
                await _saveSyncService.SyncNowAsync(_cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"SaveSyncDriver: sync attempt failed, will retry on the next interval. {ex.Message}");
            }
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (!pauseStatus) return;

            // Guarantee the local+cloud copy is current immediately (synchronous-
            // feeling); also best-effort try to reach the backend before the OS
            // may suspend the process.
            _saveSyncService.PersistLocalAndCloud();
            _ = SyncSafelyAsync();
        }

        private void OnApplicationQuit()
        {
            _saveSyncService.PersistLocalAndCloud();
            _cts?.Cancel();
        }

        private void OnDestroy()
        {
            _cts?.Cancel();
            _cts?.Dispose();
        }
    }
}
