# The Shift latch and Shift sampling: adversarial validation (#241, #248, #252, #259, #260)

Written before the new suites were trusted, per CLAUDE.md §7. Each hypothesis
names a way the green run could have been lying; each is cleared only against a
run that was **seen** to go red, then reverted.

The premise this round is unusual and is the reason the file exists: #260
observed that the whole set of new assertions is expected to be **green on
`main` before any fix**, because the behaviour they pin is already correct. A
suite that is green both before and after tells you nothing on its own. Fault
injection is the only evidence that these assertions are connected to the code
at all.

## What is under test

- `peekToggle()` (`shift-state.ts`, both twins) and the `{shift}` `key-press`
  payload derived from it (`packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`).
- The Space activation's Shift, captured at the keydown
  (`packages/kiosk-keyboard-webc/src/core/key-grid-navigation.ts`).
- The one-shot latch spend at the accent-variant commit and at a
  middleware-consumed key, on both twins.
- The latch reset on a `keyboardType` change, on both twins.

## The shared trap, recorded first

`isShiftActive` (kiosk) and the `aria-pressed` reads (webc) resolve **rendered**
state. An assertion placed straight after a synchronous tap or `.click()` reads
the pre-render attribute and is red whatever the code does — a false red that
looks like a caught regression. Every new assertion waits for a render first
(`await waitForRender()` / `await renderFinished()`), and each injection below
was checked to fail on the assertion's own message rather than on a stale read.

## H1 — the `{shift}` payload test cannot see the arm it exists for

Four of `toggle()`'s five outcomes were already reported correctly by the old
`!this._capsLock` prediction. A test that only walks Off → Shift → CapsLock →
Off passes against the bug.

**Falsified.** With `peekToggle()` reverted to `!this._capsLock`:

```
❌ shift and caps lock > fires {shift} key-press with the shift state the toggle produces
     AssertionError: Shift -> Off: expected { payload: true, pressed: 'false' } to deeply equal { payload: false, pressed: 'false' }
```

Exactly one of the four arms went red, and the `pressed` half of the same tuple
stayed correct throughout — so the assertion is discriminating the payload from
the rendered state, not conflating them.

The unit-level counterpart, same injection in `shift-state.ts`:

```
× reports the Shift -> Off arm the mirrored caps-lock flag cannot see
     Tests  1 failed | 23 passed (24)
```

## H2 — `peekToggle()` could be performing the transition it claims to predict

A peek that quietly ran `toggle()` would satisfy every "predicts the arm"
assertion while destroying the veto contract (`key-press` for `{shift}` is
cancelable, and the toggle must not have happened when a consumer vetoes).

**Falsified.** With `peekToggle()` implemented as `this.toggle(); return this.isShifted;`:

```
× predicts each arm of toggle()
× neither transitions nor moves the double-click window
     Tests  2 failed | 22 passed (24)
```

## H3 — the Space-modifier tests could pass on the both-Shift ordering alone

The pre-existing case held Shift on both the keydown and the keyup, which is
precisely the ordering on which press-sampling and release-sampling agree.

**Falsified.** With the keyup's own `e.shiftKey` restored at the activation:

```
× Space keeps a Shift released before it        (expected false to be true)
× Space ignores a Shift pressed after it        (expected true to be false)
     Tests  2 failed | 42 passed (44)
```

Both split orderings went red and the both-Shift case stayed green, which is the
shape that proves the two new cases are the discriminating ones.

## H4 — the variant-commit latch assertions could be reading a latch nothing spent

The popup's own open/close path resets state in several places; an assertion
that the latch is off after a commit could be observing a reset rather than a
spend.

**Falsified.** With `_autoReleaseShift()` deleted from webc's `_insertVariant`:

```
❌ accent-variant popup > commits an uppercase variant through the shifted char path
     AssertionError: the committed variant spent the one-shot Shift latch: expected 'true' to equal 'false'
❌ accent-variant popup > spends the one-shot Shift latch on a vetoed variant commit
     AssertionError: the veto does not keep the latch armed: expected 'true' to equal 'false'
```

Both the plain and the vetoed commit went red, so neither is riding on the
other's code path.

## H5 — the middleware-consumed key never reaches the gate the test claims to pin

After #245 a consumed key falls through to the same `spendsOneShotShift` gate as
any other character, so a latch assertion alone would stay green even if the
early return moved above that gate — and would also stay green if the middleware
never consumed the key at all.

