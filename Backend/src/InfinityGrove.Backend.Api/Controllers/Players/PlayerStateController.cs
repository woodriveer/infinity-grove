using InfinityGrove.Backend.Api.Auth;
using InfinityGrove.Backend.Api.Controllers.Events;
using InfinityGrove.Backend.Application.Events;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InfinityGrove.Backend.Api.Controllers.Players;

/// <summary>
/// Lets the client fetch its reconciled canonical state (AD-6, AD-9) directly,
/// independent of submitting a new event batch — e.g. right after launch, before
/// any local events exist to sync.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/players/me")]
public class PlayerStateController(IPlayerEventIngestionService ingestionService) : ControllerBase
{
    [HttpGet("state")]
    [ProducesResponseType(typeof(PlayerStateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetState(CancellationToken cancellationToken)
    {
        var accountId = User.GetAccountId();
        if (accountId is null)
        {
            return Unauthorized();
        }

        var snapshot = await ingestionService.GetStateAsync(accountId.Value, cancellationToken);
        return Ok(PlayerStateDto.FromSnapshot(snapshot));
    }
}
