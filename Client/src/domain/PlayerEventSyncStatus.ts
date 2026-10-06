/** Local lifecycle of an appended event (AD-6). Pending has no server-side equivalent. */
export const PLAYER_EVENT_SYNC_STATUSES = ['Pending', 'Accepted', 'Rejected'] as const;
export type PlayerEventSyncStatus = (typeof PLAYER_EVENT_SYNC_STATUSES)[number];
