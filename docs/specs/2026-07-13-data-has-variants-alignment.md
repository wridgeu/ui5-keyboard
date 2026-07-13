# Aligning the `data-has-variants` twin convention

**Date:** 2026-07-13

## Problem

The `data-has-variants` marker attribute gates the accent-variant popup: the renderer
stamps it on any key whose effective `variants` list is non-empty, and the pointer
handlers read it to decide whether a long-press / right-click should arm or open the
popup. The attribute **name** is shared per package through `dom-contract.ts`
(`attributes.hasVariants`), and the two entries are meant to stay parallel.

The **written value** and the **read style** diverged between the twins. Both were
correct, just stylistically inconsistent, which is exactly the kind of drift the twin
pairs exist to avoid:

- **kiosk** wrote the sentinel string `data-has-variants="true"` and read it via the
  `dataset` camelCase mapping (`el.dataset.hasVariants !== "true"`).
- **webc** wrote a bare presence attribute (`data-has-variants=""`) and read it with
  `el.hasAttribute(...)`.

So the DOM value differed (`"true"` vs `""`), the accessor differed (`dataset` vs
`hasAttribute`), and even the `dom-contract` entries differed (webc documented, kiosk not).

## Options

1. **Presence convention — align kiosk to webc (chosen).** Treat the marker as an
   idiomatic HTML boolean attribute (like `disabled` / `hidden`): write it
   present-with-empty-value and read it with `hasAttribute()`. Only kiosk moves.
2. **Explicit-value convention — align webc to kiosk (rejected).** Always carry `"true"`
   and compare against it. This aligns only the compared string, not the accessor
   (kiosk keeps `dataset`, webc would move to `getAttribute`), so the reads stay
   stylistically different; it also moves webc off the idiomatic boolean-attribute
   pattern and carries a silent-pass hazard (existing webc `hasAttribute` tests keep
   passing after only the written value changes, so nothing forces the read migration).
3. **A shared reader/writer helper (rejected).** Speculative abstraction for a single
   boolean marker (CLAUDE.md §2), and a _shared_ helper is barred outright by the
   no-shared-core rule plus the `RenderManager.attr`-vs-JSX writer asymmetry.

## Decision

Adopt the **presence convention**, aligning kiosk to webc.

- **Idiomatic.** Present-or-absent read with `hasAttribute()` is the web-standard form
  for marker attributes; the `"true"` sentinel is the non-idiomatic one that invites the
  classic "`data-x="false"` is still truthy" bug.
- **Render-mechanism-agnostic, identical reads.** `hasAttribute()` behaves identically
  over the kiosk `RenderManager` output and the webc JSX output, so the read expression
  becomes byte-identical across the twin variant-popup files
  (`!keyEl.hasAttribute(DOM.attributes.hasVariants)`), each still routed through its own
  package's `dom-contract` constant — parallel, not shared. Option 2 leaves the accessors
  different.
- **Fewest moving parts.** No helper, no new file, no new import edge; the writer stays
  per-twin as it must. webc (the busier package here) needs no source or test churn.
- **Low risk.** `RenderManager.attr(name, "")` emits the bare attribute
  `data-has-variants=""`, so `hasAttribute()` returns `true` — matching webc's output.
  No CSS keys on the attribute value, so the `"true"`→`""` change cannot affect styling.

The kiosk change is confined to the renderer (write `""`, update the now-stale comment),
the three kiosk read sites, and the three flipped test assertions (`"true"`→presence,
`undefined`→`false`), mirroring the webc component tests that were already at the target.
webc source and tests were unchanged. Guarded by `npm run typecheck`, `test:twin-drift`,
and the kiosk/webc variant suites.
