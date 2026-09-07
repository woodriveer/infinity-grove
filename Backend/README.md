# Infinity Grove — Backend

ASP.NET Core (.NET 8) + PostgreSQL backend for Infinity Grove, per
[Architecture.md](../docs/Architecture.md) AD-2. Layered as:

```
src/
├── InfinityGrove.Backend.Api/            # Controllers (HTTP), composition root
├── InfinityGrove.Backend.Application/    # Use-case orchestration, ports (interfaces)
├── InfinityGrove.Backend.Domain/         # Entities and rules, no external dependencies
└── InfinityGrove.Backend.Infrastructure/ # EF Core (Postgres), Steamworks Web API client, JWT
```

## Prerequisites

- .NET 8 SDK
- Docker Desktop (for local Postgres / containerized run)

## Local development

1. Copy `.env.example` to `.env` and fill in `STEAM_PUBLISHER_KEY` (from
   [partner.steamgames.com](https://partner.steamgames.com)) if you need real Steam
   ticket verification. `STEAM_APP_ID` defaults to Valve's public Spacewar test
   AppID (480) — replace once the real AppID is assigned. Generate a real
   `JWT_SIGNING_KEY` for anything beyond localhost.
2. Start Postgres + API:

   ```
   docker compose up --build
   ```

   The API listens on `http://localhost:8080`. On startup (Development
   environment) it automatically applies pending EF Core migrations — no manual
   `dotnet ef database update` needed for local docker-compose runs.
3. Check `GET /health` for a 200 OK once both containers are up.

### Running the API outside Docker (Postgres still in Docker)

```
docker compose up postgres -d
dotnet run --project src/InfinityGrove.Backend.Api
```

`appsettings.Development.json` points `ConnectionStrings:Postgres` at
`localhost:5432`, matching the port docker-compose publishes.

## EF Core migrations

`dotnet-ef` is pinned as a local tool (`.config/dotnet-tools.json`); run
`dotnet tool restore` once after cloning.

```
dotnet ef migrations add <Name> \
  --project src/InfinityGrove.Backend.Infrastructure \
  --startup-project src/InfinityGrove.Backend.Api \
  --output-dir Persistence/Migrations

dotnet ef database update \
  --project src/InfinityGrove.Backend.Infrastructure \
  --startup-project src/InfinityGrove.Backend.Api
```

## Steam authentication (AD-5, AD-10)

`POST /api/v1/auth/steam` with `{ "ticket": "<hex-encoded Auth Session Ticket>" }`.

The client obtains the ticket via Facepunch.Steamworks
(`SteamUser.GetAuthSessionTicket`), hex-encodes the byte array, and sends it here.
The backend verifies it against the Steamworks Web API
(`ISteamUserAuth/AuthenticateUserTicket`), creates the `Account` on first sight
(keyed by SteamID64) or maps to the existing one, and returns a short-lived JWT
session token to send as a `Bearer` credential on subsequent `/api/v1/...` calls.
No credential storage, password reset, or email verification exists anywhere in
this system — Steam is the sole identity provider.

## Secrets

Never commit real values for `Steamworks:PublisherKey` or `Jwt:SigningKey`.
Locally these come from `.env` (git-ignored) via docker-compose, or .NET
user-secrets when running outside Docker. In AWS (pre-launch, per AD-3) these
come from Secrets Manager.
