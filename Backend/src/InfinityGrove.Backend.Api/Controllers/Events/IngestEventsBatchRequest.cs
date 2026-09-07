using System.Text.Json;
using InfinityGrove.Backend.Domain.Events;

namespace InfinityGrove.Backend.Api.Controllers.Events;

public record IngestEventRequest(
    Guid ClientEventId,
    long SequenceNumber,
    PlayerEventType Type,
    DateTimeOffset OccurredAtUtc,
    JsonElement Payload);

public record IngestEventsBatchRequest(IReadOnlyList<IngestEventRequest> Events);
