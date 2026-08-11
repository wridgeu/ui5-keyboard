# Native text insertion: `maxlength` and the undo stack (#230)

**Date:** 2026-08-11
**Issue:** [#230](https://github.com/wridgeu/ui5-keyboard/issues/230)
**Status:** Implemented
**Packages:** `packages/kiosk-keyboard` and `packages/kiosk-keyboard-webc`. Both are affected and both change.

Every measurement below was taken against the engines Playwright ships in this repo (Chromium 147.0.7727.15, Firefox 148.0.2, WebKit 26.4) and against OpenUI5 1.136.18 served from the local framework cache. Where the three engines disagree, that is stated; the design depends only on behaviour all three share.

## 1. The defect

Both packages wrote text by assigning `dom.value` — the web component directly, the kiosk control through `setTargetValue()` and on into `InputBase.updateDomValue` → `.val()`. Both entry points are `insertText` and `handleBackspace` in each twin's `input-operations` module.

An assignment is not the platform's text-insertion path, and two native behaviours are lost by it.

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

`document.execCommand` is flagged deprecated on MDN and its specification is unmaintained. It was adopted only after the three alternatives were measured against the two symptoms of §1 — `maxlength` ignored, undo dead. Each fails, and §2.4 shows two of them fail worse than doing nothing.

### 2.1 `setRangeText()` — standardized, not deprecated, fixes neither symptom

`setRangeText()` is the obvious candidate: it is in the HTML standard, carries no deprecation, and takes the explicit range that `execCommand` lacks. Measured on `<input maxlength="3">`, identical in all three engines:

|                                 | `el.value = "abcdef"` | `setRangeText("abcdef")`   | `execCommand("insertText", …, "abcdef")` |
| ------------------------------- | --------------------- | -------------------------- | ---------------------------------------- |
| honours `maxlength="3"`         | no — `"abcdef"`       | no — `"abcdef"`            | yes — `"abc"`                            |
| joins the undo stack            | no                    | no                         | yes                                      |
| fires `input`                   | no                    | no                         | yes                                      |
| on `type=number` / `type=email` | assigns               | throws `InvalidStateError` | declines (no selection support)          |

It enforces no length limit, so the JS clamp of §3.5 would still be needed. It fires no events at all, so the synthetic `input` dispatch would still be needed. It does not participate in the undo stack, so the primary symptom is untouched. And it throws where the assignment it would replace does not. It is a stricter API for the same broken behaviour.

### 2.2 `EditContext` — not applicable to `<input>`/`<textarea>`

`EditContext` is the modern editing API, but it is an editing host for custom editors, not a way to drive a form control:

| engine       | `typeof EditContext` | `new EditContext()` on `<input>` / `<textarea>`                       | on a `<div>` |
| ------------ | -------------------- | --------------------------------------------------------------------- | ------------ |
| Chromium 147 | `"function"`         | throws `NotSupportedError: This element does not support EditContext` | attaches     |
| Firefox 148  | `"undefined"`        | —                                                                     | —            |
| WebKit 26.4  | `"undefined"`        | —                                                                     | —            |

Both packages edit the host page's own `<input>`s and `<textarea>`s, so the element requirement alone disqualifies it, before the Chromium-only availability does. It also points the wrong way on the symptom that matters: its own explainer states that web editors rarely want the DOM undo stack, which is precisely what #230 asks for.

### 2.3 A library-owned undo stack — the interception point does not exist

The third option keeps the assignment and reimplements undo: record each library edit, intercept Ctrl+Z, replay. Interception has to happen on `beforeinput` with `inputType: "historyUndo"`, the only cancelable notification an engine gives before unwinding its own stack. Measured, all three engines:

| the field's history         | Ctrl+Z fires `beforeinput` | cancelable |
| --------------------------- | -------------------------- | ---------- |
| after real typing           | yes                        | yes        |
| after `el.value = "…"` only | no event at all            | —          |

The hook is cancelable exactly where the native stack already works, and absent exactly where it does not — a field only ever written by assignment, which is the state this design exists to fix. Ctrl+Z there fires no `beforeinput` and no `input`. Falling back to `keydown` means owning the chord and its per-OS variants, and then arbitrating against the native stack whenever the user has also typed for real.

### 2.4 Ground truth with trusted input

The decisive measurement uses trusted input — real keystrokes and a real Ctrl+Z through the driver, not synthesised events. Type `"abc"` for real, perform one library insertion, then press Ctrl+Z:

| library write                           | Ctrl+Z afterwards                                               |
| --------------------------------------- | --------------------------------------------------------------- |
| `el.value = value + "d"`                | nothing is undone; the user's own `"abc"` is no longer undoable |
| `setRangeText("d", 3, 3)`               | nothing is undone; the user's own `"abc"` is no longer undoable |
| `execCommand("insertText", false, "d")` | `"abcd"` → `"abc"` → `""`                                       |

Any programmatic write other than `execCommand` poisons the stack: it does not merely fail to add an entry, it discards the entries the user earned by typing. `execCommand` is the only one that leaves Ctrl+Z working, and it unwinds the library edit first and the user's real typing after. So "keep assigning and accept no undo" is not the neutral option it looks like.

### 2.5 The standards position

MDN marks `execCommand` deprecated and carves out this use case in the same page: modifications performed by `execCommand` preserve the undo buffer, unlike direct DOM manipulation — and its worked example is `insertText` into a `<textarea>`. A replacement has been an open question since [w3c/editing#160](https://github.com/w3c/editing/issues/160), "INPUT/TEXTAREA should support subset of execCommand", filed January 2017: still open, no resolution, no proposed API.

So the choice is not "deprecated API vs modern API", it is "deprecated API vs the behaviour stays broken". What bounds the risk of taking it:

1. **The three commands used are universally supported.** `queryCommandSupported("insertText" | "delete" | "undo")` returns `true` in all three engines. These are the commands editors depend on; they are the part of `execCommand` that is not going anywhere, because removing them would break every rich-text editor on the web.
2. **The risk is bounded by construction.** Every call site keeps the assignment as a fallback, taken whenever the native path is unavailable or declines. If an engine ever drops the command, the library degrades to today's behaviour rather than failing.
3. **The blast radius is two functions.** `insertText` and `handleBackspace` per package. Nothing else in either package writes a target's value.

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

Computing the caret as `[start + text.length, ...]` is wrong under native insertion with `maxlength`: inserting `"bcdef"` into `"a"` on a `maxlength="3"` field yields `"abc"` and a caret at 3, not 6. The native path reads `selectionStart` back from the DOM; only the fallback, which knows what it clamped, computes it.

Two further measured traps:

- **A saturated field returns `true` and inserts nothing.** `execCommand("insertText")` on a full `maxlength` input returns `true` while the value is unchanged. The return value cannot be used to detect whether text landed, so it must not drive the fallback: `true` means "the command ran", and a native no-op under `maxlength` is the correct outcome, not a reason to fall back to an assignment that would defeat the fix.
- **`execCommand("delete")` at offset 0 also returns `true`** having deleted nothing. The existing guard (return `null` when `start === 0 && start === end`) stays and remains the authority on "nothing was deleted".

So: fall back only when the native path is unavailable (`typeof document.execCommand !== "function"`) or the command returns `false` (measured: `false` for a read-only element in all three engines). Otherwise read `selectionStart`/`selectionEnd` back from the DOM and return those.

### 3.5 The fallback path clamps `maxlength` itself

On the native path the browser applies `maxlength`. The fallback has no platform edit to apply it, so `clampToMaxLength()` (webc `input-operations.ts:88-102`, kiosk `input-operations.ts:90-104`) truncates the incoming text to the room left once `[start, end]` is replaced. It is reachable only from the insertion fallback (webc `:130`, kiosk `:179`); a deletion cannot exceed a length limit.

The platform semantics it mirrors, measured identically in all three engines:

| measured behaviour                                                               | what the clamp does                                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `maxLength` is `-1` when the attribute is absent                                 | a negative limit is no limit; the text passes through unchanged            |
| the limit counts UTF-16 code units                                               | `text.length`, not code points and not clusters                            |
| replacing a selection frees the selection's length                               | room is `maxLength - (value.length - (end - start))`                       |
| a surrogate pair is never split: `maxLength=3` + `"👍👍"` → `"👍"`, 2 code units | when the last unit that fits is a high surrogate, that unit is dropped too |

The surrogate rule can leave the field one code unit short of `maxLength`. That is the platform's own result, not a rounding error: no engine emits half a pair to reach the count.

The unit here is deliberately not the grapheme cluster that §3.3 uses for backspace. `maxlength` is the platform's contract and it is defined in code units; matching it is the point.

### 3.6 Events: the synthetic dispatch is dropped on the native path

The native command emits a real `input` event with the correct `inputType`, so the web component's manual `dispatchEvent(new InputEvent("input", ...))` (`input-operations.ts:142`, `:199`) is skipped when the native path ran, or every insertion would fire twice. The kiosk twin never dispatched one; it notifies UI5 through `liveChange` instead (§3.7).

Measured differences worth recording:

- Chromium and Firefox fire **only** `input`. WebKit additionally fires a **cancelable `beforeinput`**. Neither package synthesises `beforeinput`, so on WebKit consumers gain a cancellation hook the fallback does not offer; on the other two, nothing changes. This is an improvement in fidelity, not a contract the library promises.
- On a saturated `maxlength` field, WebKit fires `input` anyway; Chromium and Firefox fire none.
- `"\n"` inserted via `insertText` reports `inputType: "insertText"`, not the `"insertLineBreak"` the web component synthesises on its fallback path. The platform has no `execCommand` that produces `insertLineBreak`. This is a deliberate fidelity loss on the native path; `insertLineBreak` is retained on the fallback, where the dispatch is ours.

### 3.7 The UI5 twin: native edit first, then sync the property

This is the half issue #230 flags as needing verification before committing, because bypassing `setTargetValue()` means UI5 no longer sees the write. Measured against 1.136.18:

`InputBase.prototype.oninput` (`InputBase.js:776-779`) only sets `_bCheckDomValue = true`; it does not write the `value` property. `Input.prototype.oninput` (`Input.js:1813`) writes it **only** when `valueLiveUpdate` is set, and fires `liveChange` itself (`:1828`). So after a bare native edit on a `sap.m.Input`:

|                        | measured                           |
| ---------------------- | ---------------------------------- |
| DOM value              | `"abc"` (truncated by `maxlength`) |
| `getValue()`           | `"abc"`                            |
| `getProperty("value")` | `""` — **stale**                   |
| `liveChange` fired     | 1 (by UI5's own `oninput`)         |

A stale `value` property is not acceptable: two-way bindings read it. The fix is to write the property **after** the native edit, sourced from the resulting DOM value. That is safe because `InputBase.updateDomValue` early-returns when the DOM already matches (`InputBase.js:930`, `if (this._getInputValue() === sValue) return this;`). Measured, calling `setValue(dom.value)` after the native insert:

|                                         | measured                        |
| --------------------------------------- | ------------------------------- |
| DOM writes during `setValue`            | **0** — the undo stack survives |
| `getProperty("value")`                  | `"abc"` — synced                |
| additional `liveChange` from `setValue` | 0                               |
| `execCommand("undo")` afterwards        | DOM `""`, `getValue()` `""`     |

So the kiosk order is: native edit → property write from `dom.value` (`nativeEditWithSync`). The property syncs, no second DOM write occurs, and undo works end to end.

**`liveChange` is observed on the native path, not inferred.** `setTargetValue` is a property write followed by an explicit `element.fireEvent("liveChange", ...)`; the native path takes the write and gates the fire, because the real `input` event the platform dispatched has already reached the control.

Gating it on the control's shape does not work. UI5 dispatches DOM events to `oControl["on" + type]`, which makes an `oninput` method look like the framework's own test for "this control handles input itself" — and `sap.m.Input` does fire `liveChange` from one (`Input.js:1828`). But `sap.m.SearchField` declares `liveChange` (`SearchField.js:254`), has **no** `oninput`, and fires the event from a listener it binds in `onAfterRendering` (`SearchField.js:347` → `:616`). Under an `oninput` test it would receive two `liveChange` events per keypress — the exact double fire the rule exists to prevent. It is a live target: it is the inner control of `SelectDialog`, `TableSelectDialog`, `FacetFilter` and `Suggest`, so `Element.closestTo` on the focused `<input>` resolves to it. Controls binding `input` through `addEventDelegate` are invisible to the same test.

So `nativeEditWithSync` attaches a `liveChange` listener for the duration of the edit and fires the explicit event only when the control did not announce one itself. That is mechanism-independent: it holds for `oninput`, for a directly bound listener, and for an event delegate alike, and it keeps the guarantee that one edit produces exactly one `liveChange` on either path. On the fallback path there is no native `input` event and `setTargetValue` fires unconditionally, exactly as today. `Element.closestTo(dom)` may be `undefined` for a destroyed control, in which case the native edit stands on its own.

### 3.8 Residuals

- **`getProperty("value")` goes stale again after a user-driven Ctrl+Z.** A native undo fires `input` with `inputType: "historyUndo"`, which UI5 handles the same way as any other `input` — property written only under `valueLiveUpdate`. The library is not in that call path and cannot sync it. `getValue()` still reads correctly. Documented, not fixed; fixing it would mean listening to the target's `input` events, which is a larger change than #230.
- **Composition paths keep assigning.** `updateComposition` (`composition-utils.ts:38`) writes preedit text by assignment on both twins. Preedit is transient, replaced on every update and never a discrete undo step, so routing it natively would add undo entries a physical IME would not produce. `commitComposition` reaches the native path through `insertText`, so committed text is a proper undo transaction. Unchanged by this design.

## 4. Test plan

Per CLAUDE.md §3, the failing tests are written first.

**Environment constraint, measured:** jsdom has no `document.execCommand` at all (`typeof` → `undefined`; calling it throws `TypeError`). The webc unit suite (`vitest`, `test/unit/`) therefore exercises the **fallback** path exclusively and its existing assertions must keep passing untouched — which is also the regression test that the fallback still works. The native path can only be tested in a real browser: `test/component/**/*.test.ts` (web-test-runner + Chromium) for webc, `test/qunit/*.qunit.ts` (ui5-test-runner + Puppeteer) for kiosk.

New tests:

| test                                           | package | suite                                  | asserts                                                                                          |
| ---------------------------------------------- | ------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| maxlength overflow                             | webc    | `test/component/`                      | typing 4 chars into `maxlength="3"` yields 3                                                     |
| undo after insert                              | webc    | `test/component/`                      | `execCommand("undo")` reverts a keyboard-typed char                                              |
| undo after backspace                           | webc    | `test/component/`                      | backspace is a revertible transaction                                                            |
| grapheme backspace unchanged                   | webc    | `test/component/`                      | combining acute, ZWJ family, flag and skin tone each delete as one cluster                       |
| no double `input` event                        | webc    | `test/component/`                      | exactly one `input` per keypress                                                                 |
| unfocused target is not native-edited          | both    | component / qunit                      | inserting into a non-focused target leaves the focused element untouched                         |
| maxlength overflow on `sap.m.Input`            | kiosk   | `test/qunit/`                          | 4 chars into `maxLength: 3` yields 3                                                             |
| `value` property synced after native edit      | kiosk   | `test/qunit/`                          | `getProperty("value")` matches the DOM                                                           |
| single `liveChange` per keypress               | kiosk   | `test/qunit/`                          | no double fire                                                                                   |
| undo on the UI5 path                           | kiosk   | `test/qunit/`                          | `execCommand("undo")` reverts the DOM, and the property does not follow (§3.8)                   |
| single `liveChange` from a bound listener      | kiosk   | `test/qunit/`                          | a `SearchField`-shaped control is not double-fired (§3.7)                                        |
| grapheme backspace on the platform path        | kiosk   | `test/qunit/`                          | surrogate-pair emoji and ZWJ sequence each delete as one cluster                                 |
| the platform performed the edit                | kiosk   | `test/qunit/`                          | exactly one `input` event per platform edit — the kiosk fallback dispatches none                 |
| clamp arithmetic                               | both    | webc `test/unit/`, kiosk `test/qunit/` | room, saturation, replaced selection, surrogate pair, unset `maxLength`, backspace at saturation |
| no `input` event when the clamp leaves no room | webc    | `test/unit/`                           | a saturated insert is silent, not a spurious empty `insertText`                                  |

Per CLAUDE.md §7 the suites were then adversarially validated: [2026-08-11-native-text-insertion-adversarial-hypotheses.md](./2026-08-11-native-text-insertion-adversarial-hypotheses.md). Six hypotheses, cleared by four injections plus one assertion-strength read. Two findings from that pass belong here, because they bound what the suites prove:

- **Most assertions are parity guards, not proof the platform did the work.** The `maxlength` and grapheme tests stay green with the native path forced off, because the fallback reproduces both results by design. Each twin needs its own discriminator, and the two differ: the kiosk fallback dispatches **no** `input` event, so counting one is exact there; the web component's fallback synthesises one, so counting cannot separate the paths and its **undo tests are the only discriminators**.
- **Both browser suites run Chromium only.** The cross-engine behaviour in §1 and §3.3 was measured directly but is not re-checked by CI.

## 5. Twin symmetry

Both packages take the same change. The shared logic (`insertText`, `handleBackspace`) is duplicated per the standing no-shared-core decision (CLAUDE.md, issue #105), so the native-path helper is duplicated too — it is a short, self-contained guard-and-dispatch, well inside the "duplicate rather than hoist" line of CLAUDE.md §2.

The twins differ in two places, both inherent rather than incidental. The kiosk twin performs the extra property sync and `liveChange` reconciliation described in §3.7, because it owns a UI5 property and a UI5 event that the web component does not have; the webc twin's `insertText` ends at the DOM. And the webc twin dispatches the synthetic `input` event on its fallback path, which the kiosk twin never had — there, UI5 is notified through `liveChange` instead.
