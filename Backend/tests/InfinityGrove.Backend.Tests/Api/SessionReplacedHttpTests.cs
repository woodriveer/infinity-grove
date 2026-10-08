using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using InfinityGrove.Backend.Application.Auth;
using InfinityGrove.Backend.Domain.Accounts;
using InfinityGrove.Backend.Infrastructure.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace InfinityGrove.Backend.Tests.Api;

/// <summary>AD-006: the JwtBearer pipeline answers 401 with problem type "session-replaced".</summary>
public class SessionReplacedHttpTests
{
    private const string StateUrl = "/api/v1/players/me/state";

    [Fact]
    public async Task A_replaced_session_gets_401_session_replaced()
    {
        using var factory = Build(isCurrent: false);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", IssueToken(factory));

        var response = await client.GetAsync(StateUrl);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("session-replaced", body.RootElement.GetProperty("type").GetString());
    }

    [Fact]
    public async Task A_missing_token_gets_a_plain_401_not_session_replaced()
    {
        using var factory = Build(isCurrent: true);
        using var client = factory.CreateClient();

        var response = await client.GetAsync(StateUrl);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    private static string IssueToken(WebApplicationFactory<Program> factory)
    {
        var account = Account.CreateForSteamId("76561198000000002", DateTimeOffset.UtcNow);
        var service = new JwtSessionTokenService(
            factory.Services.GetRequiredService<IOptions<JwtOptions>>(), TimeProvider.System);
        return service.CreateToken(account).Value;
    }

    private static WebApplicationFactory<Program> Build(bool isCurrent)
    {
        // Program reads Jwt:SigningKey while building, so it has to be set before the host starts.
        Environment.SetEnvironmentVariable("Jwt__SigningKey", "test-signing-key-test-signing-key-0123456789");
        Environment.SetEnvironmentVariable("ConnectionStrings__Postgres", "Host=localhost;Database=unused");
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IHostedService>();
                services.RemoveAll<ISessionValidator>();
                services.AddSingleton<ISessionValidator>(new FixedValidator(isCurrent));
            });
        });
    }

    private sealed class FixedValidator(bool isCurrent) : ISessionValidator
    {
        public Task<bool> IsCurrentAsync(Guid accountId, Guid sessionId, CancellationToken cancellationToken) =>
            Task.FromResult(isCurrent);
    }
}
