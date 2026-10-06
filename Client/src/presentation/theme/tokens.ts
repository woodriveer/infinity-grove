/**
 * The single source of color and spacing tokens (DESIGN.md Colors). Values are
 * inherited from the parent DESIGN.md; every other presentation file reads them
 * from here, as CSS custom properties or as Phaser numeric colors. Hex literals
 * anywhere else in presentation/ fail lint.
 */
export const colorHex = {
  bgMenu: '#1B1530',
  bgWorld: '#0E2A2A',
  accentGold: '#D9A94A',
  accentGoldLight: '#F3D58A',
  accentGoldDim: '#8C6A2A',
  accentGlow: '#7FE0C9',
  ink: '#EDE6D6',
  inkDim: '#B8AF9C',
  panel: '#241B3D',
  panelEdge: '#3A2D5C',
  success: '#5FBF6A',
  dangerPowerGate: '#E08A2A',
  dangerMismatch: '#8E6BE6',
  heroFire: '#D94D33',
  heroWater: '#3380E6',
  heroNature: '#4DBF4D',
  heroLight: '#F2D966',
  heroDark: '#804D99',
  black: '#000000',
} as const;

/** Aliases introduced by the port (DESIGN.md "New token"). */
export const focusRing = colorHex.accentGlow;
export const letterboxFill = colorHex.bgWorld;

export type ColorToken = keyof typeof colorHex;

/** Phaser numeric color for a token. */
export function phaserColor(token: ColorToken): number {
  return Number.parseInt(colorHex[token].slice(1), 16);
}

/** Spacing scale in logical px (1920×1080 safe frame). */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 } as const;

/** Writes the tokens as CSS custom properties on the given element (normally :root). */
export function applyCssTokens(style: CSSStyleDeclaration): void {
  for (const [key, value] of Object.entries(colorHex)) {
    style.setProperty(`--ig-${kebab(key)}`, value);
  }
  style.setProperty('--ig-focus-ring', focusRing);
  style.setProperty('--ig-letterbox-fill', letterboxFill);
  for (const [key, value] of Object.entries(space)) {
    style.setProperty(`--ig-space-${key}`, `${value}px`);
  }
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
