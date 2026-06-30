# Feature: Grapheme-Aware Backspace and Caret Navigation

> Status: Implemented

## Problem

### Backspace splits surrogate pairs

The kiosk keyboard's `handleBackspace()` in `input-operations.ts` removes exactly **one UTF-16 code unit**:

```ts
// input-operations.ts:79
newValue = dom.value.slice(0, start - 1) + dom.value.slice(start);
newPos = start - 1;
```

JavaScript strings are UTF-16 encoded. Characters outside the Basic Multilingual Plane (most emojis, some CJK, mathematical symbols) are stored as **surrogate pairs**, two code units for one visible character. The `- 1` deletes only half the pair, leaving an orphaned surrogate that renders as an unrecognized symbol (often `�` or a blank box). The user must press backspace a second time to remove the other half.

This directly affects the demo app's emoji custom layout, where every emoji except `⭐` (U+2B50) and `✅` (U+2705) is a surrogate pair. The `❤️` (U+2764 + U+FE0F variation selector) is even worse: three code units, requiring three backspace presses.

The problem extends beyond emojis. A general-purpose virtual keyboard must handle all of Unicode correctly. Examples of multi-code-unit grapheme clusters:

| Grapheme | Composition                                 | Code units | Backspace presses (current) |
| -------- | ------------------------------------------- | ---------- | --------------------------- |
| `a`      | U+0061                                      | 1          | 1                           |
| `😀`     | U+1F600 (surrogate pair)                    | 2          | 2                           |
| `❤️`     | U+2764 + U+FE0F (base + variation selector) | 3          | 3                           |
| `👨‍👩‍👧`     | U+1F468 ZWJ U+1F469 ZWJ U+1F467             | 8          | 8                           |
| `ñ`      | U+006E + U+0303 (n + combining tilde)       | 2          | 2                           |
| `🇩🇪`     | U+1F1E9 + U+1F1EA (regional indicators)     | 4          | 4                           |

All of these should be deleted with a **single** backspace press.

### Arrow keys split surrogate pairs

The same `- 1` / `+ 1` logic in `handleNavigation()` causes ArrowLeft and ArrowRight to land **inside** a surrogate pair or grapheme cluster:

```ts
// input-operations.ts:115
case "ArrowLeft":
  newPos = start !== end ? start : Math.max(0, start - 1);
  break;
case "ArrowRight":
  newPos = start !== end ? end : Math.min(len, end + 1);
  break;
```

When the caret lands between two halves of a surrogate pair, subsequent typing or deletion produces corrupted output.

### Why this is a library concern, not a consumer concern

The keyboard control inserts multi-code-unit characters as a single operation via `insertText()`. Backspace should symmetrically delete them as a single operation. This is what every real keyboard, physical and virtual, does. A layout author providing `{ value: "\u{1F600}" }` has every right to expect that one backspace removes it. Pushing grapheme-awareness onto the consumer or layout definition would be a DX failure.

## Proposal

### Use `Intl.Segmenter` for grapheme boundary detection

The `Intl.Segmenter` API with `granularity: "grapheme"` correctly handles all of the above cases: surrogate pairs, variation selectors, ZWJ sequences, combining marks, and regional indicators. It is supported in all browsers that the kiosk keyboard targets (Chrome 87+, Edge 87+, Safari 15.4+, Firefox 125+).

Create a small utility module that segments a string into grapheme clusters and resolves boundary offsets:

```ts
// internal/grapheme.ts

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Returns the code-unit length of the grapheme cluster ending at the
 * given code-unit offset. Returns 1 as a fallback when the offset is
 * out of range or segmentation yields no result.
 */
export function graphemeLengthBefore(value: string, offset: number): number {
  if (offset <= 0) return 0;
  const before = value.slice(0, offset);
  const segments = segmenter.segment(before);

  // Walk to last segment - Intl.Segmenter is iterable but not indexable
  let last: Intl.SegmentData | undefined;
  for (const seg of segments) {
    last = seg;
  }
  return last ? last.segment.length : 1;
}

/**
 * Returns the code-unit length of the grapheme cluster starting at
 * the given code-unit offset. Returns 1 as a fallback.
 */
export function graphemeLengthAfter(value: string, offset: number): number {
  if (offset >= value.length) return 0;
  const after = value.slice(offset);
  const first = segmenter.segment(after)[Symbol.iterator]().next();
  return first.done ? 1 : first.value.segment.length;
}
```

