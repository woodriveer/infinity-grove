namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// Raised when a card-instance state transition is attempted from a state that
/// does not allow it (AD-8b) — e.g. listing a card that is PendingOutbox, or
/// consuming one that is already Listed. The caller turns this into a rejected
/// request; a transition is never silently allowed to skip a state.
/// </summary>
public class CardInstanceStateException(string message) : Exception(message);
