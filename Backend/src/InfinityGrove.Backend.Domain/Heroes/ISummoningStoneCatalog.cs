namespace InfinityGrove.Backend.Domain.Heroes;

/// <summary>
/// Per-hero Summoning Stone eligibility/pricing data (FR-49/FR-28/FR-29). No
/// admin UI is scoped for v1 (Architecture.md Open Questions) — the
/// config-backed implementation is how content changes are meant to ship,
/// per that note.
/// </summary>
public interface ISummoningStoneCatalog
{
    /// <summary>Null if the hero is not a valid Summoning Stone target at all (unknown to the catalog).</summary>
    SummoningStoneCatalogEntry? GetEntry(Guid heroDefinitionId);
}
