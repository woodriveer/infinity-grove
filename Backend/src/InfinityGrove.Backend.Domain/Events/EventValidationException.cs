namespace InfinityGrove.Backend.Domain.Events;

/// <summary>
/// Raised when a client-submitted event fails a game rule during replay (AD-6).
/// The ingestion use case catches this per event, records the event as Rejected
/// with this message, and continues the batch — it never aborts the whole batch.
/// </summary>
public class EventValidationException(string message) : Exception(message);
