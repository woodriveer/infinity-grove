using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using InfinityGrove.Domain;
using Newtonsoft.Json;
using UnityEngine;

namespace InfinityGrove.Service
{
    /// <summary>
    /// Reads/writes the local save cache as AES-encrypted JSON under
    /// Application.persistentDataPath (AD-9). The encryption key is a fixed,
    /// app-embedded passphrase - per AD-9 this "raises the bar against casual save
    /// editing but is not a security boundary"; the real boundary is the backend's
    /// server-side event validation (AD-6/NFR-4), which never trusts this file's
    /// contents for anything Market-relevant. Writes are atomic (NFR-2): the new
    /// save is written to a temp file first and swapped in only once fully
    /// flushed, so a crash mid-write can never corrupt the previous valid save.
    /// </summary>
    public class EncryptedSaveFileStore : ISaveFileStore
    {
        // Not a secret - see class doc comment. Raises the bar against casual
        // editing without pretending to be an anti-tamper boundary.
        private const string Passphrase = "InfinityGrove.LocalSaveCache.v1";
        private static readonly byte[] Salt = Encoding.UTF8.GetBytes("IG-SaveSalt-2026");
        private const int Pbkdf2Iterations = 10_000;

        private readonly string _path;

        public string FilePath => _path;

        private static readonly JsonSerializerSettings JsonSettings = new JsonSerializerSettings
        {
            Formatting = Formatting.None,
            NullValueHandling = NullValueHandling.Ignore,
        };

        public EncryptedSaveFileStore(string fileName)
        {
            _path = Path.Combine(Application.persistentDataPath, fileName);
        }

        public SaveGameData Load()
        {
            try
            {
                if (!File.Exists(_path)) return null;

                var encrypted = File.ReadAllBytes(_path);
                var json = Decrypt(encrypted);
                var data = JsonConvert.DeserializeObject<SaveGameData>(json, JsonSettings);
                return data;
            }
            catch (Exception ex)
            {
                // A corrupt/unreadable save must never crash the game (NFR-2) - treat
                // it as "no save yet" and let a fresh SaveGameData + server
                // reconciliation (AD-9) re-establish state.
                Debug.LogWarning($"EncryptedSaveFileStore: failed to load save at '{_path}', starting fresh. {ex.Message}");
                return null;
            }
        }

        public void Save(SaveGameData data)
        {
            try
            {
                var json = JsonConvert.SerializeObject(data, JsonSettings);
                var encrypted = Encrypt(json);

                var tempPath = _path + ".tmp";
                File.WriteAllBytes(tempPath, encrypted);

                if (File.Exists(_path))
                {
                    var backupPath = _path + ".bak";
                    File.Replace(tempPath, _path, backupPath);
                }
                else
                {
                    File.Move(tempPath, _path);
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"EncryptedSaveFileStore: failed to save to '{_path}'. {ex.Message}");
            }
        }

        private static byte[] Encrypt(string plainText)
        {
            using var aes = Aes.Create();
            aes.Key = DeriveKey();
            aes.GenerateIV();

            using var encryptor = aes.CreateEncryptor();
            var plainBytes = Encoding.UTF8.GetBytes(plainText);
            var cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

            // [16-byte IV][ciphertext] - IV need not be secret, only unique per write.
            var output = new byte[aes.IV.Length + cipherBytes.Length];
            Buffer.BlockCopy(aes.IV, 0, output, 0, aes.IV.Length);
            Buffer.BlockCopy(cipherBytes, 0, output, aes.IV.Length, cipherBytes.Length);
            return output;
        }

        private static string Decrypt(byte[] data)
        {
            using var aes = Aes.Create();
            aes.Key = DeriveKey();

            var ivLength = aes.BlockSize / 8;
            var iv = new byte[ivLength];
            Buffer.BlockCopy(data, 0, iv, 0, ivLength);
            aes.IV = iv;

            using var decryptor = aes.CreateDecryptor();
            var cipherLength = data.Length - ivLength;
            var plainBytes = decryptor.TransformFinalBlock(data, ivLength, cipherLength);
            return Encoding.UTF8.GetString(plainBytes);
        }

        private static byte[] DeriveKey()
        {
            using var pbkdf2 = new Rfc2898DeriveBytes(Passphrase, Salt, Pbkdf2Iterations, HashAlgorithmName.SHA256);
            return pbkdf2.GetBytes(32); // AES-256
        }
    }
}
