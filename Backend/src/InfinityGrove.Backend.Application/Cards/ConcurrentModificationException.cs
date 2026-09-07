namespace InfinityGrove.Backend.Application.Cards;

/// <summary>
/// Thrown when a repository's SaveChangesAsync detects that another request
/// already committed against the same row(s) since this request read them.
/// This is what makes FR-33's "no double-spend window" hold under concurrency:
/// CardInstance is configured with Postgres's native xmin column as an
/// optimistic concurrency token, so two requests racing to transition the same
/// card (e.g. a fusion and a "prepare to list" call) can never both win.
/// </summary>
public class ConcurrentModificationException(string message) : Exception(message);
