/**
 * Grapheme-aware cursor utilities using {@link Intl.Segmenter}.
 *
 * Baseline: `Intl.Segmenter` is available in all modern browsers since 2022
 * (Chrome 87+, Firefox 104+, Safari 15.4+). No fallback is provided.
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

/**
 * Returns true when the first code point of `label` falls in a CJK Unicode
 * range where Latin-optimised `text-box-edge: cap alphabetic` produces
 * incorrect vertical centering. CJK glyphs extend the full ideographic em
 * box, so they need script-appropriate text-box metrics instead.
 *
 * Covered ranges (BMP only -- sufficient for keyboard labels):
 *
 * - CJK Symbols & Punctuation (U+3000..U+303F)
 * - Hiragana (U+3040..U+309F)
 * - Katakana (U+30A0..U+30FF)
 * - Bopomofo (U+3100..U+312F)
 * - Hangul Compatibility Jamo (U+3130..U+318F)
 * - Kanbun (U+3190..U+319F)
 * - Bopomofo Extended (U+31A0..U+31BF)
 * - CJK Unified Ideographs Extension A (U+3400..U+4DBF)
 * - CJK Unified Ideographs (U+4E00..U+9FFF)
 * - Hangul Syllables (U+AC00..U+D7AF)
 * - Hangul Jamo Extended-B (U+D7B0..U+D7FF)
 * - CJK Compatibility Ideographs (U+F900..U+FAFF)
 * - Halfwidth Katakana (U+FF65..U+FF9F)
 * - Hangul Jamo (U+1100..U+11FF)
 * - Hangul Jamo Extended-A (U+A960..U+A97F)
 */
export function isCJKGlyph(label: string): boolean {
  if (label.length === 0) return false;
  const cp = label.codePointAt(0)!;
  return (
    (cp >= 0x1100 && cp <= 0x11ff) || // Hangul Jamo
    (cp >= 0x3000 && cp <= 0x31bf) || // CJK Symbols/Punct + Hiragana + Katakana + Bopomofo + Hangul Compat Jamo + Kanbun + Bopomofo Ext
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Unified Ideographs Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xa960 && cp <= 0xa97f) || // Hangul Jamo Extended-A
    (cp >= 0xac00 && cp <= 0xd7ff) || // Hangul Syllables + Jamo Extended-B
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0xff65 && cp <= 0xff9f) // Halfwidth Katakana
  );
}
