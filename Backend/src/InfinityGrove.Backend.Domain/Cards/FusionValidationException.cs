namespace InfinityGrove.Backend.Domain.Cards;

/// <summary>
/// Raised when a fusion request fails a game rule — insufficient duplicates, or
/// the hero is already at the maximum star tier. The fusion use case catches
/// this and turns it into a rejected request before any Postgres write happens.
/// </summary>
public class FusionValidationException(string message) : Exception(message);
