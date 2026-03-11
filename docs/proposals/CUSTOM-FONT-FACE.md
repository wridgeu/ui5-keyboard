# Custom Font Face for Keyboard Labels

> Status: **Proposal**

## Problem

The keyboard components inherit `--sapFontFamily` (the 72 font family) for key
labels. On narrow phone keys (360px viewport, QWERTY shifted row), the `@`
glyph appears slightly off-center.

**What we ruled out:**

- **Font-side metrics** are symmetric. Both `72-Regular.woff2` (the Latin
  subset loaded at runtime) and `72-Regular-full.woff2` show centred side
  bearings for `@` (U+0040) when inspected with
  [fontinfo.app](https://fontinfo.app). Font files are in the
  [SAP/theming-base-content fonts directory](https://github.com/SAP/theming-base-content/tree/master/content/Base/baseLib/baseTheme/fonts).
- **CSS centering logic** is identical for every single-glyph key
  (`text-align: center` inside a flex parent with `justify-content: center`).

**Likely cause:** sub-pixel rounding when the glyph's advance width is close to
the key's content-box width. At 360px the symbol row packs 10 regular keys
(flex: 1) plus a backspace (flex: 2) into ~274px of usable space, giving each
symbol key a content area of roughly 13px while the font renders at 16px
(1rem).

## Affected packages

- `kiosk-keyboard-webc` (Web Component)
- `kiosk-keyboard` (native UI5 library)

## Proposal

Ship a custom `@font-face` optimized for single-key labels. The font would
be a subset of 72 (or a compatible alternative) with adjusted metrics for any
glyphs that exhibit rendering issues at small key sizes.

### Scope

- Subset to printable ASCII + common currency/symbol characters used in
  keyboard layouts.
- Tune metrics for glyphs that render off-center at small sizes (`@` and any
  others identified during testing).
- Bundle the font as a WOFF2 asset inside each package so it works offline.

### Open questions

1. The 72 font ships under Apache-2.0 in `SAP/theming-base-content`.
   Does that permit distributing a modified subset, or do we need a
   separate typeface?
2. Should the custom face apply only to single-glyph labels, or to all key
   labels including multi-character ones (F1, Home, etc.)?
3. What is the acceptable bundle-size budget for the font subset?

## Current workaround

None. The `@` offset is accepted as-is. A CSS comment in
`KioskKeyboard.css` references this proposal for traceability.
