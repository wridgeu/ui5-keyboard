# CapsLock emits ẞ (U+1E9E) directly from the base ß key

**Issue:** [#169](https://github.com/wridgeu/ui5-keyboard/issues/169)
**Follow-up of:** [#162](https://github.com/wridgeu/ui5-keyboard/issues/162) task 2 / PR #163, and the deferred rule in `docs/specs/2026-07-12-longpress-variant-popup-design.md` §4.5.

## 1. Problem

The capital sharp S **ẞ** (U+1E9E) is currently reachable only through the accent-variant
popup: `toShiftVariant` special-cases `ß → ẞ` (plain `"ß".toUpperCase()` yields `"SS"`), and the
popup surfaces uppercase forms when Shift/Caps is active. Pressing the base key with **CapsLock
engaged** does not emit `ẞ`. A user with Caps Lock on, who expects the direct uppercase form, has
no non-popup path to `ẞ`.

The base key in question is the **`qwertz-de` `ß` key**, defined as `{ value: "ß", shiftValue: "?" }`.
Today, because the emit path only knows `isShifted` (true under _both_ one-shot Shift and CapsLock),
that `?` shiftValue wins under Caps too, so CapsLock+ß emits `?`, and the key's cap displays `?`.

## 2. Why Shift stays `?` but CapsLock becomes `ẞ`

The split is principled, not just hardware mimicry:

- **Shift → `?` is a physical-layout artifact.** On the standard German QWERTZ, `?` is simply the
  secondary symbol printed on that key; Shift means "give me this key's secondary symbol." It is
  not "the uppercase of ß." This is why #162 §4.5 forbids touching `qwertz-de.ts`'s `ß → ?` mapping.
- **CapsLock → `ẞ` is the semantic uppercase.** CapsLock means "uppercase mode." The
  orthographically **preferred** uppercase of `ß` since 2024 (Council for German Orthography;
  encoded 2008, accepted 2017) is `ẞ`, not the deprecated `SS`. Producing `ẞ` under Caps is the
  **letters-only Caps** interpretation, which Windows itself ships as the "German (IBM)" variant and
  which is the correct, modern choice for a kiosk keyboard.

Supporting facts from the research (see issue thread for links): `"ß".toUpperCase()` and even
`"ß".toLocaleUpperCase("de")` both still return `"SS"`, so an explicit special-case is mandatory,
which is exactly what `toShiftVariant` already encodes. Mobile keyboards (iOS, Gboard) offer no
direct `ẞ` at all, only long-press, so closing this gap is a genuine value-add.

## 3. The rule

> When **CapsLock** is active and a key's **base value is `ß`**, both the emitted character and the
> key's label/aria resolve to `ẞ` (via `toShiftVariant(value)`), bypassing the `?` shiftValue.

- Keyed on `value === "ß"`, not on a specific layout. In shipped layouts only `qwertz-de`'s `ß` key
  matches; a consumer's custom base-`ß` key gets the same correct behavior. This mirrors how the
  popup already treats `ß` as the single cased exception.
- **One-shot Shift is unchanged**: the `ß` key still emits and displays `?` under Shift.
- The default `qwerty` `s` key is unaffected: its base is `s`, so Caps yields `S` (already correct);
  `ß`/`ẞ` there remain popup-only.
- `toShiftVariant` (`internal/latin-variants.ts` / `core/latin-variants.ts`) is the single source of
  truth for `ß → ẞ`; both call sites reuse it rather than hardcoding the literal or a locale cast.

## 4. Changes (both twins, parallel per the no-shared-core convention #105)

Both twins carry structurally identical emit and label paths; each change lands in both.

### 4.1 Emit path

**kiosk** `KioskKeyboard.ts` `_handleKeyAction`, `case "char"` (~L2081). The shifted-value block
gains a CapsLock+`ß` guard that precedes the `shiftValue` lookup:

```ts
if (shift) {
  if (this._isCapsLock() && action.text === "ß") {
    effective = toShiftVariant(action.text); // ẞ
  } else {
    const shiftValue = el.dataset.shiftValue;
    if (shiftValue) effective = shiftValue;
    else if (action.text.length === 1) effective = action.text.toUpperCase();
  }
}
```

`toShiftVariant` is already imported (L16). `_isCapsLock()` already exists (L1651).

**webc** `KioskKeyboard.ts` `_onKeyClick` `char` computation (L1361). `this._capsLock` is already a
cached field; `toShiftVariant` is already imported (L30):

```ts
const char =
  action.kind === "char"
    ? shifted
      ? this._capsLock && value === "ß"
        ? toShiftVariant(value) // ẞ
        : (shiftValue ?? value.toUpperCase())
      : value
    : undefined;
```

### 4.2 Label + aria path

The cap must show what it types (Q2: relabel). `getKeyAriaLabel` derives from the visible label, so
fixing the label fixes aria automatically.

**kiosk** `internal/key-labels.ts` `getKeyLabel` receives `caps` already. Inside the no-explicit-label
`if (shift)` branch (~L40), add before the `shiftValue` check:

```ts
if (shift) {
  if (caps && base === "ß") return toShiftVariant(base); // ẞ
  if (key.shiftValue) return key.shiftValue;
  if (key.value.length === 1 && key.value.trim()) return base.toUpperCase();
}
```

`key-labels.ts` must import `toShiftVariant` from `./latin-variants`.

**webc** `KioskKeyboard.ts` `_getKeyLabel` (L1181) mirrors this with `this._capsLock`:

```ts
if (shift) {
  if (this._capsLock && base === "ß") return toShiftVariant(base); // ẞ
  if (key.shiftValue) return key.shiftValue;
  if (key.value.length === 1 && key.value.trim()) return key.value.toUpperCase();
}
```

Precedence note: the shipped `ß` key has neither an explicit `label` nor a `shiftLabel`, so it
reaches this branch. The guard is placed only where the `ß` key actually resolves; it deliberately
does not override an author's explicit `label`/`shiftLabel`, keeping author intent authoritative.

## 5. Scope and non-goals

- **In scope:** CapsLock+base-`ß` → `ẞ` for emit and label/aria, both twins, with regression tests.
- **Out of scope, unchanged:** the popup path (already correct); `qwertz-de.ts`'s `ß → ?` Shift
  value; one-shot Shift behavior anywhere.
- **Known pre-existing inconsistency, deliberately not fixed here:** the keyboard's CapsLock is
  _mixed_. The number row already shift-locks under Caps (emits shiftValues like `!`), while letters
  uppercase. A hardware German keyboard's Caps is a full shift-lock; the "German (IBM)" variant is
  letters-only. This change makes only `ß` letters-only under Caps, matching the issue's scope.
  Making Caps uniformly letters-only (so Caps+`1` yields `1`, not `!`) is a larger, separately
  scoped decision touching every layout with number-row shiftValues (including Arabic), and is
  **not** undertaken here. Noted so the record is honest.

## 6. Testing (CLAUDE.md §3: failing test first, mirror the existing ß popup test)

Each twin ships a regression test at both the unit and control level, mirroring the existing
`ß → ẞ` popup coverage.

- **kiosk** `test/qunit/`: control-level QUnit via the internals-cast pattern. With `qwertz-de`
  active and CapsLock engaged, pressing the `ß` key inserts `ẞ` (not `?`, not `SS`), and
  `getKeyLabel`/`getKeyAriaLabel` for that key return `ẞ`. A companion assertion confirms one-shot
  **Shift** on the same key still yields `?` (guarding the #162 invariant).
- **webc** `test/unit/` + `test/component/`: the `_getKeyLabel` unit assertion for CapsLock vs Shift
  on a base-`ß` key, and a component test driving CapsLock + `ß` click to assert the inserted `ẞ`.
- Both assert the negative: Caps+`ß` is not `SS` and not `?`; Shift+`ß` is still `?`.

Per CLAUDE.md §7, the tests are validated adversarially: each must be seen red before green
(e.g. temporarily revert the guard, confirm the Caps assertion fails and the Shift assertion still
passes).

## 7. Twin-drift

The two `latin-variants.ts` copies are unchanged (`toShiftVariant` already ships the mapping), so
`tools/check-twin-drift.mjs` stays green for that file. The god-class `KioskKeyboard.ts` in each twin
is excluded from the drift checker (see memory `project_twin_drift_godclasses`), so the parallel
emit/label edits must be applied to both by hand and verified by the per-twin test suites above.
