using System.IO;
using UnityEngine;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Real Steam Cloud sync via Facepunch.Steamworks' ISteamRemoteStorage wrapper
    /// (Architecture AD-4: "the Unity client uses Facepunch.Steamworks for Steam
    /// Cloud saves"). Compiled only when the <c>IG_FACEPUNCH_STEAMWORKS</c>
    /// scripting define symbol is set, because Facepunch.Steamworks ships as a
    /// manual DLL/source import (native steam_api.dll + C# wrapper), not a
    /// registry-hosted UPM package - it can't be safely added to this project's
    /// manifest.json sight unseen. To enable real Steam Cloud sync:
    /// 1. Import Facepunch.Steamworks per its own install instructions
    ///    (https://github.com/Facepunch/Facepunch.Steamworks) - drop its Unity
    ///    assembly + steam_api64.dll into the project and add a steam_appid.txt.
    /// 2. Add <c>IG_FACEPUNCH_STEAMWORKS</c> to Project Settings > Player >
    ///    Scripting Define Symbols.
    /// 3. In GameLifetimeScope, register this class instead of
    ///    <see cref="LocalOnlyCloudStore"/> for <see cref="ISteamCloudStore"/>.
    /// Until then, <see cref="LocalOnlyCloudStore"/> remains the registered
    /// default and the game stays fully playable with local-cache-only saves
    /// (AD-6).
    /// </summary>
    public class FacepunchSteamCloudStore : ISteamCloudStore
    {
#if IG_FACEPUNCH_STEAMWORKS
        public bool IsAvailable => Steamworks.SteamClient.IsValid;

        public void PullIfNewer(string localFilePath, string cloudFileName)
        {
            if (!IsAvailable) return;
            if (!Steamworks.SteamRemoteStorage.FileExists(cloudFileName)) return;

            var cloudTimestamp = Steamworks.SteamRemoteStorage.FileTime(cloudFileName);
            var localTimestamp = File.Exists(localFilePath)
                ? new System.DateTimeOffset(File.GetLastWriteTimeUtc(localFilePath)).ToUnixTimeSeconds()
                : 0L;

            if (cloudTimestamp <= localTimestamp) return;

            var bytes = Steamworks.SteamRemoteStorage.FileReadBytes(cloudFileName);
            if (bytes == null) return;

            File.WriteAllBytes(localFilePath, bytes);
        }

        public void Push(string localFilePath, string cloudFileName)
        {
            if (!IsAvailable || !File.Exists(localFilePath)) return;

            var bytes = File.ReadAllBytes(localFilePath);
            Steamworks.SteamRemoteStorage.FileWrite(cloudFileName, bytes);
        }
#else
        public bool IsAvailable => false;

        public void PullIfNewer(string localFilePath, string cloudFileName)
        {
            Debug.LogWarning("FacepunchSteamCloudStore is registered but IG_FACEPUNCH_STEAMWORKS is not defined - see this class's doc comment. Falling back to local-only save.");
        }

        public void Push(string localFilePath, string cloudFileName)
        {
        }
#endif
    }
}
