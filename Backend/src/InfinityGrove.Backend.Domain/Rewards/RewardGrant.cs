namespace InfinityGrove.Backend.Domain.Rewards;

/// <summary>
/// A reward the backend decided for an account (boss-drops, AD-001). The server mints <see cref="Id"/>, which the
/// client uses as the item's instance id and to apply a grant at most once; a resent event returns the stored
/// grants of <see cref="SourceClientEventId"/> instead of rolling again.
/// </summary>
public class RewardGrant
{
    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid SourceClientEventId { get; private set; }
    public RewardGrantKind Kind { get; private set; }

    /// <summary>Hero grants only: the hero definition (server hero id) that was granted.</summary>
    public Guid? HeroDefinitionId { get; private set; }

    /// <summary>Hero grants only: false when the account already owned a card of this hero.</summary>
    public bool? IsNewHero { get; private set; }

    /// <summary>Item grants only: the content item id.</summary>
    public string? ItemId { get; private set; }

    /// <summary>Item grants only: JSON array of <c>{ affix, value }</c> rolls.</summary>
    public string? AffixRollsJson { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    private RewardGrant()
    {
    }

    public static RewardGrant ForHero(
        Guid accountId, Guid sourceClientEventId, Guid heroDefinitionId, bool isNewHero, DateTimeOffset nowUtc) =>
        new()
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            SourceClientEventId = sourceClientEventId,
            Kind = RewardGrantKind.Hero,
            HeroDefinitionId = heroDefinitionId,
            IsNewHero = isNewHero,
            CreatedAtUtc = nowUtc,
        };

    public static RewardGrant ForItem(
        Guid accountId, Guid sourceClientEventId, string itemId, string affixRollsJson, DateTimeOffset nowUtc) =>
        new()
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            SourceClientEventId = sourceClientEventId,
            Kind = RewardGrantKind.Item,
            ItemId = itemId,
            AffixRollsJson = affixRollsJson,
            CreatedAtUtc = nowUtc,
        };
}
