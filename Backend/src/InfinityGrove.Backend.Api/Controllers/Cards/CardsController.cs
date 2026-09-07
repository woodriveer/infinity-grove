using InfinityGrove.Backend.Api.Auth;
using InfinityGrove.Backend.Application.Cards;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace InfinityGrove.Backend.Api.Controllers.Cards;

/// <summary>
/// Fusion (AD-8) and the "prepare to list" Market authorization (AD-8b). Both
/// are synchronous request/response flows, not part of the batched event log
/// (AD-6/EventsController) — a fusion or listing request needs an immediate,
/// authoritative accept/reject, not opportunistic reconciliation.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/cards")]
public class CardsController(
    IFusionService fusionService,
    IMarketListingService marketListingService,
    ICardInstanceRepository cardInstanceRepository) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CardInstanceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetOwnCards(CancellationToken cancellationToken)
    {
        var accountId = User.GetAccountId();
        if (accountId is null)
        {
            return Unauthorized();
        }

        var cards = await cardInstanceRepository.GetByAccountAsync(accountId.Value, cancellationToken);
        return Ok(cards.Select(CardInstanceDto.FromDomain).ToList());
    }

    [HttpPost("fuse")]
    [ProducesResponseType(typeof(FusionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(FusionResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Fuse([FromBody] FuseCardRequest request, CancellationToken cancellationToken)
    {
        var accountId = User.GetAccountId();
        if (accountId is null)
        {
            return Unauthorized();
        }

        var result = await fusionService.FuseAsync(accountId.Value, request.HeroDefinitionId, cancellationToken);
        var response = new FusionResponse(
            result.Success, result.RejectionReason, result.NewStarTier, result.ConsumedCardInstanceIds, result.OutboxEntryId);

        return result.Success ? Ok(response) : BadRequest(response);
    }

    /// <summary>
    /// AD-8b: the sole path that authorizes listing a specific card instance on
    /// the Steam Community Market. Synchronous — the response only ever reports
    /// success once Steam has confirmed the item is marketable and Postgres has
    /// recorded the card as Listed.
    /// </summary>
    [HttpPost("{cardInstanceId:guid}/prepare-to-list")]
    [ProducesResponseType(typeof(PrepareToListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PrepareToListResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> PrepareToList(Guid cardInstanceId, CancellationToken cancellationToken)
    {
        var accountId = User.GetAccountId();
        if (accountId is null)
        {
            return Unauthorized();
        }

        var result = await marketListingService.PrepareToListAsync(accountId.Value, cardInstanceId, cancellationToken);
        var response = new PrepareToListResponse(result.Success, result.RejectionReason);

        return result.Success ? Ok(response) : BadRequest(response);
    }
}
