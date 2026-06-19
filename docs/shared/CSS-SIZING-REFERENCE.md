# CSS Sizing Reference

This document explains the rationale behind every sizing constant in the keyboard CSS. Both packages (WebC and UI5) use the same values but different variable names. WebC uses kebab-case with a `--kiosk-keyboard-*` prefix (e.g. `--kiosk-keyboard-key-height`); UI5 uses a `--ui5KioskKeyboard-*` prefix with the per-word segments folded to camelCase (e.g. `--ui5KioskKeyboard-keyHeight`). The variable reference below lists the WebC (kebab) names; swapping only the prefix is not enough to get the UI5 name, the segment casing changes too.

All rem-to-pixel conversions in this document assume the browser default of 16px per rem.

## Key Font-Size Ratio (0.375)

```css
--kiosk-keyboard-key-font-size: calc(var(--kiosk-keyboard-key-height) * 0.375);
```

The key font-size is 37.5% (3/8) of the key height. At the default 3rem (48px) key height, this resolves to 1.125rem (18px).

This ratio keeps text visually proportional inside the key at any height. A 48px key with 18px text leaves 30px for vertical centering, borders, and breathing room. Because the font-size references the key-height variable directly, changing key-height (whether by consumer override or responsive breakpoint) automatically recalculates the font-size. The height-responsive classes only need to override `--kiosk-keyboard-key-height` and the font scales along with it.

## Width-Responsive Font Caps

```css
@container keyboard (max-width: 30rem) {
  /* 480px */
  .kiosk-key {
    --kiosk-keyboard-key-font-size: min(base, 1rem);
  }
}
@container keyboard (max-width: 20rem) {
  /* 320px */
  .kiosk-key {
    --kiosk-keyboard-key-font-size: min(base, 0.875rem);
  }
}
```

These use `min()` to cap but never inflate: a consumer who sets font-size to 0.75rem keeps 0.75rem at all sizes. Only values above the cap are reduced.

| Breakpoint | Threshold     | Cap             | Typical scenario                |
| ---------- | ------------- | --------------- | ------------------------------- |
| Medium     | 30rem (480px) | 1rem (16px)     | Phone landscape, narrow popover |
| Narrow     | 20rem (320px) | 0.875rem (14px) | Phone portrait, split view      |

The 0.875rem narrow cap matches SAP Fiori's base font-size (`--sapFontSize`), which is the smallest size used in standard UI5 controls.

## Width-Responsive Key Padding

```css
@container keyboard (max-width: 20rem) {
  --_kiosk-keyboard-key-padding: var(--kiosk-keyboard-key-padding-xs, 0 0.125rem);
}
```

At 20rem and below, horizontal key padding drops from 0.25rem (4px) to 0.125rem (2px). This gives wide glyphs like `@`, `%`, and `&` more room before the narrower keys force text clipping. The extra-small padding is defined as `min(var(--kiosk-keyboard-key-padding-inline), 0.125rem)` so a consumer who already set a smaller padding keeps their value.

## Height-Responsive Breakpoints

Height breakpoints are driven by JavaScript (ResizeObserver + CSS class toggling) rather than CSS `container-type: size`, because block-size containment would collapse auto-height hosts.

### Why 16rem and 12rem?

A standard 5-row QWERTY keyboard at default sizes totals:

```
5 keys:    5 * 3rem     = 15rem
4 gaps:    4 * 0.375rem =  1.5rem
2 padding: 2 * 0.75rem  =  1.5rem
                         --------
Natural height:           18rem (288px)
```

The **16rem** (256px) threshold is the point where the default layout would overflow its container. The Short tier values reduce key sizing so the keyboard fits:

```
5 keys:    5 * 2.25rem  = 11.25rem
4 gaps:    4 * 0.25rem  =  1rem
2 padding: 2 * 0.5rem   =  1rem
                         --------
Short tier height:        13.25rem (212px)   fits in 16rem with 2.75rem headroom
```

The **12rem** (192px) threshold is where even Short tier values would look cramped. The Tiny tier values reduce further:

```
5 keys:    5 * 1.75rem  =  8.75rem
4 gaps:    4 * 0.125rem =  0.5rem
2 padding: 2 * 0.25rem  =  0.5rem
                         --------
Tiny tier height:          9.75rem (156px)   fits in 12rem with 2.25rem headroom
```

### Summary table

