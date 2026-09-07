using InfinityGrove.Backend.Api.Auth;
using InfinityGrove.Backend.Application.Purchases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InfinityGrove.Backend.Api.Controllers.Purchases;

/// <summary>
/// AD-12's deterministic Summoning Stone purchase flow. "purchase" is the
/// player-facing, JWT-authenticated request that validates FR-49 Hero Block
/// eligibility and starts the Steamworks charge; "authorize-callback" is the
/// backend authorization endpoint Steam itself calls once the player approves
/// payment in Steam's own UI, so it deliberately sits outside the player JWT
/// auth scheme.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/summoning-stones")]
public class SummoningStonesController(ISummoningStonePurchaseService purchaseService) : ControllerBase
{
    [HttpPost("purchase")]
    [ProducesResponseType(typeof(InitiatePurchaseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(InitiatePurchaseResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Purchase([FromBody] InitiatePurchaseRequest request, CancellationToken cancellationToken)
    {
        var accountId = User.GetAccountId();
        if (accountId is null)
        {
            return Unauthorized();
        }

        var result = await purchaseService.InitiateAsync(accountId.Value, request.HeroDefinitionId, cancellationToken);
        var response = new InitiatePurchaseResponse(
            result.Success, result.RejectionReason, result.SteamOrderId, result.SteamTransactionId,
            result.PriceAmountMinorUnits, result.Currency);

        return result.Success ? Ok(response) : BadRequest(response);
    }

    /// <summary>
    /// The backend authorization endpoint AD-12 names: Steam calls this once the
    /// player approves the charge in Steam's own payment UI. Deliberately
    /// anonymous to the player JWT scheme — the caller here is Steam, not the
    /// client. Validating the request actually originated from Steam (e.g.
    /// against Valve's published IP ranges) before trusting it is a
    /// pre-production hardening step this task does not implement, matching the
    /// "re-verify before a real Steam App ID" caveat already carried by
    /// SteamworksInventoryPublisherClient/SteamworksMicrotransactionClient.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("authorize-callback")]
    [ProducesResponseType(typeof(FinalizePurchaseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(FinalizePurchaseResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AuthorizeCallback(
        [FromQuery] SteamMicroTxnAuthorizationCallback callback, CancellationToken cancellationToken)
    {
        var result = await purchaseService.AuthorizeAndFinalizeAsync(callback.OrderId, callback.SteamId, cancellationToken);
        var response = new FinalizePurchaseResponse(result.Success, result.RejectionReason, result.CardInstanceId, result.OutboxEntryId);

        return result.Success ? Ok(response) : BadRequest(response);
    }
}
