# UI5 Event Handling Deep Dive

Reference for UI5 keyboard events, touch event simulation, pseudo events, and how the `ui5.hotkeys` / `ui5.kiosk` libraries interact with them.

> **Research date:** February 2026, based on OpenUI5 1.144.0 source code and official documentation.

## Table of Contents

1. [Event Architecture Overview](#1-event-architecture-overview)
2. [ControlEvents: UIArea Auto-Delegation](#2-controlevents-uiarea-auto-delegation)
3. [PseudoEvents: Semantic Keyboard Events](#3-pseudoevents-semantic-keyboard-events)
4. [EventSimulation: saptouchstart / saptouchend](#4-eventsimulation-saptouchstart--saptouchend)
5. [F6 Fast Navigation](#5-f6-fast-navigation)
6. [CommandExecution: UI5's Built-in Shortcut System](#6-commandexecution-ui5s-built-in-shortcut-system)
7. [UI5 Reserved / Disallowed Shortcuts](#7-ui5-reserved--disallowed-shortcuts)
8. [SAP Fiori Elements Standard Shortcuts](#8-sap-fiori-elements-standard-shortcuts)
9. [Focus Handling](#9-focus-handling)
10. [ItemNavigation Delegate](#10-itemnavigation-delegate)
11. [Hybrid Device Handling (Mouse + Touch)](#11-hybrid-device-handling-mouse--touch)
12. [Implications for Our Libraries](#12-implications-for-our-libraries)

## 1. Event Architecture Overview

UI5 layers its event system on top of browser events: native DOM events (layer 1) feed UIArea-auto-delegated **ControlEvents** (layer 2, ~26 browser events), which are classified into semantic **PseudoEvents** (layer 3, `sapenter`, `sapnext`, etc.), with **simulated touch events** (layer 4, `saptouchstart`/`saptouchend`) and manifest-declared **CommandExecution** shortcuts (layer 5) on top.

**UIArea** is the central dispatcher. It binds all ControlEvents on its root DOM element:

```js
jQuery(oDomRef).on(ControlEvents.events.join(" "), this._handleEvent.bind(this));
```

When an event fires, `_handleEvent()`:

1. Resolves the target UI5 control from the DOM event target
2. Retrieves pseudo event types via `event.getPseudoTypes()`
3. Dispatches to each control's `on<eventName>` methods
4. Bubbles up the control hierarchy

## 2. ControlEvents: UIArea Auto-Delegation

**Module:** `sap/ui/events/ControlEvents` (public since 1.58)

`ControlEvents.events` is an array of ~26 base browser events that UIArea registers once on its root DOM and dispatches to controls via `on<eventName>(oEvent)` methods. It covers the usual mouse/keyboard/focus/drag/clipboard events (`click`, `keydown`, `keyup`, `focusin`, `focusout`, `mousedown`, `input`, `change`, `compositionstart`/`compositionend`, etc.).

**Not in this list:** `pointerdown`, `pointerup`, `pointermove`, `wheel`, `scroll`, `touchstart`, `touchend`. These must be registered explicitly via `attachBrowserEvent()` or `addEventListener()` in `onAfterRendering()`.

**API:**

- `ControlEvents.events`: the array of event names
- `ControlEvents.bindAnyEvent(fn)` / `unbindAnyEvent(fn)`: bind/unbind a callback for ALL events on `document`

## 3. PseudoEvents: Semantic Keyboard Events

**Module:** `sap/ui/events/PseudoEvents` (public since 1.58)

Pseudo events are **semantically enriched keyboard events**. They:

- Are classified from `keydown` (or `keypress`/`click`) events
- Are dispatched via UIArea alongside the original event
- Can ONLY be handled via `on<eventName>()` methods, **NOT** via `jQuery.on()`
- Are checked via `event.getPseudoTypes()` and `event.isPseudoType(name)`

There are 51 in total (the full list lives in the [PseudoEvents.js source](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/events/PseudoEvents.js)). The ones relevant to these libraries:

| Event                            | Key(s)                       | Notes                               |
| -------------------------------- | ---------------------------- | ----------------------------------- |
| `sapenter` / `sapselect`         | Enter (and Space for select) | Activation                          |
| `sapspace`                       | Space                        |                                     |
| `sapescape`                      | Escape                       |                                     |
| `sapnext` / `sapprevious`        | Arrow keys (RTL-aware)       | Used by ItemNavigation (section 10) |
| `saphome` / `sapend`             | Home / End                   |                                     |
| `saptabnext` / `saptabprevious`  | Tab / Tab+Shift              |                                     |
| `sapskipforward` / `sapskipback` | F6 / Shift+F6 (F6 nav)       | See section 5                       |

Each arrow/home/end/page/edit event also has a `...modifiers` variant that fires when any modifier is held. `sapminus` / `sapplus` are classified from `keypress` (experimental since 1.25) and are the only reason UI5 still reads `keypress` (see section 12).

### Held keys: pseudo events auto-repeat, and `repeat` is not on the wrapper

Because they are classified from `keydown`, a pseudo event fires again for every auto-repeat keydown the OS sends while a key stays down. `sapselect` is the one that bites: a handler that treats it as "the user activated this" runs at the OS repeat rate for as long as Enter or Space is held. UI5 does not filter this for you, and neither does `sap.m.Button`; `sap/m/Panel.js` is the in-framework example of a control guarding it by hand.

The guard cannot read `repeat` off the event the handler receives. UI5 delivers a jQuery-fixed event, and jQuery 3.6's `jQuery.event.addProp` list (the props it defines accessors for) has no `repeat` entry, so the wrapper reports `undefined`. Unwrap the native event from `originalEvent` first - the same unwrap `getModifierState` needs, since that is not forwarded either:

```js
oEvent.preventDefault(); // still owed on the repeats
const oNative = oEvent.originalEvent ?? oEvent;
if (oNative.repeat) return;
```

Order matters: `preventDefault()` belongs above the guard, or the page scrolls while Space is held down.

## 4. EventSimulation: saptouchstart / saptouchend

**Module:** `sap/ui/events/jquery/EventSimulation` (internal, but stable)

### Status: NOT deprecated, still fully supported in OpenUI5 1.144.0

These are **simulated unified touch events**, NOT pseudo events. `EventSimulation.js` creates them as jQuery special events (prefixing native names with `"sap"` → `saptouchstart`, `saptouchend`, `saptouchmove`, `saptouchcancel`), adds them to `ControlEvents.events` dynamically, and creates corresponding pseudo-event entries.

### Mouse-to-Touch Simulation (non-touch devices)

| Simulated Event | Triggered By             |
| --------------- | ------------------------ |
| `saptouchstart` | `mousedown`              |
| `saptouchend`   | `mouseup`, `mouseout`    |
| `saptouchmove`  | `mousemove`, `dragstart` |

`_handleMouseToTouchEvent()` constructs synthetic touch objects with the usual coordinate/identifier/radius properties.

### Touch-to-Mouse Simulation (touch devices)

| Native Touch Event | Simulated Mouse Events                                             |
| ------------------ | ------------------------------------------------------------------ |
| `touchstart`       | `mousedown`                                                        |
| `touchmove`        | `mousemove` (if movement exceeds `jQuery.vmouse`'s move threshold) |
| `touchend`         | `mouseup` + `click` (if no significant movement)                   |
| `touchcancel`      | `mouseup`                                                          |

### Why KioskKeyboard Uses ontouchstart / ontouchend

1. **Unified mouse+touch**: EventSimulation ensures these fire for both input types without dual handlers
2. **Proper UI5 integration**: Works with UIArea event delegation
3. **No pointerdown preventDefault trap**: `preventDefault()` on `pointerdown` suppresses ALL compatibility mouse events per the Pointer Events spec, breaking jQuery's `tap` → `vmousedown` → `ontap` chain
4. **Framework-blessed**: The standard pattern used by all `sap.m` controls (Button, Slider, Switch, ListItemBase, etc.)

### What NOT to do

```js
// BAD: Creates pointerdown preventDefault trap
this.attachBrowserEvent("pointerdown", handler);

// BAD: Duplicate handling on hybrid devices
ontouchstart(e) { handle(e); }
onmousedown(e) { handle(e); }  // Fires TWICE on touch devices

// GOOD: Unified approach (same as sap.m controls)
ontouchstart(e) { handle(e); }  // Works for both mouse and touch via EventSimulation
ontouchend(e) { handle(e); }
```

## 5. F6 Fast Navigation

**Module:** `sap/ui/events/F6Navigation` (internal but stable)

F6 enables "fast navigation" between UI5 control groups: **F6** triggers `sapskipforward` (jump to next group), **Shift+F6** triggers `sapskipback`. Groups are marked with `data-sap-ui-fastnavgroup="true"` on DOM elements (custom groups use `data-sap-ui-customfastnavgroup="true"` and fire `BeforeFastNavigationFocus`). Navigation cycles: after the last group it wraps to the first.

### Important for HotkeyManager

**F6 is in the disallowed shortcuts list** (see section 7). Our HotkeyManager should warn if someone registers F6 as a hotkey since it conflicts with UI5's built-in fast navigation.

## 6. CommandExecution: UI5's Built-in Shortcut System

**Module:** `sap/ui/core/CommandExecution` (public since 1.70)

UI5's official mechanism for application-level keyboard shortcuts, declared in the manifest (`"sap.ui5".commands`) and wired in XML via `<core:CommandExecution command="Save" execute=".onSave" />` or the `press="cmd:Save"` shorthand.

### Three-State Model

| State              | Behavior                                        |
| ------------------ | ----------------------------------------------- |
| Visible + Enabled  | Shortcut executes the handler                   |
| Visible + Disabled | Shortcut consumed (blocked), handler NOT called |
| Not Visible        | Shortcut propagates to parent controls          |

### Critical Limitation: Focus Dependency

**CommandExecution requires focus on a tabbable element.** The shortcut listener is registered by `ShortcutHelper` on the nearest `UIArea` root; if no tabbable element within that UIArea has focus, the shortcut is NOT intercepted and the browser's default action fires.

From [GitHub Issue #2788](https://github.com/UI5/openui5/issues/2788):

> "We can not provide a stable non-confusing implementation of focus-free shortcuts."

**This is exactly why our HotkeyManager exists.** It uses a single `window`-level `keydown` listener in capture phase (via the centralized EventDispatcher), making it focus-independent and able to handle global shortcuts that CommandExecution cannot.

### Shortcut Validation

The `Shortcut` module validates key combinations with two regexes (one for the full string like `"Ctrl+Shift+S"`, one for the key part alone), and adapts `Ctrl` → `Cmd` on macOS. The allowed key set is `[a-z0-9.,\-*/=]`, `Plus`, `Tab`, `Space`, `Enter`, `Backspace`, `Home`, `Delete`, `End`, `Pageup`, `Pagedown`, `Escape`, the four arrows, and `F1` through `F12`.

## 7. UI5 Reserved / Disallowed Shortcuts

**Source:** `sap/ui/core/util/ShortcutHelper.js`, `mDisallowedShortcuts`

These are **blocked by UI5's CommandExecution** and should also be warned about by our HotkeyManager. Three groups:

- **Browser-reserved (cannot be intercepted in Chrome):** `Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+T`, `Ctrl+Shift+T`, `Ctrl+W`, `Ctrl+Shift+W`, `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+PageUp`, `Ctrl+PageDown`, `F11`, `F12`.
- **UI5 framework-reserved:** `Ctrl+Alt+Shift+P` (Technical Info), `Ctrl+Alt+Shift+S` (Support Popup), `F6` (group navigation).
- **Browser-functional (overridable but confusing):** `Ctrl+L`, `Ctrl+Q`, `Ctrl+0`, `Ctrl+-`, `Ctrl++`, `Ctrl+Shift+=`, `Tab` / `Shift+Tab`.

> [!NOTE]
> `Ctrl+Alt+Shift+T` (UI5 Test Recorder) is handled by the framework at runtime but is **not** in `ShortcutHelper.js`'s `mDisallowedShortcuts` map, so CommandExecution does not block it during validation.

Additional rule: shortcuts with `Shift` + punctuation keys (`., - + = * /`) are blocked because Shift changes the meaning of these keys on many layouts.

## 8. SAP Fiori Elements Standard Shortcuts

Applications should avoid conflicting with Fiori Elements standards. The most common: Save (`Ctrl+S`), Create (`Ctrl+Enter`), Delete table row (`Ctrl+D`), Edit (`Ctrl+E`), Export to Excel (`Ctrl+Shift+E`), Go/Search (`Enter`), Cancel (`Esc`), Select row (`Shift+Space`), Table settings (`Ctrl+,`). On macOS `Ctrl` maps to `Cmd`. Full table in the [Fiori Elements keyboard shortcuts docs](https://github.com/SAP-docs/sapui5/blob/main/docs/06_SAP_Fiori_Elements/keyboard-shortcuts-0cd318c.md).

## 9. Focus Handling

**Module:** `sap/ui/core/Element` provides `getFocusDomRef()`, `focus()`, `getFocusInfo()`, `applyFocusInfo(info)`, and `onfocusfail()`. Re-rendering destroys and recreates DOM nodes; without `getFocusInfo()`/`applyFocusInfo()`, focus is lost.

**KioskKeyboard implements both** `getFocusInfo` and `applyFocusInfo` to preserve the focused key across re-renders.

## 10. ItemNavigation Delegate

**Module:** `sap/ui/core/delegate/ItemNavigation` (public API)

Provides arrow key, Home/End, PageUp/PageDown navigation for list-like controls using a **roving tabindex** pattern (handling `onsapnext`/`onsapprevious`/`onsaphome`/`onsapend`/`onsappageup`/`onsappagedown` and F2 to toggle action vs navigation mode). Configurable via `setCycling`, `setColumns`, `setPageSize`, `setTableMode`, `setDisabledModifiers`.

### Relevance to KioskKeyboard

KioskKeyboard implements its own arrow key navigation (a dedicated `KeyGridNavigation` delegate) rather than using ItemNavigation because the keyboard layout (rows of varying widths) doesn't fit ItemNavigation's linear or fixed-grid model.

## 11. Hybrid Device Handling (Mouse + Touch)

UI5 handles devices supporting both mouse and touch input simultaneously.

### Event Sequence on Touch Tap

```
touchstart → touchend → mousedown → mouseup → click
```

UI5 flags emulated mouse events with a `"delayedMouseEvent"` marker (via jQuery's `.isMarked()` API) to prevent duplicate handling.

### Rules for Control Developers

1. **Do NOT implement both `onmouse*` and `ontouch*`**, use `ontouchstart`/`ontouchend` instead (EventSimulation handles both)
2. For explicit `addEventListener()` registrations, check the delayed mouse event marker:
   ```js
   if (oEvent.isMarked("delayedMouseEvent")) return; // Skip emulated event
   ```
3. UI5 auto-manages the simulation: `ontouch*` and `ontap*` fire for BOTH mouse and touch

## 12. Implications for Our Libraries

### HotkeyManager (`ui5.hotkeys`)

| Aspect                        | Status                 | Notes                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Window-level capture listener | **Correct**            | Single `window` capture listener (via EventDispatcher), fires before UIArea, independent of focus, solves CommandExecution's focus limitation. `stopPropagation` prevents events from reaching `document` listeners entirely. |
| F6 conflict                   | **Should warn**        | F6 is reserved for fast navigation. Registering F6 as a hotkey breaks accessibility                                                                                                                                           |
| UI5 tool shortcuts            | **Should warn**        | Ctrl+Alt+Shift+P/S are disallowed; Ctrl+Alt+Shift+T is handled at runtime                                                                                                                                                     |
| Browser-reserved shortcuts    | **Should warn**        | Ctrl+N/T/W etc. cannot be intercepted in Chrome                                                                                                                                                                               |
| Fiori Elements conflict       | **Consider warning**   | Ctrl+S, Ctrl+E, Ctrl+D etc. are Fiori standard                                                                                                                                                                                |
| `keypress` event              | **Not used (correct)** | `keypress` is deprecated per W3C; UI5 uses it only for `sapminus`/`sapplus`                                                                                                                                                   |
| AltGr handling                | **Correct**            | Properly detected and skipped                                                                                                                                                                                                 |

### KioskKeyboard (`ui5.kiosk`)

| Aspect                      | Status                      | Notes                                                                         |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `ontouchstart`/`ontouchend` | **Correct, not deprecated** | Unified mouse+touch via EventSimulation, matches sap.m control pattern        |
| `apiVersion: 4` renderer    | **Correct**                 | Semantic rendering, output depends only on control's own properties and state |
| Focus handling              | **Correct**                 | Implements `getFocusInfo()`/`applyFocusInfo()`                                |
| Roving tabindex             | **Correct**                 | Custom impl (not ItemNavigation), appropriate for variable-width rows         |
| F6 group                    | **Correct**                 | Renderer sets `data-sap-ui-fastnavgroup="true"` on the root element           |

### Deprecated API Avoidance (OpenUI5 2.x readiness)

| Deprecated                           | Replacement                   | Our Status                                |
| ------------------------------------ | ----------------------------- | ----------------------------------------- |
| `jQuery.sap.PseudoEvents`            | `sap/ui/events/PseudoEvents`  | N/A (we don't use pseudo events directly) |
| `jQuery.sap.ControlEvents`           | `sap/ui/events/ControlEvents` | N/A                                       |
| `jQuery.sap.keycodes`                | `sap/ui/events/KeyCodes`      | N/A (we use `event.key` strings)          |
| `jQuery.sap.handleF6GroupNavigation` | `sap/ui/events/F6Navigation`  | N/A                                       |
| `UIEvent.which` / `UIEvent.keyCode`  | `KeyboardEvent.key`           | **Correct**. We use `event.key`           |

## Sources

### Official Documentation

- [Keyboard Shortcuts for SAPUI5 Tools](https://github.com/SAP-docs/sapui5/blob/main/docs/02_Read-Me-First/keyboard-shortcuts-for-sapui5-tools-154844c.md)
- [Keyboard Handling for SAPUI5 UI Elements](https://github.com/SAP-docs/sapui5/blob/main/docs/04_Essentials/keyboard-handling-for-sapui5-ui-elements-6b741a6.md)
- [Browser Events](https://github.com/SAP-docs/sapui5/blob/main/docs/09_Developing_Controls/browser-events-91f1b38.md)
- [Event Handler Methods](https://github.com/SAP-docs/sapui5/blob/main/docs/09_Developing_Controls/event-handler-methods-bdf3e98.md)
- [Keyboard Usage of ARIA Role Mapped Controls](https://ui5.sap.com/sdk/docs/topics/e6cd5476193f48d1a273de990276c9bc.html)
- [Implementing Focus Handling](https://ui5.sap.com/sdk/docs/topics/91f19f036f4d1014b6dd926db0e91070.html)
- [Mobile Events](https://ui5.sap.com/sdk/docs/topics/9860cd2b183540f48ee054bcef44a8b5.html)
- [Devices Supporting Mouse and Touch](https://ui5.sap.com/sdk/docs/topics/1f9de72bea734beaafa86b80c2c4222c.html)
- [SAP Fiori Elements Keyboard Shortcuts](https://github.com/SAP-docs/sapui5/blob/main/docs/06_SAP_Fiori_Elements/keyboard-shortcuts-0cd318c.md)

### OpenUI5 Source Code

- [PseudoEvents.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/events/PseudoEvents.js)
- [ControlEvents.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/events/ControlEvents.js)
- [EventSimulation.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/events/jquery/EventSimulation.js)
- [F6Navigation.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/events/F6Navigation.js)
- [UIArea.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/core/UIArea.js)
- [CommandExecution.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/core/CommandExecution.js)
- [Shortcut.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/core/Shortcut.js)
- [ShortcutHelper.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/core/util/ShortcutHelper.js)
- [ItemNavigation.js](https://github.com/SAP/openui5/blob/master/src/sap.ui.core/src/sap/ui/core/delegate/ItemNavigation.js)

### GitHub Issues

- [CommandExecution focus limitation (#2788)](https://github.com/UI5/openui5/issues/2788)
- [Commands/shortcuts documentation (#20)](https://github.com/UI5/docs/issues/20)
