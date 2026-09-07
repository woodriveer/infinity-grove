using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>Fusion preview and execution for one owned hero (PRD FR-6/FR-7).</summary>
    public interface IFusionService
    {
        FusionPreview GetPreview(HeroEntity hero);

        /// <summary>Consumes duplicates and advances one star tier. Returns false if not eligible.</summary>
        bool TryFuse(HeroEntity hero);
    }
}
