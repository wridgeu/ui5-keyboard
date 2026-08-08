# Feature: Black-Box QUnit Test Layer for `ui5.kiosk`

> Status: Implemented

## Goal

Add a stable black-box test layer for `ui5.kiosk` that validates rendered DOM,
public events, and input behavior from a consumer perspective.

## Scope

- QUnit only.
- No mutation tooling.
- No renderer/internal API access in assertions.

## Implemented Test Additions

### 1) Suite: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts`

1. **Shift cycle render contract**
   - Tap `{shift}` three times and assert rendered key state transitions using:
     - `aria-pressed`
     - `.ui5KioskKey--shiftActive`
     - `.ui5KioskKey--capsLock`
     - live-region text changes
2. **Shifted labels and aria-labels**
   - Use a custom layout (`1` with `shiftLabel: "!"`, `a` key).
   - Assert rendered labels/aria-labels change with shift and reset after typing.
3. **Keyboard type render switching**
   - Switch `Full -> Numpad -> Numeric -> Full`.
   - Assert root classes and rendered key set updates per mode.
4. **Special key accessibility labels**
   - Assert rendered `aria-label` values for `{backspace}`, `{enter}`,
     `{shift}`, and space key.
5. **Layout switch rendering**
   - Trigger layout change via `{layout:name}` key and assert rendered key matrix
     reflects new layout.

### 2) Suite: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-input-blackbox.qunit.ts`

> This suite no longer exists. Its coverage was absorbed into
> `KioskKeyboard.qunit.ts`, which had grown duplicates of six of its seven tests.

1. **Default typing into `targetInput`**
   - Associate `sap.m.Input` and assert text insertion for printable keys.
2. **Backspace and space behavior**
   - Assert backspace removes characters and space inserts a space character.
3. **`keyPress` preventDefault contract**
   - Prevent specific key and assert target input value is unchanged.
4. **`keyPress` event payload contract**
   - Assert emitted `key` and `shiftKey` values for shifted and unshifted taps.
5. **No-target safety**
   - Without target input, assert key events still fire and do not throw.

### 3) Suite: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-autoshow-blackbox.qunit.ts`

1. **Docked auto-show open/close**
   - With `docked=true` and `autoShow=true`, assert keyboard opens on input focus
     and closes when focus leaves input context.
2. **Auto-type switch by focused input**
   - Focus number-oriented input and assert keyboard type switches to numeric mode.
   - Focus text input and assert keyboard type returns to full mode.
3. **`keyboardTypeChange` event contract**
   - Assert event payload (`keyboardType`, `previousKeyboardType`, `autoDetected`)
     on auto-detected transitions.

### 4) Suite registration update

- Added entries in `packages/kiosk-keyboard/test/qunit/testsuite.qunit.ts`:
  - `KioskKeyboard-renderer-blackbox`
  - `KioskKeyboard-input-blackbox`
  - `KioskKeyboard-autoshow-blackbox`

## Notes

- Existing implementation-coupled tests can remain; this layer adds a
  public-contract safety net that stays useful across internal refactors.
