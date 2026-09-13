# Responsive Layout Patterns

The KioskKeyboard adapts to its container size automatically via CSS container queries and height-responsive classes. This guide documents the built-in responsive behavior, shows how to customize visual properties per breakpoint, and provides a pattern for switching entire layouts at different device sizes.

> **Scope:** selectors and custom-property names below are the `kiosk-keyboard` (UI5 control) spelling. The `kiosk-keyboard-webc` twin implements the same breakpoints and the same layout data with kebab-case names (`.kiosk-row`, `--kiosk-keyboard-key-gap`); the [CSS sizing reference](../shared/CSS-SIZING-REFERENCE.md) maps the two. Where behavior differs between the packages, this guide says so.

## Built-In Responsive Behavior

The keyboard uses `container-type: inline-size` on its root element with `container-name: keyboard`. Width-responsive styling is pure CSS with no JavaScript involved. The one width behavior that runs JavaScript is the opt-in `autoCompact` layout swap (see [Switching Layouts Per Device Size](#switching-layouts-per-device-size)).

### Width Breakpoints

| Breakpoint        | What Changes                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `<=30rem` (480px) | Key font size capped at `1rem`                                                           |
| `<=22rem` (352px) | Row gap capped at `0.25rem`                                                              |
| `<=20rem` (320px) | Row gap capped at `0.125rem`, key font size capped at `0.875rem`, inline padding reduced |

Every cell above is a `min()` cap on a custom property, so a smaller consumer value survives and only larger ones clamp; the gap caps are skipped for the numpad. Both packages ship these breakpoints identically. No breakpoint reflows a row; see below.

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

**In RTL.** Rows are flex containers and lay out along the document direction, so the compact form mirrors: each row runs right to left, Up keeps Down's column, and the horizontal arrows keep flanking Down with ArrowLeft rendering to the right of it. Arrow-key navigation mirrors the same way - a horizontal move resolves against the direction - so focus still moves between the keys a user sees adjacent. Both packages are guarded by a measured invariant (`test/e2e/invariants.spec.ts`).

**Why this is data and not a `@container` rule.** Arrow-key grid navigation moves on the resolved layout's row/column coordinates, not on rendered geometry. Wrapping one 8-key row into two visual rows with `flex-wrap` leaves it a single logical row of eight, so ArrowDown from Up skips the whole nav row instead of reaching Down; adding a CSS `order` regroup to place the arrows makes visual and logical order disagree outright, which is also a [WCAG 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) problem. Expressing the arrangement as rows keeps DOM order, visual order and navigation order the same thing. `reading-flow: flex-visual` is the CSS-side answer to this class of mismatch, but it is not yet Baseline.

The same reasoning retires the F-key wrap. Preserving source order is not sufficient: it rescues ArrowLeft/Right and reading order, but vertical moves still step by index into the logical row array, so a 1x12 F-key row wrapped to a visual 2x6 leaves ArrowDown from F1 skipping the function keys entirely instead of reaching the F7 rendered directly beneath it. [APG's layout-grid guidance](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/) permits wrapping a single logical set of cells, but it describes the ARIA model rather than the 2D arrow behaviour this control implements. `layouts/fkey-row-compact` is the F-key counterpart to `nav-row-compact`, and the built-in `fkeys` layout is built from it. A whole layout can need the same treatment: `ja-kana-compact` is the kana counterpart, rearranged rather than reflowed for the same reason (see [Switching Layouts Per Device Size](#switching-layouts-per-device-size)).

**Switching between them.** The keyboard swaps layout data on its own only between a whole layout and the compact counterpart that layout declares (see [Switching Layouts Per Device Size](#switching-layouts-per-device-size)). A row composed into a layout of your own is picked by you, which keeps the choice explicit and lets a custom nav row use its own compact form:

```ts
const narrow = window.matchMedia("(max-width: 20rem)");
const navLayout = new CustomLayout({ name: "qwerty-nav" });
kb.addCustomLayout(navLayout);

function applyNavRow(kb: KioskKeyboard): void {
  const rows = narrow.matches ? navRowCompact : [navRow];
  navLayout.setRows(KioskKeyboard.composeLayout(rows, "qwerty"));
  kb.setLayout("qwerty-nav");
}

applyNavRow(kb);
narrow.addEventListener("change", () => applyNavRow(kb));
```

`matchMedia` measures the viewport, while the 20rem it borrows is the keyboard's own container width, and `rem` in a media query resolves against the browser's default font size rather than the root font size the `@container` rules use - the two figures agree only when the keyboard fills the viewport at the default root size. Where the keyboard can be narrower than the viewport, such as a panel on a wide screen, observe the keyboard element with a `ResizeObserver` instead; the same holds for the breakpoint switch under [Switching Layouts Per Device Size](#switching-layouts-per-device-size).

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

CSS custom properties handle visual tuning, but some scenarios require structural layout changes: different keys, different row counts, different key arrangements. A layout that declares a compact counterpart yields to it on its own once `autoCompact` is on; every other switch is a `setLayout()` call on layouts supplied through the `customLayouts` aggregation.

### Pattern: Switch to a Compact Variant at a Breakpoint

Kana is the built-in case. `ja-kana` follows a physical JIS keyboard, which puts Backspace on the digit row and Shift and Enter on the lower kana row; at 1.5x each those rows come to 12.5 and 13 key widths. Below 20rem the inline target-size floor is lifted so a row fits at all (see [the width breakpoints](#width-breakpoints)), and at that density the keys fall under the 24 CSS px spacing [WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) accepts in place of a 24px target. `ja-kana-compact` collects those three keys into a row of their own and returns ー and ろ to their JIS positions, holding every row to twelve widths:

| Keyboard width | `ja-kana` | `ja-kana-compact` |
| -------------- | --------- | ----------------- |
| 400px          | 30.5px    | 31.7px            |
| 352px          | 28.0px    | 28.0px            |
| 320px          | 23.4px    | 24.7px            |
| 312px          | 22.8px    | 24.0px            |

(Measured spacing between the closest pair of key centres, at the default 16px root font size; 24px is the criterion. Both packages measure the same figures.) The wide form holds the criterion down to a 328px keyboard and the compact form down to 312px; one pixel narrower and each falls under. No kana layout clears it below that, since the JIS upper and home rows are twelve keys on their own.

The 320px row is the premise the compact layout exists for, and is held to a measurement by `ja-kana falls under 24px key spacing in a 320px keyboard, where ja-kana-compact clears it` in each package's `test/e2e/invariants.spec.ts`; the 352px row by `both kana forms clear 24px key spacing at the 22rem autoCompact threshold` beside it. Both assert which side of 24px each form is on rather than the figure itself. The 400px and 312px rows and the two crossover widths are point measurements, asserted nowhere.

The two are declared as a pair, so the switch is a property rather than code:

```xml
<kiosk:KioskKeyboard id="kanaKeyboard" layout="ja-kana" autoCompact="true" controls="kanaInput" />
```

The keyboard's own box is what is measured, so an embedded keyboard tiers on the room it was granted rather than on the viewport, and the compact form is taken at or below 22rem (352px) and given back above it. Override that with the `--ui5KioskKeyboard-autoCompactThreshold` custom property (`--kiosk-keyboard-auto-compact-threshold` on the web component, where the attribute is `auto-compact`). The property is off by default and dormant while off: the observer behind it is not constructed until it is switched on.

A swap never overrides an explicit choice. The layout you set stays the one the tier resolves against, so a `setLayout` call or a `{layout:*}` key still wins and is re-tiered from there - the romaji layout's かな key names the wide form, and on a narrow keyboard the tier immediately takes it back to `ja-kana-compact`. `layoutChange` fires with `autoDetected: true` for a swap and `false` for a request, so a listener can tell the two apart.

A layout of your own names its counterpart with the `compact` property of a `customLayouts` entry, which may point at a built-in or at another custom layout:

```xml
<kiosk:customLayouts>
  <kiosk:CustomLayout name="warehouse" rows="{layouts>/warehouseWide}" compact="warehouse-narrow" />
  <kiosk:CustomLayout name="warehouse-narrow" rows="{layouts>/warehouseNarrow}" />
</kiosk:customLayouts>
```

#### Driving the switch yourself

`autoCompact` resolves one declared pair at one threshold. Drive the switch from your own observer when that is not the shape you need: more than two arrangements, two layouts that are not declared as a pair, a threshold that differs per layout, or a choice that depends on something other than the keyboard's width.

```ts
import type KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// Clear of the 328px below which `ja-kana` falls under the criterion.
const KANA_COMPACT_WIDTH = 352;
let width = Infinity;

const keyboard = this.byId("kanaKeyboard") as KioskKeyboard;

function applyKanaLayout(): void {
  const compact = width <= KANA_COMPACT_WIDTH;
  const layout = keyboard.getLayout();
  if (compact && layout === "ja-kana") {
    keyboard.setLayout("ja-kana-compact");
  } else if (!compact && layout === "ja-kana-compact") {
    keyboard.setLayout("ja-kana");
  }
}

const observer = new ResizeObserver(([entry]) => {
  if (!entry) return;
  width = entry.contentRect.width;
  applyKanaLayout();
});
observer.observe(keyboard.getDomRef()!);
// The romaji layout's かな key names the wide form, so a round trip through it
// lands back on `ja-kana` however narrow the keyboard is.
keyboard.attachLayoutChange(applyKanaLayout);
```

Three things this shape gets right, and `autoCompact` gets right for you. It observes the element, not the viewport, which matters wherever the keyboard can be narrower than the window (a panel on a wide screen); the renderer uses semantic rendering, so the root it hands you is patched in place and stays the node you observed. It re-resolves on `layoutChange` as well as on resize, because a layout-switch key can name the wide form from elsewhere and the width will not have changed. And it leaves any layout that is not one of the two alone, so a trip to `numeric` or `fkeys` is not hijacked. Disconnect the observer in `onExit`. The same shape works for a layout of your own: supply it through `customLayouts` and name it in the `setLayout` call.

### When to Use CSS vs Layout Switching

| Scenario                                 | Approach                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Adjust key size, gap, font, padding      | CSS custom properties in `@container` rules                      |
| Hide labels, change icon size            | CSS custom properties (`--ui5KioskKeyboard-dualDirection`, etc.) |
| Change which keys exist                  | `customLayouts` + `setLayout()`                                  |
| Change row structure (key count per row) | `customLayouts` + `setLayout()`                                  |
| Wrap a row at narrow widths, same order  | CSS `flex-wrap`, if vertical arrows need not follow the wrap     |
| Regroup a row's keys at narrow widths    | A second layout named by `compact` + `autoCompact`               |

## Worked Example: Custom Row Wrapping

Wrapping a row in CSS is the right tool when the wrapped arrangement is the row's own order, read left to right and top to bottom, and the row is not one users move through with the vertical arrows. The row stays one logical row: reading order and ArrowLeft/ArrowRight still walk the keys in the order they appear, but ArrowUp/ArrowDown step between logical rows and skip the wrap, for the reason given under [Rows: Choose the Arrangement](#rows-choose-the-arrangement-dont-reflow-it).

Reach for a second layout instead, as [`nav-row-compact`](#rows-choose-the-arrangement-dont-reflow-it) does, when the arrangement you want moves keys past one another. `order` inside a `@container` query would achieve it visually, but navigation follows the resolved layout, so focus would jump against the visual order.

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

`classifyRow()` sets `data-row-kind="fkey"` only when every key is a numbered function key (`F1`, `F2`, ...), and `"nav"` only when every key is a known navigation key. `toolRow` uses `{fkey:...}` values, but `Cut`/`Copy`/`Paste`/`Undo`/`Redo`/`Find` are none of those, so the row classifies as `undefined` and carries no `data-row-kind`. Target it by position or by a custom `data-*` attribute instead:

```css
/* Wrap a custom 6-key toolbar row into 2x3 at narrow widths */
@container keyboard (max-width: 20rem) {
  .ui5KioskRow:first-child {
    flex-wrap: wrap;
  }

  .ui5KioskRow:first-child > .ui5KioskKey {
    flex: 1 0 calc((100% - 2 * var(--ui5KioskKeyboard-keyGap)) / 3);
  }
}
```

This wraps `toolRow` into Cut/Copy/Paste over Undo/Redo/Find - the row's own order, so nothing moves past anything else and ArrowLeft/ArrowRight still walk the keys in the order they appear. ArrowDown from Cut does not reach Undo: the toolbar is still one logical row, so it moves on to the first QWERTY row. When that matters, split the toolbar into two rows in the layout data instead.

If you want a different grouping in the wrapped form, express it as a second layout rather than adding `order` here. `order` would place the keys visually, but arrow-key navigation moves on the resolved layout's coordinates and would keep walking the source order, so focus and sight would disagree.
