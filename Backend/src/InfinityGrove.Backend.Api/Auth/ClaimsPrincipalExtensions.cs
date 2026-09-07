using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace InfinityGrove.Backend.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Reads the backend AccountId (AD-10's session token "sub" claim) from an
    /// authenticated request. Checks both the raw JWT claim name and its legacy
    /// ClaimTypes.NameIdentifier mapping, since ASP.NET Core's JWT handler
    /// configuration determines which one survives onto the ClaimsPrincipal.
    /// </summary>
    public static Guid? GetAccountId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(value, out var accountId) ? accountId : null;
    }
}
