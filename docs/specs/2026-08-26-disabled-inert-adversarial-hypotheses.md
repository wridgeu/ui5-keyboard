# A disabled keyboard mid-gesture: adversarial validation (#251, #256)

Written before the new suites were trusted, per CLAUDE.md §7. Each hypothesis
names a way the green run could have been lying; each is cleared only against a
run that was **seen** to go red, then reverted.

The trap this round is specific: every guard on this branch is a _second_ read
of a flag that is already read somewhere earlier. `disabled` is checked when a
gesture is armed, and the branch adds a check where the gesture is consumed. A
test that never gets a gesture armed in the first place is green either way, and
so is a test whose keycap loses its class for an unrelated reason. The injections
below each remove exactly one of the added reads, so a red run names the read it
came from. H5 is the exception in kind, not in trap: it removes a dismissal
rather than a read, and the popup it closes is the one gesture whose surface
outlives the gesture itself.

## What is under test

- `KeyGridNavigation.onKeyDown` / `onKeyUp` (`packages/kiosk-keyboard-webc/src/core/key-grid-navigation.ts`)
  and the `isDisabled()` host hook behind them.
- `_performBackspaceRepeatDelete` (webc) and `_performBackspaceRepeatTick`
  (kiosk): the auto-repeat tick, not the arm.
- `_resolveKeyVariants` (kiosk), and its pre-existing webc counterpart
  `_resolveVariantOpenState`, at the moment the hold timer fires.
- The dismissal of an already-open popup at the moment the flag flips:
  `setEnabled` (kiosk) and the `disabled` setter (webc).

## H1 — the arrow-key tests could pass on a keyboard that never navigates

Both new arrow assertions ("does not move, does not rewrite the tab stop") are
satisfied by a keyboard whose grid navigation is broken outright, or by one
rendered without a roving tab stop to move.

**Falsified.** With the `onKeyDown` guard removed:

```
× does not activate or paint press feedback
× navigates again after the keyboard is re-enabled
  Tests  2 failed | 45 passed (47)
```

```
❌ kiosk-keyboard > accessibility > arrow keys neither move focus nor rewrite the tab stop while disabled
```

The second red is the load-bearing one: the re-enable case is what proves the
suite can tell "refused while disabled" from "never navigates", and it is the
case a one-shot / sticky read of the flag would break.

## H2 — the Space-release test could be green without any release-side guard

Disabling re-renders the keyboard, and a re-render could drop
`ui5KioskKey--pressed` on its own. Then the assertion passes with the `onKeyUp`
read gone.

**Falsified.** With only the `onKeyUp` guard removed (the `onKeyDown` one left
in place):

```
× drops the press feedback of a Space held across the disable
  Tests  1 failed | 46 passed (47)
```

One test, and only that test. The class survives the disable unless the release
path drops it, so the assertion is on the guard and not on the re-render.

## H3 — the auto-repeat tests could pass at the arm, never reaching the tick

`{backspace}` auto-repeat already refuses to _arm_ on a disabled keyboard. A test
that disables before the hold starts asserts nothing about the tick.

**Falsified,** both twins, with only the tick guard removed:

```
❌ kiosk-keyboard > backspace auto-repeat > stops the repeat when the keyboard is disabled mid-hold
   Chromium: 176 passed, 1 failed
```

```
KioskKeyboard-backspace-repeat   5/6
  "disabling mid-hold stops the repeat, deletions and keyPress alike"
```

So the hold is genuinely running when the flag flips, the timer fires again
after it, and the tick read is what ends it.

## H4 — the variant tests could be green because the hold timer never fires

The popup opens on a 450 ms hold. A test whose synthetic gesture never reaches
the timer asserts "no popup" against a popup that was never scheduled.

**Falsified,** kiosk, with the `_resolveKeyVariants` guard removed:

```
KioskKeyboard-variants   60/61
  "disabling mid-hold keeps the popup from opening when the timer fires"
```

The timer fires in the test environment; without the guard the popup opens. On
webc the same guard already existed on `main`, so the new webc case is a pin
rather than a regression test, and it needed its own injection to prove it is
connected at all — removing `_resolveVariantOpenState`'s `disabled` read stops
the suite passing (`61 passed` → the run never finishes, `0 passed`, popup left
open). A hang is a blunt signal, but it is not green, and it is the same read.

## H5 — the dismissal tests could be green against a popup that never opened

Both new cases assert "no popup, nothing typed" after the flag flips. A gesture
that never opened one satisfies that outright, and so does a tap helper that
never reaches the option.

**Falsified,** both twins, with only the dismissal removed.

```
KioskKeyboard-variants   61/62
  "disabling the keyboard dismisses an open popup"
    the popup is dismissed:                          expected false, got true
    the option the press was aimed at types nothing: expected "z", got "zà"
```

```
kiosk-keyboard - accent-variant popup > dismisses an open popup when the keyboard is disabled
  AssertionError: the option the press was aimed at types nothing: expected 'â' to equal ''
```

Both reds name the typing assertion, not only the "is it open" one, so the tap
helper is demonstrably live and the popup demonstrably opened. The sibling case
in the same run ("disabling mid-hold keeps the popup from opening when the timer
fires") stays green under this injection, which separates the two mechanisms:
the dismissal closes what is open, `_resolveKeyVariants` refuses what is pending.

Two notes on the shape of the red:

- The kiosk assertion is only reachable because `tapOption` now carries the
  option's centre. A coordinate-less synthetic touch throws out of
  `document.elementFromPoint` while a Popover is open, and the uncaught error
  ended the test before its typing assertion could be reached — the injection
  looked red for the wrong reason.
- On webc the whole file stops finishing under this injection (`0 passed`, a
  runner timeout) rather than reporting one failure: clicking a live option on a
  disabled keyboard wedges the component. Not green, but blunt — the named red
  above comes from running that test alone. Same signal class as H4's.

## Not covered

- The kiosk arrow path. #256 is webc-only: kiosk already refuses arrows on a
  disabled keyboard, and the kiosk-side navigation guard this branch first added
  was cut again for that reason. No injection here, because there is no new read.
