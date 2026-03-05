/**
 * Grapheme-aware cursor utilities using {@link Intl.Segmenter}.
 *
 * Baseline: `Intl.Segmenter` is available in all modern browsers since 2022
 * (Chrome 87+, Firefox 104+, Safari 15.4+). No fallback is provided.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Returns the code-unit length of the grapheme cluster ending at the
 * given code-unit offset. Returns 0 when offset is at or before
 * position 0 (nothing to delete).
 */
export function graphemeLengthBefore(value: string, offset: number): number {
  if (offset <= 0) return 0;

  // Only examine a trailing window — slicing avoids iterating the entire
  // string for long values. 40 code units covers all real-world grapheme
  // clusters including long emoji tag sequences and combining-mark runs.
  const clampedOffset = Math.min(offset, value.length);
  const tail = value.slice(Math.max(0, clampedOffset - 40), clampedOffset);

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
  if (offset >= value.length) return 0;

  const after = value.slice(offset);
  const first = segmenter.segment(after)[Symbol.iterator]().next();
  return first.done ? 0 : first.value.segment.length;
}
