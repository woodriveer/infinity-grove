using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Cards;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.Backend.Tests.Events;

/// <summary>Repositories over plain collections, the same shape VectorGen's event-validation family uses.</summary>
internal sealed class InMemoryProgressRepository : IPlayerProgressRepository
{
    private readonly Dictionary<Guid, PlayerProgress> _rows = new();

    public PlayerProgress? Find(Guid accountId) => _rows.GetValueOrDefault(accountId);

    public Task<PlayerProgress?> GetByAccountIdAsync(Guid accountId, CancellationToken cancellationToken) =>
        Task.FromResult(_rows.GetValueOrDefault(accountId));

    public Task AddAsync(PlayerProgress progress, CancellationToken cancellationToken)
    {
        _rows[progress.AccountId] = progress;
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

internal sealed class InMemoryEventRepository : IPlayerEventRepository
{
    private readonly List<PlayerEvent> _events = new();

    public IReadOnlyList<PlayerEvent> Events => _events;

    public Task<PlayerEvent?> FindByClientEventIdAsync(Guid accountId, Guid clientEventId, CancellationToken cancellationToken) =>
        Task.FromResult(_events.FirstOrDefault(e => e.AccountId == accountId && e.ClientEventId == clientEventId));

    public Task AddRangeAsync(IEnumerable<PlayerEvent> events, CancellationToken cancellationToken)
    {
        _events.AddRange(events);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AccountEventCount>> CountEventsByAccountSinceAsync(
        PlayerEventType type, DateTimeOffset sinceUtc, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccountEventCount>>(Array.Empty<AccountEventCount>());
}

internal sealed class InMemoryCardRepository : ICardInstanceRepository
{
    private readonly List<CardInstance> _cards = new();

    public Task<CardInstance?> GetByIdAsync(Guid cardInstanceId, CancellationToken cancellationToken) =>
        Task.FromResult(_cards.FirstOrDefault(c => c.Id == cardInstanceId));

    public Task<List<CardInstance>> GetOwnedByHeroAsync(Guid accountId, Guid heroDefinitionId, int take, CancellationToken cancellationToken) =>
        Task.FromResult(_cards.Where(c => c.AccountId == accountId && c.HeroDefinitionId == heroDefinitionId).Take(take).ToList());

    public Task<List<CardInstance>> GetByAccountAsync(Guid accountId, CancellationToken cancellationToken) =>
        Task.FromResult(_cards.Where(c => c.AccountId == accountId).ToList());

    public Task AddAsync(CardInstance cardInstance, CancellationToken cancellationToken)
    {
        _cards.Add(cardInstance);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

internal sealed class FixedTimeProvider : TimeProvider
{
    public static readonly FixedTimeProvider Instance = new();
    public static readonly DateTimeOffset Now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => Now;
}
