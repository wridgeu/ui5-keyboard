# Native text insertion: `maxlength` and the undo stack (#230)

**Date:** 2026-08-11
**Issue:** [#230](https://github.com/wridgeu/ui5-keyboard/issues/230)
**Status:** Design — implementation pending
**Packages:** `packages/kiosk-keyboard` and `packages/kiosk-keyboard-webc`. Both are affected and both change.

Every measurement below was taken against the engines Playwright ships in this repo (Chromium 147.0.7727.15, Firefox 148.0.2, WebKit 26.4) and against OpenUI5 1.136.18 served from the local framework cache. Where the three engines disagree, that is stated; the design depends only on behaviour all three share.

## 1. The defect

Both packages write text by assigning `dom.value`:

- `packages/kiosk-keyboard-webc/src/core/input-operations.ts:59` (`insertText`) and `:109` (`handleBackspace`).
- `packages/kiosk-keyboard/src/internal/input-operations.ts:60-69` and `:109-133`, which route through `setTargetValue()` (`:199-220`) and land on `InputBase.updateDomValue` → `.val()`.

An assignment is not the platform's text-insertion path, and two native behaviours are lost.

| operation on `<input maxlength="3">`         | Chromium   | Firefox    | WebKit     |
| -------------------------------------------- | ---------- | ---------- | ---------- |
| `el.value = "abcdef"`                        | `"abcdef"` | `"abcdef"` | `"abcdef"` |
| `execCommand("insertText", false, "abcdef")` | `"abc"`    | `"abc"`    | `"abc"`    |
| `execCommand("undo")` after a native insert  | reverts    | reverts    | reverts    |
| `execCommand("undo")` after `.value =`       | unchanged  | unchanged  | unchanged  |

The undo half is engine-independent: an assignment does not open an undo transaction, so there is nothing for the browser to revert. This is the same in all three engines, and it is why the symptom cannot be fixed by clamping lengths in library code.

### 1.1 The issue's `sap.m.Input` claim is wrong for the pinned version

Issue #230 states that `maxLength` _is_ respected on the UI5 `sap.m.Input` path because `sap.m.Input` overrides `_getInputValue` to `substring(0, getMaxLength())`, and concludes the maxlength symptom does not affect that path. At 1.136.18 that override is a no-op:

```js
// sap/m/Input.js:2653
Input.prototype._getInputValue = function () {
  var sValue = InputBase.prototype._getInputValue.apply(this, arguments);

  return sValue;
};
```

`InputBase.prototype._getInputValue` (`InputBase.js:285`) returns `sValue.toString()` and clamps nothing. Only `sap.m.TextArea` truncates (`TextArea.js:214-215`). `maxLength` on `sap.m.Input` reaches the DOM solely as the `maxlength` **attribute**, written by the renderer (`InputBaseRenderer.js:136-137`) — and an attribute constrains user input, never a programmatic assignment.

Measured on a live `sap.m.Input({ maxLength: 3 })`:

|                                              | result                                      |
| -------------------------------------------- | ------------------------------------------- |
| `input.setValue("abcdef")`                   | `getValue()` → `"abcdef"`, DOM → `"abcdef"` |
| rendered attribute                           | `maxlength="3"`                             |
| `dom.value = "abcdef"`                       | `"abcdef"`                                  |
| `execCommand("insertText", false, "abcdef")` | DOM → `"abc"`, `getValue()` → `"abc"`       |

So the maxlength symptom affects **every** path in both packages, not only the fallback branches. The issue's scoping of the UI5 half should be corrected when it is closed.

## 2. Why `execCommand`, despite the deprecation

`document.execCommand` is flagged deprecated on MDN and its specification is unmaintained. Adopting it is a deliberate decision, taken on these grounds:

1. **There is no replacement for the capability.** The browser's undo stack is not scriptable through any other API. `beforeinput`/`input` are notifications, not commands. `EditContext` is an editing host for custom editors (canvas, contenteditable) — it does not attach to `<input>`/`<textarea>`, and it is Chromium-only (measured: `typeof EditContext !== "undefined"` is `true` in Chromium, `false` in Firefox and WebKit). The choice is not "deprecated API vs modern API", it is "deprecated API vs the behaviour stays broken".
2. **The three commands used are universally supported.** `queryCommandSupported("insertText" | "delete" | "undo")` returns `true` in all three engines. These are the commands editors depend on; they are the part of `execCommand` that is not going anywhere, because removing them would break every rich-text editor on the web.
3. **The risk is bounded by construction.** Every call site keeps the current assignment as a fallback, taken whenever the native path is unavailable or declines. If an engine ever drops the command, the library degrades to today's behaviour rather than failing.
4. **The blast radius is two functions.** `insertText` and `handleBackspace` per package. Nothing else in either package writes a target's value.

This is recorded here rather than left implicit so that a future reader finds a decision, not an accident.

## 3. Mechanism

### 3.1 The native path acts on the focused element, not the one you pass

This is the single most important measured fact, and it is uniform across all three engines:

```js
g1.focus();
document.execCommand("insertText", false, "Q");
// → g1.value === "Q", g2.value === ""   (g2 was the element we "meant")
```

`execCommand` has no element parameter. It operates on the document's active editing host. Both packages' `insertText(dom, ...)` take the target as an argument and are called in paths where that element is not guaranteed focused — `kana-dakuten.ts:62`, `hangul-compose.ts:215`/`:252`, and the public `insertText()` API (`KioskKeyboard.ts:1767` webc, `:2371` kiosk) among them. Taking the native path without a focus check would silently edit whatever else holds focus.

**Therefore the native path is guarded by an active-element check, and the guard must pierce shadow roots.** Measured: with an `<input>` inside an open shadow root focused, `document.activeElement` is the **host**, not the input (`shadowRoot.activeElement` is the input). A naive `document.activeElement === dom` test would reject a legitimately focused shadow-DOM target and silently fall back. The check walks `activeElement` through `shadowRoot` until it bottoms out.

### 3.2 The explicit `cursor` parameter is honoured by selecting first

Both `insertText` and `handleBackspace` accept an optional `cursor` tuple that may differ from the DOM selection, and `TargetInputSession` relies on it (`target-input-session.ts:34`, `:46`, `:62`). `execCommand` inserts at the selection and takes no position argument.

Measured, in all three engines: `setSelectionRange(start, end)` followed by `execCommand("insertText", ...)` inserts at exactly that range and replaces the selection. So the resolved cursor is written to the DOM selection first, then the command runs. This is not a workaround — it is what the caller means by "insert at this position".

### 3.3 Grapheme-aware backspace: select the cluster, then delete it

Issue #230 asks whether native `delete` deletes by the same notion of a cluster as `graphemeLengthBefore()`. Measured with a bare `execCommand("delete")` at the end of the value:

| value                             | Chromium | Firefox    | WebKit |
| --------------------------------- | -------- | ---------- | ------ |
| `"X" + "á"` (a + combining acute) | `"Xa"`   | `"Xa"`     | `"X"`  |
| `"X" + "👩‍👩‍👦"` (ZWJ family)         | `"X"`    | `"X👩‍👩"` | `"X"`  |

Three engines, three different answers. Chromium and Firefox strip a single combining mark and leave the base letter; WebKit removes the whole cluster. On the ZWJ sequence Firefox removes only the trailing segment. A bare native `delete` therefore cannot be used: it would make backspace engine-dependent and would regress the library's grapheme-cluster behaviour on two of three engines.

The design keeps the library's own `graphemeLengthBefore()` and uses the native path only to _perform_ the deletion:

```
setSelectionRange(start - graphemeLengthBefore(value, start), start)
execCommand("delete")
```

Measured in all three engines: this deletes exactly the selected range and `execCommand("undo")` restores it (`"Xá"` → `"X"` → `"Xá"`). Cluster semantics stay ours and stay identical across engines; the undo stack becomes the browser's. The selection case (`start !== end`) is already a range and needs no computation.

### 3.4 The return value must be read from the DOM, not computed

`insertText` currently returns `[start + text.length, ...]`. Under native insertion with `maxlength`, that is wrong: inserting `"bcdef"` into `"a"` on a `maxlength="3"` field yields `"abc"` and a caret at 3, not 6.

Two further measured traps:

- **A saturated field returns `true` and inserts nothing.** `execCommand("insertText")` on a full `maxlength` input returns `true` while the value is unchanged. The return value cannot be used to detect whether text landed, so it must not drive the fallback: `true` means "the command ran", and a native no-op under `maxlength` is the correct outcome, not a reason to fall back to an assignment that would defeat the fix.
- **`execCommand("delete")` at offset 0 also returns `true`** having deleted nothing. The existing guard (return `null` when `start === 0 && start === end`) stays and remains the authority on "nothing was deleted".

So: fall back only when the native path is unavailable (`typeof document.execCommand !== "function"`) or the command returns `false` (measured: `false` for a read-only element in all three engines). Otherwise read `selectionStart`/`selectionEnd` back from the DOM and return those.

### 3.5 Events: the synthetic dispatch is dropped on the native path

The native command emits a real `input` event with the correct `inputType`, so the packages' manual `dispatchEvent(new InputEvent("input", ...))` (webc `input-operations.ts:66`, `:115`) must be skipped when the native path ran, or every insertion fires twice.

Measured differences worth recording:

- Chromium and Firefox fire **only** `input`. WebKit additionally fires a **cancelable `beforeinput`**. Today neither package fires `beforeinput` at all, so on WebKit consumers gain a cancellation hook they did not have; on the other two, nothing changes. This is an improvement in fidelity, not a contract the library promises.
- On a saturated `maxlength` field, WebKit fires `input` anyway; Chromium and Firefox fire none.
- `"\n"` inserted via `insertText` reports `inputType: "insertText"`, not the `"insertLineBreak"` the packages synthesise today. The platform has no `execCommand` that produces `insertLineBreak`. This is a deliberate, documented fidelity loss on the native path; `insertLineBreak` is retained on the fallback path where we control the dispatch.

### 3.6 The UI5 twin: native edit first, then sync the property

This is the half issue #230 flags as needing verification before committing, because bypassing `setTargetValue()` means UI5 no longer sees the write. Measured against 1.136.18:

`InputBase.prototype.oninput` (`InputBase.js:776-779`) only sets `_bCheckDomValue = true`; it does not write the `value` property. `Input.prototype.oninput` (`Input.js:1813`) writes it **only** when `valueLiveUpdate` is set, and fires `liveChange` itself (`:1828`). So after a bare native edit on a `sap.m.Input`:

|                        | measured                           |
| ---------------------- | ---------------------------------- |
| DOM value              | `"abc"` (truncated by `maxlength`) |
| `getValue()`           | `"abc"`                            |
| `getProperty("value")` | `""` — **stale**                   |
| `liveChange` fired     | 1 (by UI5's own `oninput`)         |

A stale `value` property is not acceptable: two-way bindings read it. The fix is to keep `setTargetValue()` but run it **after** the native edit, sourced from the resulting DOM value. That is safe because `InputBase.updateDomValue` early-returns when the DOM already matches (`InputBase.js:930`, `if (this._getInputValue() === sValue) return this;`). Measured, calling `setValue(dom.value)` after the native insert:

|                                         | measured                        |
| --------------------------------------- | ------------------------------- |
| DOM writes during `setValue`            | **0** — the undo stack survives |
| `getProperty("value")`                  | `"abc"` — synced                |
| additional `liveChange` from `setValue` | 0                               |
| `execCommand("undo")` afterwards        | DOM `""`, `getValue()` `""`     |

So the kiosk order is: native edit → `setTargetValue(element, dom.value)`. The property syncs, no second DOM write occurs, and undo works end to end.

**One suppression is required.** `setTargetValue` ends with an explicit `element.fireEvent("liveChange", ...)` (`input-operations.ts:217-219`). UI5's own `oninput` already fired `liveChange` in response to the native event, so leaving the explicit fire in place double-fires it. On the native path the explicit fire is suppressed; on the fallback path (no native `input` event) it is kept, exactly as today.

### 3.7 Residuals

- **`getProperty("value")` goes stale again after a user-driven Ctrl+Z.** A native undo fires `input` with `inputType: "historyUndo"`, which UI5 handles the same way as any other `input` — property written only under `valueLiveUpdate`. The library is not in that call path and cannot sync it. `getValue()` still reads correctly. Documented, not fixed; fixing it would mean listening to the target's `input` events, which is a larger change than #230.
- **Composition paths keep assigning.** `updateComposition` (`composition-utils.ts:38`) writes preedit text by assignment on both twins. Preedit is transient, replaced on every update and never a discrete undo step, so routing it natively would add undo entries a physical IME would not produce. `commitComposition` reaches the native path through `insertText`, so committed text is a proper undo transaction. Unchanged by this design.

## 4. Test plan

Per CLAUDE.md §3, the failing tests are written first.

**Environment constraint, measured:** jsdom has no `document.execCommand` at all (`typeof` → `undefined`; calling it throws `TypeError`). The webc unit suite (`vitest`, `test/unit/`) therefore exercises the **fallback** path exclusively and its existing assertions must keep passing untouched — which is also the regression test that the fallback still works. The native path can only be tested in a real browser: `test/component/**/*.test.ts` (web-test-runner + Chromium) for webc, `test/qunit/*.qunit.ts` (ui5-test-runner + Puppeteer) for kiosk.

New tests:

| test                                      | package | suite                            | asserts                                                                  |
| ----------------------------------------- | ------- | -------------------------------- | ------------------------------------------------------------------------ |
| maxlength overflow                        | webc    | `test/component/`                | typing 4 chars into `maxlength="3"` yields 3                             |
| undo after insert                         | webc    | `test/component/`                | `execCommand("undo")` reverts a keyboard-typed char                      |
| undo after backspace                      | webc    | `test/component/`                | backspace is a revertible transaction                                    |
| grapheme backspace unchanged              | webc    | `test/unit/` + `test/component/` | `á`, ZWJ family, flag, skin tone delete whole-cluster on both paths      |
| no double `input` event                   | webc    | `test/component/`                | exactly one `input` per keypress                                         |
| unfocused target is not native-edited     | both    | component / qunit                | inserting into a non-focused target leaves the focused element untouched |
| maxlength overflow on `sap.m.Input`       | kiosk   | `test/qunit/`                    | 4 chars into `maxLength: 3` yields 3                                     |
| `value` property synced after native edit | kiosk   | `test/qunit/`                    | `getProperty("value")` matches the DOM                                   |
| single `liveChange` per keypress          | kiosk   | `test/qunit/`                    | no double fire                                                           |
| undo on the UI5 path                      | kiosk   | `test/qunit/`                    | `execCommand("undo")` reverts, `getValue()` follows                      |

Per CLAUDE.md §7 the suite is then adversarially validated, in a companion `2026-08-11-native-text-insertion-adversarial-hypotheses.md`. The false-positive hypotheses to clear before trusting green, stated now:

1. The maxlength test passes because the fallback ran and the assertion is too weak to tell the paths apart.
2. The undo test passes because `execCommand("undo")` reverted an unrelated earlier edit rather than the one under test.
3. The "no double `input`" test passes because zero events fired, not one.
4. The kiosk `liveChange` test passes because the target was never focused, so the native path never ran and the old behaviour was measured.
5. The grapheme tests pass in jsdom via the fallback while the browser-path behaviour is never exercised.

## 5. Twin symmetry

Both packages take the same change. The shared logic (`insertText`, `handleBackspace`) is duplicated per the standing no-shared-core decision (CLAUDE.md, issue #105), so the native-path helper is duplicated too — it is a short, self-contained guard-and-dispatch, well inside the "duplicate rather than hoist" line of CLAUDE.md §2.

The twins differ in exactly one place, and the difference is inherent rather than incidental: the kiosk twin performs the extra `setTargetValue()` sync described in §3.6 because it owns a UI5 property that the web component does not have. The webc twin's `insertText` ends at the DOM.
