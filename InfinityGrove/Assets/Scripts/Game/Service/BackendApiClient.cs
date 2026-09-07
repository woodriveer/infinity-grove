using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Networking;

namespace InfinityGrove.Service
{
    /// <summary>
    /// UnityWebRequest-based implementation of <see cref="IBackendApiClient"/>
    /// against the ASP.NET Core backend (AD-2/AD-10). Holds the short-lived
    /// session token in memory only - never persisted to the local save file,
    /// since a fresh token is obtained from a new Steam Auth Session Ticket every
    /// launch (AD-5).
    /// </summary>
    public class BackendApiClient : IBackendApiClient
    {
        private readonly BackendSyncSettings _settings;
        private string _sessionToken;

        public bool IsAuthenticated => !string.IsNullOrEmpty(_sessionToken);

        public BackendApiClient(BackendSyncSettings settings)
        {
            _settings = settings;
        }

        public async Task<bool> AuthenticateWithSteamAsync(string ticketHex, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(ticketHex)) return false;

            var request = new SteamAuthRequestDto(ticketHex);
            var response = await PostAsync<SteamAuthResponseDto>("auth/steam", request, includeAuth: false, cancellationToken);
            if (response == null) return false;

            _sessionToken = response.SessionToken;
            return true;
        }

        public async Task<PlayerStateWireDto> GetStateAsync(CancellationToken cancellationToken)
        {
            if (!IsAuthenticated) return null;
            return await GetAsync<PlayerStateWireDto>("players/me/state", cancellationToken);
        }

        public async Task<IngestEventsBatchResponseDto> IngestBatchAsync(List<IngestEventWireDto> events, CancellationToken cancellationToken)
        {
            if (!IsAuthenticated) return null;

            var request = new IngestEventsBatchRequestDto { Events = events };
            return await PostAsync<IngestEventsBatchResponseDto>("events/batch", request, includeAuth: true, cancellationToken);
        }

        private async Task<TResponse> GetAsync<TResponse>(string relativeUrl, CancellationToken cancellationToken) where TResponse : class
        {
            using var request = UnityWebRequest.Get(BuildUrl(relativeUrl));
            ApplyCommonHeaders(request, includeAuth: true);

            return await SendAsync<TResponse>(request, cancellationToken);
        }

        private async Task<TResponse> PostAsync<TResponse>(string relativeUrl, object body, bool includeAuth, CancellationToken cancellationToken) where TResponse : class
        {
            var json = JsonConvert.SerializeObject(body);
            var bodyBytes = Encoding.UTF8.GetBytes(json);

            using var request = new UnityWebRequest(BuildUrl(relativeUrl), "POST");
            request.uploadHandler = new UploadHandlerRaw(bodyBytes);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            ApplyCommonHeaders(request, includeAuth);

            return await SendAsync<TResponse>(request, cancellationToken);
        }

        private async Task<TResponse> SendAsync<TResponse>(UnityWebRequest request, CancellationToken cancellationToken) where TResponse : class
        {
            request.timeout = Mathf.Max(1, _settings.requestTimeoutSeconds);

            try
            {
                using var cancelRegistration = cancellationToken.Register(request.Abort);
                await request.SendWebRequest();

                if (request.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogWarning($"BackendApiClient: request to '{request.url}' failed: {request.error}");
                    return null;
                }

                var responseText = request.downloadHandler.text;
                return string.IsNullOrEmpty(responseText) ? null : JsonConvert.DeserializeObject<TResponse>(responseText);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"BackendApiClient: request to '{request.url}' threw: {ex.Message}");
                return null;
            }
        }

        private void ApplyCommonHeaders(UnityWebRequest request, bool includeAuth)
        {
            request.downloadHandler ??= new DownloadHandlerBuffer();
            request.SetRequestHeader("Accept", "application/json");

            if (includeAuth && IsAuthenticated)
            {
                request.SetRequestHeader("Authorization", $"Bearer {_sessionToken}");
            }
        }

        private string BuildUrl(string relativeUrl)
        {
            var baseUrl = _settings.apiBaseUrl;
            if (!baseUrl.EndsWith("/")) baseUrl += "/";
            return baseUrl + relativeUrl;
        }
    }
}
