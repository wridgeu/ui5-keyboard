# TypeScript and Decorator Setup

## Compiler options

The `kiosk-keyboard-webc` package requires specific TypeScript settings to work correctly with the UI5 Web Components framework. These are defined in `packages/kiosk-keyboard-webc/tsconfig.json`.

### `experimentalDecorators: true`

UI5 Web Components uses **legacy (stage 2) TypeScript decorators**, not the TC39 standard (stage 3) decorators. This flag enables the legacy decorator semantics required by `@customElement`, `@property`, `@event`, and other UI5 WC decorators.

### `useDefineForClassFields: false`

This is **critical**. With `useDefineForClassFields: true` (the default for `target: "ES2022"`), TypeScript emits class fields using `Object.defineProperty`. This breaks UI5 WC's `@property()` decorator because:

1. The decorator creates a getter/setter pair on the prototype for reactivity.
2. `Object.defineProperty` on the instance **shadows** the prototype accessor, making the reactive property inert.

Setting this to `false` uses the legacy "assign" semantics (`this.prop = value` in the constructor), which does **not** shadow the prototype accessor.

### `jsx: "react-jsx"` + `jsxImportSource: "@ui5/webcomponents-base"`

UI5 Web Components uses a preact-based JSX renderer. These settings route JSX transpilation through `@ui5/webcomponents-base/jsx-runtime`, which produces the virtual DOM nodes that `JsxRenderer` expects.

## Decorator patterns

### `@property()` on plain fields

The standard pattern for reactive properties:

```typescript
@property()
layout = "";

@property({ type: Boolean })
docked = false;
```

The decorator intercepts reads/writes to trigger re-renders and reflect to/from HTML attributes. The attribute name is the kebab-case form of the property name (e.g., `keyboardType` → `keyboard-type`).

### `@property()` on getter/setter pairs

Used when a property change has **side effects** (e.g., opening/closing the keyboard). This follows the same pattern used by `@ui5/webcomponents` [Popup](https://github.com/SAP/ui5-webcomponents/blob/main/packages/main/src/Popup.ts) / [Dialog](https://github.com/SAP/ui5-webcomponents/blob/main/packages/main/src/Dialog.ts) for their `open` property:

```typescript
// Plain backing field (NOT decorated — no reactivity of its own)
_open = false;

@property({ type: Boolean })
set open(value: boolean) {
  if (this._open === value) return;
  this._open = value;
  if (!this.isConnected) return; // deferred to onEnterDOM
  if (value) {
    this._performOpen();
  } else {
    this._performClose();
  }
}

get open(): boolean {
  return this._open;
}
```

Key points:

- The `@property()` decorator goes on the **setter** (not the getter).
- The backing field (`_open`) is a plain class field — it holds the actual state.
- The setter guards against no-ops (`=== value`) and handles pre-connection state (`!this.isConnected`).
- Side effects (event dispatch, inputmode suppression) live in dedicated methods called from the setter.
- `onEnterDOM` checks the backing field and runs side effects for values set before DOM connection.
- `onExitDOM` manipulates the backing field directly (since `isConnected` is `false` at that point).

### `@event()` declarations

Events are declared with the `event-strict` decorator and typed via `eventDetails`:

```typescript
@event("key-press", { bubbles: true, cancelable: true })
@event("after-open", { bubbles: true })
export default class KioskKeyboard extends UI5Element {
  eventDetails!: {
    "key-press": KeyPressEventDetail;
    "after-open": void;
  };
}
```

The `!:` (definite assignment assertion) is the canonical pattern used by all official UI5 Web Components (see [Button.ts](https://github.com/SAP/ui5-webcomponents/blob/main/packages/main/src/Button.ts), [Popup.ts](https://github.com/SAP/ui5-webcomponents/blob/main/packages/main/src/Popup.ts), [Input.ts](https://github.com/SAP/ui5-webcomponents/blob/main/packages/main/src/Input.ts)). Do **not** use `declare eventDetails:` — `declare` emits no runtime field and may interact differently with the framework's type checking.

Events are fired via `this.fireDecoratorEvent("key-press", detail)` (not the deprecated `fireEvent()`), which returns `false` if `preventDefault()` was called (for cancelable events). See the [UI5 Web Components development docs](https://ui5.github.io/webcomponents/docs/advanced/) for current API reference.

**Deprecated patterns to avoid:**

- `import event from ".../decorators/event.js"` → use `event-strict.js` instead
- `this.fireEvent("name", data, cancelable, bubbles)` → use `this.fireDecoratorEvent("name", data)` (bubbles/cancelable are read from the decorator metadata automatically)

## UI5 bridge integration

When consuming the web component in a UI5 XML view via `WebComponent.extend()`:

- `mapping: { type: "property", to: "attribute-name" }` renders the value as an **HTML attribute** on the custom element tag. The `@property()` decorator's attribute observation picks it up and reflects it to the JS property.
- Only `object`-type mappings set JS properties directly.
- For properties that are `@property()`-decorated getter/setter pairs (like `open`), the attribute change triggers `attributeChangedCallback` → the setter runs → side effects execute. This is why `open` works correctly through the bridge.
- Methods listed in the bridge's `methods` array are forwarded as-is to the DOM element.
