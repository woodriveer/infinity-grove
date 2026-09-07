using InfinityGrove.Backend.Application.Auth;
using Microsoft.AspNetCore.Mvc;

namespace InfinityGrove.Backend.Api.Controllers.Auth;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(ISteamAuthenticationService steamAuthenticationService) : ControllerBase
{
    /// <summary>
    /// Exchanges a Steam Auth Session Ticket for a backend session token (AD-5, AD-10).
    /// Creates the Account on first sight, keyed by SteamID64; maps to it otherwise.
    /// </summary>
    [HttpPost("steam")]
    [ProducesResponseType(typeof(SteamAuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> AuthenticateWithSteam([FromBody] SteamAuthRequest request, CancellationToken cancellationToken)
    {
        var result = await steamAuthenticationService.AuthenticateAsync(request.Ticket, cancellationToken);
        if (!result.Succeeded || result.SessionToken is null || result.SteamId64 is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = "Steam authentication failed.",
                Detail = result.FailureReason,
                Status = StatusCodes.Status401Unauthorized,
            });
        }

        var response = new SteamAuthResponse(
            result.AccountId,
            result.SteamId64,
            result.SessionToken.Value,
            result.SessionToken.ExpiresAtUtc);

        return Ok(response);
    }
}
