using InfinityGrove.Domain;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Encrypted local persistence for <see cref="SaveGameData"/> (AD-9). This is a
    /// cache, never authority - see <see cref="EncryptedSaveFileStore"/>'s doc
    /// comment for why encryption here is not a security boundary.
    /// </summary>
    public interface ISaveFileStore
    {
        /// <summary>Absolute path of the local save file, shared with <see cref="ISteamCloudStore"/> so both operate on the same bytes.</summary>
        string FilePath { get; }

        /// <summary>Returns null if no save exists yet or the file is unreadable/corrupt (treated as a fresh save, never as a crash).</summary>
        SaveGameData Load();

        /// <summary>Writes atomically (NFR-2): a crash or forced quit mid-write must never corrupt the previous valid save.</summary>
        void Save(SaveGameData data);
    }
}
