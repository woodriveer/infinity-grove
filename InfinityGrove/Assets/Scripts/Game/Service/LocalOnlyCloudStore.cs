namespace InfinityGrove.Service
{
    /// <summary>
    /// Default <see cref="ISteamCloudStore"/> when the Facepunch.Steamworks SDK is
    /// not present in this build (see FacepunchSteamCloudStore's doc comment for
    /// how to enable the real one). Local-only play must never be blocked on
    /// Steamworks being installed/running (AD-6: "stays fully playable offline").
    /// </summary>
    public class LocalOnlyCloudStore : ISteamCloudStore
    {
        public bool IsAvailable => false;

        public void PullIfNewer(string localFilePath, string cloudFileName)
        {
            // No-op: nothing to pull from.
        }

        public void Push(string localFilePath, string cloudFileName)
        {
            // No-op: nothing to push to.
        }
    }
}
