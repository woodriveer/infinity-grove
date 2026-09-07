using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Wire DTOs for the backend's api/v1/auth, api/v1/players/me and
    /// api/v1/events endpoints (AD-10). Field names are pinned to the backend's
    /// camelCase JSON contract via explicit [JsonProperty] rather than relying on
    /// a global naming policy, since ASP.NET Core's default MVC JSON options
    /// (Program.cs's AddJsonOptions) use camelCase property names and a
    /// JsonStringEnumConverter for enums - see EventsController/PlayerStateDto on
    /// the backend for the shapes these mirror.
    /// </summary>
    public class SteamAuthRequestDto
    {
        [JsonProperty("ticket")] public string Ticket;

        public SteamAuthRequestDto(string ticket) => Ticket = ticket;
    }

    public class SteamAuthResponseDto
    {
        [JsonProperty("accountId")] public Guid AccountId;
        [JsonProperty("steamId64")] public string SteamId64;
        [JsonProperty("sessionToken")] public string SessionToken;
        [JsonProperty("expiresAtUtc")] public DateTimeOffset ExpiresAtUtc;
    }

    public class RosterEntryWireDto
    {
        [JsonProperty("heroDefinitionId")] public Guid HeroDefinitionId;
        [JsonProperty("ownedCount")] public int OwnedCount;
        [JsonProperty("starTier")] public int StarTier;
    }

    public class PlayerStateWireDto
    {
        [JsonProperty("goldMantissa")] public double GoldMantissa;
        [JsonProperty("goldExponent")] public int GoldExponent;
        [JsonProperty("furthestStageCleared")] public int FurthestStageCleared;
        [JsonProperty("lastAppliedSequence")] public long LastAppliedSequence;
        [JsonProperty("roster")] public List<RosterEntryWireDto> Roster = new List<RosterEntryWireDto>();
        [JsonProperty("activeSquadHeroIds")] public List<Guid> ActiveSquadHeroIds = new List<Guid>();
    }

    public class IngestEventWireDto
    {
        [JsonProperty("clientEventId")] public Guid ClientEventId;
        [JsonProperty("sequenceNumber")] public long SequenceNumber;
        [JsonProperty("type")] public string Type;
        [JsonProperty("occurredAtUtc")] public DateTimeOffset OccurredAtUtc;
        [JsonProperty("payload")] public JsonRawPayload Payload;
    }

    /// <summary>Wraps a pre-serialized JSON payload string so it round-trips through Newtonsoft as a raw JSON value rather than an escaped string.</summary>
    [JsonConverter(typeof(JsonRawPayloadConverter))]
    public class JsonRawPayload
    {
        public string RawJson;

        public JsonRawPayload(string rawJson) => RawJson = rawJson;
    }

    public class JsonRawPayloadConverter : JsonConverter<JsonRawPayload>
    {
        public override void WriteJson(JsonWriter writer, JsonRawPayload value, JsonSerializer serializer)
        {
            writer.WriteRawValue(string.IsNullOrEmpty(value?.RawJson) ? "null" : value.RawJson);
        }

        public override JsonRawPayload ReadJson(JsonReader reader, Type objectType, JsonRawPayload existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            var token = Newtonsoft.Json.Linq.JToken.Load(reader);
            return new JsonRawPayload(token.ToString(Formatting.None));
        }
    }

    public class IngestEventsBatchRequestDto
    {
        [JsonProperty("events")] public List<IngestEventWireDto> Events = new List<IngestEventWireDto>();
    }

    public class EventIngestionResultWireDto
    {
        [JsonProperty("clientEventId")] public Guid ClientEventId;
        [JsonProperty("status")] public string Status;
        [JsonProperty("rejectionReason")] public string RejectionReason;
    }

    public class IngestEventsBatchResponseDto
    {
        [JsonProperty("results")] public List<EventIngestionResultWireDto> Results = new List<EventIngestionResultWireDto>();
        [JsonProperty("state")] public PlayerStateWireDto State;
    }

    public class GoldEarnedPayload
    {
        [JsonProperty("goldMantissa")] public double GoldMantissa;
        [JsonProperty("goldExponent")] public int GoldExponent;
    }

    public class GoldSpentPayload
    {
        [JsonProperty("goldMantissa")] public double GoldMantissa;
        [JsonProperty("goldExponent")] public int GoldExponent;
    }

    public class StageClearedPayload
    {
        [JsonProperty("stageNumber")] public int StageNumber;
    }

    public class HeroAcquiredPayload
    {
        [JsonProperty("heroDefinitionId")] public Guid HeroDefinitionId;
    }

    public class ActiveSquadChangedPayload
    {
        [JsonProperty("heroDefinitionIds")] public List<Guid> HeroDefinitionIds = new List<Guid>();
    }
}
