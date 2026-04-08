# Feature: Nav Row Wrapping & Responsive Layout Patterns Documentation

> Status: Implemented

## Problem

### Nav row is unusable at phone-sm widths

At phone-sm viewport (320px / 20rem), the inline nav row renders all 8 navigation keys (Home, Up, End, PgUp, PgDn, Left, Down, Right) in a single flat row. Each key is roughly 35px wide, making icons hard to distinguish and keys untappable. The standalone nav layout uses a spacious 3-column grid, but the inline nav row has no wrapping behavior.

F-key rows already wrap from 1x12 to 2x6 at `<=35rem` via a `@container` rule targeting `data-row-kind="fkey"`. The same `data-row-kind="nav"` attribute is already set on nav rows by `classifyRow()` but has no corresponding CSS wrapping rule.

### No documentation for device-aware layout adaptation

The component has all the primitives for responsive layout adaptation (CSS container queries, `registerLayout()`, `setLayout()`, CSS custom properties, height classes), but consumers have no guide showing how to combine them for device-specific behavior. Layouts like Japanese kana (12 keys per row at 320px) need structural adaptation, not just CSS tweaks.

## Proposal

### 1. Nav row wrapping at narrow widths (CSS)

Add a `@container keyboard (max-width: 20rem)` rule that wraps `data-row-kind="nav"` rows into a 4+4 grid with CSS `order` reordering.

**Source order** in `nav-row.ts`:

1. Home, 2. Up, 3. End, 4. PgUp, 5. PgDn, 6. Left, 7. Down, 8. Right

**Desired wrapped layout:**

- Row 1: Home, Up, End, PgUp (position/page-up cluster)
- Row 2: Left, Down, Right, PgDn (arrows + page-down)

**CSS `order` assignments** (inside the container query only):

- Keys 6-8 (Left, Down, Right): `order: 1` -- move before PgDn
- Key 5 (PgDn): `order: 2` -- push to end of row 2

Keys 1-4 keep natural `order: 0` (default). The `flex-basis` targets 1/4 width minus gaps, using the same calc pattern as the existing fkey wrapping rule.

**CSS rule:**

```less
@container keyboard (max-width: 20rem) {
  .ui5KioskRow[data-row-kind="nav"] {
    flex-wrap: wrap;
  }

  .ui5KioskRow[data-row-kind="nav"] > .ui5KioskKey {
    flex: 1 0 calc((100% - 3 * var(--_ui5KioskKeyboard-keyGap)) / 4);
  }

  .ui5KioskRow[data-row-kind="nav"] > :nth-child(n + 6) {
    order: 1;
  }

  .ui5KioskRow[data-row-kind="nav"] > :nth-child(5) {
    order: 2;
  }
}
```

**Why 20rem:** Matches the existing compact-width threshold. The nav row is usable above this width.

**Why CSS `order`:** The source order in `nav-row.ts` is designed for the standalone nav layout's `slice()` pattern. Changing it would break that composition. CSS `order` is scoped to the container query with zero effect at wider widths.

### 2. Responsive layout patterns documentation

New file: `docs/kiosk/responsive-layout-patterns.md`

Contents:

1. **Built-in responsive behavior** -- What the component handles automatically: container queries for font/padding, fkey wrapping, nav row wrapping, height classes, dual-key label hiding. Lists the breakpoints and what triggers at each.

2. **Customizing visual appearance per size** -- How consumers override CSS custom properties inside `@container` or `@media` rules. Concrete recipes.

3. **Switching layouts per device size** -- Pattern for structural adaptation: register a compact layout variant via `registerLayout()`, use ResizeObserver or media query to call `setLayout()` at a breakpoint. Concrete recipe for Japanese kana-compact at phone widths.

4. **Worked example: nav row wrapping** -- Walk through the CSS `order` + `flex-wrap` technique as a reusable pattern for custom row compositions.

### 3. README cross-link

Add a reference in `packages/kiosk-keyboard/README.md` (Theming > Custom Width Breakpoints area) pointing to `docs/kiosk/responsive-layout-patterns.md`.

## Scope

### In scope

- CSS container query rule for nav row wrapping at `<=20rem`
- New `docs/kiosk/responsive-layout-patterns.md` documentation
- Cross-link from kiosk-keyboard README
- Regenerate affected phone-sm visual baselines

### Out of scope

- Japanese kana layout restructuring (documented as a consumer recipe, not a built-in change)
- Built-in layout-per-breakpoint API (decided against in favor of documentation-first approach)
- Changes to kiosk-keyboard-webc package CSS (shares the LESS source, but may need separate baseline regeneration)

## Considerations

- **Accessibility of CSS `order`**: Screen readers follow DOM order, not visual order. The nav row's DOM order is unchanged; only the visual presentation wraps. The keys remain individually labeled, so this is not an a11y concern.
- **Custom nav row compositions**: Consumers who build their own nav rows with different key counts will get default flex wrapping behavior. The `order` rules target `:nth-child` positions specific to the 8-key nav-row.ts layout. Custom compositions should define their own wrapping rules.
- **This serves as a documented example**: The nav row wrapping demonstrates a pattern (CSS `order` + `flex-wrap` inside `@container`) that consumers can replicate for their own custom row kinds.

## Migration

Non-breaking. The wrapping rule only activates at `<=20rem` container width where the current 8-in-a-row layout is already broken. No API changes.
