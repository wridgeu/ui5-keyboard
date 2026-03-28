# CJK Glyph Centering

> Status: **In Progress** | Tracks: [#46](https://github.com/wridgeu/ui5-lib-keyboard/issues/46)

## Problem

At narrow key widths (phone-sm, phone-md device profiles), CJK glyphs
(hiragana, katakana, Hangul, kanji) appear visually offset within their keys.
Investigation in [PR #47](https://github.com/wridgeu/ui5-lib-keyboard/pull/47)
proved the CSS layout is mathematically correct -- the label element is
perfectly centered. The offset is in the **font glyph metrics** themselves.

This document covers two distinct centering dimensions, the industry context,
what has been implemented so far, and what remains blocked on browser support.

## Two Dimensions of the Problem

### Horizontal offset (font side bearings)

Hiragana and other CJK characters in the SAP 72 font (and system fallbacks like
Yu Gothic UI) have **asymmetric side bearings**: the visual ink center does not
match the typographic center of the glyph bounding box. The browser correctly
centers the bounding box, but the ink appears shifted.

- **Root cause**: font glyph metrics (not CSS)
- **Fix**: requires a custom font with optically centered CJK glyphs, or a
  monospaced CJK font for kana layouts (see [CUSTOM-FONT-FACE.md](./CUSTOM-FONT-FACE.md))
- **Evidence**: pixel measurements in PR #47 show `labelCenterOffset: 0px` and
  symmetric padding at both phone-sm and phone-md

### Vertical offset (text-box-edge metrics)

The `@supports (text-box-trim: trim-both)` progressive enhancement applies
`text-box-edge: cap alphabetic` to all single-glyph labels. This trims the
label's line box to Latin cap-height (top) and alphabetic baseline (bottom).
CJK glyphs extend the full ideographic em-box, which is taller than cap-height,
so the trimmed box does not match the CJK glyph extent.

- **Root cause**: `cap alphabetic` is a Latin-script-specific metric
- **Fix**: override to `text-box-edge: text` for CJK glyphs (implemented in
  [PR #48](https://github.com/wridgeu/ui5-lib-keyboard/pull/48)), with a
  `@supports` guard for the future `ideographic-ink` value
- **Current practical impact**: with Yu Gothic UI on Windows, `text` and
  `cap alphabetic` resolve to the same metrics, so baselines are visually
  unchanged. The fix is architecturally correct and will take visible effect
  with fonts that have differentiated CJK metrics (e.g. Noto Sans JP) or when
  browsers ship `ideographic-ink`

### Japanese punctuation positioning

Characters like 、(comma), 。(period), ゛(dakuten), ゜(handakuten) are
**intentionally** positioned off-center within the em-box. The W3C Requirements
for Japanese Text Layout (JLREQ) states:

> "Also there are punctuation marks with letter faces that are not placed at
> the vertical and horizontal center of the character frame."

-- [JLREQ, Section 3.1.2](https://w3c.github.io/jlreq/?lang=en#about_character_shape)

This is standard Japanese typography. Japanese users expect these marks where
they are. Forcing them to appear visually centered would look wrong to native
readers.

## How Native Keyboards Handle CJK Centering

### Android / Gboard (AOSP LatinIME)

The AOSP LatinIME source uses **ink-bound centering**: it measures the actual
rendered height of a reference glyph ('M'), then positions the text baseline so
the ink midpoint aligns with the key center.

```java
// TypefaceUtils.java -- measures actual ink height of 'M'
float labelCharHeight = TypefaceUtils.getReferenceCharHeight(paint);

// KeyboardView.java -- centers ink midpoint in key
labelBaseline = centerY + labelCharHeight / 2.0f;
```

**Sources:**

- [`TypefaceUtils.java`](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/refs/heads/main/java/src/com/android/inputmethod/latin/utils/TypefaceUtils.java)
- [`KeyboardView.java`](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/refs/heads/main/java/src/com/android/inputmethod/keyboard/KeyboardView.java)

### iOS

Apple's CoreText framework exposes per-glyph bounding box APIs
(`CTFontGetBoundingRectsForGlyphs`) that enable ink-bound centering. However,
the iOS keyboard implementation is proprietary and there is no public evidence
confirming whether Apple uses ink-bound centering specifically.

**Source:** [Apple CoreText CTFont Reference](https://developer.apple.com/documentation/coretext/ctfont-rct)

### Windows

DirectWrite exposes font metrics via `IDWriteFontFace1::GetMetrics()`, returning
a `DWRITE_FONT_METRICS1` struct with fields like `glyphBoxTop/Bottom` and
`capHeight`. These are general metrics, not CJK-specific -- the struct does not
contain ideographic-specific metric fields.

**Sources:**

- [`IDWriteFontFace1::GetMetrics`](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_1/nf-dwrite_1-idwritefontface1-getmetrics)
- [`DWRITE_FONT_METRICS1`](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_1/ns-dwrite_1-dwrite_font_metrics1)

### Summary

All platforms that implement ink-bound centering bypass the em-box abstraction
and work with measured glyph bounding boxes. The web currently cannot replicate
this because `text-box-edge: ideographic-ink` is not yet implemented.

## CSS `text-box-edge` and CJK: Current State

### Browser support for `text-box-trim`

| Browser      | Support                    |
| ------------ | -------------------------- |
| Chrome 133+  | Supported (flag from 128)  |
| Edge 133+    | Supported                  |
| Safari 18.2+ | Supported (flag from 16.4) |
| Firefox      | Not supported (as of v151) |

**Source:** [Can I Use: text-box-trim](https://caniuse.com/css-text-box-trim)

### `text-box-edge` values relevant to CJK

The CSS Inline Layout Module Level 3 spec defines these values:

| Value             | Description                                     | Browser support                     |
| ----------------- | ----------------------------------------------- | ----------------------------------- |
| `text`            | Font-defined text-over/text-under baselines     | Shipped (Chrome 133+, Safari 18.2+) |
| `cap alphabetic`  | Latin cap-height to alphabetic baseline         | Shipped                             |
| `ideographic`     | Ideographic ascent/descent from font BASE table | Not shipped                         |
| `ideographic-ink` | Ink bounds of representative CJK characters     | Not shipped                         |

**Spec source:** [CSS Inline Layout Module Level 3, `text-box-edge`](https://drafts.csswg.org/css-inline-3/#propdef-text-box-edge)

### Open spec/browser issues

- [csswg-drafts #10928](https://github.com/w3c/csswg-drafts/issues/10928) --
  `text-box-edge: ideographic` should use ideographic fonts in the cascade
  (i.e., which font in a multi-font stack provides the ideographic metrics?)
- [csswg-drafts #10850](https://github.com/w3c/csswg-drafts/issues/10850) --
  how to synthesize `ideographic-over` and `ideographic-under` baselines when
  the font lacks OpenType `idtp`/`ideo`/`icft`/`icfb` table entries
- [Chromium #365423076](https://issues.chromium.org/issues/365423076) --
  implement `ideographic` and `ideographic-ink` values for `text-box-edge`

### ICS Media finding

The ICS Media article on `text-box-trim` found that applying
`text-box-edge: cap alphabetic` to Japanese text causes it to appear
"excessively trimmed" ("日本語はやや過剰にトリミングされているようにも見えます").

**Source:** [ICS Media: CSS text-box-trim (2025)](https://ics.media/entry/250319/)

## What We Implemented (PR #48)

### `isCJKGlyph()` detection

Unicode range check on the first code point to identify CJK characters. Covered
ranges:

| Range          | Block                              |
| -------------- | ---------------------------------- |
| U+1100..U+11FF | Hangul Jamo                        |
| U+3000..U+303F | CJK Symbols & Punctuation          |
| U+3040..U+309F | Hiragana                           |
| U+30A0..U+30FF | Katakana                           |
| U+3100..U+312F | Bopomofo                           |
| U+3130..U+318F | Hangul Compatibility Jamo          |
| U+3190..U+319F | Kanbun                             |
| U+31A0..U+31BF | Bopomofo Extended                  |
| U+3400..U+4DBF | CJK Unified Ideographs Extension A |
| U+4E00..U+9FFF | CJK Unified Ideographs             |
| U+A960..U+A97F | Hangul Jamo Extended-A             |
| U+AC00..U+D7FF | Hangul Syllables + Jamo Extended-B |
| U+F900..U+FAFF | CJK Compatibility Ideographs       |
| U+FF65..U+FF9F | Halfwidth Katakana                 |

### CSS class: `.kiosk-key__label--glyph-cjk`

Applied to single-glyph key labels where `isCJKGlyph()` returns true. Overrides
`text-box-edge` from `cap alphabetic` to `text`.

### Future-proofing: `@supports (text-box-edge: ideographic-ink)`

A `@supports` block that will automatically upgrade to `ideographic-ink` once
browsers implement it. This is the web equivalent of Android's
`getReferenceCharHeight()` approach -- centering based on measured ink bounds
rather than abstract font metrics.

## Web Keyboard Comparison

| Library                                                      | CJK-specific centering? | Source                                                                                               |
| ------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| [simple-keyboard](https://github.com/hodgef/simple-keyboard) | No                      | Repo-wide search for "cjk", "japanese", "chinese": zero results                                      |
| [KioskBoard](https://github.com/furcan/KioskBoard)           | No                      | Repo-wide search for "cjk", "japanese", "chinese": zero results                                      |
| kiosk-keyboard-webc (ours)                                   | Yes                     | `text-box-trim` progressive enhancement + CJK-aware `text-box-edge` + `ideographic-ink` future guard |

## What Remains

1. **Horizontal centering** -- blocked on a custom font solution (see
   [CUSTOM-FONT-FACE.md](./CUSTOM-FONT-FACE.md))
2. **Vertical centering with current fonts** -- architecturally fixed but
   visually unchanged because Yu Gothic UI maps `text` and `cap alphabetic` to
   the same metrics. Will improve with fonts that differentiate these metrics or
   when browsers ship `ideographic-ink`
3. **Punctuation marks** -- inherent to Japanese typography per JLREQ; not a bug

## References

- [CSS Inline Layout Module Level 3: text-box-edge](https://drafts.csswg.org/css-inline-3/#propdef-text-box-edge)
- [Can I Use: text-box-trim](https://caniuse.com/css-text-box-trim)
- [W3C JLREQ: Requirements for Japanese Text Layout](https://w3c.github.io/jlreq/?lang=en)
- [ICS Media: CSS text-box-trim (2025)](https://ics.media/entry/250319/)
- [Koji Ishii: text-box-trim Explainer](https://kojiishi.github.io/explainers/text-box-trim.html)
- [AOSP LatinIME TypefaceUtils.java](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/refs/heads/main/java/src/com/android/inputmethod/latin/utils/TypefaceUtils.java)
- [AOSP LatinIME KeyboardView.java](https://android.googlesource.com/platform/packages/inputmethods/LatinIME/+/refs/heads/main/java/src/com/android/inputmethod/keyboard/KeyboardView.java)
- [Apple CoreText CTFont Reference](https://developer.apple.com/documentation/coretext/ctfont-rct)
- [Microsoft DirectWrite IDWriteFontFace1::GetMetrics](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_1/nf-dwrite_1-idwritefontface1-getmetrics)
- [Microsoft DWRITE_FONT_METRICS1](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_1/ns-dwrite_1-dwrite_font_metrics1)
