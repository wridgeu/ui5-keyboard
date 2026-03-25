# CSS Sizing Reference

This document explains the rationale behind every sizing constant in the keyboard CSS. Both packages (WebC and UI5) use the same values, differing only in naming conventions (`--kiosk-keyboard-*` vs `--ui5KioskKeyboard-*`).

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

The **16rem** (256px) threshold is the point where the default layout would overflow its container. The `cq-short` values reduce key sizing so the keyboard fits:

```
5 keys:    5 * 2.25rem  = 11.25rem
4 gaps:    4 * 0.25rem  =  1rem
2 padding: 2 * 0.5rem   =  1rem
                         --------
cq-short height:          13.25rem (212px)   fits in 16rem with 2.75rem headroom
```

The **12rem** (192px) threshold is where even cq-short values would look cramped. The `cq-tiny` values reduce further:

```
5 keys:    5 * 1.75rem  =  8.75rem
4 gaps:    4 * 0.125rem =  0.5rem
2 padding: 2 * 0.25rem  =  0.5rem
                         --------
cq-tiny height:            9.75rem (156px)   fits in 12rem with 2.25rem headroom
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
  :host(:where(.cq-short, .cq-tiny)) ... .kiosk-key {
    --kiosk-keyboard-key-font-size: min(base, 0.75rem);
  }
}
```

When the keyboard is both narrow (at or below 320px) and height-constrained, this applies the most aggressive font-size cap at 0.75rem (12px).

This cap primarily affects `cq-short` keyboards. At cq-short, the font-size from the height ratio is `2.25rem * 0.375 = 0.84375rem` (13.5px), which gets capped to 0.75rem (12px). At cq-tiny, the font-size is already `1.75rem * 0.375 = 0.65625rem` (10.5px), which is below the 0.75rem cap, so the rule has no additional effect.

## Modifier and Action Key Font-Scale (0.8)

```css
font-size: min(
  var(--kiosk-keyboard-modifier-font-size),
  calc(var(--kiosk-keyboard-key-font-size) * var(--kiosk-keyboard-modifier-font-scale))
);
```

Modifier keys (Shift, layout switches) and action keys (Enter, Backspace) use a font-size capped at 80% of the character key font-size. This keeps their labels visually subordinate to the character keys.

| Scenario                | modifier-font-size | key-font \* 0.8   | Resolved font     | Cap effect |
| ----------------------- | ------------------ | ----------------- | ----------------- | ---------- |
| Default (3rem keys)     | 0.875rem (14px)    | 0.9rem (14.4px)   | 0.875rem (14px)   | No-op      |
| cq-short (2.25rem keys) | 0.875rem (14px)    | 0.675rem (10.8px) | 0.675rem (10.8px) | Active     |
| cq-tiny (1.75rem keys)  | 0.875rem (14px)    | 0.525rem (8.4px)  | 0.525rem (8.4px)  | Active     |

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

| Property   | Value    | Source                                                                             |
| ---------- | -------- | ---------------------------------------------------------------------------------- |
| Key height | 2.25rem  | `--sapElement_Height`                                                              |
| Font-size  | 0.875rem | `--sapFontSize`                                                                    |
| Padding    | 0.5rem   | Matches cq-short to keep compact density visually consistent with constrained mode |
| Gap        | 0.25rem  | Matches cq-short                                                                   |

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
