# UI5 Event Handling Deep Dive

Comprehensive reference for UI5 keyboard events, touch event simulation, pseudo events, and how our `ui5.hotkeys` / `ui5.kiosk` libraries interact with them.

> **Research date:** February 2026, based on OpenUI5 1.144.0 source code and official documentation.

---

## Table of Contents

1. [Event Architecture Overview](#1-event-architecture-overview)
2. [ControlEvents — UIArea Auto-Delegation](#2-controlevents--uiarea-auto-delegation)
3. [PseudoEvents — Semantic Keyboard Events](#3-pseudoevents--semantic-keyboard-events)
4. [EventSimulation — saptouchstart / saptouchend](#4-eventsimulation--saptouchstart--saptouchend)
5. [F6 Fast Navigation](#5-f6-fast-navigation)
6. [CommandExecution — UI5's Built-in Shortcut System](#6-commandexecution--ui5s-built-in-shortcut-system)
7. [UI5 Reserved / Disallowed Shortcuts](#7-ui5-reserved--disallowed-shortcuts)
8. [SAP Fiori Elements Standard Shortcuts](#8-sap-fiori-elements-standard-shortcuts)
9. [Focus Handling](#9-focus-handling)
10. [ItemNavigation Delegate](#10-itemnavigation-delegate)
11. [Hybrid Device Handling (Mouse + Touch)](#11-hybrid-device-handling-mouse--touch)
12. [Implications for Our Libraries](#12-implications-for-our-libraries)

---

## 1. Event Architecture Overview

UI5 has a **layered event system** built on top of browser events:

```
┌─────────────────────────────────────────────────────┐
│  Layer 5: CommandExecution (manifest-declared)       │  sap/ui/core/CommandExecution
│           Focus-dependent, scoped to control tree    │
├─────────────────────────────────────────────────────┤
│  Layer 4: Simulated Touch Events                    │  sap/ui/events/jquery/EventSimulation
│           saptouchstart, saptouchend, saptouchmove  │  jQuery special events
├─────────────────────────────────────────────────────┤
│  Layer 3: PseudoEvents (51 semantic events)         │  sap/ui/events/PseudoEvents
│           sapenter, sapnext, sapskipforward, etc.   │  on<eventName> only, no jQuery.on()
├─────────────────────────────────────────────────────┤
│  Layer 2: ControlEvents (26 browser events)         │  sap/ui/events/ControlEvents
│           click, keydown, focusin, mousedown, etc.  │  Auto-delegated by UIArea
├─────────────────────────────────────────────────────┤
│  Layer 1: Native Browser Events                     │  DOM Level 3
│           KeyboardEvent, MouseEvent, TouchEvent      │
└─────────────────────────────────────────────────────┘
```

**UIArea** is the central dispatcher. It binds all ControlEvents on its root DOM element:

```js
jQuery(oDomRef).on(ControlEvents.events.join(" "), this._handleEvent.bind(this));
```

When an event fires, `_handleEvent()`:

1. Resolves the target UI5 control from the DOM event target
2. Retrieves pseudo event types via `event.getPseudoTypes()`
3. Dispatches to each control's `on<eventName>` methods
4. Bubbles up the control hierarchy

---

## 2. ControlEvents — UIArea Auto-Delegation

**Module:** `sap/ui/events/ControlEvents` (public since 1.58)

The static `events` array contains 26 base browser events:

```
click        dblclick      contextmenu
focusin      focusout
keydown      keypress      keyup
mousedown    mouseout      mouseover    mouseup
select       selectstart
dragstart    dragenter     dragover     dragleave    dragend    drop
compositionstart    compositionend
paste        cut           input        change
```

Controls implement `on<eventName>(oEvent)` methods to handle these. UIArea registers them once on its root DOM and dispatches via delegation.

**Not in this list:** `pointerdown`, `pointerup`, `pointermove`, `wheel`, `scroll`, `touchstart`, `touchend`. These must be registered explicitly via `attachBrowserEvent()` or `addEventListener()` in `onAfterRendering()`.

**API:**

- `ControlEvents.events` — the array of event names
- `ControlEvents.bindAnyEvent(fn)` — bind callback for ALL events on `document`
- `ControlEvents.unbindAnyEvent(fn)` — unbind callback

---

## 3. PseudoEvents — Semantic Keyboard Events

**Module:** `sap/ui/events/PseudoEvents` (public since 1.58)

Pseudo events are **semantically enriched keyboard events**. They:

- Are classified from `keydown` (or `keypress`/`click`) events
- Are dispatched via UIArea alongside the original event
- Can ONLY be handled via `on<eventName>()` methods — **NOT** via `jQuery.on()`
- Are checked via `event.getPseudoTypes()` and `event.isPseudoType(name)`

### Complete List (51 events)

#### Arrow Navigation

| Event                            | Key        | Modifiers  |
| -------------------------------- | ---------- | ---------- |
| `sapdown` / `sapdownmodifiers`   | ArrowDown  | None / Any |
| `sapup` / `sapupmodifiers`       | ArrowUp    | None / Any |
| `sapleft` / `sapleftmodifiers`   | ArrowLeft  | None / Any |
| `sapright` / `saprightmodifiers` | ArrowRight | None / Any |

#### Page / Home / End

| Event                                  | Key      | Modifiers  |
| -------------------------------------- | -------- | ---------- |
| `saphome` / `saphomemodifiers`         | Home     | None / Any |
| `saptop`                               | Home     | Ctrl only  |
| `sapend` / `sapendmodifiers`           | End      | None / Any |
| `sapbottom`                            | End      | Ctrl only  |
| `sappageup` / `sappageupmodifiers`     | PageUp   | None / Any |
| `sappagedown` / `sappagedownmodifiers` | PageDown | None / Any |

#### Selection / Action

| Event                              | Key(s)         | Modifiers  |
| ---------------------------------- | -------------- | ---------- |
| `sapselect` / `sapselectmodifiers` | Enter OR Space | None / Any |
| `sapspace` / `sapspacemodifiers`   | Space          | None / Any |
| `sapenter` / `sapentermodifiers`   | Enter          | None / Any |

#### Editing

| Event                                    | Key       | Modifiers  |
| ---------------------------------------- | --------- | ---------- |
| `sapbackspace` / `sapbackspacemodifiers` | Backspace | None / Any |
| `sapdelete` / `sapdeletemodifiers`       | Delete    | None / Any |

#### Special

| Event            | Key(s)    | Notes                |
| ---------------- | --------- | -------------------- |
| `sapescape`      | Escape    | No modifier variants |
| `saptabnext`     | Tab       | No Shift             |
| `saptabprevious` | Tab+Shift | Shift only           |

#### Expand / Collapse (Tree)

| Event                                  | Key       | Modifiers  |
| -------------------------------------- | --------- | ---------- |
| `sapexpand` / `sapexpandmodifiers`     | Numpad +  | None / Any |
| `sapcollapse` / `sapcollapsemodifiers` | Numpad -  | None / Any |
| `sapcollapseall`                       | Numpad \* | None       |

#### Show / Hide (Dropdown)

| Event     | Key(s)                       | Notes           |
| --------- | ---------------------------- | --------------- |
| `sapshow` | F4 (no mod) OR Alt+ArrowDown | Opens dropdown  |
| `saphide` | Alt+ArrowUp                  | Closes dropdown |

#### F6 Fast Navigation

| Event            | Key(s)                       | Notes              |
| ---------------- | ---------------------------- | ------------------ |
| `sapskipforward` | F6 OR Ctrl+Alt+ArrowDown     | Forward group nav  |
| `sapskipback`    | Shift+F6 OR Ctrl+Alt+ArrowUp | Backward group nav |

#### RTL-Aware Semantic Events

| Event                                  | LTR Keys              | RTL Keys              |
| -------------------------------------- | --------------------- | --------------------- |
| `sapnext` / `sapnextmodifiers`         | ArrowRight, ArrowDown | ArrowLeft, ArrowDown  |
| `sapprevious` / `sappreviousmodifiers` | ArrowLeft, ArrowUp    | ArrowRight, ArrowUp   |
| `sapincrease` / `sapincreasemodifiers` | ArrowRight, ArrowUp   | ArrowLeft, ArrowUp    |
| `sapdecrease` / `sapdecreasemodifiers` | ArrowLeft, ArrowDown  | ArrowRight, ArrowDown |

#### Miscellaneous

| Event                   | Type     | Notes                                   |
| ----------------------- | -------- | --------------------------------------- |
| `sapminus`              | keypress | `-` character (experimental since 1.25) |
| `sapplus`               | keypress | `+` character (experimental since 1.25) |
| `sapdelayeddoubleclick` | click    | Two clicks 300-1300ms apart             |

---

## 4. EventSimulation — saptouchstart / saptouchend

**Module:** `sap/ui/events/jquery/EventSimulation` (internal, but stable)

### Status: NOT deprecated, still fully supported in OpenUI5 1.144.0

These are **simulated unified touch events** — NOT pseudo events. They are created by `EventSimulation.js` as jQuery special events and dynamically added to `ControlEvents.events`.

### How They Work

The `_createSimulatedEvent()` function:

1. Prefixes event names with `"sap"` → `saptouchstart`, `saptouchend`, `saptouchmove`, `saptouchcancel`
2. Adds them to `ControlEvents.events` dynamically
3. Registers jQuery special event handlers for binding/unbinding
4. Creates corresponding pseudo-event entries

### Mouse-to-Touch Simulation (non-touch devices)

| Simulated Event | Triggered By             |
| --------------- | ------------------------ |
| `saptouchstart` | `mousedown`              |
| `saptouchend`   | `mouseup`, `mouseout`    |
| `saptouchmove`  | `mousemove`, `dragstart` |

The `_handleMouseToTouchEvent()` function constructs synthetic touch objects with properties: `identifier`, `pageX`, `pageY`, `clientX`, `clientY`, `screenX`, `screenY`, `target`, `radiusX`, `radiusY`, `rotationAngle`.

### Touch-to-Mouse Simulation (touch devices)

| Native Touch Event | Simulated Mouse Events                           |
| ------------------ | ------------------------------------------------ |
| `touchstart`       | `mousedown`                                      |
| `touchmove`        | `mousemove` (if movement > 10px)                 |
| `touchend`         | `mouseup` + `click` (if no significant movement) |
| `touchcancel`      | `mouseup`                                        |

### Why KioskKeyboard Uses onsaptouchstart / onsaptouchend

1. **Unified mouse+touch**: Fires for both input types without dual handlers
2. **Proper UI5 integration**: Works with UIArea event delegation
3. **No pointerdown preventDefault trap**: `preventDefault()` on `pointerdown` suppresses ALL compatibility mouse events per the Pointer Events spec, breaking jQuery's `tap` → `vmousedown` → `ontap` chain
4. **Framework-blessed**: Used by UI5 core controls (e.g., `sap.m.RatingIndicator`)

### What NOT to do

```js
// BAD: Creates pointerdown preventDefault trap
this.attachBrowserEvent("pointerdown", handler);

// BAD: Duplicate handling on hybrid devices
ontouchstart(e) { handle(e); }
onmousedown(e) { handle(e); }  // Fires TWICE on touch devices

// GOOD: Unified approach
onsaptouchstart(e) { handle(e); }  // Works for both mouse and touch
onsaptouchend(e) { handle(e); }
```

---

## 5. F6 Fast Navigation

**Module:** `sap/ui/events/F6Navigation` (internal but stable)

F6 enables "fast navigation" between UI5 control groups.

### How It Works

- **F6** triggers `sapskipforward` pseudo event → jumps to next group
- **Shift+F6** triggers `sapskipback` → jumps to previous group
- Groups are marked with `data-sap-ui-fastnavgroup="true"` on DOM elements
- Custom groups use `data-sap-ui-customfastnavgroup="true"` (fires `BeforeFastNavigationFocus` event)
- Navigation cycles: after last group, wraps to first

### Setting Up Groups

```js
// In control's renderer or onAfterRendering:
this.data("sap-ui-fastnavgroup", "true", true); // CustomData approach
```

### Important for HotkeyManager

**F6 is in the disallowed shortcuts list** (see section 7). Our HotkeyManager should warn if someone registers F6 as a hotkey since it conflicts with UI5's built-in fast navigation.

---

## 6. CommandExecution — UI5's Built-in Shortcut System

**Module:** `sap/ui/core/CommandExecution` (public since 1.70)

UI5's official mechanism for application-level keyboard shortcuts.

### Manifest Configuration

```json
{
  "sap.ui5": {
    "commands": {
      "Save": { "shortcut": "Ctrl+S" },
      "Refresh": { "shortcut": "Ctrl+Shift+R" }
    }
  }
}
```

### XML View Usage

```xml
<core:CommandExecution command="Save" execute=".onSave" />
<!-- Or shorthand: -->
<Button press="cmd:Save" />
```

### Three-State Model

| State              | Behavior                                        |
| ------------------ | ----------------------------------------------- |
| Visible + Enabled  | Shortcut executes the handler                   |
| Visible + Disabled | Shortcut consumed (blocked), handler NOT called |
| Not Visible        | Shortcut propagates to parent controls          |

### Critical Limitation: Focus Dependency

**CommandExecution requires focus on a tabbable element.** If no element has focus, the shortcut is NOT intercepted and the browser's default action fires.

From [GitHub Issue #2788](https://github.com/SAP/openui5/issues/2788):

> "We can not provide a stable non-confusing implementation of focus-free shortcuts."

**This is exactly why our HotkeyManager exists.** It uses a document-level `keydown` listener in capture phase, making it focus-independent and able to handle global shortcuts that CommandExecution cannot.

### Shortcut Validation

The `Shortcut` module validates key combinations using a regex:

```
/^([a-z0-9\.,\-\*\/=]|Plus|Tab|Space|Enter|Backspace|Home|Delete|End|
Pageup|Pagedown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Escape|
F[1-9]|F1[0-2])$/i
```

Platform adaptation: `Ctrl` → `Cmd` on macOS.

---

## 7. UI5 Reserved / Disallowed Shortcuts

**Source:** `sap/ui/core/util/ShortcutHelper.js` — `mDisallowedShortcuts`

These shortcuts are **blocked by UI5's CommandExecution** and should also be warned about by our HotkeyManager:

### Browser-Reserved (Cannot Be Intercepted in Chrome)

| Shortcut         | Reason                       |
| ---------------- | ---------------------------- |
| `Ctrl+N`         | New window                   |
| `Ctrl+Shift+N`   | New incognito window         |
| `Ctrl+T`         | New tab                      |
| `Ctrl+Shift+T`   | Reopen last tab              |
| `Ctrl+W`         | Close tab                    |
| `Ctrl+Shift+W`   | Close window                 |
| `Ctrl+Tab`       | Cycle through tabs           |
| `Ctrl+Shift+Tab` | Cycle through tabs (reverse) |
| `Ctrl+PageUp`    | Cycle through tabs           |
| `Ctrl+PageDown`  | Cycle through tabs           |
| `F11`            | Fullscreen                   |
| `F12`            | Browser dev tools            |

### UI5 Framework-Reserved

| Shortcut           | Reason                          |
| ------------------ | ------------------------------- |
| `Ctrl+Alt+Shift+P` | UI5 Technical Info Dialog       |
| `Ctrl+Alt+Shift+S` | UI5 Support Popup (Diagnostics) |
| `Ctrl+Alt+Shift+T` | UI5 Test Recorder               |
| `F6`               | F6-based group navigation       |

### Browser Functional (Overridable But Confusing)

| Shortcut            | Reason                         |
| ------------------- | ------------------------------ |
| `Ctrl+L`            | Jump to address bar            |
| `Ctrl+Q`            | Quit Chrome (Mac)              |
| `Ctrl+0`            | Reset zoom                     |
| `Ctrl+-`            | Zoom out                       |
| `Ctrl++`            | Zoom in                        |
| `Ctrl+Shift+=`      | Cannot be handled consistently |
| `Tab` / `Shift+Tab` | TAB-based keyboard navigation  |

### Additional Validation Rule

Shortcuts with `Shift` modifier + punctuation keys (`., - + = * /`) are blocked because Shift changes the meaning of these keys on many keyboard layouts.

---

## 8. SAP Fiori Elements Standard Shortcuts

Applications should avoid conflicting with these standard Fiori Elements shortcuts:

| Action              | Windows          | macOS           |
| ------------------- | ---------------- | --------------- |
| Save                | Ctrl+S           | Cmd+S           |
| Create              | Ctrl+Enter       | Cmd+Enter       |
| Create with Filters | Ctrl+Shift+Enter | Cmd+Shift+Enter |
| Delete (page)       | Ctrl+Del         | Cmd+Fn+Delete   |
| Delete (table)      | Ctrl+D           | Cmd+D           |
| Edit page           | Ctrl+E           | Cmd+E           |
| Export to Excel     | Ctrl+Shift+E     | Cmd+Shift+E     |
| Go/Search           | Enter            | Enter           |
| Open error list     | Ctrl+Shift+M     | Cmd+Shift+M     |
| Cancel/Discard      | Esc              | Esc             |
| Select row          | Shift+Space      | Shift+Space     |
| Share               | Ctrl+Shift+S     | Cmd+Shift+S     |
| Table settings      | Ctrl+,           | Ctrl+,          |

---

## 9. Focus Handling

**Module:** `sap/ui/core/Element` provides five focus management methods:

| Method                 | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `getFocusDomRef()`     | Returns the DOM node that should receive focus (default: root DOM) |
| `focus()`              | Sets focus using `getFocusDomRef()`                                |
| `getFocusInfo()`       | Serializes focus state to JSON before re-rendering                 |
| `applyFocusInfo(info)` | Restores focus after re-rendering                                  |
| `onfocusfail()`        | Redirects focus when element becomes disabled/hidden/destroyed     |

Re-rendering destroys and recreates DOM nodes. Without `getFocusInfo()`/`applyFocusInfo()`, focus is lost.

**KioskKeyboard implements both** (`getFocusInfo` at line ~426, `applyFocusInfo` at line ~436) to preserve the focused key across re-renders.

---

## 10. ItemNavigation Delegate

**Module:** `sap/ui/core/delegate/ItemNavigation` (public API)

Provides arrow key, Home/End, PageUp/PageDown navigation for list-like controls using a **roving tabindex** pattern.

### Keyboard Events Handled (via pseudo events)

- `onsapnext` / `onsapprevious` — ArrowDown/Right / ArrowUp/Left
- `onsaphome` / `onsapend` — Home / End
- `onsappageup` / `onsappagedown` — PageUp / PageDown
- `onkeyup` (F2) — Toggle between action mode and navigation mode

### Configuration

- `setCycling(boolean)` — wrap at boundaries
- `setColumns(n)` — grid/table layout
- `setPageSize(n)` — enable PageUp/PageDown
- `setTableMode(boolean)` — row/column grid navigation
- `setDisabledModifiers(obj)` — selectively suppress modifier combos

### Relevance to KioskKeyboard

KioskKeyboard implements its own arrow key navigation (`_moveFocus()`) rather than using ItemNavigation because the keyboard layout (rows of varying widths) doesn't fit ItemNavigation's linear or fixed-grid model.

---

## 11. Hybrid Device Handling (Mouse + Touch)

UI5 handles devices supporting both mouse and touch input simultaneously.

### Event Sequence on Touch Tap

```
touchstart → touchend → mousedown → mouseup → click
```

UI5 flags emulated mouse events with `_sapui_delayedMouseEvent` to prevent duplicate handling.

### Rules for Control Developers

1. **Do NOT implement both `onmouse*` and `ontouch*`** — use `onsaptouchstart`/`onsaptouchend` instead
2. For explicit `addEventListener()` registrations, check the delayed mouse event flag:
   ```js
   if (oEvent._sapui_delayedMouseEvent) return; // Skip emulated event
   ```
3. UI5 auto-manages the simulation: `ontouch*` and `ontap*` fire for BOTH mouse and touch

---

## 12. Implications for Our Libraries

### HotkeyManager (`ui5.hotkeys`)

| Aspect                          | Status                 | Notes                                                                                    |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| Document-level capture listener | **Correct**            | Operates below UIArea, independent of focus — solves CommandExecution's focus limitation |
| F6 conflict                     | **Should warn**        | F6 is reserved for fast navigation. Registering F6 as a hotkey breaks accessibility      |
| UI5 tool shortcuts              | **Should warn**        | Ctrl+Alt+Shift+P/S/T are framework-reserved                                              |
| Browser-reserved shortcuts      | **Should warn**        | Ctrl+N/T/W etc. cannot be intercepted in Chrome                                          |
| Fiori Elements conflict         | **Consider warning**   | Ctrl+S, Ctrl+E, Ctrl+D etc. are Fiori standard                                           |
| `keypress` event                | **Not used (correct)** | `keypress` is deprecated per W3C; UI5 uses it only for `sapminus`/`sapplus`              |
| AltGr handling                  | **Correct**            | Properly detected and skipped                                                            |

### KioskKeyboard (`ui5.kiosk`)

| Aspect                            | Status                      | Notes                                                                                   |
| --------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `onsaptouchstart`/`onsaptouchend` | **Correct, not deprecated** | Unified mouse+touch via EventSimulation, proper UI5 pattern                             |
| `apiVersion: 4` renderer          | **Verify**                  | Linter doesn't recognize 4; may need to be 2                                            |
| Focus handling                    | **Correct**                 | Implements `getFocusInfo()`/`applyFocusInfo()`                                          |
| Roving tabindex                   | **Correct**                 | Custom impl (not ItemNavigation) — appropriate for variable-width rows                  |
| F6 group                          | **Missing**                 | Consider `data-sap-ui-fastnavgroup="true"` so F6 navigation can skip over/into keyboard |

### Deprecated API Avoidance (OpenUI5 2.x readiness)

| Deprecated                           | Replacement                   | Our Status                                |
| ------------------------------------ | ----------------------------- | ----------------------------------------- |
| `jQuery.sap.PseudoEvents`            | `sap/ui/events/PseudoEvents`  | N/A (we don't use pseudo events directly) |
| `jQuery.sap.ControlEvents`           | `sap/ui/events/ControlEvents` | N/A                                       |
| `jQuery.sap.keycodes`                | `sap/ui/events/KeyCodes`      | N/A (we use `event.key` strings)          |
| `jQuery.sap.handleF6GroupNavigation` | `sap/ui/events/F6Navigation`  | N/A                                       |
| `UIEvent.which` / `UIEvent.keyCode`  | `KeyboardEvent.key`           | **Correct** — we use `event.key`          |

---

## Sources

### Official Documentation

- [Keyboard Shortcuts for SAPUI5 Tools](https://github.com/SAP-docs/sapui5/blob/main/docs/02_Read-Me-First/keyboard-shortcuts-for-sapui5-tools-154844c.md)
- [Keyboard Handling for SAPUI5 UI Elements](https://github.com/SAP-docs/sapui5/blob/main/docs/04_Essentials/keyboard-handling-for-sapui5-ui-elements-6b741a6.md)
- [Browser Events](https://github.com/SAP-docs/sapui5/blob/main/docs/09_Developing_Controls/browser-events-91f1b38.md)
- [Event Handler Methods](https://github.com/SAP-docs/sapui5/blob/main/docs/09_Developing_Controls/event-handler-methods-bdf3e98.md)
- [Keyboard Usage of ARIA Role Mapped Controls](https://sapui5.hana.ondemand.com/sdk/docs/topics/e6cd5476193f48d1a273de990276c9bc.html)
- [Implementing Focus Handling](https://sapui5.hana.ondemand.com/sdk/docs/topics/91f19f036f4d1014b6dd926db0e91070.html)
- [Mobile Events](https://sapui5.hana.ondemand.com/sdk/docs/topics/9860cd2b183540f48ee054bcef44a8b5.html)
- [Devices Supporting Mouse and Touch](https://sapui5.hana.ondemand.com/sdk/docs/topics/1f9de72bea734beaafa86b80c2c4222c.html)
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

- [CommandExecution focus limitation (#2788)](https://github.com/SAP/openui5/issues/2788)
- [Commands/shortcuts documentation (#20)](https://github.com/SAP/openui5-docs/issues/20)
