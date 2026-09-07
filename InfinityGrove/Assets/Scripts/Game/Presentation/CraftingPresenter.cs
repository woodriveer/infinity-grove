using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Crafting/enchanting screen (PRD FR-22 AC): shows the current roll, re-roll
    /// cost and possible range for each affix on the equipment item currently
    /// selected in <see cref="EquipmentPresenter"/>'s bag/slots view, before the
    /// player commits currency.
    /// </summary>
    public class CraftingPresenter : MonoBehaviour
    {
        [Header("Containers")]
        [SerializeField] private Transform _affixContainer;

        private ICraftingService _craftingService;
        private EquipmentInstance _selectedItem;

        [Inject]
        public void Construct(ICraftingService craftingService)
        {
            _craftingService = craftingService;
        }

        /// <summary>Called by the equipment screen (or any picker) when an item is chosen for crafting.</summary>
        public void SelectItem(EquipmentInstance item)
        {
            _selectedItem = item;
            Refresh();
        }

        private void OnEnable()
        {
            UiFactory.PrepareListContainer(_affixContainer);
            Refresh();
        }

        private void Refresh()
        {
            UiFactory.ClearChildren(_affixContainer);

            if (_selectedItem == null)
            {
                UiFactory.CreateLabel(_affixContainer, "Select an equipment item to craft.");
                return;
            }

            UiFactory.CreateLabel(_affixContainer, _selectedItem.Data.displayName, 26);

            foreach (var affix in CraftingRules.AffixesForSlot(_selectedItem.Data.slot))
            {
                var preview = _craftingService.GetPreview(_selectedItem, affix);
                var row = UiFactory.CreateRow(_affixContainer, affix.ToString());

                UiFactory.CreateLabel(row, $"{affix}: {preview.CurrentRoll:0.0} (range {preview.MinRoll:0.0}-{preview.MaxRoll:0.0})", 20);
                UiFactory.CreateButton(row, $"Reroll ({preview.RerollCost}g)", () =>
                {
                    if (_craftingService.TryReroll(_selectedItem, affix))
                        Refresh();
                });
            }
        }
    }
}
