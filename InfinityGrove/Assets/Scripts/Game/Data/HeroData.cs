using System;
using InfinityGrove.Domain;
using UnityEngine;

/// <summary>
/// Design-time definition of a collectible hero card (PRD FR-2/FR-6). Runtime
/// fusion/ownership state lives in <see cref="InfinityGrove.Domain.HeroEntity"/>,
/// never on this asset.
/// </summary>
[CreateAssetMenu(fileName = "New Hero", menuName = "Infinity Grove/Hero Data")]
public class HeroData : ScriptableObject
{
    [Tooltip("Stable identifier used for save data and roster lookups. Must be unique across all heroes.")]
    public string heroId;

    [Tooltip("The backend's HeroDefinitionId (Guid) for this hero, per the content catalog config (Architecture AD-2's Domain layer / SummoningStoneCatalogOptions). Empty until this hero's server-side definition is content-authored - see HeroData.TryGetServerHeroId.")]
    public string serverHeroId;

    public string displayName;
    public HeroType heroType;
    public Sprite portrait;
    public int basePower = 10;

    [Tooltip("Ability/flavor text unlocked at each star tier, index 0 = 1★ .. index 11 = 12★.")]
    [TextArea]
    public string[] abilityByStarTier = new string[12];

    public string GetAbilityDescription(int starTier)
    {
        int index = Mathf.Clamp(starTier - 1, 0, abilityByStarTier.Length - 1);
        return abilityByStarTier != null && abilityByStarTier.Length > index && !string.IsNullOrEmpty(abilityByStarTier[index])
            ? abilityByStarTier[index]
            : "No ability data configured for this tier.";
    }

    /// <summary>Save/backend sync (AD-6/AD-9) needs the server's Guid identity for this hero to build event payloads and reconcile roster state; returns false for content not yet mapped to a server-side hero definition.</summary>
    public bool TryGetServerHeroId(out Guid id) => Guid.TryParse(serverHeroId, out id);
}
