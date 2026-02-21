const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Returns the code-unit length of the grapheme cluster ending at the
 * given code-unit offset. Returns 0 when offset is at or before
 * position 0 (nothing to delete). Falls back to 1 if segmentation
 * yields no result (should not happen in practice).
 */
export function graphemeLengthBefore(value: string, offset: number): number {
  if (offset <= 0) return 0;
  const before = value.slice(0, offset);
  const segments = segmenter.segment(before);

  // Walk to last segment — Intl.Segmenter is iterable but not indexable
  let last: Intl.SegmentData | undefined;
  for (const seg of segments) {
    last = seg;
  }
  return last ? last.segment.length : 1;
}

/**
 * Returns the code-unit length of the grapheme cluster starting at
 * the given code-unit offset. Returns 0 when offset is at or past
 * the end of the string (nothing ahead). Falls back to 1 if
 * segmentation yields no result.
 */
export function graphemeLengthAfter(value: string, offset: number): number {
  if (offset >= value.length) return 0;
  const after = value.slice(offset);
  const first = segmenter.segment(after)[Symbol.iterator]().next();
  return first.done ? 1 : first.value.segment.length;
}