### Patch `handleBackspace()`

Replace the fixed `- 1` with a grapheme-length lookup:

```ts
} else if (start > 0) {
  const deleteLen = graphemeLengthBefore(dom.value, start);
  newValue = dom.value.slice(0, start - deleteLen) + dom.value.slice(start);
  newPos = start - deleteLen;
}
```

One backspace now removes the entire grapheme cluster, whether it is 1, 2, 4, or 8 code units.

### Patch `handleNavigation()`

Replace `- 1` and `+ 1` for ArrowLeft/ArrowRight with grapheme-aware steps:

```ts
case "ArrowLeft":
  if (start !== end) {
    newPos = start;
  } else {
    const step = graphemeLengthBefore(dom.value, start);
    newPos = Math.max(0, start - step);
  }
  break;
case "ArrowRight":
  if (start !== end) {
    newPos = end;
  } else {
    const step = graphemeLengthAfter(dom.value, end);
    newPos = Math.min(len, end + step);
  }
  break;
```

### No change to `insertText()`

`insertText()` is already correct. It inserts the full string and advances the cursor by `text.length` (code units). Since DOM `selectionStart`/`selectionEnd` are code-unit-based, this is the right unit. No change needed.

### No change to `resolveVerticalCaret()`

ArrowUp/ArrowDown use `resolveVerticalCaret()` which operates on line boundaries (`\n` positions). Newlines are always single code units, so the line-start/line-end calculations remain correct. The column clamping (`Math.min(column, lineLen)`) may land inside a grapheme cluster at line edges, but this is consistent with how native textareas handle vertical caret movement; they also use code-unit columns, not grapheme columns. Changing this would be over-engineering for an edge case that doesn't arise in practice (kiosk keyboards rarely have multi-line emoji input).

## Scope

### In scope

- New `internal/grapheme.ts` module with `graphemeLengthBefore()` and `graphemeLengthAfter()`
- Updated `handleBackspace()` to delete one grapheme cluster per press
- Updated `handleNavigation()` ArrowLeft/ArrowRight to step by one grapheme cluster
- QUnit tests covering:
  - BMP characters (ASCII, currency symbols)
  - Surrogate pairs (standard emojis like 😀)
  - Variation sequences (❤️)
  - ZWJ sequences (👨‍👩‍👧)
  - Combining marks (ñ as n + combining tilde)
  - Regional indicator pairs (flag emojis 🇩🇪)
  - Mixed strings (ASCII + emoji + ASCII)
  - Empty string and cursor-at-zero edge cases

### Out of scope

- `resolveVerticalCaret()` (ArrowUp/ArrowDown): line-boundary logic is unaffected
- `insertText()`: already correct
- `Ctrl+Backspace` (word-level deletion): the kiosk keyboard does not support modifier+backspace
- Grapheme cluster display width in the keyboard layout rendering: keys already render emoji correctly via CSS

## Considerations

- **`Intl.Segmenter` availability**: Fully supported in Chrome 87+ (2020), Edge 87+ (2020), Safari 15.4+ (2022), Firefox 125+ (2024). Since the kiosk keyboard targets embedded Chromium kiosks, this is a non-issue. OpenUI5 1.120+ already dropped IE11.
- **Performance**: `Intl.Segmenter` is instantiated once at module level (singleton). Per-keystroke cost is segmenting the substring before the cursor, negligible for input field lengths.
- **No fallback**: `Intl.Segmenter` is instantiated once at module load with no guard, and no single-code-unit fallback is provided. Given the embedded-Chromium target above, a fallback would only add untested code paths for environments the library does not support.
- **Selection deletion**: When there is an active selection (`start !== end`), backspace already correctly deletes the entire selection regardless of grapheme boundaries. No change needed for this path.

## Migration

Non-breaking. The change only affects how many code units are removed per backspace/arrow-step. No public API changes, no new properties, no configuration. Existing layouts and consumer code are unaffected.
