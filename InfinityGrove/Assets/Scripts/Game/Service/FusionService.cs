using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Per Scope Decision D1, fusion permanently consumes duplicate cards; this
    /// service is the only place that calls <see cref="HeroEntity.ApplyFusion"/>.
    /// </summary>
    public class FusionService : IFusionService
    {
        public FusionPreview GetPreview(HeroEntity hero)
        {
            bool isMax = hero.StarTier >= FusionRules.MaxStarTier;
            int required = FusionRules.DuplicatesRequiredForNextTier(hero.StarTier);
            bool canFuse = !isMax && FusionRules.CanFuse(hero.StarTier, hero.DuplicatesOwned);
            string nextAbility = isMax ? "Max star tier reached." : hero.Data.GetAbilityDescription(hero.StarTier + 1);

            return new FusionPreview(hero.StarTier, hero.DuplicatesOwned, required, nextAbility, canFuse, isMax);
        }

        public bool TryFuse(HeroEntity hero)
        {
            if (hero == null) return false;

            var preview = GetPreview(hero);
            if (!preview.CanFuse) return false;

            hero.ApplyFusion(preview.DuplicatesRequired);
            return true;
        }
    }
}
