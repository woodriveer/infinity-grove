using TMPro;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Small runtime-UI helper shared by the roster/fusion/equipment/crafting/
    /// stage-select presenters. These screens build their list rows in code so
    /// each presenter only needs a single empty container assigned in the
    /// Inspector, rather than a hand-authored prefab per row type.
    /// </summary>
    public static class UiFactory
    {
        public static TextMeshProUGUI CreateLabel(Transform parent, string text, int fontSize = 28, Color? color = null)
        {
            var go = new GameObject("Label", typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var label = go.AddComponent<TextMeshProUGUI>();
            label.text = text;
            label.fontSize = fontSize;
            label.color = color ?? Color.white;
            label.enableWordWrapping = true;

            return label;
        }

        public static Button CreateButton(Transform parent, string label, UnityAction onClick, bool interactable = true)
        {
            var go = new GameObject(label + " Button", typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var image = go.AddComponent<Image>();
            image.color = new Color(0.2f, 0.2f, 0.25f, 1f);

            var button = go.AddComponent<Button>();
            button.interactable = interactable;
            if (onClick != null)
                button.onClick.AddListener(onClick);

            var layout = go.AddComponent<LayoutElement>();
            layout.minHeight = 48;
            layout.minWidth = 140;

            CreateLabel(go.transform, label, 24).alignment = TextAlignmentOptions.Center;
            var labelRect = go.transform.GetChild(0).GetComponent<RectTransform>();
            labelRect.anchorMin = Vector2.zero;
            labelRect.anchorMax = Vector2.one;
            labelRect.offsetMin = Vector2.zero;
            labelRect.offsetMax = Vector2.zero;

            return button;
        }

        public static RectTransform CreateRow(Transform parent, string name = "Row")
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);

            var layout = go.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = 12;
            layout.childControlHeight = true;
            layout.childControlWidth = false;
            layout.childForceExpandHeight = false;
            layout.childForceExpandWidth = false;
            layout.childAlignment = TextAnchor.MiddleLeft;

            var fitter = go.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            var element = go.AddComponent<LayoutElement>();
            element.minHeight = 52;

            return go.GetComponent<RectTransform>();
        }

        public static void ClearChildren(Transform container)
        {
            if (container == null) return;

            for (int i = container.childCount - 1; i >= 0; i--)
                Object.Destroy(container.GetChild(i).gameObject);
        }

        /// <summary>
        /// Ensures a container assigned in the Inspector stacks the rows built by
        /// <see cref="CreateRow"/>/<see cref="CreateLabel"/> vertically. Safe to call
        /// every frame/refresh - it only adds the components once.
        /// </summary>
        public static void PrepareListContainer(Transform container)
        {
            if (container == null) return;

            var go = container.gameObject;
            if (!go.TryGetComponent<VerticalLayoutGroup>(out var layout))
                layout = go.AddComponent<VerticalLayoutGroup>();
            layout.spacing = 6;
            layout.childControlHeight = true;
            layout.childControlWidth = true;
            layout.childForceExpandHeight = false;
            layout.childForceExpandWidth = true;

            if (!go.TryGetComponent<ContentSizeFitter>(out var fitter))
                fitter = go.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        }
    }
}