| Breakpoint | Threshold     | Key height     | Gap            | Padding        | Resulting 5-row height |
| ---------- | ------------- | -------------- | -------------- | -------------- | ---------------------- |
| Default    | (none)        | 3rem (48px)    | 0.375rem (6px) | 0.75rem (12px) | 18rem (288px)          |
| Short      | 16rem (256px) | 2.25rem (36px) | 0.25rem (4px)  | 0.5rem (8px)   | 13.25rem (212px)       |
| Tiny       | 12rem (192px) | 1.75rem (28px) | 0.125rem (2px) | 0.25rem (4px)  | 9.75rem (156px)        |

The key-height reduction ratios are 75% for short and 58% for tiny, relative to the default.

## Mixed-Constraint Font Cap (0.75rem)

```css
@container keyboard (max-width: 20rem) {
  :host(.kiosk-keyboard--cq-short, .kiosk-keyboard--cq-tiny) ... .kiosk-key {
    --kiosk-keyboard-key-font-size: min(base, 0.75rem);
  }
}
```

When the keyboard is both narrow (at or below 320px) and height-constrained, this applies the most aggressive font-size cap at 0.75rem (12px).

This cap primarily affects keyboards at the Short tier. At Short, the font-size from the height ratio is `2.25rem * 0.375 = 0.84375rem` (13.5px), which gets capped to 0.75rem (12px). At Tiny, the font-size is already `1.75rem * 0.375 = 0.65625rem` (10.5px), which is below the 0.75rem cap, so the rule has no additional effect.

## Modifier and Action Key Font-Scale (0.8)

```css
font-size: min(
  var(--kiosk-keyboard-modifier-font-size),
  calc(var(--kiosk-keyboard-key-font-size) * var(--kiosk-keyboard-modifier-font-scale))
);
```

Modifier keys (Shift, layout switches) and action keys (Enter, Backspace) use a font-size capped at 80% of the character key font-size. This keeps their labels visually subordinate to the character keys.

| Scenario             | modifier-font-size | key-font \* 0.8   | Resolved font     | Cap effect |
| -------------------- | ------------------ | ----------------- | ----------------- | ---------- |
| Default (3rem keys)  | 0.875rem (14px)    | 0.9rem (14.4px)   | 0.875rem (14px)   | No-op      |
| Short (2.25rem keys) | 0.875rem (14px)    | 0.675rem (10.8px) | 0.675rem (10.8px) | Active     |
| Tiny (1.75rem keys)  | 0.875rem (14px)    | 0.525rem (8.4px)  | 0.525rem (8.4px)  | Active     |

At desktop sizes, `modifier-font-size` (0.875rem from `--sapFontSize`) is already smaller than `key-font * 0.8` (0.9rem), so the cap is a no-op. The cap only activates when keys shrink in constrained containers, keeping modifier text proportionally smaller.

## Multi-Character Label Scaling

```css
.kiosk-key__label--multi {
  font-size: clamp(0.5rem, calc(100cqi * 0.35), 1em);
}
```

This applies to labels with multiple characters (F10, Home, PgUp, Space). Each `.kiosk-key` element has `container-type: inline-size`, so `cqi` units inside the key refer to that key's own inline width.

The three parts of the clamp:

| Part    | Value           | Purpose                                |
| ------- | --------------- | -------------------------------------- |
| Floor   | 0.5rem (8px)    | Minimum readable size on touch devices |
| Ideal   | `100cqi * 0.35` | Font is 35% of the key's width         |
| Ceiling | 1em             | Never exceeds the key's base font-size |

The **0.35 multiplier** is tuned so that typical 3-to-5-character labels (like "F10", "Home", "PgUp") fit within standard key widths across all layouts. At a 40px key, the ideal font is 14px. At a 25px key, the ideal is 8.75px. At a 20px key, the ideal would be 7px, but the 8px floor prevents illegibility.

This is a progressive enhancement: `cqi` units require container query support. In browsers without it, the `clamp()` expression is invalid and labels inherit the key's base font-size as a fallback.

## Numpad Mode

| Property           | Value           | Rationale                                                                                                                         |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Key height         | 3.5rem (56px)   | Taller than default (48px) for easier touch targeting on primary data-entry keys                                                  |
| Font-size          | 1.375rem (22px) | Larger digits for a calculator-style feel. The ratio 22/56 = 0.39, close to the standard 0.375, preserving visual consistency     |
| Min key width      | 4rem (64px)     | Generous horizontal tap area                                                                                                      |
| Max keyboard width | 20rem (320px)   | Keeps the numpad compact. A 3-column grid at 4rem min-width + gaps + padding totals roughly 14.25rem, well within the 20rem limit |

