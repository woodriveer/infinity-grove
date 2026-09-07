using InfinityGrove.Backend.Application.Accounts;
using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Domain.Accounts;
using InfinityGrove.Backend.Domain.Cards;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace InfinityGrove.Backend.Infrastructure.Cards;

/// <summary>
/// AD-8's outbox drain: polls for Pending <see cref="SteamInventoryOutboxEntry"/>
/// rows whose retry backoff has elapsed and calls the Steamworks Web API to
/// actually apply the mutation each one names. On success, the entry and every
/// CardInstance it references move to their terminal state (Applied / Consumed)
/// together; on failure the entry is retried with exponential backoff (capped)
/// rather than blocking the batch or dropping the mutation. The exact poll
/// interval, batch size, and backoff schedule are this task's own
/// implementation choice — Architecture.md's Open Questions section flags these
/// as parameters deferred to implementation, not fixed by any AD.
/// </summary>
public class SteamInventoryOutboxWorker(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<SteamInventoryOutboxWorker> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private const int MaxBatchSize = 20;
    private const int MaxBackoffSeconds = 300;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DrainOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Unhandled error while draining the Steam Inventory outbox.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
            }
        }
    }

    private async Task DrainOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var outboxRepository = scope.ServiceProvider.GetRequiredService<ISteamInventoryOutboxRepository>();
        var cardInstanceRepository = scope.ServiceProvider.GetRequiredService<ICardInstanceRepository>();
        var accountRepository = scope.ServiceProvider.GetRequiredService<IAccountRepository>();
        var steamClient = scope.ServiceProvider.GetRequiredService<ISteamInventoryPublisherClient>();

        var dueEntries = await outboxRepository.GetDueAsync(timeProvider.GetUtcNow(), MaxBatchSize, cancellationToken);

        foreach (var entry in dueEntries)
        {
            await ProcessEntryAsync(entry, outboxRepository, cardInstanceRepository, accountRepository, steamClient, cancellationToken);
        }
    }

    private async Task ProcessEntryAsync(
        SteamInventoryOutboxEntry entry,
        ISteamInventoryOutboxRepository outboxRepository,
        ICardInstanceRepository cardInstanceRepository,
        IAccountRepository accountRepository,
        ISteamInventoryPublisherClient steamClient,
        CancellationToken cancellationToken)
    {
        var nowUtc = timeProvider.GetUtcNow();
        var account = await accountRepository.GetByIdAsync(entry.AccountId, cancellationToken);
        if (account is null)
        {
            logger.LogError("Outbox entry {EntryId} references unknown account {AccountId}.", entry.Id, entry.AccountId);
            entry.RecordFailedAttempt("Account not found.", NextDelay(entry.Attempts), nowUtc);
            await outboxRepository.SaveChangesAsync(cancellationToken);
            return;
        }

        switch (entry.Operation)
        {
            case SteamInventoryOutboxOperation.ConsumeCardInstances:
                await ProcessConsumeAsync(entry, account, cardInstanceRepository, steamClient, nowUtc, cancellationToken);
                break;
            case SteamInventoryOutboxOperation.GrantCardInstance:
                await ProcessGrantAsync(entry, account, steamClient, nowUtc, cancellationToken);
                break;
            default:
                logger.LogError("Unknown outbox operation {Operation} on entry {EntryId}.", entry.Operation, entry.Id);
                entry.RecordFailedAttempt($"Unknown operation {entry.Operation}.", NextDelay(entry.Attempts), nowUtc);
                break;
        }

        // Both the outbox entry's own status and any CardInstance transitions made
        // while processing it share this same scoped DbContext, so this one call
        // commits them together.
        await outboxRepository.SaveChangesAsync(cancellationToken);
    }

    private async Task ProcessConsumeAsync(
        SteamInventoryOutboxEntry entry,
        Account account,
        ICardInstanceRepository cardInstanceRepository,
        ISteamInventoryPublisherClient steamClient,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var steamItemInstanceIds = entry.CardInstanceIds.Select(id => id.ToString()).ToList();
        var result = await steamClient.ConsumeItemInstancesAsync(account.SteamId64, steamItemInstanceIds, cancellationToken);

        if (!result.Success)
        {
            logger.LogWarning(
                "Steam Inventory consume failed for outbox entry {EntryId} (attempt {Attempt}): {Error}",
                entry.Id, entry.Attempts + 1, result.ErrorMessage);
            entry.RecordFailedAttempt(result.ErrorMessage ?? "Unknown Steam error.", NextDelay(entry.Attempts), nowUtc);
            return;
        }

        foreach (var cardInstanceId in entry.CardInstanceIds)
        {
            var instance = await cardInstanceRepository.GetByIdAsync(cardInstanceId, cancellationToken);
            instance?.MarkConsumed(nowUtc);
        }

        entry.MarkApplied(nowUtc);
    }

    /// <summary>
    /// AD-12: the CardInstance a Summoning Stone purchase grants is already
    /// minted Owned in Postgres at commit time — AD-8b's 4-state machine has no
    /// "pending grant" state, mirroring how a stage-drop HeroAcquired event mints
    /// Owned directly. This only confirms Steam's own side of the mutation.
    /// </summary>
    private async Task ProcessGrantAsync(
        SteamInventoryOutboxEntry entry,
        Account account,
        ISteamInventoryPublisherClient steamClient,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        if (entry.SteamItemDefId is not { } itemDefId)
        {
            logger.LogError("Grant outbox entry {EntryId} is missing its Steam item definition id.", entry.Id);
            entry.RecordFailedAttempt("Missing Steam item definition id.", NextDelay(entry.Attempts), nowUtc);
            return;
        }

        var result = await steamClient.GrantItemInstanceAsync(account.SteamId64, itemDefId, cancellationToken);
        if (!result.Success)
        {
            logger.LogWarning(
                "Steam Inventory grant failed for outbox entry {EntryId} (attempt {Attempt}): {Error}",
                entry.Id, entry.Attempts + 1, result.ErrorMessage);
            entry.RecordFailedAttempt(result.ErrorMessage ?? "Unknown Steam error.", NextDelay(entry.Attempts), nowUtc);
            return;
        }

        entry.MarkApplied(nowUtc);
    }

    private static TimeSpan NextDelay(int attemptsSoFar)
    {
        var seconds = Math.Min(MaxBackoffSeconds, 5 * Math.Pow(2, attemptsSoFar));
        return TimeSpan.FromSeconds(seconds);
    }
}
