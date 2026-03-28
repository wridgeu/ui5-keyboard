/**
 * Grapheme-aware cursor utilities using {@link Intl.Segmenter}.
 *
 * Baseline: `Intl.Segmenter` is available in all modern browsers since 2022
 * (Chrome 87+, Firefox 104+, Safari 15.4+). No fallback is provided.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** 40 code units covers all known grapheme clusters (longest: subdivision flag tags at ~28). */
const GRAPHEME_TAIL_WINDOW = 40;

/**
 * Returns the code-unit length of the grapheme cluster ending at the
 * given code-unit offset. Returns 0 when offset is at or before
 * position 0 (nothing to delete).
 */
export function graphemeLengthBefore(value: string, offset: number): number {
  if (offset <= 0) return 0;

  // Only examine a trailing window - slicing avoids iterating the entire
  // string for long values. 40 code units covers all real-world grapheme
  // clusters including long emoji tag sequences and combining-mark runs.
  const clampedOffset = Math.min(offset, value.length);
  const tail = value.slice(Math.max(0, clampedOffset - GRAPHEME_TAIL_WINDOW), clampedOffset);

  let last: Intl.SegmentData | undefined;
  for (const seg of segmenter.segment(tail)) {
    last = seg;
  }
  return last ? last.segment.length : 0;
}

/**
 * Returns the code-unit length of the grapheme cluster starting at
 * the given code-unit offset. Returns 0 when offset is at or past
 * the end of the string (nothing ahead).
 */
export function graphemeLengthAfter(value: string, offset: number): number {
  const clamped = Math.max(0, offset);
  if (clamped >= value.length) return 0;

  const after = value.slice(clamped);
  const first = segmenter.segment(after)[Symbol.iterator]().next();
  return first.done ? 0 : first.value.segment.length;
}

/**
 * Returns true when the string contains exactly one grapheme cluster.
 * Used to distinguish single-glyph key labels (e.g. "A", "😀", "🇩🇪")
 * from multi-character labels (e.g. "Tab", "F1").
 */
export function isSingleGlyph(label: string): boolean {
  let count = 0;
  for (const _segment of segmenter.segment(label)) {
    count += 1;
    if (count > 1) return false;
  }
  return count === 1;
}

/**
 * Matches the first character of a string against CJK script families using
 * Unicode Script_Extensions property escapes. This covers Han, Hiragana,
 * Katakana, Hangul, and Bopomofo -- including shared characters like CJK
 * punctuation, Kangxi radicals, and halfwidth forms that `Script=` alone
 * would miss.
 *
 * Used to detect glyphs where Latin-optimised `text-box-edge: cap alphabetic`
 * produces incorrect vertical centering. CJK glyphs extend the full
 * ideographic em box, so they need script-appropriate text-box metrics.
 *
 * Relies on ES2018 Unicode property escapes (Chrome 64+, Firefox 78+,
 * Safari 11.1+). The engine's Unicode data updates automatically with
 * new browser versions, so no manual range maintenance is needed.
 */
const CJK_RE =
  /^[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}\p{Script_Extensions=Bopomofo}]/u;

export function isCJKGlyph(label: string): boolean {
  return label.length > 0 && CJK_RE.test(label);
}

/**
 * Matches the first character of a string against Hangul script using
 * Unicode Script_Extensions property escapes. This covers Hangul Jamo,
 * Hangul Compatibility Jamo, Hangul Syllables, and Hangul Jamo Extended
 * blocks -- including halfwidth Hangul and enclosed Hangul letters that
 * `Script=` alone would miss.
 *
 * Kept separate from {@link isCJKGlyph} because Hangul needs a Korean-first
 * font stack for correct glyph metrics. While Hangul shares the CJK
 * `text-box-edge: text` treatment, the default CJK font stack prioritizes
 * Japanese fonts (Hiragino, Yu Gothic, Meiryo) which produce incorrect
 * metrics when rendering Hangul jamo. A dedicated class allows the CSS to
 * use Korean system fonts first (Malgun Gothic, Apple SD Gothic Neo).
 *
 * Note: `isCJKGlyph()` still returns true for Hangul (Hangul is part of
 * the CJK regex). Renderers should check `isHangulGlyph()` first and
 * apply the more specific Hangul class, falling through to CJK only for
 * non-Hangul CJK characters.
 */
const HANGUL_RE = /^[\p{Script_Extensions=Hangul}]/u;

export function isHangulGlyph(label: string): boolean {
  return label.length > 0 && HANGUL_RE.test(label);
}

/**
 * Matches the first character of a string against Indic (Brahmic) script
 * families using Unicode Script_Extensions property escapes. This covers
 * Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada,
 * Malayalam, and Sinhala -- including shared characters like danda (U+0964)
 * and Devanagari digits that `Script=` alone would miss.
 *
 * Kept separate from {@link isCJKGlyph} because Indic scripts have
 * fundamentally different vertical metrics: headline systems (shirorekha),
 * descenders, and conjuncts versus the uniform ideographic em box of CJK.
 * This distinction allows each group to use its own `text-box-edge` tuning.
 *
 * Relies on ES2018 Unicode property escapes (Chrome 64+, Firefox 78+,
 * Safari 11.1+). The engine's Unicode data updates automatically with
 * new browser versions, so no manual range maintenance is needed.
 */
const INDIC_RE =
  /^[\p{Script_Extensions=Devanagari}\p{Script_Extensions=Bengali}\p{Script_Extensions=Gurmukhi}\p{Script_Extensions=Gujarati}\p{Script_Extensions=Oriya}\p{Script_Extensions=Tamil}\p{Script_Extensions=Telugu}\p{Script_Extensions=Kannada}\p{Script_Extensions=Malayalam}\p{Script_Extensions=Sinhala}]/u;

export function isIndicGlyph(label: string): boolean {
  return label.length > 0 && INDIC_RE.test(label);
}
