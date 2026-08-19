/**
 * Grapheme-aware cursor utilities using {@link Intl.Segmenter}.
 *
 * Baseline 2024: `Intl.Segmenter` is available in every current engine
 * (Chrome 87+, Safari 14.1+, Firefox 125+), Firefox 125 being the release that
 * completed it in April 2024. No fallback is provided, and the segmenter below is
 * constructed at module scope, so an engine without it throws on import.
 *
 * @module
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

/** CJK: Han, Hiragana, Katakana, Hangul, Bopomofo. Includes Hangul; call isHangulGlyph() first for Korean-specific handling. */
const CJK_RE =
  /^[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}\p{Script_Extensions=Bopomofo}]/u;

export function isCJKGlyph(label: string): boolean {
  return label.length > 0 && CJK_RE.test(label);
}

/**
 * Hangul: Jamo, Compatibility Jamo, Syllables, Extended blocks.
 * Separate from CJK for Korean-first font stack.
 *
 * Uses strict `\p{Script=Hangul}` (not Script_Extensions) because shared
 * CJK punctuation like ideographic comma (U+3001), ideographic full stop
 * (U+3002), and katakana middle dot (U+30FB) have Script_Extensions=Hangul
 * but Script=Common. Using Script_Extensions here would claim these shared
 * characters for the Hangul font stack instead of letting them fall through
 * to the broader CJK detector.
 */
const HANGUL_RE = /^[\p{Script=Hangul}]/u;

export function isHangulGlyph(label: string): boolean {
  return label.length > 0 && HANGUL_RE.test(label);
}

/** Indic (Brahmic): Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Sinhala. */
const INDIC_RE =
  /^[\p{Script_Extensions=Devanagari}\p{Script_Extensions=Bengali}\p{Script_Extensions=Gurmukhi}\p{Script_Extensions=Gujarati}\p{Script_Extensions=Oriya}\p{Script_Extensions=Tamil}\p{Script_Extensions=Telugu}\p{Script_Extensions=Kannada}\p{Script_Extensions=Malayalam}\p{Script_Extensions=Sinhala}]/u;

export function isIndicGlyph(label: string): boolean {
  return label.length > 0 && INDIC_RE.test(label);
}

/** Arabic: Basic Arabic, Supplement, Extended-A/B, Presentation Forms. Also covers Persian, Urdu, Kurdish. */
const ARABIC_RE = /^[\p{Script_Extensions=Arabic}]/u;

export function isArabicGlyph(label: string): boolean {
  return label.length > 0 && ARABIC_RE.test(label);
}
