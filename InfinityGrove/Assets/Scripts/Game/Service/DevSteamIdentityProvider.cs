namespace InfinityGrove.Service
{
    /// <summary>
    /// Default <see cref="ISteamIdentityProvider"/> when the Facepunch.Steamworks
    /// SDK is not present in this build (see FacepunchSteamIdentityProvider's doc
    /// comment for how to enable the real one). Always reports no ticket
    /// available, which keeps the client in local-only offline play (AD-6) rather
    /// than failing a backend call with no valid credential.
    /// </summary>
    public class DevSteamIdentityProvider : ISteamIdentityProvider
    {
        public string TryGetAuthTicketHex() => null;
    }
}
