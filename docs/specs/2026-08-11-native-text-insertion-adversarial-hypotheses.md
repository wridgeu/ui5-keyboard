# Native text insertion: adversarial validation (#230)

**Date:** 2026-08-11
**Issue:** [#230](https://github.com/wridgeu/ui5-keyboard/issues/230)
**Design:** [2026-08-11-native-text-insertion-design.md](./2026-08-11-native-text-insertion-design.md)
**Status:** Cleared. §3 records what each suite can and cannot separate.

Per CLAUDE.md §7, the suites for #230 are only trusted after each has been **seen** to go red for the
regression it claims to guard. The hypotheses were written before the injections were run. Every
injection below was reverted immediately after the run that cleared it, and the working tree was
verified clean afterwards.

The change is unusually exposed to a green-but-lying suite, because the fallback path reproduces most
of the native path's observable behaviour. A test that never focuses its fixture silently measures the
old code and passes. That is hypothesis 4, and it is the one that matters most.

## 1. Hypotheses

| #   | A green run could be lying because…                                                                  |
| --- | ---------------------------------------------------------------------------------------------------- |
| 1   | the `maxlength` tests pass on the fallback's JS clamp and cannot tell the two paths apart            |
| 2   | the undo tests pass because `execCommand("undo")` reverted some earlier unrelated edit               |
| 3   | the "exactly one `input` event" tests pass because **zero** events fired, not one                    |
| 4   | the kiosk `liveChange` tests pass because the target was never focused, so the native path never ran |
| 5   | the grapheme tests pass in jsdom through the fallback while the browser path is never exercised      |
| 6   | the `liveChange` suppression is never actually exercised, so a double fire would go unnoticed        |

## 2. Injections and what they proved

### 2.1 Always fire our own `liveChange` (clears 6, and 3 for kiosk)

`nativeEditWithSync`'s `if (ran && !announced)` → `if (ran)`, reproducing the rejected `oninput`
inference for a control that announces through its own listener.

Red, 64/66:

```
input-operations - native insertText ▶ Fires liveChange exactly once on sap.m.Input
input-operations - native insertText ▶ Fires liveChange once for a control that binds the input event itself
```

Both "exactly once" assertions are live, and the runner's exit code propagated the failure. The second
test is the regression guard for the `sap.m.SearchField` shape — a control with a `liveChange` event,
no `oninput`, announcing from a listener bound in `onAfterRendering`.

### 2.2 Force the fallback (clears 4, and 2)

`nativeEdit` returns `false` unconditionally, so every edit takes the assignment path.

Run **first**, before the discriminators of §3 existed, this took only two kiosk tests red out of the
eight that claim the platform path — the undo test and one that failed for an incidental reason (the
fallback's `setValue` defers the DOM write to the next render). That result is what motivated §3: the
undo test was carrying the whole package alone.

Re-run **after** every test in the two platform-path modules gained an `input`-event assertion, the
same injection takes all eight red, 63/71:

```
input-operations - native insertText ▶ Enforces maxLength through the platform edit
input-operations - native insertText ▶ Syncs the UI5 value property with the edited DOM value
input-operations - native insertText ▶ Fires liveChange exactly once on sap.m.Input
input-operations - native insertText ▶ Fires liveChange for a target without an oninput handler
input-operations - native insertText ▶ Fires liveChange once for a control that binds the input event itself
input-operations - native insertText ▶ Undo reverts the DOM value; the value property keeps the pre-undo text
input-operations - native handleBackspace ▶ Deletes an entire surrogate-pair emoji
input-operations - native handleBackspace ▶ Deletes an entire ZWJ sequence
```

That is hypothesis 4 cleared: the kiosk fixtures demonstrably reach the platform path rather than
quietly measuring the old behaviour. It also clears 2 — an undo of some unrelated earlier edit would
have kept the undo test green here.

Same injection in the web component, run against `test/component/` in real Chromium — red, 348/350,
and exactly the two undo tests, which remain its only discriminators for the reason given in §3:

```
native text insertion > undoes an inserted character through the platform undo stack
native text insertion > undoes a backspace through the platform undo stack
```

### 2.3 Disable the focus guard

`nativeEdit`'s `if (activeElement() !== dom) return false;` neutered.

Red, 348/350, and exactly the two guard tests:

```
native text insertion > focus guard > types into the unfocused target and leaves the focused decoy untouched
native text insertion > focus guard > backspaces the unfocused target and leaves the focused decoy untouched
```

This is the hazard that makes the native path dangerous — `execCommand` edits whatever is focused,
ignoring the element it is handed — and the suite catches its removal.

### 2.4 Clamp faults (clears 1 for the fallback, and 5)

Three injections into the web component's `clampToMaxLength`, run against the vitest suite:

| injection                                                         | red                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `return text` immediately after the `max < 0` guard               | 4 tests                                                        |
| `room = max - dom.value.length` (ignoring the replaced selection) | 1 test, and only that one                                      |
| delete the `if (max < 0) return text` guard                       | 6 tests, including 5 pre-existing ones that set no `maxLength` |

The second injection failing exactly one test shows the selection-room arithmetic has its own guard
rather than being incidentally covered.

The kiosk twin carries a byte-identical copy of the function, so it was injected separately rather than
assumed covered: replacing the body with `return text` takes three of its five fallback clamp tests
red, 68/71 — room in a partially filled field, saturation, and the surrogate-pair back-off. The other
two stay green because an unclamped result is the correct result for them (a replaced selection that
fits, and `maxLength` unset), which is the expected shape rather than a gap.

### 2.5 Assertion strength (clears 3)

Read rather than injected: the event-count assertions are exact on both sides — `.to.equal(1)` in the
web component, `assert.strictEqual(inputEvents, 1, …)` in kiosk — and each sits alongside an assertion
that the value changed, so a run in which no event fired fails on the count rather than passing
vacuously.

## 3. What the assertions can and cannot separate

§2.2 exposed the real weakness: with the native path forced off, only two kiosk tests went red out of
eight that claim it. The rest are **parity guards** — green on either path, by design:

- **`maxlength` enforcement.** The fallback clamps in JS to the same result, so the assertion cannot
  tell which side produced it. That is the point of the clamp, not a defect.
- **The grapheme-cluster tests.** The range is selected from `graphemeLengthBefore` before the platform
  delete, so the engine's own cluster notion never comes into play (design doc §3.3). Nothing about the
  result distinguishes the paths.

A parity guard is worth keeping, but it must not be mistaken for proof that the platform did the work.
So each twin now carries an explicit discriminator, and the two are necessarily different:

| twin  | fallback dispatches an `input` event?                                                | discriminator                                      |
| ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| kiosk | no — `setTargetValue` → `updateDomValue` → jQuery `.val()`, which dispatches nothing | assert exactly one `input` event per platform edit |
| webc  | yes — the fallback synthesises one                                                   | the undo tests, and only those                     |

Every kiosk test in the two platform-path modules asserts the event count, so §2.2's injection now
takes all of them red rather than two. The web component has no such lever — a count of one is what
both of its paths produce — which leaves its two undo tests carrying the whole load. **If those two
are ever weakened or skipped, nothing in the webc suite will notice a silent regression to the
fallback.**

## 4. Not covered

- **Firefox and WebKit.** Both browser suites run Chromium only (web-test-runner's `playwrightLauncher`
  and ui5-test-runner's puppeteer). The cross-engine behaviour the design rests on was measured
  directly (design doc §1, §3.3) but is not guarded by CI on every run.
- **The `document.hasFocus()` false case.** A backgrounded document could in principle decline the
  command; the guard covers the element, not the document. No engine was observed declining on that
  basis, and the fallback would absorb it.
