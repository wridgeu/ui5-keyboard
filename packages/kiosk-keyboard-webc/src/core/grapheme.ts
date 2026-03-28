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
 * Returns true when the first code point of `label` falls in a CJK Unicode
 * range where Latin-optimised `text-box-edge: cap alphabetic` produces
 * incorrect vertical centering. CJK glyphs extend the full ideographic em
 * box, so they need script-appropriate text-box metrics instead.
 *
 * Covered ranges: Hiragana, Katakana, CJK Unified Ideographs (+ Ext-A),
 * CJK Compatibility Ideographs, CJK Symbols & Punctuation, Halfwidth
 * Katakana, and Kanbun.
 */
export function isCJKGlyph(label: string): boolean {
  if (label.length === 0) return false;
  const cp = label.codePointAt(0)!;
  return (
    (cp >= 0x3000 && cp <= 0x30ff) || // CJK Symbols/Punctuation + Hiragana + Katakana
    (cp >= 0x3190 && cp <= 0x319f) || // Kanbun
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Unified Ideographs Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0xff65 && cp <= 0xff9f) // Halfwidth Katakana
  );
}