Numpad modifier and action keys bypass the 0.8 font-scale cap because they are primary interaction targets in a numpad context, not subordinate labels.

## Numeric Mode

Font-size is 1.25rem (20px), slightly larger than the default 1.125rem to emphasize digit input. All other sizing inherits from the default.

## Compact Density

Values come from SAP Fiori design tokens, not arbitrary constants:

| Property   | Value    | Source                                                                                   |
| ---------- | -------- | ---------------------------------------------------------------------------------------- |
| Key height | 2.25rem  | `--sapElement_Height`                                                                    |
| Font-size  | 0.875rem | `--sapFontSize`                                                                          |
| Padding    | 0.5rem   | Matches the Short tier to keep compact density visually consistent with constrained mode |
| Gap        | 0.25rem  | Matches the Short tier                                                                   |

Compact density also adjusts numpad sizing:

| Property      | Value    | Rationale                                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------------------------ |
| Key height    | 2.75rem  | Smaller than default numpad (3.5rem) but larger than compact (2.25rem) for touch targeting |
| Font-size     | 1.125rem | Matches default full-keyboard font-size; large enough for calculator-style feel            |
| Min key width | 3rem     | Narrower than default numpad (4rem) to match compact proportions                           |

## Shadow Opacities

Shadows derive from `--sapContent_ShadowColor` via `color-mix()`, with static `rgba()` fallbacks for browsers that do not support `color-mix()`.

| Element           | Opacity | Rationale                                                                                                                                                  |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key at rest       | 10%     | Minimal depth, avoids visual noise across a full keyboard                                                                                                  |
| Key on hover      | 15%     | Slightly stronger to signal interactivity                                                                                                                  |
| Modifier at rest  | 14%     | Higher than regular keys because modifiers use transparent backgrounds (`sapButton_Lite_Background`), so the shadow provides the primary visual separation |
| Modifier on hover | 18%     | Proportional increase over modifier rest                                                                                                                   |
| Docked bar        | 20%     | Most prominent, the docked keyboard floats over page content and needs clear separation                                                                    |

## Key Interaction Transforms

| State              | Transform                     | Duration                 |
| ------------------ | ----------------------------- | ------------------------ |
| Hover              | `translateY(-1px)`            | 0.05s ease               |
| Active / Highlight | `scale(0.96) translateY(1px)` | 0.05s ease               |
| Focus              | `translateY(-1px)`            | (no transition, instant) |

The hover effect lifts the key 1px. The active effect presses it down (1px lower than resting + 4% scale reduction) for a tactile feel. All key transforms are disabled under `prefers-reduced-motion: reduce`.

## Docked Mode Animation

| Property                | Value                          | Source                                                                                         |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Slide duration          | 0.3s                           | Standard UI5/Material animation duration                                                       |
| Easing                  | `cubic-bezier(0.4, 0, 0.2, 1)` | Material Design "standard" easing curve                                                        |
| Visibility delay (hide) | 0.3s                           | Matches slide duration so `visibility: hidden` applies after the slide-out animation completes |

## Space Bar Width

```css
.kiosk-key--wspace {
  flex: 6 1 0;
}
```

The space bar takes 6x the flex-grow of a standard key. In a typical bottom row with 7 keys (4 standard + space + 2 modifiers), the space bar occupies roughly 50% of the row width, matching the proportions of physical keyboards.

## Icon Dimensions

```css
.kiosk-key__icon {
  width: 1.25em;
  height: 1.25em;
}
```

Icons are sized at 125% of the current font-size (`1.25em`). This makes icons slightly larger than adjacent text so they appear visually balanced at the same optical weight.

The icon font stack appends symbol fonts (`Segoe UI Symbol`, `Apple Symbols`, `Noto Sans Symbols 2`) after the SAP font family. Navigation key icons use Unicode arrow symbols (U+21DE-U+21F2) that are absent from the 72 font and may fail on stripped-down platforms (embedded Android WebView) without these explicit fallbacks.

## Dual Icon + Label Keys

```css
--kiosk-keyboard-dual-direction: row;
--kiosk-keyboard-dual-icon-size: 1em;
--kiosk-keyboard-dual-label-size: 1em;
--kiosk-keyboard-dual-gap: 0.3em;
```

When a key has both an icon and a text label (Shift, Enter, Backspace), the `.kiosk-key--dual` class applies flex layout with configurable direction and sizing.

