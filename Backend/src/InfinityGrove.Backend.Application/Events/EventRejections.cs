namespace InfinityGrove.Backend.Application.Events;

/// <summary>Rejection reasons the client matches by exact string (single-active-session SESSION-03).</summary>
public static class EventRejections
{
    public const string StaleSequence = "Stale sequence; resend after login.";
}
