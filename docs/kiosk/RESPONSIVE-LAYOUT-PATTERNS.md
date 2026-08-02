# Responsive Layout Patterns

The KioskKeyboard adapts to its container size automatically via CSS container queries and height-responsive classes. This guide documents the built-in responsive behavior, shows how to customize visual properties per breakpoint, and provides a pattern for switching entire layouts at different device sizes.

> **Scope:** selectors and custom-property names below are the `kiosk-keyboard` (UI5 control) spelling. The `kiosk-keyboard-webc` twin implements the same breakpoints and the same layout data with kebab-case names (`.kiosk-row`, `--kiosk-keyboard-key-gap`); the [CSS sizing reference](../shared/CSS-SIZING-REFERENCE.md) maps the two. Where behavior differs between the packages, this guide says so.

## Built-In Responsive Behavior

The keyboard uses `container-type: inline-size` on its root element with `container-name: keyboard`. All width-responsive behavior is pure CSS with no JavaScript involved.

### Width Breakpoints

| Breakpoint        | What Changes                                                             |
| ----------------- | ------------------------------------------------------------------------ |
| `<=30rem` (480px) | Key font size capped at `1rem`                                           |
| `<=20rem` (320px) | Key font size capped at `0.875rem`, inline padding reduced to `0.125rem` |

Both packages ship these breakpoints identically. No breakpoint reflows a row; see below.

### Rows: Choose the Arrangement, Don't Reflow It

An 8-key `navRow` composed onto a keyboard narrower than about 20rem leaves each key around 30px wide. The fix is a second arrangement of the same keys, shipped as layout data:

```ts
import navRow from "ui5/kiosk/layouts/nav-row"; // 1 row of 8
import navRowCompact from "ui5/kiosk/layouts/nav-row-compact"; // 2 rows of 4
```

`navRowCompact` slices the same key definitions into:

- **Row 1:** Home, Up, End, PgUp (position cluster)
- **Row 2:** Left, Down, Right, PgDn (arrows, Page Down trailing)

Up therefore sits directly above Down with Left and Right flanking it.

**Why this is data and not a `@container` rule.** Arrow-key grid navigation moves on the resolved layout's row/column coordinates, not on rendered geometry. Wrapping one 8-key row into two visual rows with `flex-wrap` leaves it a single logical row of eight, so ArrowDown from Up skips the whole nav row instead of reaching Down; adding a CSS `order` regroup to place the arrows makes visual and logical order disagree outright, which is also a [WCAG 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) problem. Expressing the arrangement as rows keeps DOM order, visual order and navigation order the same thing. `reading-flow: flex-visual` is the CSS-side answer to this class of mismatch, but it is not yet Baseline.

