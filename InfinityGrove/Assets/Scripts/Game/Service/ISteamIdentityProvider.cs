namespace InfinityGrove.Service
{
    /// <summary>Obtains the Steam Auth Session Ticket the backend exchanges for a session token (AD-5).</summary>
    public interface ISteamIdentityProvider
    {
        /// <summary>Returns a hex-encoded Auth Session Ticket, or null if Steam is unavailable (e.g. SDK not present, Steam client not running). A null result means the client stays in local-only offline play (AD-6) until a ticket becomes available on a later sync attempt.</summary>
        string TryGetAuthTicketHex();
    }
}
