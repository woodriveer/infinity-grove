using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using InfinityGrove.Backend.Application.Auth;
using InfinityGrove.Backend.Domain.Accounts;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace InfinityGrove.Backend.Infrastructure.Auth;

/// <summary>
/// Issues the short-lived bearer session token described in AD-10, exchanged once
/// per Steam Auth Session Ticket (AD-5) and sent on subsequent API calls.
/// </summary>
public class JwtSessionTokenService(IOptions<JwtOptions> options, TimeProvider timeProvider) : ISessionTokenService
{
    public const string SteamIdClaimType = "steam_id64";

    public SessionToken CreateToken(Account account)
    {
        var jwtOptions = options.Value;
        var nowUtc = timeProvider.GetUtcNow();
        var expiresAtUtc = nowUtc.AddMinutes(jwtOptions.SessionLifetimeMinutes);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
            new Claim(SteamIdClaimType, account.SteamId64),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtOptions.Issuer,
            audience: jwtOptions.Audience,
            claims: claims,
            notBefore: nowUtc.UtcDateTime,
            expires: expiresAtUtc.UtcDateTime,
            signingCredentials: credentials);

        var value = new JwtSecurityTokenHandler().WriteToken(token);
        return new SessionToken(value, expiresAtUtc);
    }
}
