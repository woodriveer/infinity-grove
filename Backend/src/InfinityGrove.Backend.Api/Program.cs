using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using InfinityGrove.Backend.Api.Auth;
using InfinityGrove.Backend.Application.Auth;
using InfinityGrove.Backend.Infrastructure;
using InfinityGrove.Backend.Infrastructure.Auth;
using InfinityGrove.Backend.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

const string SessionReplacedKey = "ig.session-replaced";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddInfrastructure(builder.Configuration);

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        options.Events = new JwtBearerEvents
        {
            // AD-006: a token is only good while its sid is the account's current session.
            OnTokenValidated = async context =>
            {
                var principal = context.Principal;
                var accountId = principal?.GetAccountId();
                var sid = principal?.FindFirstValue(JwtSessionTokenService.SessionIdClaimType);
                if (accountId is null || !Guid.TryParse(sid, out var sessionId))
                {
                    context.Fail("Token has no session.");
                    return;
                }

                var validator = context.HttpContext.RequestServices.GetRequiredService<ISessionValidator>();
                if (!await validator.IsCurrentAsync(accountId.Value, sessionId, context.HttpContext.RequestAborted))
                {
                    context.HttpContext.Items[SessionReplacedKey] = true;
                    context.Fail("Session replaced.");
                }
            },
            OnChallenge = async context =>
            {
                if (!context.HttpContext.Items.ContainsKey(SessionReplacedKey))
                {
                    return;
                }

                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/problem+json";
                await context.Response.WriteAsJsonAsync(new
                {
                    type = "session-replaced",
                    title = "Session replaced",
                    status = StatusCodes.Status401Unauthorized,
                    detail = "This account signed in on another device.",
                }, options: null, contentType: "application/problem+json");
            },
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddHealthChecks();

var app = builder.Build();


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    // Local dev convenience only: applies pending EF Core migrations on startup
    // instead of requiring a manual `dotnet ef database update`.
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<InfinityGroveDbContext>();
    dbContext.Database.Migrate();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Exposed for WebApplicationFactory-based integration tests.
public partial class Program;
