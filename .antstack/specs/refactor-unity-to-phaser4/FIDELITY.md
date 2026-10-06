# Fidelity Sign-off (RFR-44, DESIGN.md)

Approval is by eye from side-by-side screenshots of the same state, Unity vs. Phaser (PRD S5).
Phaser screenshots: `cd Client && npm run test:e2e:screenshots` → `artifacts/screenshots/`.
Unity screenshots: from the Unity project (still in the tree until the archive, RFR-50).
A rejected item stays open; it does not block G3.

**2026-10-06: the developer approved every listed item. G4 passed.** The Slime row is not a fidelity
item: it stays open as an art task.

| Item | Phaser technique | Acceptable difference | Status |
|---|---|---|---|
| Krell idle / walk / punch | Aseprite-JSON sheets from `art:slice` (Unity rects + clip timings), both weapon variants | Frame timing within one frame | **approved** (2026-10-06) |
| Fireflies | Additive particles, `diamond` texture, `accentGlow` tint, params in `content/effects/fireflies.json` (off in tests, fewer with reduced motion) | Motion feel and color | **approved** (2026-10-06) |
| Scene lighting | Baked into the backgrounds (no URP 2D lights ported) | Overall mood | **approved** (2026-10-06) |
| Cinzel Decorative | Bundled `.ttf` via `@font-face` (titles) | Hinting / anti-aliasing | **approved** (2026-10-06) |
| Gradient button | Unity plaque bitmaps as 9-slice `border-image`; primary label uses a gold CSS text gradient | Gradient stops | **approved** (2026-10-06) |
| Backgrounds and card frames | Same bitmaps (`menu-bg`, `forest-bg`), cover-scaled to the window | None inside the safe frame | **approved** (2026-10-06) |
| Inter numerics (new) | Bundled `woff2`, tabular figures in the HUD | n/a (new element) | **approved** (2026-10-06) |
| Slime (not on the original list) | Placeholder drawn body; the Unity asset has no sprite (PORT_MAP B8) | — | needs art |
