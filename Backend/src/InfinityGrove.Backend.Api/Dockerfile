FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY InfinityGrove.Backend.sln .
COPY src/InfinityGrove.Backend.Api/InfinityGrove.Backend.Api.csproj src/InfinityGrove.Backend.Api/
COPY src/InfinityGrove.Backend.Application/InfinityGrove.Backend.Application.csproj src/InfinityGrove.Backend.Application/
COPY src/InfinityGrove.Backend.Domain/InfinityGrove.Backend.Domain.csproj src/InfinityGrove.Backend.Domain/
COPY src/InfinityGrove.Backend.Infrastructure/InfinityGrove.Backend.Infrastructure.csproj src/InfinityGrove.Backend.Infrastructure/
RUN dotnet restore src/InfinityGrove.Backend.Api/InfinityGrove.Backend.Api.csproj

COPY src/ src/
RUN dotnet publish src/InfinityGrove.Backend.Api/InfinityGrove.Backend.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "InfinityGrove.Backend.Api.dll"]
