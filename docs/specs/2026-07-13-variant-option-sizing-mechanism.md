# Accent-variant popup: option-sizing mechanism (issue #164)

## Question

The accent-variant long-press popup sizes each option cell to the parent keyboard's
**key footprint** (width and height) so the popup reads as part of the keyboard at
every breakpoint. Both twins do this by **measuring the anchor key at open** and
publishing the result as a CSS custom property the theme consumes. Issue #164 asked
whether that JS measurement could be replaced by a cleaner, more native, more
declarative mechanism, and named CSS anchor positioning (`anchor-size()`) as the
most promising candidate.

Answer: **no native mechanism can replace the width measurement** under this popup's
UX contract and browser-support matrix. The measurement is necessary. This document
records the evaluation so the option is not re-litigated, and the smaller
improvements that were made instead.

## What the option cell must achieve

The accepted look (settled during #163 review) is: **each cell equals the anchor
key's full footprint, width and height, laid out in a single row until the row
exceeds ~92vw, then wrapping.** Two capped variants, a square at key-height and a
proportional ~2x cap, were tried and rejected in review; an exact footprint match is
the contract.

One fact drives everything below:

- **Key height and font-size are CSS tokens** (`--ui5KioskKeyboard-keyHeight` /
  `--kiosk-keyboard-key-height`, default `3rem`, and the derived key-font-size).
- **Key width has no token.** Keys fill their row with `flex: 1 1 0` (wider keys use
  a larger flex grow), so a key's rendered width is `(keyboard content width - gaps)
/ (sum of flex grows in the row)`. It depends on the row composition and the
  keyboard's rendered width, and is only knowable by reading the laid-out box.

So width is the one dimension with no declarative source. Every candidate below is
judged on whether it can give a wrapping flex row of option cells the anchor key's
flex-derived width across the four evergreen browsers this project targets
(Chrome, Firefox, Safari, Edge; see `docs/kiosk/history/WEBCOMPONENT-PACKAGE.md`).

## Why the twins differ

- **webc**: the `ui5-popover` renders in-place in the host shadow root (native
  top-layer, no static-area portal in `@ui5/webcomponents` 2.x), so `:host` key-size
  tokens cascade into the option buttons. Only width is measured.
- **kiosk**: the `sap.m.Popover` renders in the UI5 static area, a body-level sibling
  of the app root that inherits nothing from the keyboard. Both dimensions must be
  carried across.

## Alternatives evaluated

| Alternative                        | Verdict       | Reason                                                                                                                                                |
| ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anchor-size()`                    | Infeasible    | Layout-incompatible (below) and Chromium-only, against an evergreen matrix.                                                                           |
| Publish key-size tokens            | Half-solution | Solves height (already a token); width still has no token to publish.                                                                                 |
| Reuse the flex model in the popup  | Infeasible    | Option count differs from key count; a `flex:1` option equals key width only if the container is already `N * keyWidth`, which needs the measurement. |
| Container queries / relative units | Infeasible    | No CSS mechanism reads another element's flex-derived width into a sibling.                                                                           |
| Square / `min()` cell              | Rejected      | Already the built-in fallback, but capped cells were rejected in review.                                                                              |

### `anchor-size()` in detail

`anchor-size()` is the only native way to read an anchor's rendered size into another
element's sizing without JS. It was tested in Chromium 149 (newer than any stable
release) across the exact topologies of both twins. Findings:

- It resolves **only for an out-of-flow positioned element** (`position: absolute` /
  `fixed`). On a `static` or `relative` in-flow element the declaration is dropped.
- The anchor must be a **descendant of the positioned element's containing block**.
  It resolves when the containing block is the viewport (`fixed`, or `absolute` with
  no positioned ancestor) and the anchor is anywhere in the document or shadow tree;
  it falls back when the containing block is a positioned wrapper that does not
  contain the anchor.
- It does cross shadow and slot boundaries.

The blocker: the option cells are a **wrapping flex row** (the pinned UX). Out-of-flow
positioned elements cannot form a wrapping row, and an in-flow (`relative`) option
does not resolve `anchor-size()` because the anchor key is not inside the popup.
Sizing the popup container instead would require `position: fixed` (viewport
containing block), which escapes the popover's own positioned frame, breaking its
arrow, placement, and collision handling, and turns "wrap" into "shrink".

On top of the layout incompatibility, anchor positioning is Chromium-only (no stable
Firefox or Safari), so it would need a full non-Chromium fallback and could not
remove the mechanism regardless. See
[MDN: `anchor-size()`](https://developer.mozilla.org/en-US/docs/Web/CSS/anchor-size)
and the [CSS Anchor Positioning spec](https://drafts.csswg.org/css-anchor-position-1/).

## Decision

Keep the measurement. Width genuinely can only be read from the laid-out box, so the
measured-CSS-var mechanism is the correct pragmatic solution rather than an accident.
`anchor-size()` and the other native candidates do not satisfy the footprint contract
across the supported browsers.

## What changed instead

The smells #164 pointed at were addressed without removing the measurement:

- **Measure only the un-tokenizable dimension.** kiosk no longer measures height; it
  mirrors the key-height token value onto the option grid (read from the keyboard
  root, so responsive overrides apply), matching the webc twin. Both twins now
  measure width only and take height from the token.
- **Resting box, not the pressed box.** Both twins read `offsetWidth` /
  `offsetHeight` rather than `getBoundingClientRect()`. The held key carries a
  `:active` `scale(0.96)` transform; `getBoundingClientRect()` folds it in and sizes
  the options a few percent small, while the offset dimensions report the layout
  border-box.
- **One read per open.** kiosk previously measured the anchor twice per open (once
  for the option size, once for the density fallback); it now reads once.

Live re-measure on resize while the popup is open (smell #3) was left out: the popup
is a short-lived hold interaction, so the staleness window is not worth a
`ResizeObserver` and its teardown.
