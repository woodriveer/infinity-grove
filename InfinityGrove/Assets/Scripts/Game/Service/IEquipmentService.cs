using System;

namespace InfinityGrove.Service
{
    public interface IEquipmentService
    {
        Equipment Current { get; }

        event Action<Equipment> OnEquipmentChanged;

        void Equip(Equipment item);
        void Unequip();
    }
}
