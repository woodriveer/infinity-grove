using UnityEngine;

/// <summary>
/// Design-time tuning for the local save cache, Steam Cloud sync and backend
/// reconciliation loop (Architecture AD-6/AD-9/AD-10, PRD FR-41/FR-42/FR-43/FR-44).
/// Offline-accrual rate and cap are tuning parameters PRD FR-42 explicitly defers
/// to balancing work; the fields below are that placeholder, not a final value.
/// </summary>
[CreateAssetMenu(fileName = "Backend Sync Settings", menuName = "Infinity Grove/Backend Sync Settings")]
public class BackendSyncSettings : ScriptableObject
{
    [Header("Backend API")]
    [Tooltip("Base URL of the ASP.NET Core backend's versioned API, e.g. http://localhost:5217/api/v1/ for local docker-compose (Architecture AD-3/AD-10).")]
    public string apiBaseUrl = "http://localhost:5217/api/v1/";

    [Tooltip("Seconds between opportunistic event-batch syncs while the game is running and online (AD-6).")]
    public float syncIntervalSeconds = 60f;

    [Tooltip("Seconds to wait for a single backend HTTP call before treating it as unreachable and falling back to offline play (AD-6: 'stays fully playable offline').")]
    public int requestTimeoutSeconds = 10;

    [Header("Offline Gold Accrual (FR-41/FR-42)")]
    [Tooltip("Gold earned per point of Active Squad power per hour spent offline. [ASSUMPTION - tuning placeholder, PRD FR-42/FR-16].")]
    public double idleGoldPerSquadPowerPerHour = 1.0;

    [Tooltip("Maximum hours of offline time credited on return, matching PRD FR-42's assumed capped model (8-24h genre norm; exact cap deferred to tuning).")]
    public float offlineAccrualCapHours = 12f;

    [Header("Local Save File")]
    [Tooltip("File name written under Application.persistentDataPath (AD-9). Steam Cloud (AD-4) mirrors this same file across a player's devices.")]
    public string saveFileName = "infinitygrove.save";
}
