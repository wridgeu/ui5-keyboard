# Feature: Native F-Key Mode

> Status: Implemented

## Problem

The kiosk keyboard's F-keys currently fire a custom `keyPress` event with `key: "F5"` (etc.) and the **app** decides what action to take. This is the right default for SAP transaction terminals where F3 = Back, F5 = Refresh Data, F8 = Execute.

But not every deployment is a SAP GUI replacement. Some kiosk apps are general-purpose browser apps where users expect F-keys to do what they do on a physical keyboard:

- **F5** refreshes the page
- **F11** toggles fullscreen
- **F1** opens browser help
- **F12** opens DevTools (during development)

Today an app developer who wants standard browser F-key behavior must:

1. Listen to `keyPress`
2. Check `key === "F5"`, `key === "F11"`, etc.
3. Manually call `location.reload()`, `document.documentElement.requestFullscreen()`, etc.

This is tedious, error-prone, and forces every consuming app to re-implement what the browser already does for physical keyboards.

### Real-world scenario

A company uses the kiosk keyboard on a shop-floor terminal running in fullscreen Chrome kiosk mode. The app has no SAP transaction logic; it's a simple data-entry form. Users see F-keys on the keyboard but tapping F5 does nothing visible. The admin wants "just make F-keys work normally".

## Proposal

### New property: `fKeyMode`

Add an enumeration property to `KioskKeyboard` that controls how F-key presses are dispatched:

| Value       | Behavior                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `"Virtual"` | **(Default)** Current behavior. Fires `keyPress` event only. App handles the action.            |
| `"Native"`  | Dispatches a real `KeyboardEvent("keydown")` to the document, enabling native browser handling. |

```ts
// App opts into native F-key behavior
<kiosk:KioskKeyboard fKeyMode="Native" />
```

### New enum: `FKeyMode`

```ts
// src/library.ts - alongside KeyboardType, MobileKeyboard
enum FKeyMode {
  Virtual = "Virtual",
  Native = "Native",
}
```

### How `"Native"` mode works

When `fKeyMode="Native"` and the user taps an F-key on the virtual keyboard:

1. **Dispatch a synthetic `KeyboardEvent`** to the **target input** (or `document.body` if no target):

   ```ts
   const event = new KeyboardEvent("keydown", {
     key: fkeyName, // "F5"
     code: `${fkeyName}`, // "F5"
     bubbles: true,
     cancelable: true,
     shiftKey: shift,
   });
   targetEl.dispatchEvent(event);
   ```

2. **If the `KeyboardEvent` was not `preventDefault()`'d**, execute the **built-in browser action** for well-known F-keys:

   | Key   | Native action                                                                 |
   | ----- | ----------------------------------------------------------------------------- |
   | F1    | _(no built-in, too platform-specific)_                                        |
   | F5    | `location.reload()`                                                           |
   | F11   | `document.documentElement.requestFullscreen()` or `document.exitFullscreen()` |
   | Other | _(no built-in action)_                                                        |

3. **Fire `keyPress` as usual** (so existing listeners still work). The `keyPress` event fires **after** the native dispatch, giving apps a chance to observe the outcome.

> **Why step 2?** Synthetic `KeyboardEvent`s have `isTrusted: false`, so browsers won't perform default actions (refresh, fullscreen, etc.) automatically. The keyboard must explicitly invoke the action for the keys where native behavior is well-defined and safe.

### Flow comparison

```
Virtual mode (current):
  tap F5 → fireEvent("keyPress", {key:"F5"}) → app handles it

Native mode (new):
  tap F5 → dispatch KeyboardEvent("keydown", {key:"F5"})
         → if not prevented: location.reload()
         → fireEvent("keyPress", {key:"F5"})
```

### Preventing native actions

Apps can selectively block native actions by listening to the dispatched `keydown` event:

```ts
// "I want native F-keys, except F5 should do a data refresh instead of page reload"
oInput.getDomRef().addEventListener("keydown", (e) => {
  if (e.key === "F5") {
    e.preventDefault(); // blocks location.reload()
    this.refreshData(); // custom action instead
  }
});
```

Or by using the hotkeys library's existing infrastructure, since the dispatched `KeyboardEvent` bubbles up to the document and is picked up by `HotkeyManager`:

```ts
HotkeyManager.getInstance().register({
  key: "F5",
  handler: () => this.refreshData(),
  preventDefault: true, // blocks the native action
});
```

> Note: this example predates the instance-lifecycle change. The `getInstance()` singleton was later removed in favor of `new HotkeyManager()` owned by the component (see [HOTKEYS-INSTANCE-LIFECYCLE](../../hotkeys/history/HOTKEYS-INSTANCE-LIFECYCLE.md)), and `register()` now takes `(hotkey, handler, options)`.

