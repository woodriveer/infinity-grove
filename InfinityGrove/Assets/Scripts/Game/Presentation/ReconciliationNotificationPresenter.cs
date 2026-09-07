using System.Collections;
using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using UnityEngine.UI;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Surfaces exactly the two save-sync moments the player needs to see (AD-6):
    /// a rejected event correcting their local state, and a "welcome back" offline
    /// gold summary (FR-41). Everything else about reconciliation stays silent by
    /// design - see ISaveSyncService's doc comment. Builds its own toast overlay
    /// at runtime so it works without any scene wiring beyond adding this
    /// component (RegisterComponentInHierarchy in GameLifetimeScope).
    /// </summary>
    public class ReconciliationNotificationPresenter : MonoBehaviour
    {
        [SerializeField] private float _displaySeconds = 6f;

        private ISaveSyncService _saveSyncService;
        private RectTransform _container;

        [Inject]
        public void Construct(ISaveSyncService saveSyncService)
        {
            _saveSyncService = saveSyncService;
        }

        private void OnEnable()
        {
            EnsureOverlay();
            _saveSyncService.OnCorrectionSurfaced += HandleCorrection;
            _saveSyncService.OnOfflineAccrualApplied += HandleOfflineAccrual;
        }

        private void OnDisable()
        {
            _saveSyncService.OnCorrectionSurfaced -= HandleCorrection;
            _saveSyncService.OnOfflineAccrualApplied -= HandleOfflineAccrual;
        }

        private void HandleCorrection(ReconciliationCorrection correction)
        {
            ShowToast(correction.ToPlayerMessage(), new Color(0.9f, 0.55f, 0.1f));
        }

        private void HandleOfflineAccrual(OfflineAccrualResult result)
        {
            var hours = result.ElapsedCredited.TotalHours;
            var cappedSuffix = result.WasCapped ? " (capped)" : "";
            ShowToast($"Welcome back! Your Active Squad earned {result.GoldAccrued} gold over {hours:0.#}h offline{cappedSuffix}.", new Color(0.3f, 0.85f, 0.3f));
        }

        private void ShowToast(string message, Color accentColor)
        {
            var row = UiFactory.CreateRow(_container, "Toast");

            var background = row.gameObject.AddComponent<Image>();
            background.color = new Color(0.1f, 0.1f, 0.12f, 0.92f);

            UiFactory.CreateLabel(row, message, 22, accentColor);

            StartCoroutine(RemoveAfterDelay(row.gameObject, _displaySeconds));
        }

        private IEnumerator RemoveAfterDelay(GameObject toast, float delay)
        {
            yield return new WaitForSeconds(delay);
            if (toast != null) Destroy(toast);
        }

        private void EnsureOverlay()
        {
            if (_container != null) return;

            var canvasGo = new GameObject("ReconciliationNotificationCanvas", typeof(RectTransform));
            canvasGo.transform.SetParent(transform, false);

            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 1000;

            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);

            canvasGo.AddComponent<GraphicRaycaster>();

            var containerGo = new GameObject("Toasts", typeof(RectTransform));
            containerGo.transform.SetParent(canvasGo.transform, false);
            _container = containerGo.GetComponent<RectTransform>();
            _container.anchorMin = new Vector2(1f, 1f);
            _container.anchorMax = new Vector2(1f, 1f);
            _container.pivot = new Vector2(1f, 1f);
            _container.anchoredPosition = new Vector2(-24f, -24f);
            _container.sizeDelta = new Vector2(480f, 0f);

            UiFactory.PrepareListContainer(_container);
        }
    }
}
