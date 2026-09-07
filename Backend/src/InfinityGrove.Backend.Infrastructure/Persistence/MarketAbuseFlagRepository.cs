using InfinityGrove.Backend.Application.MarketAbuse;
using InfinityGrove.Backend.Domain.MarketAbuse;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

public class MarketAbuseFlagRepository(InfinityGroveDbContext dbContext) : IMarketAbuseFlagRepository
{
    public Task<bool> ExistsSinceAsync(Guid accountId, MarketAbuseSignalType signalType, DateTimeOffset sinceUtc, CancellationToken cancellationToken) =>
        dbContext.MarketAbuseFlags.AnyAsync(
            f => f.AccountId == accountId && f.SignalType == signalType && f.DetectedAtUtc >= sinceUtc,
            cancellationToken);

    public async Task AddAsync(MarketAbuseFlag flag, CancellationToken cancellationToken) =>
        await dbContext.MarketAbuseFlags.AddAsync(flag, cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        SaveChangesGuard.RunAsync(dbContext, cancellationToken);
}
