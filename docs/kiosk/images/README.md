# Kiosk README Images

This folder contains the screenshots embedded in:

- `README.md`
- `packages/kiosk-keyboard/README.md`

## Regenerate Images (Automated)

From repository root:

```bash
npm run test:kiosk:e2e:docs
```

What this does:

1. Auto-starts a local UI5 server on port `8085` (if not already running).
2. Opens the visual test page for each theme.
3. Captures the inline full-size keyboard (`kiosk-inline-wide-*.png`).
4. Writes files into this folder.

## Why Pointer Events Are Disabled During Capture

The screenshot test temporarily sets `pointer-events: none` on the keyboard roots (`DOM.selectors.root`) before taking element screenshots.

Reason: Playwright element screenshots can place a virtual pointer on a descendant key, which may trigger `:hover` and produce non-deterministic colors (most noticeable in high-contrast themes). Disabling pointer events during capture avoids this hover artifact.

Implementation is in:

- `packages/kiosk-keyboard/test/e2e/readme-screenshots.spec.ts`