The same reasoning retires the F-key wrap. Preserving source order is not sufficient: it rescues ArrowLeft/Right and reading order, but vertical moves still step by index into the logical row array, so a 1x12 F-key row wrapped to a visual 2x6 leaves ArrowDown from F1 skipping the function keys entirely instead of reaching the F7 rendered directly beneath it. [APG's layout-grid guidance](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/) permits wrapping a single logical set of cells, but it describes the ARIA model rather than the 2D arrow behaviour this control implements. `layouts/fkey-row-compact` is the F-key counterpart to `nav-row-compact`, and the built-in `fkeys` layout is built from it.

**Switching between them.** The keyboard does not swap layout data on its own; the consumer picks the arrangement, which keeps the choice explicit and lets a custom nav row use its own compact form:

```ts
const narrow = window.matchMedia("(max-width: 20rem)");

function applyNavRow(kb: KioskKeyboard): void {
  const rows = narrow.matches ? navRowCompact : [navRow];
  kb.setInstanceLayouts({ "qwerty-nav": KioskKeyboard.composeLayout(rows, "qwerty") });
  kb.setLayout("qwerty-nav");
}

applyNavRow(kb);
narrow.addEventListener("change", () => applyNavRow(kb));
```

See [Worked Example: Custom Row Wrapping](#worked-example-custom-row-wrapping) below for the CSS-side pattern, which remains appropriate for rows whose source order already matches the wrapped arrangement.

### Height-Responsive Classes

These are applied programmatically by a `ResizeObserver`. The contract is shared with the web-component twin: the keyboard applies `cqShort`/`cqTiny` when the height its container actually grants the keyboard's rendered box, measured in untransformed layout pixels (light DOM: the root's client height plus its border, the granted border box; shadow DOM: the host's content-box height), is smaller than the keyboard's natural content height, with the tier chosen against the 16rem/12rem thresholds (overridable via the `--ui5KioskKeyboard-cqShortThreshold` / `--ui5KioskKeyboard-cqTinyThreshold` CSS custom properties). Ancestor `transform: scale()` therefore never shifts breakpoints. The measured box must keep `overflow: hidden` (never `overflow: clip`, which can collapse `scrollHeight` to `clientHeight` in some browsers and break detection).

| Class                       | Threshold         | Changes                                              |
| --------------------------- | ----------------- | ---------------------------------------------------- |
| `ui5KioskKeyboard--cqShort` | `<=16rem` (256px) | Key height: 2.25rem, gap: 0.25rem, padding: 0.5rem   |
| `ui5KioskKeyboard--cqTiny`  | `<=12rem` (192px) | Key height: 1.75rem, gap: 0.125rem, padding: 0.25rem |

Thresholds are configurable via `--ui5KioskKeyboard-cqShortThreshold` and `--ui5KioskKeyboard-cqTinyThreshold`.

### Dual-Key Label Hiding

Keys with both an icon and a label (Shift, Enter, Backspace, nav keys) use the `--dual` variant. At narrow key widths (`<=7rem` per-key container query), the label is visually hidden via the sr-only pattern while remaining in the accessibility tree, and the icon is scaled up to `--ui5KioskKeyboard-keyFontSize` so the key does not read as empty. Nav/function keys are included: below this threshold their `--ui5KioskKeyboard-fkeyIconSize` scaling is superseded, since it exists to balance the icon against a visible label.

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

CSS custom properties handle visual tuning, but some scenarios require structural layout changes: different keys, different row counts, different key arrangements. Supply alternate layouts via the per-instance `instanceLayouts` property and switch with `setLayout()`.

### Pattern: Supply a Compact Variant, Switch at a Breakpoint

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// 1. Define a compact layout (fewer keys per row, adapted for narrow screens)
const kanaCompact: LayoutDefinition = [
  // 10 keys per row instead of 12
  [/* ... hiragana row 1, 10 keys ... */],
  [/* ... hiragana row 2, 10 keys ... */],
  // ...
];

// 2. Supply it on the control
const keyboard = this.byId("myKeyboard") as KioskKeyboard;
keyboard.setInstanceLayouts({ "ja-kana-compact": kanaCompact });

// 3. Switch based on container/viewport width
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
| Change which keys exist                  | `instanceLayouts` + `setLayout()`                                |
| Change row structure (key count per row) | `instanceLayouts` + `setLayout()`                                |
| Wrap a row at narrow widths, same order  | CSS `flex-wrap` on `data-row-kind` (if applicable)               |
| Regroup a row's keys at narrow widths    | A second layout + `instanceLayouts` + `setLayout()`              |

## Worked Example: Custom Row Wrapping

Wrapping a row in CSS is the right tool when the wrapped arrangement is the row's own order, read left to right and top to bottom. The row stays one logical row, and the keys a user sees adjacent stay adjacent to arrow-key navigation.

Reach for a second layout instead, as [`nav-row-compact`](#nav-rows-choose-the-arrangement-dont-reflow-it) does, when the arrangement you want moves keys past one another. `order` inside a `@container` query would achieve it visually, but navigation follows the resolved layout, so focus would jump against the visual order.

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

Since all keys in `toolRow` use `{fkey:...}` values, `classifyRow()` marks the row as `data-row-kind="fkey"`. That attribute is a styling hook only; the component ships no wrapping rule for it, so the row lays out 1x6 on a single line. To wrap it 2x3 at narrow widths, add the custom CSS rule below (1/3 width).

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

This wraps `toolRow` into Cut/Copy/Paste over Undo/Redo/Find - the row's own order, so nothing moves past anything else and arrow-key navigation still walks the keys in the order they appear.

If you want a different grouping in the wrapped form, express it as a second layout rather than adding `order` here. `order` would place the keys visually, but arrow-key navigation moves on the resolved layout's coordinates and would keep walking the source order, so focus and sight would disagree.
