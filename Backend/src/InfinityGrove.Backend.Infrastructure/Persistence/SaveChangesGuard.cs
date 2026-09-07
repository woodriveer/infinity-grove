using InfinityGrove.Backend.Application.Cards;
using Microsoft.EntityFrameworkCore;

namespace InfinityGrove.Backend.Infrastructure.Persistence;

/// <summary>
/// Translates EF Core's <see cref="DbUpdateConcurrencyException"/> (raised by
/// CardInstance's xmin-backed optimistic concurrency token, AD-8b) into the
/// Application-layer <see cref="ConcurrentModificationException"/>, so use
/// cases (FusionService, MarketListingService) never need an EF Core reference
/// of their own to react to a concurrent write conflict.
/// </summary>
internal static class SaveChangesGuard
{
    public static async Task RunAsync(DbContext dbContext, CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrentModificationException("A concurrent update conflicted with this request.");
        }
    }
}
