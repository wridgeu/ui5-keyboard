# Extensible custom keys via an enriched keyPress contract

**Issue:** [#74](https://github.com/wridgeu/ui5-keyboard/issues/74)
**Date:** 2026-06-11
**Status:** Proposed (supersedes the per-instance action subsystem spiked in PR #111)

## Context

Issue #74 asks for an extension point so consumers can add custom layout keys
(e.g. a clipboard-paste key) instead of being limited to the built-in tokens
(`{backspace}`, `{enter}`, `{shift}`, `{layout:*}`, `{fkey:*}`).

Three designs were evaluated:

1. **Global action registry** (`KioskKeyboard.registerAction(...)`, #74's original
   sketch). Rejected: module-level mutable state survives the page-lifetime module
   cache and FLP app restarts (the lifecycle footgun CLAUDE.md warns about; cf.
   #112). Built-ins-as-registrations would also force internal behaviors (shift
   toggle, native f-key dispatch, composition ordering) through a public context.
2. **Per-instance action subsystem** (`instanceActions` map + `ActionContext` +
   `ActionDefinition` + `defineActions`, as built in #111/#113). It avoids the
   global-state footgun, but a four-agent design review found it: (a) does **not**
   deliver #74's central goal of unifying the hardcoded special-key switch (it
   bolts `{action:*}` on as a sibling branch, leaving a permanent dual-dispatch
   model); (b) has an **a11y defect** for icon-only custom keys (the accessible
   name silently falls back to a developer identifier, with no i18n path and no
   warning); (c) carries a large, twin-duplicated public surface
   (`instanceActions`/`ActionContext`/`ActionDefinition`/`defineActions`/
   `action-registry`/`parseActionToken`) whose only load-bearing increment over
   the already-firing cancelable `keyPress` is cursor-managed text insertion.
3. **Enriched keyPress** (this spec). Chosen.

### Industry grounding

The dominant OSS on-screen keyboard, **simple-keyboard**, is explicitly
"callback-centric rather than registry-based": custom keys are tokens in the
`layout`, labels come from a central `display` map, behavior is handled by name
in the `onKeyPress` callback, and the instance exposes an input/caret API
(`getInput`/`setInput`/`setCaretPosition`/`getButtonElement`). Named-handler
**registries** are the standard at _application command-bus_ altitude (VS Code
`registerCommand` + keybindings by id, CodeMirror `commands`) — shared,
palette-discoverable, rebindable — which is a different product than a reusable
input widget and is the global model already rejected here.

For a reusable keyboard **component**, the callback + token + label-map + input-API
model is both the industry-standard shape and the architecturally cleaner one:
one extension point, layout stays serializable data, a small input API on the
component. This codebase already has the better half of it (the cancelable
`keyPress` fires today for any `{...}` token, and `TargetInputSession` writes the
**real** target with cursor tracking and fires UI5 `liveChange`/`change`, which
is a stronger input model than simple-keyboard's internal-string approach).

## Decision

Deliver #74 by **enriching the existing cancelable `keyPress` / `key-press`
contract** rather than adding an action subsystem:

1. The event already fires (cancelable) for unrecognized `{...}` tokens and never
   inserts literal braces. A consumer puts `{paste}` in the layout, listens, and
   calls `preventDefault()` to own it.
2. Add a **small public input API** on the keyboard that the handler calls, routed
   through the existing `TargetInputSession`:
   - `insertText(text: string): void` — insert at the caret of the active target
     (cursor-tracked, fires `liveChange`).
   - `deleteBackward(): boolean` — delete one grapheme before the caret.
   - a resolved-target accessor (the active native `<input>`/`<textarea>` or null).
     Layout switching is already public (`setLayout` / the tracked base layout).
3. Labeling stays declarative on the `KeyDefinition` (`label` / `icon`), analogous
   to simple-keyboard's `display`. The **accessible name** for custom keys resolves
   through the existing i18n resolver, and an icon-only custom key with no
   resolvable accessible name emits a dev-time warning (carries forward the a11y
   fix the action design lacked).

### UI5 idiom

UI5 events carry **data**, not functions, so the writers are exposed as **control
methods** (called from inside the handler), not as function-valued event
parameters — matching simple-keyboard's instance-method model. The web component
mirrors the same methods on the element for twin symmetry (it may additionally
surface them on the event `detail`; decided at implementation).

### API sketch

```ts
// Layout: a plain token, label/icon declared as usual.
{ value: "{paste}", icon: "sap-icon://paste", type: "action" }

// UI5 control
kb.attachKeyPress((e) => {
  if (e.getParameter("key") === "{paste}") {
    e.preventDefault();
    navigator.clipboard.readText().then((t) => kb.insertText(t));
  }
});

// Web component
el.addEventListener("key-press", (e) => {
  if (e.detail.key === "{paste}") {
    e.preventDefault();
    navigator.clipboard.readText().then((t) => el.insertText(t));
  }
});
```

## Removed by this pivot

The action subsystem is deleted from **both** packages (it never shipped to
consumers — `@since 0.2.0`, no in-repo usage — so removal is non-breaking):

- `instanceActions` property + custom setter + `_toActionMap` / `_actionsView`.
- `ActionContext`, `ActionDefinition`, `defineActions` (types + bundle exports).
- `internal/action-registry.ts` / `core/action-registry.ts` (`getRegisteredAction`,
  `parseActionToken`) and their entry in `tools/check-twin-drift.mjs`
  (`CORE_MODULES`; `EXPECTED_PAIR_COUNT` 21 → 20).
- `_handleActionKey` / `_createActionContext` (+ `_switchLayoutFromAction`) and the
  `{action:*}` dispatch branch in both controls.
- The `{action:${string}}` member of `SpecialKeyValue` and the `{action:*}` rows in
  the `SpecialKeyValue` doc table.
- `instance-actions` tests (kiosk qunit + webc component) and bundle-export
  assertions for `defineActions`.

`{fkey:*}` is unchanged. (A future change could fold `{fkey}` into the same
enriched-keyPress story, but that is out of scope here.)

## Impact

- **Public surface shrinks** (no new action API freezes on either package); the
  net is closer to "the keyboard fires events and exposes input methods".
- **Single dispatch story** for custom keys (the event), no dual model; the
  hardcoded built-in switch is untouched and #74 is re-scoped to match (this spec
  does **not** claim to unify built-ins into a registry — that goal is dropped as
  not worth the coupling).
- **Twin parity**: the new input methods are added to both controls; remove the
  `action-registry` twin pair from the drift manifest.

## Adversarial validation (CLAUDE.md §7), when implemented

- Prove in a **real app** (puppeteer against `packages/demo-app`, reading the UI5
  `Log` buffer / DOM) that a `{custom}` token fires a cancelable `keyPress` and
  that `preventDefault()` suppresses default handling. (The keyPress-fires path was
  already demonstrated live this way.)
- Prove `insertText`/`deleteBackward` write the **real** target at the caret and
  fire `liveChange` (not the keyboard's own buffer), with a test that goes red if
  routed through anything other than `TargetInputSession`.
- Prove the custom-key accessible name resolves through i18n and that an
  icon-only custom key with no resolvable name produces the dev warning (test must
  fail if the warning is suppressed).

## Open questions

1. Method names: `insertText` / `deleteBackward` (reuses the action-context verbs)
   vs. `type` / `backspace`. Lean: keep `insertText` / `deleteBackward`.
2. Should the web component also expose the writers on `event.detail` for
   convenience, or methods-only for strict twin symmetry?
3. Accessible-name source of truth for custom keys: layout `KeyDefinition.label`
   (+ i18n) only, or also an optional per-key aria override.
