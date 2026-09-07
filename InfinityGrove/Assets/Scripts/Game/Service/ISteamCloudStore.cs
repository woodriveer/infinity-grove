namespace InfinityGrove.Service
{
    /// <summary>
    /// Mirrors the encrypted local save file's raw bytes to/from Steam Cloud
    /// (PRD FR-44, Architecture AD-4/AD-9). Operates on already-encrypted bytes on
    /// disk - it has no knowledge of <see cref="InfinityGrove.Domain.SaveGameData"/>
    /// or the local file's encryption, so the same interface works whether Steam
    /// Cloud is available (Facepunch.Steamworks, gated - see
    /// FacepunchSteamCloudStore) or not (LocalOnlyCloudStore, the default).
    /// </summary>
    public interface ISteamCloudStore
    {
        bool IsAvailable { get; }

        /// <summary>If Steam Cloud holds a newer copy of this file than what's on local disk, downloads it over the local copy (NFR-2: cross-device conflicts must not silently discard progress - the newer copy always wins, and the backend remains the final authority on replay, per AD-9).</summary>
        void PullIfNewer(string localFilePath, string cloudFileName);

        /// <summary>Uploads the local file's current bytes to Steam Cloud under <paramref name="cloudFileName"/>.</summary>
        void Push(string localFilePath, string cloudFileName);
    }
}