| Property   | Default | Purpose                                                  |
| ---------- | ------- | -------------------------------------------------------- |
| Direction  | `row`   | Icon and label side by side; set to `column` for stacked |
| Icon size  | `1em`   | Inherits from the key's computed font-size               |
| Label size | `1em`   | Same as icon; can be reduced for subordinate labels      |
| Gap        | `0.3em` | Space between icon and label, scales with font-size      |

At narrow key widths (below 7rem per-key inline size), the dual label is visually hidden using the `sr-only` pattern (not `display: none`) so the text remains in the accessibility tree as the key's accessible name.

## Navigation / Function Key Styling

```css
--kiosk-keyboard-fkey-direction: column;
--kiosk-keyboard-fkey-icon-size: clamp(1em, 15cqi, 3em);
--kiosk-keyboard-fkey-label-size: clamp(0.5rem, calc(100cqi * 0.35), 0.7em);
--kiosk-keyboard-fkey-gap: 0.05em;
```

Navigation and function keys (`{fkey:*}`) override the dual-key defaults with a column layout that stacks the icon above a smaller caption label.

| Property   | Default                                     | Rationale                                                      |
| ---------- | ------------------------------------------- | -------------------------------------------------------------- |
| Direction  | `column`                                    | Icon above label; consumers can set to `row` for side-by-side  |
| Icon size  | `clamp(1em, 15cqi, 3em)`                    | Scales with key width (cqi units), clamped between 1em and 3em |
| Label size | `clamp(0.5rem, calc(100cqi * 0.35), 0.7em)` | Scales responsively; floor 8px, ceiling 0.7em of parent        |
| Gap        | `0.05em`                                    | Tight spacing since icon and label have distinct visual weight |

