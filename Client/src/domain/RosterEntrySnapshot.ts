/**
 * Mirrors the backend RosterEntryDto: total copies ever owned and the server
 * star tier. Backend star tiers start at 0; client HeroEntity tiers start at 1,
 * so reconciling into a HeroEntity adds 1.
 */
export interface RosterEntrySnapshot {
  readonly heroDefinitionId: string;
  readonly ownedCount: number;
  readonly starTier: number;
}
