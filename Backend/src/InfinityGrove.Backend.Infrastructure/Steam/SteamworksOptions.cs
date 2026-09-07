namespace InfinityGrove.Backend.Infrastructure.Steam;

/// <summary>
/// Steamworks Web API settings. The publisher key must come from a secret store
/// (AWS Secrets Manager pre-launch per AD-3; user-secrets/env var locally) — never committed.
/// </summary>
public class SteamworksOptions
{
    public const string SectionName = "Steamworks";

    public string WebApiBaseUrl { get; set; } = "https://api.steampowered.com";

    public string PublisherKey { get; set; } = string.Empty;

    public uint AppId { get; set; }
}
