import type { HeroType } from '../domain/HeroType';
import type { ColorToken } from './theme/tokens';

/**
 * Hero type legibility (P15, parent NFR-3): an abbreviation and a full name always
 * accompany the color, so type never relies on color alone. Port of HeroTypeDisplay.cs.
 */
export const HeroTypeDisplay = {
  abbreviation(type: HeroType): string {
    switch (type) {
      case 'Fire':
        return 'FIR';
      case 'Water':
        return 'WAT';
      case 'Nature':
        return 'NAT';
      case 'Light':
        return 'LIT';
      case 'Dark':
        return 'DRK';
    }
  },

  color(type: HeroType): ColorToken {
    switch (type) {
      case 'Fire':
        return 'heroFire';
      case 'Water':
        return 'heroWater';
      case 'Nature':
        return 'heroNature';
      case 'Light':
        return 'heroLight';
      case 'Dark':
        return 'heroDark';
    }
  },

  /** "NAT · Nature": what screens and describe() show. */
  label(type: HeroType): string {
    return `${HeroTypeDisplay.abbreviation(type)} · ${type}`;
  },
} as const;
