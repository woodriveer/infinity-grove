using InfinityGrove.Backend.Api.Auth;
using InfinityGrove.Backend.Application.Events;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InfinityGrove.Backend.Api.Controllers.Events;

/// <summary>
/// AD-6/AD-10: batched, opportunistic ingestion of the client's append-only local
/// event log. Every state-changing gameplay action (gold earned/spent, stage
/// cleared, hero acquired, active squad changed) arrives here as a discrete event;
/// the response is always the account's full canonical state so the client can
/// reconcile silently, or surface why a specific event was rejected.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/events")]
public class EventsController(IPlayerEventIngestionService ingestionService) : ControllerBase
{
    [HttpPost("batch")]
    [ProducesResponseType(typeof(IngestEventsBatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> IngestBatch([FromBody] IngestEventsBatchRequest request, CancellationToken cancellationToken)
    {
        var accountId = User.GetAccountId();
        if (accountId is null)
        {
            return Unauthorized();
        }

        var commands = request.Events
            .Select(e => new IngestEventCommand(e.ClientEventId, e.SequenceNumber, e.Type, e.OccurredAtUtc, e.Payload))
            .ToList();

        var result = await ingestionService.IngestAsync(accountId.Value, commands, cancellationToken);

        var response = new IngestEventsBatchResponse(
            [.. result.Results.Select(EventIngestionResultDto.FromResult)],
            PlayerStateDto.FromSnapshot(result.CanonicalState));

        return Ok(response);
    }
}
