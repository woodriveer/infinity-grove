/** Four equipment slots per hero (PRD FR-19). Order matches the Unity enum. */
export const EQUIPMENT_SLOTS = ['Weapon', 'Chest', 'Boots', 'Gloves'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
