using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace InfinityGrove.Presentation
{
    public class MainMenuPresenter : MonoBehaviour
    {
        [SerializeField] private Button _playButton;
        [SerializeField] private Button _configButton;
        [SerializeField] private string _gameSceneName = "Game Scene";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoInitializeOnSceneLoaded()
        {
            var activeScene = SceneManager.GetActiveScene();
            if (activeScene.name == "Main Menu")
            {
                if (FindFirstObjectByType<MainMenuPresenter>() == null)
                {
                    var go = new GameObject("MainMenuPresenterAuto", typeof(MainMenuPresenter));
                    Debug.Log("[MainMenuPresenter] Auto-initialized MainMenuPresenter in 'Main Menu' scene.");
                }
            }
        }

        private void Awake()
        {
            FindButtonsIfMissing();
            BindEvents();
        }

        private void Start()
        {
            FindButtonsIfMissing();
            BindEvents();
        }

        private void OnDestroy()
        {
            UnbindEvents();
        }

        private void FindButtonsIfMissing()
        {
            if (_playButton == null || _configButton == null)
            {
                var buttons = FindObjectsByType<Button>(FindObjectsSortMode.None);
                foreach (var btn in buttons)
                {
                    var textMesh = btn.GetComponentInChildren<TMPro.TMP_Text>();
                    string label = textMesh != null ? textMesh.text : "";
                    if (_playButton == null && (btn.gameObject.name.Equals("Play", System.StringComparison.OrdinalIgnoreCase) ||
                        label.Equals("Play", System.StringComparison.OrdinalIgnoreCase) ||
                        label.Equals("Iniciar", System.StringComparison.OrdinalIgnoreCase) ||
                        label.Equals("Jogar", System.StringComparison.OrdinalIgnoreCase)))
                    {
                        _playButton = btn;
                    }
                    else if (_configButton == null && (btn.gameObject.name.Equals("Configuration", System.StringComparison.OrdinalIgnoreCase) ||
                             label.Equals("Config", System.StringComparison.OrdinalIgnoreCase) ||
                             label.Equals("Configuration", System.StringComparison.OrdinalIgnoreCase)))
                    {
                        _configButton = btn;
                    }
                }
            }
        }

        private void BindEvents()
        {
            if (_playButton != null)
            {
                _playButton.onClick.RemoveListener(OnPlayClicked);
                _playButton.onClick.AddListener(OnPlayClicked);
            }
            if (_configButton != null)
            {
                _configButton.onClick.RemoveListener(OnConfigClicked);
                _configButton.onClick.AddListener(OnConfigClicked);
            }
        }

        private void UnbindEvents()
        {
            if (_playButton != null)
            {
                _playButton.onClick.RemoveListener(OnPlayClicked);
            }
            if (_configButton != null)
            {
                _configButton.onClick.RemoveListener(OnConfigClicked);
            }
        }

        public void OnPlayClicked()
        {
            Debug.Log($"[MainMenuPresenter] Play button clicked! Loading '{_gameSceneName}'...");
            SceneManager.LoadScene(_gameSceneName);
        }

        public void OnConfigClicked()
        {
            Debug.Log("[MainMenuPresenter] Configuration button clicked.");
        }
    }
}
