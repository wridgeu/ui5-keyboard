# Responsive Layout Patterns

The KioskKeyboard adapts to its container size automatically via CSS container queries and height-responsive classes. This guide documents the built-in responsive behavior, shows how to customize visual properties per breakpoint, and provides a pattern for switching entire layouts at different device sizes.

## Built-In Responsive Behavior

The keyboard uses `container-type: inline-size` on its root element with `container-name: keyboard`. All width-responsive behavior is pure CSS with no JavaScript involved.

### Width Breakpoints

| Breakpoint        | What Changes                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `<=35rem` (560px) | F-key rows (12 keys) wrap from 1x12 to 2x6                                                                       |
| `<=30rem` (480px) | Key font size capped at `1rem`                                                                                   |
| `<=20rem` (320px) | Key font size capped at `0.875rem`, inline padding reduced to `0.125rem`, nav rows (8 keys) wrap from 1x8 to 2x4 |

### Nav Row Wrapping Detail

At `<=20rem`, the inline nav row (8 navigation keys) wraps into two rows of four. CSS `order` regroups the keys so that directional arrows stay together:

- **Row 1:** Home, Up, End, PgUp (position/page-up cluster)
- **Row 2:** Left, Down, Right, PgDn (arrows + page-down)

The source order in `nav-row.ts` is unchanged. The reordering is purely visual, scoped to the container query, and has no effect at wider widths. Screen readers follow the DOM order, so accessibility is unaffected.

