using System;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Holds Krell's currently equipped item. Plain C#, registered as a singleton
    /// in the composition root so any presenter can react to equip changes.
    /// </summary>
    public class EquipmentService : IEquipmentService
    {
        public Equipment Current { get; private set; }

        public event Action<Equipment> OnEquipmentChanged;

        public EquipmentService(Equipment startingEquipment)
        {
            Current = startingEquipment;
        }

        public void Equip(Equipment item)
        {
            Current = item;
            OnEquipmentChanged?.Invoke(Current);
        }

        public void Unequip()
        {
            Current = null;
            OnEquipmentChanged?.Invoke(null);
        }
    }
}
