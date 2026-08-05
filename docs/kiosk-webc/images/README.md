# Web Component README Images

This folder contains the screenshots embedded in:

- `packages/kiosk-keyboard-webc/README.md`

The same run also writes the key-type table both package READMEs share, into
`docs/shared/images`.

## Regenerate Images (Automated)

From repository root:

```bash
npm run test:kiosk-webc:e2e:docs
```

What this does:

1. Auto-starts a local Vite server on port `8087` (if not already running).
2. Opens `test/pages/key-style-demo.html`, the page that carries every fixture the
   images need: the framed QWERTY preview, the numpad and numeric keyboards, and the
   single-key default / modifier pair.
3. Captures each one at a device scale factor of 2, so a 624 CSS px preview lands as a
   1248 px image that the README scales down rather than up on a HiDPI display.
4. Writes files into this folder and into `docs/shared/images`.

The QWERTY preview is captured as the padded `#preview-qwerty` frame rather than the
bare keyboard: the frame carries the theme background, and its proportions match the
UI5 control's images in `docs/kiosk/images`.

## Why Pointer Events Are Disabled During Capture

The screenshot test temporarily sets `pointer-events: none` on the keyboard roots
(`DOM.selectors.root`) before taking element screenshots.

Reason: Playwright element screenshots can place a virtual pointer on a descendant key,
which may trigger `:hover` and produce non-deterministic colors (most noticeable in
high-contrast themes). Disabling pointer events during capture avoids this hover
artifact. The two hover images are the exception: they turn it back on and aim the
pointer deliberately.

Implementation is in:

- `packages/kiosk-keyboard-webc/test/e2e/readme-screenshots.spec.ts`

## Why The Capture Waits For `document.fonts.ready`

The theme metadata custom property is set before the swapped stylesheet and the `72`
webfont have finished changing text metrics. A capture taken in that window lands the
keyboard about a pixel off - invisible to the eye, but it rewrites every edge in the
PNG, so a committed image would churn on roughly one run in six for no real change.
Waiting for `document.fonts.ready` plus two animation frames settles it; six
consecutive runs then produce byte-identical files.

## Why Chrome Runs With `--disable-lcd-text`

Chrome's subpixel antialiasing tints glyph edges red and blue for an LCD it assumes
is downstream. A screenshot has no such display, so the tint survives into the PNG as
stray colour on the keycap letters - most visible on `sap_horizon_hcb` and
`sap_horizon_hcw`, whose palette has no colour of its own to hide it. The flag forces
grayscale antialiasing instead.

Set in `packages/kiosk-keyboard-webc/playwright.docs.config.ts` alongside the scale
factor.

## Why This Is Not Part of the Regression Run

`playwright.config.ts` ignores `readme-screenshots.spec.ts` through
`SEPARATE_CONFIG_SPECS`. The capture settings above (2x scale, grayscale text) differ
from the ones the committed visual baselines under `test/e2e/__baselines__` were taken
with, so folding the two runs together would invalidate every baseline.
