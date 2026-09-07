using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Thin REST+JSON client for the backend's auth/state/events endpoints
    /// (AD-10). Every call returns null/false on any failure (unreachable
    /// backend, timeout, malformed response) instead of throwing - callers treat
    /// that as "stay in local-only offline play" (AD-6), never as a fatal error.
    /// </summary>
    public interface IBackendApiClient
    {
        bool IsAuthenticated { get; }

        /// <summary>Exchanges a Steam Auth Session Ticket for a backend session token (AD-5). Returns false if the ticket is null/rejected or the backend is unreachable.</summary>
        Task<bool> AuthenticateWithSteamAsync(string ticketHex, CancellationToken cancellationToken);

        /// <summary>Fetches the account's current canonical state directly (AD-6/AD-9), independent of submitting an event batch. Returns null on failure.</summary>
        Task<PlayerStateWireDto> GetStateAsync(CancellationToken cancellationToken);

        /// <summary>Submits a batch of locally-appended events for replay/validation (AD-6). Returns null on failure - callers must not assume the events were applied or rejected in that case, only that the batch never reached the server.</summary>
        Task<IngestEventsBatchResponseDto> IngestBatchAsync(List<IngestEventWireDto> events, CancellationToken cancellationToken);
    }
}
