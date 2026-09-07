namespace InfinityGrove.Backend.Infrastructure.Auth;

/// <summary>
/// Signing settings for the AD-10 backend session token. The signing key must come
/// from a secret store (Secrets Manager pre-launch per AD-3; user-secrets locally).
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string SigningKey { get; set; } = string.Empty;

    public string Issuer { get; set; } = "InfinityGrove.Backend";

    public string Audience { get; set; } = "InfinityGrove.Client";

    public int SessionLifetimeMinutes { get; set; } = 60;
}
