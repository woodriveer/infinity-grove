/**
 * Mirrors Backend/src/InfinityGrove.Backend.Domain/Events/PlayerEventType.cs name
 * for name; both sides serialize it as a JSON string.
 */
export const PLAYER_EVENT_TYPES = ['GoldEarned', 'GoldSpent', 'StageCleared', 'HeroAcquired', 'ActiveSquadChanged'] as const;
export type PlayerEventType = (typeof PLAYER_EVENT_TYPES)[number];
