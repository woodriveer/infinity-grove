namespace InfinityGrove.Backend.Domain.Purchases;

/// <summary>
/// Raised when a <see cref="SummoningStonePurchase"/> state transition is
/// attempted from a state that does not allow it — e.g. finalizing a purchase
/// that already failed, or granting one that was never finalized.
/// </summary>
public class SummoningStonePurchaseStateException(string message) : Exception(message);
