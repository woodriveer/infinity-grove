using InfinityGrove.Domain;
using InfinityGrove.Service;
using UnityEngine;
using VContainer;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Equipment screen (PRD FR-19/FR-20): pick an owned hero, see their 4 equip
    /// slots, and equip items from the shared account-wide bag.
    /// </summary>
    public class EquipmentPresenter : MonoBehaviour
    {
        private static readonly EquipmentSlot[] Slots = { EquipmentSlot.Weapon, EquipmentSlot.Chest, EquipmentSlot.Boots, EquipmentSlot.Gloves };

        [Header("Containers")]
        [SerializeField] private Transform _heroSelectContainer;
        [SerializeField] private Transform _slotsContainer;
        [SerializeField] private Transform _bagContainer;

        private IRosterService _rosterService;
        private IEquipmentInventoryService _equipmentInventoryService;
        private HeroEntity _selectedHero;

        [Inject]
        public void Construct(IRosterService rosterService, IEquipmentInventoryService equipmentInventoryService)
        {
            _rosterService = rosterService;
            _equipmentInventoryService = equipmentInventoryService;
        }

        private void OnEnable()
        {
            UiFactory.PrepareListContainer(_heroSelectContainer);
            UiFactory.PrepareListContainer(_slotsContainer);
            UiFactory.PrepareListContainer(_bagContainer);

            _rosterService.OnRosterChanged += RefreshHeroSelect;
            _equipmentInventoryService.OnBagChanged += RefreshAll;
            _equipmentInventoryService.OnEquippedChanged += HandleEquippedChanged;
            RefreshHeroSelect();
        }

        private void OnDisable()
        {
            _rosterService.OnRosterChanged -= RefreshHeroSelect;
            _equipmentInventoryService.OnBagChanged -= RefreshAll;
            _equipmentInventoryService.OnEquippedChanged -= HandleEquippedChanged;
        }

        private void HandleEquippedChanged(string heroId) => RefreshAll();

        public HeroEntity SelectedHero => _selectedHero;

        private void RefreshHeroSelect()
        {
            UiFactory.ClearChildren(_heroSelectContainer);

            foreach (var hero in _rosterService.AllHeroes)
            {
                var row = UiFactory.CreateRow(_heroSelectContainer, hero.Data.displayName);
                UiFactory.CreateLabel(row, hero.Data.displayName, 22);
                UiFactory.CreateButton(row, "Select", () => Select(hero));
            }

            if (_selectedHero == null && _rosterService.AllHeroes.Count > 0)
                Select(_rosterService.AllHeroes[0]);
            else
                RefreshAll();
        }

        private void Select(HeroEntity hero)
        {
            _selectedHero = hero;
            RefreshAll();
        }

        private void RefreshAll()
        {
            RefreshSlots();
            RefreshBag();
        }

        private void RefreshSlots()
        {
            UiFactory.ClearChildren(_slotsContainer);

            if (_selectedHero == null)
            {
                UiFactory.CreateLabel(_slotsContainer, "No hero selected.");
                return;
            }

            var equipped = _equipmentInventoryService.GetEquipped(_selectedHero.Data.heroId);

            foreach (var slot in Slots)
            {
                var row = UiFactory.CreateRow(_slotsContainer, slot.ToString());
                bool hasItem = equipped.TryGetValue(slot, out var item);

                UiFactory.CreateLabel(row, $"{slot}: {(hasItem ? item.Data.displayName : "(empty)")}", 22);

                if (hasItem)
                {
                    UiFactory.CreateButton(row, "Unequip", () => _equipmentInventoryService.Unequip(_selectedHero.Data.heroId, slot));
                }
            }
        }

        private void RefreshBag()
        {
            UiFactory.ClearChildren(_bagContainer);
            UiFactory.CreateLabel(_bagContainer, $"Bag ({_equipmentInventoryService.Bag.Count})", 22);

            foreach (var item in _equipmentInventoryService.Bag)
            {
                var row = UiFactory.CreateRow(_bagContainer, item.Data.displayName);
                UiFactory.CreateLabel(row, $"{item.Data.displayName} [{item.Data.slot}/{item.Data.archetype}]", 20);

                bool canEquip = _selectedHero != null;
                UiFactory.CreateButton(row, "Equip", () =>
                {
                    if (_selectedHero != null)
                        _equipmentInventoryService.TryEquip(_selectedHero.Data.heroId, item);
                }, canEquip);
            }
        }
    }
}