**Falsified.** With the gate skipped whenever a middleware is active (the
pre-#245 shape, where the release lived inside the middleware branch):

```
❌ keyboardType vs composition middleware > spends the one-shot Shift latch on a middleware-consumed key
     AssertionError: the consumed key still spent the one-shot Shift latch: expected 'true' to equal 'false'
```

The consumption half of the same test (`calls.handled` deep-equals `["ㄱ"]`) is
what rules out the second failure mode: it fails if the key took the
fall-through path instead.

## H6 — the `keyboardType` latch test could be reading a surface with no `{shift}` key

The numpad surface carries no `{shift}` keycap, so `isShiftActive` /
`queryKey(el, "{shift}")` would report "not latched" vacuously if the assertion
were taken while the numpad is rendered. Both tests therefore switch **back** to
`Full` before asserting.

**Falsified.** With `this._shiftState.reset()` removed from webc's `keyboardType`
branch:

```
❌ shift and caps lock > resets the shift latch on a keyboardType change, caps lock included
     AssertionError: the surface swap cleared it: expected 'true' to equal 'false'
```

Caps Lock survived the round trip, which is both the injected regression and the
proof that the round trip does not clear the latch by itself.

## Kiosk twin: H4, H5, H6 and H1 again, one batched run

Four injections applied together — the variant commit stops spending, the shared
spend gate is skipped whenever a middleware is active, `_setKeyboardTypeSource`
stops resetting, and `peekToggle()` falls back to `!isCapsLock`. Each lands on a
different code path, and the run turned exactly five assertions red across four
test pages, with nothing else moving (`keyboard-type-middleware` 2/3,
`KioskKeyboard` 109/110, `KioskKeyboard-variants` 58/60, `shift-state` 23/24):

```
MODULE: keyboard-type-middleware - keyboardType vs composition middleware
  TEST: a middleware-consumed key spends the one-shot Shift latch
  MSG: the consumed key still spent the one-shot Shift latch | actual=true expected=false

MODULE: KioskKeyboard
  TEST: a keyboardType change resets the Shift latch, Caps Lock included
  MSG: the surface swap cleared Caps Lock | actual=true expected=false
       and left no shift latched | actual=true expected=false

MODULE: KioskKeyboard accent-variant popup
  TEST: Shift surfaces the uppercase variants including ẞ for ß
  MSG: the committed variant spent the one-shot Shift latch | actual=true expected=false

MODULE: KioskKeyboard accent-variant popup
  TEST: a vetoed variant commit still spends the one-shot Shift latch
  MSG: the veto does not keep the latch armed | actual=true expected=false

MODULE: ShiftState
  TEST: peekToggle: reports the Shift -> Off arm the mirrored caps-lock flag cannot see
  MSG: outside the window: Shift -> Off | actual=true expected=false
```

## H7 — the kiosk Space test pins nothing, because kiosk never reads the keyup

The kiosk half of #252 is a **pin on existing behaviour**, not a fix: `sapselect`
and `sapselectmodifiers` are keydown pseudo-events (`aTypes: ["keydown"]`,
`PseudoEvents.js:327,342` in the pinned 1.136.18), and `onkeyup` only clears the
pressed styling. So no edit to the shipped code can make the keyup's modifier
reach the activation, and a test asserting it does not could be asserting
nothing at all.

What the injection can show is that the assertion is **live** — that it reads the
modifier the activation actually carried:

**Falsified.** With `onsapselectmodifiers` passing `false` into
`_activateFocusedKey` — the transient Shift dropped at the source:

```
MODULE: KioskKeyboard
  TEST: a Space keyup carrying a different Shift does not change what was typed
  MSG: the Shift released before the Space still applied | actual="b" expected="B"
       a Shift arriving after the press did not apply | actual="bc" expected="Bc"
```

Both halves went red, including the second one whose expected value (`"Bc"`)
contains no shifted character from the keystroke under test — so it is reading
the activation's modifier and not just any uppercase. Eight pre-existing
transient-Shift tests went red with it, which is the expected blast radius of
deleting the feature outright rather than collateral from a bad test.

The same run carried the second `peekToggle()` injection (the peek performs the
move), for the kiosk copy of the module:

```
MODULE: ShiftState
  TEST: peekToggle: predicts each arm of toggle()
  MSG: Shift -> CapsLock, within the window | actual=false expected=true
       Off -> CapsLock, within the window | actual=false expected=true
MODULE: ShiftState
  TEST: peekToggle: neither transitions nor moves the double-click window
  MSG: still shifted: peeking performs nothing | actual=false expected=true
       no onChange from a peek | actual=false expected=true
```

## Method note

The kiosk injections were applied in batches rather than one run per hypothesis
(a full QUnit pass is ~100s). Each batch targets code paths that do not overlap,
and each expected failure names its own test, so attribution is unambiguous; had
two hypotheses shared a failing test, they would have been re-run singly.
