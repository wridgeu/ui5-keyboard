# CJK Glyph Centering

> Status: **Partially Implemented** | Tracks: [#46](https://github.com/wridgeu/ui5-lib-keyboard/issues/46)

## Problem

CJK glyphs (hiragana, katakana, Hangul, kanji) can appear visually offset within their keys due to font glyph metrics, not CSS layout. The issue has two dimensions: vertical offset (text-box-edge metrics mismatch) and horizontal offset (asymmetric font side bearings).

## Implementation

- **Script glyph detection** (`isCJKGlyph()`, `isHangulGlyph()`, `isIndicGlyph()`, `isArabicGlyph()`) identifying script-specific characters via Unicode `\p{Script_Extensions=...}` properties (Hangul uses strict `\p{Script=Hangul}` to avoid claiming shared CJK punctuation)
- **`.kiosk-key__label--glyph-cjk`** class with `text-box-edge: text` override (progressive enhancement under `@supports (text-box-trim: trim-both)`)
- **Script font-family overrides**: script-specific system fonts placed first in the stack, ensuring matched glyph and line-box metrics. Exposed via `--kiosk-keyboard-cjk-font-family`, `--kiosk-keyboard-hangul-font-family`, `--kiosk-keyboard-indic-font-family`, and `--kiosk-keyboard-arabic-font-family` consumer overrides
- **Separate Hangul, Indic, and Arabic classes** with dedicated font stacks for correct per-script metrics

## What Remains

1. **Horizontal centering**: blocked on a custom font with optically centered CJK glyphs (see [CUSTOM-FONT-FACE.md](./CUSTOM-FONT-FACE.md))
2. **`ideographic-ink`**: when browsers ship `text-box-edge: ideographic-ink`, adopt it with tested baselines (tracked in [#52](https://github.com/wridgeu/ui5-lib-keyboard/issues/52))
   - [csswg-drafts #10928](https://github.com/w3c/csswg-drafts/issues/10928): ideographic font cascade question
   - [csswg-drafts #10850](https://github.com/w3c/csswg-drafts/issues/10850): synthesizing ideographic baselines
   - [Chromium #365423076](https://issues.chromium.org/issues/365423076): implement `ideographic-ink`
3. **Japanese punctuation**: inherently off-center per [JLREQ Section 3.1.2](https://w3c.github.io/jlreq/?lang=en#about_character_shape); not a bug

## References

- [CSS Inline Layout Module Level 3: text-box-edge](https://drafts.csswg.org/css-inline-3/#propdef-text-box-edge)
- [Can I Use: text-box-trim](https://caniuse.com/css-text-box-trim)
- [W3C JLREQ](https://w3c.github.io/jlreq/?lang=en)
- [ICS Media: CSS text-box-trim (2025)](https://ics.media/entry/250319/)
