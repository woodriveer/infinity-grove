import type { SteamIdentity } from '../ports';

/**
 * Dev identity (Unity DevSteamIdentityProvider). With no ticket it returns null,
 * so the game runs offline. CI's sync-e2e passes a fake-Steam test ticket instead.
 */
export class DevSteamIdentity implements SteamIdentity {
  constructor(private readonly ticket: string | null = null) {}

  async getAuthTicketHex(): Promise<string | null> {
    return this.ticket;
  }
}
