using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Combines account/player data with currently equipped gear to produce the
    /// tap damage KrellPresenter deals. Keeps that arithmetic out of presentation.
    /// </summary>
    public class PlayerCombatService : IPlayerCombatService
    {
        private readonly PlayerStats _playerStats;
        private readonly IEquipmentService _equipmentService;

        public PlayerCombatService(PlayerStats playerStats, IEquipmentService equipmentService)
        {
            _playerStats = playerStats;
            _equipmentService = equipmentService;
        }

        public int CalculateAttackDamage()
        {
            int level = _playerStats != null ? _playerStats.level : 0;
            int damagePerLevel = _playerStats != null ? _playerStats.damagePerLevel : 0;
            int bonusDamage = _equipmentService.Current != null ? _equipmentService.Current.bonusDamage : 0;

            return DamageCalculator.CalculatePlayerDamage(level, damagePerLevel, bonusDamage);
        }
    }
}
