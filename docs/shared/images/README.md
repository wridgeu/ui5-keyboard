# Shared README Images

The key-type comparison table embedded in both package READMEs:

- `packages/kiosk-keyboard/README.md`
- `packages/kiosk-keyboard-webc/README.md`

One image per cell: a default key and a `type: "modifier"` key, each at rest and
hovered. The web component renders them, and the two packages share the CSS these
styles come from, so a single set serves both READMEs.

## Regenerate Images (Automated)

From repository root:

```bash
npm run test:kiosk-webc:e2e:docs
```

The same run also writes `docs/kiosk-webc/images`. See
[that folder's README](../../kiosk-webc/images/README.md) for what the run does, why
pointer events are disabled for the two at-rest captures, and why Chrome runs with
`--disable-lcd-text`.