This pattern (CSS `order` + `flex-wrap` inside `@container`) is reusable for custom row compositions. See [Worked Example: Custom Row Wrapping](#worked-example-custom-row-wrapping) below.

### Height-Responsive Classes

These are applied programmatically by a `ResizeHandler` when the keyboard's rendered height is externally constrained:

| Class                        | Threshold         | Changes                                              |
| ---------------------------- | ----------------- | ---------------------------------------------------- |
| `ui5KioskKeyboard--cq-short` | `<=16rem` (256px) | Key height: 2.25rem, gap: 0.25rem, padding: 0.5rem   |
| `ui5KioskKeyboard--cq-tiny`  | `<=12rem` (192px) | Key height: 1.75rem, gap: 0.125rem, padding: 0.25rem |

Thresholds are configurable via `--ui5KioskKeyboard-cqShortThreshold` and `--ui5KioskKeyboard-cqTinyThreshold`.

### Dual-Key Label Hiding

Keys with both an icon and a label (Shift, Enter, Backspace, nav keys) use the `--dual` variant. At narrow key widths (`<=7rem` per-key container query), the label is visually hidden via the sr-only pattern while remaining in the accessibility tree.

## Customizing Visual Appearance Per Size

All component styles live inside `@layer kiosk-keyboard`, so any unlayered consumer CSS wins regardless of specificity. The keyboard's container name (`keyboard`) is part of the public API and can be referenced in consumer `@container` rules.

### Override CSS Custom Properties at Breakpoints

```css
/* Reduce key height on narrow containers */
@container keyboard (max-width: 25rem) {
  .ui5KioskKeyboard {
    --ui5KioskKeyboard-keyHeight: 2.5rem;
    --ui5KioskKeyboard-keyGap: 0.25rem;
  }
}

/* Larger keys for wide kiosk terminals */
@container keyboard (min-width: 60rem) {
  .ui5KioskKeyboard {
    --ui5KioskKeyboard-keyHeight: 4rem;
    --ui5KioskKeyboard-keyFontSize: 1.5rem;
  }
}
```

### Tune Complex-Script Layouts

Layouts with visually complex glyphs (Arabic, CJK, Devanagari) may appear cramped at narrow widths. Override `--ui5KioskKeyboard-keyFontSize` to adjust:

```css
@container keyboard (max-width: 20rem) {
  .ui5KioskKeyboard {
    --ui5KioskKeyboard-keyFontSize: 0.75rem;
  }
}
```

The responsive `min()` caps in the built-in queries preserve any consumer value that is already smaller than the cap.

## Switching Layouts Per Device Size

CSS custom properties handle visual tuning, but some scenarios require structural layout changes -- different keys, different row counts, different key arrangements. The component provides `registerLayout()` and `setLayout()` for this.

### Pattern: Register a Compact Variant, Switch at a Breakpoint

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// 1. Define a compact layout (fewer keys per row, adapted for narrow screens)
const kanaCompact: LayoutDefinition = [
  // 10 keys per row instead of 12
  [
    /* ... hiragana row 1, 10 keys ... */
  ],
  [
    /* ... hiragana row 2, 10 keys ... */
  ],
  // ...
];

// 2. Register it
KioskKeyboard.registerLayout("ja-kana-compact", kanaCompact);

// 3. Switch based on container/viewport width
const keyboard = this.byId("myKeyboard") as KioskKeyboard;
const mq = window.matchMedia("(max-width: 400px)");

function applyLayout(e: MediaQueryList | MediaQueryListEvent) {
  const current = keyboard.getLayout();
  if (e.matches && current === "ja-kana") {
    keyboard.setLayout("ja-kana-compact");
  } else if (!e.matches && current === "ja-kana-compact") {
    keyboard.setLayout("ja-kana");
  }
}

mq.addEventListener("change", applyLayout);
applyLayout(mq);
```

### When to Use CSS vs Layout Switching

| Scenario                                 | Approach                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Adjust key size, gap, font, padding      | CSS custom properties in `@container` rules                      |
| Hide labels, change icon size            | CSS custom properties (`--ui5KioskKeyboard-dualDirection`, etc.) |
| Change which keys exist                  | `registerLayout()` + `setLayout()`                               |
| Change row structure (key count per row) | `registerLayout()` + `setLayout()`                               |
| Wrap existing rows at narrow widths      | CSS `flex-wrap` on `data-row-kind` (if applicable)               |

## Worked Example: Custom Row Wrapping

The nav row wrapping demonstrates a reusable CSS pattern for adapting row density at narrow widths. Consumers composing custom rows can apply the same technique.

### The Problem

A custom layout prepends 6 tool keys as a single row above the QWERTY keys:

```ts
const toolRow: KeyRow = [
  { value: "{fkey:Cut}", icon: "\u2702", label: "Cut", type: "modifier" },
  { value: "{fkey:Copy}", icon: "\u2398", label: "Copy", type: "modifier" },
  { value: "{fkey:Paste}", icon: "\u2399", label: "Paste", type: "modifier" },
  { value: "{fkey:Undo}", icon: "\u238C", label: "Undo", type: "modifier" },
  { value: "{fkey:Redo}", icon: "\u238D", label: "Redo", type: "modifier" },
  { value: "{fkey:Find}", icon: "\u{1F50D}", label: "Find", type: "modifier" },
];

const myLayout = [toolRow, ...qwerty];
```

At 320px, 6 tool keys in a row are cramped.

### The Solution

Since all keys in `toolRow` use `{fkey:...}` values, `classifyRow()` marks the row as `data-row-kind="fkey"`. The built-in fkey wrapping rule at `<=35rem` already handles this: the 6 keys wrap to 2x3.

If the row contains a mix of key types (not all fkeys or all nav keys), `classifyRow()` returns `undefined` and no `data-row-kind` is set. In that case, add a custom CSS rule targeting the row by position or a custom `data-*` attribute:

```css
/* Wrap a custom 6-key toolbar row into 2x3 at narrow widths */
@container keyboard (max-width: 20rem) {
  .ui5KioskRow:first-child {
    flex-wrap: wrap;
  }

  .ui5KioskRow:first-child > .ui5KioskKey {
    flex: 1 0 calc((100% - 2 * var(--_ui5KioskKeyboard-keyGap)) / 3);
  }
}
```

To reorder keys during wrapping, use CSS `order` on `:nth-child()` selectors inside the same `@container` block. The order values only take effect when `flex-wrap` activates, so they have no impact at wider widths.
