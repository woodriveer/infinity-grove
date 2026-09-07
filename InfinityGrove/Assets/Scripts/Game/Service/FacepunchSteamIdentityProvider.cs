using UnityEngine;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Real Steam identity via Facepunch.Steamworks (AD-5). Compiled only when
    /// <c>IG_FACEPUNCH_STEAMWORKS</c> is defined - see FacepunchSteamCloudStore's
    /// doc comment for the same reasoning (manual SDK import, not a UPM package)
    /// and the enablement steps. Until enabled, <see cref="DevSteamIdentityProvider"/>
    /// remains the registered default.
    /// </summary>
    public class FacepunchSteamIdentityProvider : ISteamIdentityProvider
    {
#if IG_FACEPUNCH_STEAMWORKS
        public string TryGetAuthTicketHex()
        {
            if (!Steamworks.SteamClient.IsValid) return null;

            using var ticket = Steamworks.SteamUser.GetAuthSessionTicket();
            return ticket?.Data == null ? null : System.Convert.ToHexString(ticket.Data);
        }
#else
        public string TryGetAuthTicketHex()
        {
            Debug.LogWarning("FacepunchSteamIdentityProvider is registered but IG_FACEPUNCH_STEAMWORKS is not defined - see this class's doc comment.");
            return null;
        }
#endif
    }
}