The `15cqi` ideal value prevents the "icon looks lost" appearance on wide nav-only layouts where each key spans ~33% of the keyboard. These variables are scoped to `.kiosk-key--fkey` (a class set by the renderer when a key's value starts with `{fkey:`) to avoid affecting Shift/Enter/Backspace.

### F-Key Row Wrap

At narrow widths (<=35rem / 560px), a `@container` query targets `[data-row-kind="fkey"]` rows and splits them into two rows of six via `flex-wrap`. Each F-key gets `flex: 1 0 calc((100% - 5 * gap) / 6)`, ensuring exactly six keys per row. Above 35rem, all 12 keys fit on a single row. In the UI5 variant, navigation rows (`[data-row-kind="nav"]`) wrap into a 2x4 grid at <=20rem via CSS `order` reordering. In the web component variant, navigation rows do not wrap. The `data-row-kind` attribute is set automatically by `classifyRow()` based on row content.

## Structural Properties

```css
--kiosk-keyboard-border: 1px solid var(--sapGroup_TitleBorderColor, #d9d9d9);
--kiosk-keyboard-border-radius: var(--sapElement_BorderCornerRadius, 0.75rem);
--kiosk-keyboard-max-width: 100%;
--kiosk-keyboard-docked-max-width: 1024px;
--kiosk-keyboard-docked-z-index: 100;
```

| Property         | Default   | Source / rationale                                                            |
| ---------------- | --------- | ----------------------------------------------------------------------------- |
| Border           | 1px solid | Uses `--sapGroup_TitleBorderColor` for consistent SAP Fiori group styling     |
| Border radius    | 0.75rem   | Uses `--sapElement_BorderCornerRadius`; docked mode zeroes bottom corners     |
| Max width        | 100%      | Inline keyboard fills its container                                           |
| Docked max width | 1024px    | Prevents the docked keyboard from stretching across ultra-wide displays       |
| Docked z-index   | 100       | Sits above page content but below modal dialogs (SAP Fiori modals use higher) |

### Key Border Color

`--kiosk-keyboard-key-border-color` is unset by default. When set, it applies a uniform border color across all key types (default, modifier, action), overriding the per-variant SAP button border colors. Useful for industrial/kiosk deployments where key boundaries must be extra visible.

## Height-Responsive Threshold Variables

```css
--kiosk-keyboard-cq-short-threshold: 16rem;
--kiosk-keyboard-cq-tiny-threshold: 12rem;
```

These thresholds are read by the ResizeObserver in JavaScript to toggle `.kiosk-keyboard--cq-short` and `.kiosk-keyboard--cq-tiny` classes on the host element. Exposing them as CSS custom properties allows consumers to adjust when the height breakpoints trigger without modifying JavaScript. See [Height-Responsive Breakpoints](#height-responsive-breakpoints) for the sizing values at each tier.

## Script-Specific Font Stacks

The SAP 72 font has no CJK, Hangul, Indic, or Arabic glyphs. When rendering these scripts, the browser falls through the font stack to OS defaults. However, the line-box metrics (used by `text-box-trim` and `line-height`) still come from the primary font (72), causing vertical offset. Putting script-specific system fonts first for labeled keys ensures the browser uses matched glyph and line-box metrics.

Each script class has a dedicated CSS custom property for consumer overrides:

| Script family | CSS class                         | Override variable                     | Default stack (abbreviated)                                |
| ------------- | --------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| CJK           | `.kiosk-key__label--glyph-cjk`    | `--kiosk-keyboard-cjk-font-family`    | Hiragino Sans, Yu Gothic UI, Meiryo, Noto Sans CJK JP, ... |
| Hangul        | `.kiosk-key__label--glyph-hangul` | `--kiosk-keyboard-hangul-font-family` | Apple SD Gothic Neo, Malgun Gothic, Noto Sans CJK KR, ...  |
| Indic         | `.kiosk-key__label--glyph-indic`  | `--kiosk-keyboard-indic-font-family`  | Nirmala UI, Noto Sans Devanagari, Noto Sans Bengali, ...   |
| Arabic        | `.kiosk-key__label--glyph-arabic` | `--kiosk-keyboard-arabic-font-family` | Segoe UI, Geeza Pro, Noto Sans Arabic, Tahoma, ...         |

Hangul gets a separate class from CJK so Korean system fonts are prioritized over Japanese/Chinese fonts for correct glyph metrics. Arabic gets its own class because its vertical metrics (extended ascenders, descenders, diacritical marks) differ from Latin `cap alphabetic` trimming. See [CJK Glyph Centering](../proposals/CJK-GLYPH-CENTERING.md) for background on the text-box-edge approach.

## Text-box-trim Progressive Enhancement

```css
@supports (text-box-trim: trim-both) {
  .kiosk-key__label {
    text-box-trim: trim-both;
    text-box-edge: text;
    line-height: normal;
  }
  .kiosk-key__label--glyph {
    text-box-edge: cap alphabetic;
  }
  .kiosk-key__label--glyph-cjk,
  .kiosk-key__label--glyph-hangul,
  .kiosk-key__label--glyph-indic,
  .kiosk-key__label--glyph-arabic {
    text-box-edge: text;
  }
}
```

Trims invisible half-leading above and below text, giving true optical centering inside keys. Single-glyph Latin labels use `cap alphabetic` for tighter metrics. CJK, Hangul, Indic, and Arabic labels fall back to `text` because `cap alphabetic` is a Latin-specific metric that produces incorrect trimming for these scripts.

Browser support: Chrome 133+, Edge 133+, Safari 18.2+. Non-supporting browsers keep the existing `line-height` behavior unchanged.

## Complete Variable Reference

All public CSS custom properties defined on `:host`, listed with their default values.

| Variable                                 | Default                                         | Section                                                                         |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `--kiosk-keyboard-padding`               | `0.75rem`                                       | [Height-Responsive Breakpoints](#height-responsive-breakpoints)                 |
| `--kiosk-keyboard-key-gap`               | `0.375rem`                                      | [Height-Responsive Breakpoints](#height-responsive-breakpoints)                 |
| `--kiosk-keyboard-key-height`            | `3rem`                                          | [Height-Responsive Breakpoints](#height-responsive-breakpoints)                 |
| `--kiosk-keyboard-key-font-size`         | `calc(key-height * 0.375)`                      | [Key Font-Size Ratio](#key-font-size-ratio-0375)                                |
| `--kiosk-keyboard-key-padding-inline`    | `0.25rem`                                       | [Width-Responsive Key Padding](#width-responsive-key-padding)                   |
| `--kiosk-keyboard-key-padding`           | `0 key-padding-inline`                          | [Width-Responsive Key Padding](#width-responsive-key-padding)                   |
| `--kiosk-keyboard-key-padding-inline-xs` | `min(key-padding-inline, 0.125rem)`             | [Width-Responsive Key Padding](#width-responsive-key-padding)                   |
| `--kiosk-keyboard-key-padding-xs`        | `0 key-padding-inline-xs`                       | [Width-Responsive Key Padding](#width-responsive-key-padding)                   |
| `--kiosk-keyboard-key-shadow`            | `0 1px 2px rgba(34,53,72,0.1)`                  | [Shadow Opacities](#shadow-opacities)                                           |
| `--kiosk-keyboard-key-shadow-hover`      | `0 2px 4px rgba(34,53,72,0.15)`                 | [Shadow Opacities](#shadow-opacities)                                           |
| `--kiosk-keyboard-modifier-shadow`       | `0 1px 2px rgba(34,53,72,0.14)`                 | [Shadow Opacities](#shadow-opacities)                                           |
| `--kiosk-keyboard-modifier-shadow-hover` | `0 2px 4px rgba(34,53,72,0.18)`                 | [Shadow Opacities](#shadow-opacities)                                           |
| `--kiosk-keyboard-docked-shadow`         | `0 -4px 20px rgba(34,53,72,0.2)`                | [Shadow Opacities](#shadow-opacities)                                           |
| `--kiosk-keyboard-modifier-font-size`    | `var(--sapFontSize, 0.875rem)`                  | [Modifier and Action Key Font-Scale](#modifier-and-action-key-font-scale-08)    |
| `--kiosk-keyboard-modifier-font-scale`   | `0.8`                                           | [Modifier and Action Key Font-Scale](#modifier-and-action-key-font-scale-08)    |
| `--kiosk-keyboard-max-width`             | `100%`                                          | [Structural Properties](#structural-properties)                                 |
| `--kiosk-keyboard-docked-max-width`      | `1024px`                                        | [Structural Properties](#structural-properties)                                 |
| `--kiosk-keyboard-docked-z-index`        | `100`                                           | [Structural Properties](#structural-properties)                                 |
| `--kiosk-keyboard-border`                | `1px solid --sapGroup_TitleBorderColor`         | [Structural Properties](#structural-properties)                                 |
| `--kiosk-keyboard-border-radius`         | `var(--sapElement_BorderCornerRadius, 0.75rem)` | [Structural Properties](#structural-properties)                                 |
| `--kiosk-keyboard-key-border-color`      | not declared                                    | [Structural Properties](#structural-properties)                                 |
| `--kiosk-keyboard-numpad-max-width`      | `20rem`                                         | [Numpad Mode](#numpad-mode)                                                     |
| `--kiosk-keyboard-numpad-key-min-width`  | `4rem`                                          | [Numpad Mode](#numpad-mode)                                                     |
| `--kiosk-keyboard-dual-direction`        | `row`                                           | [Dual Icon + Label Keys](#dual-icon--label-keys)                                |
| `--kiosk-keyboard-dual-icon-size`        | `1em`                                           | [Dual Icon + Label Keys](#dual-icon--label-keys)                                |
| `--kiosk-keyboard-dual-label-size`       | `1em`                                           | [Dual Icon + Label Keys](#dual-icon--label-keys)                                |
| `--kiosk-keyboard-dual-gap`              | `0.3em`                                         | [Dual Icon + Label Keys](#dual-icon--label-keys)                                |
| `--kiosk-keyboard-fkey-direction`        | `column`                                        | [Navigation / Function Key Styling](#navigation--function-key-styling)          |
| `--kiosk-keyboard-fkey-icon-size`        | `clamp(1em, 15cqi, 3em)`                        | [Navigation / Function Key Styling](#navigation--function-key-styling)          |
| `--kiosk-keyboard-fkey-label-size`       | `clamp(0.5rem, calc(100cqi * 0.35), 0.7em)`     | [Navigation / Function Key Styling](#navigation--function-key-styling)          |
| `--kiosk-keyboard-fkey-gap`              | `0.05em`                                        | [Navigation / Function Key Styling](#navigation--function-key-styling)          |
| `--kiosk-keyboard-cq-short-threshold`    | `16rem`                                         | [Height-Responsive Threshold Variables](#height-responsive-threshold-variables) |
| `--kiosk-keyboard-cq-tiny-threshold`     | `12rem`                                         | [Height-Responsive Threshold Variables](#height-responsive-threshold-variables) |
| `--kiosk-keyboard-cjk-font-family`       | not declared                                    | [Script-Specific Font Stacks](#script-specific-font-stacks)                     |
| `--kiosk-keyboard-hangul-font-family`    | not declared                                    | [Script-Specific Font Stacks](#script-specific-font-stacks)                     |
| `--kiosk-keyboard-indic-font-family`     | not declared                                    | [Script-Specific Font Stacks](#script-specific-font-stacks)                     |
| `--kiosk-keyboard-arabic-font-family`    | not declared                                    | [Script-Specific Font Stacks](#script-specific-font-stacks)                     |
