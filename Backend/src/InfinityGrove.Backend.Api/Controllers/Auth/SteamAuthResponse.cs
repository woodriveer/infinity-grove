namespace InfinityGrove.Backend.Api.Controllers.Auth;

public record SteamAuthResponse(Guid AccountId, string SteamId64, string SessionToken, DateTimeOffset ExpiresAtUtc);