## Handler change

Current `_handleKeyAction` F-key block:

```ts
if (keyValue.startsWith("{fkey:")) {
  const fkeyName = keyValue.slice("{fkey:".length, -1);
  this.fireEvent("keyPress", { key: fkeyName, shiftKey: shift }, true);
  return;
}
```

Updated:

```ts
if (keyValue.startsWith("{fkey:")) {
  const fkeyName = keyValue.slice("{fkey:".length, -1);

  if (this.getFKeyMode() === FKeyMode.Native) {
    const targetEl = this._getTargetDomRef() ?? document.body;
    const nativeEvent = new KeyboardEvent("keydown", {
      key: fkeyName,
      code: fkeyName,
      bubbles: true,
      cancelable: true,
      shiftKey: shift,
    });
    const allowed = targetEl.dispatchEvent(nativeEvent);

    if (allowed) {
      KioskKeyboard._executeNativeAction(fkeyName);
    }
  }

  this.fireEvent("keyPress", { key: fkeyName, shiftKey: shift }, true);
  return;
}
```

Native action map (static, private):

```ts
private static readonly _NATIVE_FKEY_ACTIONS: Partial<Record<string, () => void>> = {
  F5: () => location.reload(),
  F11: () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  },
};

private static _executeNativeAction(fkeyName: string): void {
  KioskKeyboard._NATIVE_FKEY_ACTIONS[fkeyName]?.();
}
```

## Metadata change

```ts
static readonly metadata = {
  properties: {
    // ... existing properties ...
    fKeyMode: {
      type: "ui5.kiosk.FKeyMode",
      defaultValue: FKeyMode.Virtual,
    },
  },
};
```

## Scope

### In scope

- `FKeyMode` enum in `library.ts`
- `fKeyMode` property on `KioskKeyboard` (default `"Virtual"`)
- Synthetic `KeyboardEvent("keydown")` dispatch in `"Native"` mode
- Built-in native actions for F5 (reload) and F11 (fullscreen toggle)
- `keyPress` still fires in both modes (non-breaking)
- QUnit tests for both modes
- Demo page toggle showing the difference

### Out of scope

- Per-key mode configuration (e.g., "F5 native but F8 virtual"): apps can use `keydown` + `preventDefault` for selective overrides
- Custom native action mapping API (e.g., `setNativeAction("F3", () => history.back())`): possible future enhancement
- `keyup` dispatch (only `keydown`, consistent with how physical F-keys trigger actions on keydown)

## Files to change

| File                            | Change                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `src/library.ts`                | Add `FKeyMode` enum                                       |
| `src/KioskKeyboard.ts`          | Add `fKeyMode` property, update F-key handler, native map |
| `test/qunit/FKeys.qunit.ts`     | Tests for both modes, `preventDefault` blocking           |
| `test/qunit/testsuite.qunit.ts` | Update if new test file needed                            |
| Demo app view/controller        | Toggle switch to demonstrate native vs virtual mode       |

## Considerations

1. **`isTrusted: false`**: Synthetic events cannot trigger browser defaults on their own. This is why the keyboard explicitly calls `location.reload()` / `requestFullscreen()` for known keys. Apps and libraries (hotkeys, Fiori Launchpad) that listen for `keydown` events will still receive the synthetic event and can act on it.

2. **Security**: `location.reload()` and `requestFullscreen()` are safe actions that the user explicitly triggered by tapping a key. No destructive actions (closing tabs, navigating away) are included in the built-in map.

3. **Fullscreen quirk**: `requestFullscreen()` requires a user gesture. A virtual key tap is a `pointerdown`/`click` event, so it qualifies as a user gesture in all major browsers. This should work without issues.

4. **Shift+F-key**: The `shiftKey` flag is passed through to the synthetic `KeyboardEvent`, so handlers that distinguish Shift+F5 (force refresh) from plain F5 will work correctly. The built-in native action map does not differentiate; `location.reload()` is the same regardless. Apps that want Shift+F5 = hard refresh can use `location.reload()` themselves via `keydown` listener.

5. **Interaction with HotkeyManager**: When `fKeyMode="Native"`, the dispatched `KeyboardEvent` bubbles to the document and will be captured by `HotkeyManager` if it has a matching hotkey registered. This is desirable; it means the two libraries compose naturally. The hotkey handler can `preventDefault` to block the native action.

## Migration

Non-breaking. Default is `"Virtual"`, which preserves current behavior. Apps opt into `"Native"` explicitly.
