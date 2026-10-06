# Fidelity Sign-off (RFR-44, DESIGN.md)

Approval is by eye from side-by-side screenshots of the same state, Unity vs. Phaser (PRD S5).
Phaser screenshots: `cd Client && npm run test:e2e:screenshots` → `artifacts/screenshots/`.
Unity screenshots: from the Unity project (still in the tree until the archive, RFR-50).
A rejected item stays open; it does not block G3.

| Item | Phaser technique | Acceptable difference | Status |
|---|---|---|---|
| Krell idle / walk / punch | Aseprite-JSON sheets from `art:slice` (Unity rects + clip timings), both weapon variants | Frame timing within one frame | awaiting developer |
| Fireflies | Additive particles, `diamond` texture, `accentGlow` tint, params in `content/effects/fireflies.json` (off in tests, fewer with reduced motion) | Motion feel and color | awaiting developer |
| Scene lighting | Baked into the backgrounds (no URP 2D lights ported) | Overall mood | awaiting developer |
| Cinzel Decorative | Bundled `.ttf` via `@font-face` (titles) | Hinting / anti-aliasing | awaiting developer |
| Gradient button | Unity plaque bitmaps as 9-slice `border-image`; primary label uses a gold CSS text gradient | Gradient stops | awaiting developer — stops not yet sampled from `Button.prefab` |
| Backgrounds and card frames | Same bitmaps (`menu-bg`, `forest-bg`), cover-scaled to the window | None inside the safe frame | awaiting developer |
| Inter numerics (new) | Bundled `woff2`, tabular figures in the HUD | n/a (new element) | awaiting developer |
| Slime (not on the original list) | Placeholder drawn body; the Unity asset has no sprite (PORT_MAP B8) | — | needs art |
