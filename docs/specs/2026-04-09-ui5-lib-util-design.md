# ui5-lib-util Design Specification

**Date:** 2026-04-09
**Status:** Draft
**Target UI5 Version:** OpenUI5 1.120+
**Target Node.js:** >= 22

## 1. Overview

`ui5-lib-util` is a collection of battle-tested UI5 utility patterns, packaged as a single
OpenUI5 library. These are solutions to problems commonly encountered in UI5 application
development -- dialog lifecycle management, centralized messaging, sequential message box
display, WebSocket communication, OData V2 promise wrapping, and focus management.

While consumable as a library dependency, this project is equally a reference implementation.
Developers are encouraged to extract individual modules into their own applications or
libraries as needed.

### What this is not

This is not a tightly coupled framework. Each module is independent and can be used in
isolation. The library packaging is a deliberate choice for convenience -- these utilities
are often used together, and a single dependency is simpler than six.

## 2. Repository Structure

```
ui5-lib-util/
  package.json                         # name: "ui5-lib-util", workspaces: ["packages/*"]
  tsconfig.json
  commitlint.config.mjs
  lint-staged.config.mjs
  release-please-config.json
  README.md
  packages/
    lib/
      package.json                     # name: "ui5-lib-util"
      ui5.yaml                         # metadata.name: ui5.util
      tsconfig.json
      src/
        library.ts
        manifest.json
        dialog/
          DialogManager.ts
          DialogProvider.ts
          DialogControllerExtension.ts
          AbstractDialogController.ts
          types.ts
        messaging/
          MessageHandler.ts
          types.ts
        messageBoxSequencer/
          MessageBoxSequencer.ts
        websocket/
          WebSocketService.ts
          WebSocketEventFacade.ts
          RetryStrategy.ts
          types.ts
        odata/
          ODataV2ModelPromisifier.ts
          types.ts
        focus/
          FocusHandler.ts
      test/
        qunit/
          testsuite.qunit.ts
          Test.qunit.html
          wdio.conf.ts
          dialog/
            DialogProvider.qunit.ts
            DialogManager.qunit.ts
            DialogControllerExtension.qunit.ts
          messaging/
            MessageHandler.qunit.ts
          messageBoxSequencer/
            MessageBoxSequencer.qunit.ts
          websocket/
            WebSocketService.qunit.ts
            RetryStrategy.qunit.ts
          odata/
            ODataV2ModelPromisifier.qunit.ts
          focus/
            FocusHandler.qunit.ts
    demo-app/
      package.json                     # name: "demo-util-app", depends on "ui5-lib-util"
      ui5.yaml
      webapp/
        Component.ts
        manifest.json
        controller/
        view/
        view/dialogs/
        controller/dialogs/
```

### Naming

| Aspect            | Value                                         |
| ----------------- | --------------------------------------------- |
| Folder            | `ui5-lib-util`                                |
| npm package       | `ui5-lib-util`                                |
| UI5 namespace     | `ui5.util`                                    |
| Module namespaces | `ui5.util.dialog`, `ui5.util.messaging`, etc. |

### Tooling

| Tool                      | Version |
| ------------------------- | ------- |
| UI5 CLI                   | ~4.0.x  |
| UI5 Tooling specVersion   | 4.0     |
| ui5-tooling-transpile     | ~3.11.x |
| TypeScript                | ~6.0.x  |
| Node.js                   | >= 22   |
| OpenUI5 framework version | 1.120.x |

### ui5.yaml (library)

```yaml
specVersion: "4.0"
metadata:
  name: ui5.util
type: library
framework:
  name: OpenUI5
  version: "1.120.0"
  libraries:
    - name: sap.ui.core
    - name: sap.m
builder:
  resources:
    excludes:
      - "/test-resources/**"
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        omitTSFromBuildResult: true
        transformTypeScript:
          allowDeclareFields: true
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transformTypeScript:
          allowDeclareFields: true
```

### library.ts

```typescript
import Lib from "sap/ui/core/Lib";

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.util",
  version: "${version}",
  dependencies: ["sap.ui.core", "sap.m"],
  types: [],
  interfaces: [],
  controls: [],
  elements: [],
  noLibraryCSS: true,
});

export default library;
```

## 3. Module: dialog

### Purpose

Manages the full lifecycle of fragment-based overlays (Dialog, Popover, ResponsivePopover):
dynamic loading, controller creation, event handler deferral, dependency ownership, caching,
and cleanup. Consumers define their own fragments and controllers; the library handles the
wiring.

### Components

#### TDialogConfiguration (types.ts)

Consumer-defined plain object describing a dialog:

```typescript
interface TDialogConfiguration {
  /** Fragment name relative to component namespace + fragmentBasePath */
  fragmentName: string;
  /** Controller name relative to component namespace + controllerBasePath (omit to use parent controller) */
  controllerName?: string;
  /** Events that trigger dialog close (default: ["afterClose"]) */
  closeEvents?: string[];
  /** Cache mode: "destroy" recreates on each open, "reuse" caches and re-calls onData() */
  cacheMode?: "destroy" | "reuse";
  /** Where to call addDependent(): "rootView" (default), "control", or "none" */
  dependentTarget?: "rootView" | "control" | "none";
}
```

#### DialogManager

Component-scoped orchestrator. Created in `Component.init()`.

```typescript
import BaseObject from "sap/ui/base/Object";

interface DialogManagerOptions {
  /** Path prefix for fragment resolution (default: "view/dialogs") */
  fragmentBasePath?: string;
  /** Path prefix for controller resolution (default: "controller/dialogs") */
  controllerBasePath?: string;
}

interface DialogOpenProperties {
  /** Unique ID for this dialog instance */
  id: string;
  /** Root view for dependent management and ID scoping */
  rootView: View;
  /** Data to pass to the dialog controller's onData() */
  data?: object | Context | BaseObject | null;
  /** Dialog configuration */
  configuration: TDialogConfiguration;
  /** Control to dock a Popover/ResponsivePopover to */
  dockingControl?: Element;
}
```

**Responsibilities:**

- Resolves fragment and controller module IDs from the consumer's component manifest
  namespace combined with the configured base paths
- Maintains a `Map<string, DialogProvider>` of active/cached dialogs
- Creates `DialogProvider` instances on `open()`, returns it for fluent `.on()` chaining
- Handles `"destroy"` mode: removes from map on CLOSE, provider destroys fragment + controller
- Handles `"reuse"` mode: keeps provider in map, re-calls `onData()` with new data on re-open
- `destroy()`: cleans up all open/cached dialogs (called from `Component.exit()`)

**Namespace resolution logic:**

```
Component manifest namespace: "com.example.myapp"
fragmentBasePath: "view/dialogs"
controllerBasePath: "controller/dialogs"
fragmentName: "CreateMember"

Resolved fragment module ID: "com.example.myapp.view.dialogs.CreateMember"
Resolved controller module ID: "com.example.myapp.controller.dialogs.CreateMemberController"
```

The component namespace is read from `component.getManifestEntry("/sap.app/id")`.

#### DialogProvider

Lifecycle manager for a single dialog instance. Extends `sap/ui/base/EventProvider`.

**Responsibilities:**

- Loads fragment via `Fragment.load()` (returns `Promise<Control | Control[]>`)
- Optionally loads controller via `Controller.create()` (since 1.56)
- Manages deferred event handlers (simple array approach)
- Detects overlay type and calls appropriate open method:
  - `Dialog`: `dialog.open()`
  - `Popover`: `popover.openBy(dockingControl)`
  - `ResponsivePopover`: `responsivePopover.openBy(dockingControl)`
- Manages `addDependent()` based on `dependentTarget` configuration
- Orchestrates controller lifecycle: `onInit()`, `onData()`, `onBeforeRendering()`,
  `onAfterRendering()`, `onExit()`
- Handles close: detaches events, removes dependent, destroys (or caches), fires CLOSE

**Lifecycle events (consistent across Dialog/Popover/ResponsivePopover):**

- `beforeOpen`, `afterOpen`, `beforeClose`, `afterClose`

**Fluent event API:**

```typescript
/** Attach one-time handler. Deferred if dialog not yet open. */
public on(eventType: string, callback: (event?: Event) => void): this;

/** Attach persistent handler. Survives across multiple event firings. */
public onPersistent(eventType: string, callback: (event?: Event) => void): this;
```

**Deferred event handler implementation:**

```typescript
type DeferredEventHandler = {
  eventType: string;
  callback: (event?: Event) => void;
  persistent?: boolean;
};

// In on() / onPersistent():
if (this.isOpened) {
  // Dialog exists, attach immediately
  handler.persistent ? this.dialog.attachEvent(eventType, callback) : this.dialog.attachEventOnce(eventType, callback);
} else {
  // Store for later attachment in open()
  this.deferredEventHandlers.push({ eventType, callback, persistent });
}
```

#### DialogControllerExtension

Composition-based approach for dialog controllers. Extends `sap/ui/core/mvc/ControllerExtension`.

```typescript
import ControllerExtension from "sap/ui/core/mvc/ControllerExtension";
import OverrideExecution from "sap/ui/core/mvc/OverrideExecution";

export default class DialogControllerExtension extends ControllerExtension {
  static readonly metadata = {
    methods: {
      onDialogOpened: { public: true, final: false, overrideExecution: OverrideExecution.After },
      onDialogClosed: { public: true, final: false, overrideExecution: OverrideExecution.After },
    },
  };

  static readonly overrides = {
    onExit: function (this: DialogControllerExtension) {
      // Cleanup
    },
  };
}
```

**Provided methods:**

- `fireDialogEvent(control, settings)` -- fires custom event on a control
- `fireSaveEvent(control, source, updateFields)` -- convenience for SAVE
- `fireCreateEvent(control, data)` -- convenience for CREATE
- `fireCancelEvent(control)` -- convenience for CANCEL
- `fireDeleteEvent(control, data)` -- convenience for DELETE
- `fireEditEvent(control, data)` -- convenience for EDIT
- `fragmentById<T>(fragmentId, controlId)` -- ID-scoped control lookup via `Fragment.byId()`
- `onDialogOpened()` -- overridable hook
- `onDialogClosed()` -- overridable hook

**Consumer usage (composition):**

```typescript
import ControllerExtension from "sap/ui/core/mvc/ControllerExtension";
import DialogControllerExtension from "ui5/util/dialog/DialogControllerExtension";

export default class MyDialogController extends Controller {
  dialogSupport = ControllerExtension.use(DialogControllerExtension);

  onSave() {
    const data = this.collectFormData();
    this.dialogSupport.fireSaveEvent(this.byId("myDialog"), null, data);
  }
}
```

#### AbstractDialogController

Inheritance-based approach. Independent from `DialogControllerExtension` -- these are two
separate options for consumers, not layered on top of each other. Both provide the same
convenience methods (`fireDialogEvent`, `fireSaveEvent`, etc.) with their own implementations.
The underlying logic is thin (event firing via `control.fireEvent()` and ID-scoped lookup
via `Fragment.byId()`), so there is no meaningful duplication concern.

```typescript
import Controller from "sap/ui/core/mvc/Controller";

export default abstract class AbstractDialogController extends Controller {
  protected ownerComponent!: Component;
  protected fragmentId!: string;

  // Lifecycle hooks with default empty implementations
  public onInit(): void {}
  public onBeforeRendering(): void {}
  public onAfterRendering(): void {}
  public onExit(): void {}

  // Abstract -- must be implemented by subclasses
  public abstract onData(data: object | Context): void | Promise<void>;

  // Event firing convenience methods (own implementation)
  protected fireDialogEvent(control: Control, settings: {
    eventId: string;
    parameters?: object;
    allowPreventDefault?: boolean;
    enableEventBubbling?: boolean;
  }): void {
    control.fireEvent(settings.eventId, settings.parameters,
      settings.allowPreventDefault, settings.enableEventBubbling);
  }
  protected fireSaveEvent(control: Control, source: Context | null, updateFields: object): void { ... }
  protected fireCreateEvent(control: Control, data: object): void { ... }
  protected fireCancelEvent(control: Control): void { ... }
  protected fireDeleteEvent(control: Control, data: Context | null): void { ... }
  protected fireEditEvent(control: Control, data: Context | null): void { ... }

  // ID-scoped control lookup
  protected fragmentById<T extends Element>(id: string): T {
    return Fragment.byId(this.fragmentId, id) as T;
  }

  // Component and ResourceBundle access
  public setOwnerComponent(component: Component): void { this.ownerComponent = component; }
  public getOwnerComponent(): Component { return this.ownerComponent; }
  public setFragmentId(id: string): void { this.fragmentId = id; }
  protected async getResourceBundle(): Promise<ResourceBundle> { ... }
}
```

**Consumer usage (inheritance):**

```typescript
import AbstractDialogController from "ui5/util/dialog/AbstractDialogController";
import type Context from "sap/ui/model/Context";

export default class CreateItemController extends AbstractDialogController {
  public onData(data: Context): void {
    // Receive data, populate form
  }

  public onSavePress(): void {
    const formData = this.collectFormData();
    this.fireCreateEvent(this.byId("dialog"), formData);
  }

  public onCancelPress(): void {
    this.fireCancelEvent(this.byId("dialog"));
  }
}
```

### UI5 APIs used (dialog module)

| API                         | Import                                | Since             | Replaces                               |
| --------------------------- | ------------------------------------- | ----------------- | -------------------------------------- |
| `Fragment.load()`           | `sap/ui/core/Fragment`                | 1.58              | `sap.ui.xmlfragment()`                 |
| `Fragment.byId()`           | `sap/ui/core/Fragment`                | 1.58              | `sap.ui.core.Fragment.byId()` (global) |
| `Controller.create()`       | `sap/ui/core/mvc/Controller`          | 1.56              | `sap.ui.controller()`                  |
| `ControllerExtension`       | `sap/ui/core/mvc/ControllerExtension` | 1.56              | N/A                                    |
| `ControllerExtension.use()` | `sap/ui/core/mvc/ControllerExtension` | Babel plugin 7.5+ | N/A                                    |
| `OverrideExecution`         | `sap/ui/core/mvc/OverrideExecution`   | 1.56              | N/A                                    |
| `EventProvider`             | `sap/ui/base/EventProvider`           | 1.0               | N/A                                    |
| `BaseObject`                | `sap/ui/base/Object`                  | 1.0               | N/A                                    |

## 4. Module: messaging

### Purpose

Centralized, component-scoped message handling with i18n support, display mode control,
HTTP error categorization, and integration with UI5's global `MessageModel`.

### Key design decisions

**Component-scoped, not singleton:** each component creates its own `MessageHandler` instance.
This is critical for Fiori launchpad scenarios where multiple applications coexist. The
handler's i18n ResourceBundle, logger, and lifecycle are tied to its owning component.

**Global MessageModel integration:** while the handler instance is component-scoped, it reads
from and writes to UI5's central `MessageModel` via `sap/ui/core/Messaging`. This is by design
and matches how SAP's own Fiori elements work. Any `MessagePopover` or `MessageView` bound to
`{message>/}` picks up messages regardless of which component created them.

**i18n binding syntax:** the handler accepts `"{i18n>key.path}"` binding syntax for IDE
support and key resolution. The parsing uses `BindingParser.simpleParser()` from
`sap/ui/base/BindingParser` to extract the key path from the binding expression.

**Note:** `BindingParser.simpleParser()` is not a public API. It is an internal/undocumented
UI5 API that could change without notice. This is a known dependency accepted for its
convenience and reliability (it handles edge cases that a simple regex would miss). If this
API is removed or changed in a future UI5 version, a regex-based fallback can be substituted.

```typescript
private parseI18nBinding(binding: string | undefined): string | undefined {
  if (!binding) return undefined;
  const bindingInfo = BindingParser.simpleParser(binding) as
    { path: string; model?: string } | undefined;
  if (bindingInfo?.path) {
    if (bindingInfo.model && bindingInfo.model !== "i18n") {
      Log.warning(`Expected i18n model but got "${bindingInfo.model}"`);
    }
    return bindingInfo.path;
  }
  return binding; // Plain key fallback
}
```

### MessageHandler API

```typescript
import BaseObject from "sap/ui/base/Object";

export default class MessageHandler extends BaseObject {
  constructor(component: Component);

  // Unified display
  show(options: IShowOptions): void;

  // Convenience methods (each has a default displayMode)
  showError(messageKey: string, options?: IShowMethodOptions): void; // default: BOX
  showWarning(messageKey: string, options?: IShowMethodOptions): void; // default: BOX
  showSuccess(messageKey: string, options?: IShowMethodOptions): void; // default: TOAST
  showInfo(messageKey: string, options?: IShowMethodOptions): void; // default: TOAST

  // MessageModel integration
  addMessage(options: IAddMessageOptions): Message;
  removeMessages(messages: Message | Message[]): void;
  clearMessages(): void;
  getMessageModel(): MessageModel;

  // HTTP error handling with categorization
  handleHttpError(error: IHttpError, messageKey: string, options?: IHttpErrorOptions): void;

  // Confirmation dialogs
  confirm(options: IConfirmOptions): void;
}
```

### Types

```typescript
export enum ErrorCategory {
  NETWORK = "NETWORK", // status 0
  AUTHENTICATION = "AUTHENTICATION", // 401
  AUTHORIZATION = "AUTHORIZATION", // 403
  NOT_FOUND = "NOT_FOUND", // 404
  VALIDATION = "VALIDATION", // 422
  BUSINESS_LOGIC = "BUSINESS_LOGIC", // 4xx other
  TECHNICAL = "TECHNICAL", // 5xx
  UNKNOWN = "UNKNOWN",
}

export enum MessageDisplayMode {
  POPOVER = "POPOVER", // Non-intrusive, MessagePopover only
  BOX = "BOX", // Modal MessageBox
  TOAST = "TOAST", // Transient MessageToast
}

export interface IShowOptions {
  type: MessageType;
  messageKey: string;
  messageArgs?: string[];
  titleKey?: string;
  displayMode?: MessageDisplayMode;
  persist?: boolean;
  group?: string;
  descriptionKey?: string;
}

export type IShowMethodOptions = Partial<Omit<IShowOptions, "type" | "messageKey">> & {
  error?: unknown; // Auto-logged with stack trace (showError only)
};

export interface IAddMessageOptions {
  type: MessageType;
  messageKey: string;
  messageArgs?: string[];
  descriptionKey?: string;
  target?: string;
  persistent?: boolean;
  group?: string;
}

export interface IHttpError extends Error {
  status?: number;
  statusCode?: number;
  statusText?: string;
}

export interface IHttpErrorOptions extends IShowMethodOptions {
  logToConsole?: boolean; // default: true
}

export interface IConfirmOptions {
  messageKey: string;
  titleKey?: string;
  actions: string[]; // i18n bindings for action labels
  emphasizedAction?: number; // index of emphasized action (default: 0)
  onClose: (selectedIndex: number) => void; // -1 for cancel/close
}
```

### Component integration

```typescript
import MessageHandler from "ui5/util/messaging/MessageHandler";

export default class Component extends UIComponent {
  private messageHandler!: MessageHandler;

  public init(): void {
    super.init();
    this.messageHandler = new MessageHandler(this);
    this.setModel(this.messageHandler.getMessageModel(), "message");
  }

  public getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  public exit(): void {
    this.messageHandler.destroy();
  }
}
```

The demo-app includes a `MessagePopoverButton.fragment.xml` as a reference for wiring up the
popover UI. This is a view-layer concern and lives in the demo-app, not the library.

### UI5 APIs used (messaging module)

| API                            | Import                            | Since | Replaces                                                             |
| ------------------------------ | --------------------------------- | ----- | -------------------------------------------------------------------- |
| `Messaging`                    | `sap/ui/core/Messaging`           | 1.118 | `sap.ui.getCore().getMessageManager()`                               |
| `Message`                      | `sap/ui/core/message/Message`     | 1.0   | N/A                                                                  |
| `MessageType`                  | `sap/ui/core/message/MessageType` | 1.0   | N/A                                                                  |
| `MessageBox`                   | `sap/m/MessageBox`                | 1.0   | N/A                                                                  |
| `MessageToast`                 | `sap/m/MessageToast`              | 1.0   | N/A                                                                  |
| `Log`                          | `sap/base/Log`                    | 1.58  | `jQuery.sap.log`                                                     |
| `BindingParser.simpleParser()` | `sap/ui/base/BindingParser`       | 1.0   | **Internal API** -- not public, used for i18n binding syntax parsing |
| `BaseObject`                   | `sap/ui/base/Object`              | 1.0   | N/A                                                                  |

## 5. Module: messageBoxSequencer

### Purpose

Ensures `MessageBox` dialogs are shown one at a time in FIFO order. When a MessageBox is
already open, subsequent calls are queued and shown sequentially as each is closed.

### MessageBoxSequencer API

```typescript
import BaseObject from "sap/ui/base/Object";
import type { MessageBoxOptions } from "sap/m/MessageBox";

export default class MessageBoxSequencer extends BaseObject {
  constructor();

  /** Queue or show a message. If a MessageBox is open, message is queued. */
  handleMessage(message: string, options?: MessageBoxOptions): void;

  /** Destroy the sequencer, clear queue, clean up. */
  destroy(): void;
}
```

### Internal design

- Maintains a FIFO queue: `Array<{ message: string; options?: MessageBoxOptions }>`
- Generates a unique dialog ID per instance (e.g., `__MessageBoxSequencer-${uid}`) to
  avoid collisions when multiple components each have their own sequencer
- Uses `InstanceManager.getOpenDialogs()` to find the active MessageBox by ID
- Attaches `afterClose` handler via `EventProvider.hasListener()` guard to prevent
  duplicate attachment
- On close: shifts next message from queue, calls `handleMessage()` recursively

### Component integration

```typescript
import MessageBoxSequencer from "ui5/util/messageBoxSequencer/MessageBoxSequencer";

export default class Component extends UIComponent {
  private messageBoxSequencer!: MessageBoxSequencer;

  public init(): void {
    super.init();
    this.messageBoxSequencer = new MessageBoxSequencer();
  }

  public getMessageBoxSequencer(): MessageBoxSequencer {
    return this.messageBoxSequencer;
  }

  public exit(): void {
    this.messageBoxSequencer.destroy();
  }
}
```

### UI5 APIs used (messageBoxSequencer module)

| API               | Import                      | Since | Replaces |
| ----------------- | --------------------------- | ----- | -------- |
| `MessageBox`      | `sap/m/MessageBox`          | 1.0   | N/A      |
| `InstanceManager` | `sap/m/InstanceManager`     | 1.0   | N/A      |
| `EventProvider`   | `sap/ui/base/EventProvider` | 1.0   | N/A      |
| `BaseObject`      | `sap/ui/base/Object`        | 1.0   | N/A      |

## 6. Module: websocket

### Purpose

Reusable WebSocket communication service with event-driven architecture, automatic
reconnection via exponential backoff, and a typed eventing facade. Wraps UI5's
`sap.ui.core.ws.WebSocket` and `sap.ui.core.ws.SapPcpWebSocket`.

### Components

#### WebSocketService

```typescript
import EventProvider from "sap/ui/base/EventProvider";

export default class WebSocketService extends EventProvider {
  constructor();

  /** Establish a WebSocket connection. */
  setupConnection(url: string, usePCP?: boolean): void;

  /** Whether a connection is currently active. */
  isConnected(): boolean;

  /** Send a message payload. */
  send(payload: string): void;

  /** Close the connection (normal closure, no reconnect). */
  close(): void;

  /** Get the typed eventing facade. */
  getEventingFacade(): WebSocketEventFacade;

  /** Register a custom action handler. */
  registerAction(actionName: string, handler: (data: unknown) => void): void;

  /** Unregister an action handler. */
  unregisterAction(actionName: string): void;

  /** Set a custom message parser. */
  setMessageParser(parser: (rawData: string) => ParsedMessage | null): void;

  destroy(): void;
}
```

**Fired events:** `open`, `close`, `error`, `message` (unhandled actions),
`retryScheduled`, `retryMaxAttemptsReached`, `retryReset`

**Custom message parser:**

```typescript
interface ParsedMessage {
  action: string;
  data: unknown;
}

// Default parser: expects JSON with pcpFields.action
// Consumer can replace entirely:
wsService.setMessageParser((rawData: string) => {
  const parsed = JSON.parse(rawData);
  return { action: parsed.type, data: parsed.payload };
});
```

**Dynamic action registry:**

```typescript
// Register handlers for specific actions
wsService.registerAction("NOTIFICATION", (data) => {
  /* handle */
});
wsService.registerAction("STATUS_UPDATE", (data) => {
  /* handle */
});

// Unregister when no longer needed
wsService.unregisterAction("NOTIFICATION");
```

#### RetryStrategy

Exponential backoff with jitter for reconnection scheduling. Stays within the websocket
module.

```typescript
import EventProvider from "sap/ui/base/EventProvider";

interface RetryStrategySettings {
  initialDelay?: number; // default: 1000
  maxDelay?: number; // default: 16000
  maxAttempts?: number; // default: 10
  maxJitter?: number; // default: 3000
}

export default class RetryStrategy extends EventProvider {
  constructor(settings?: RetryStrategySettings);

  /** Schedule a retry. Returns false when max attempts reached. */
  schedule(fn: () => void): boolean;

  /** Reset to initial state (call after successful connection). */
  reset(): void;

  /** Cancel pending retry without resetting counters. */
  cancel(): void;

  /** Current attempt count. */
  getAttempts(): number;

  destroy(): void;
}
```

**Fired events:** `scheduled` (params: `attempt`, `delay`), `maxAttemptsReached`
(params: `attempts`), `reset`

#### WebSocketEventFacade

Typed convenience layer over `EventProvider.attachEvent()` for cleaner consumer code.

### Component integration

```typescript
import WebSocketService from "ui5/util/websocket/WebSocketService";

export default class Component extends UIComponent {
  private wsService!: WebSocketService;

  public init(): void {
    super.init();
    this.wsService = new WebSocketService();
  }

  public getWebSocketService(): WebSocketService {
    return this.wsService;
  }

  public exit(): void {
    this.wsService.destroy();
  }
}

// In a controller after login/connection URL is known:
const ws = this.getOwnerComponent().getWebSocketService();
ws.registerAction("NOTIFICATION", (data) => this.showNotification(data));
ws.setupConnection("/sap/bc/apc/my_channel");
```

### UI5 APIs used (websocket module)

| API               | Import                           | Since | Replaces         |
| ----------------- | -------------------------------- | ----- | ---------------- |
| `WebSocket`       | `sap/ui/core/ws/WebSocket`       | 1.0   | N/A              |
| `SapPcpWebSocket` | `sap/ui/core/ws/SapPcpWebSocket` | 1.28  | N/A              |
| `EventProvider`   | `sap/ui/base/EventProvider`      | 1.0   | N/A              |
| `Log`             | `sap/base/Log`                   | 1.58  | `jQuery.sap.log` |

## 7. Module: odata

### Purpose

Wraps the callback-based `sap.ui.model.odata.v2.ODataModel` API with Promises, providing
a modern async/await interface for CRUD operations and function imports.

### ODataV2ModelPromisifier API

```typescript
import BaseObject from "sap/ui/base/Object";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";

export default class ODataV2ModelPromisifier extends BaseObject {
  /** Pre-defined batch group ID for out-of-order batching. */
  static readonly GROUP_ID_OUT_OF_ORDER_BATCHING = "OUT_OF_ORDER_BATCHING";

  constructor(model: ODataModel);

  /** Access the underlying OData model. */
  getModel(): ODataModel;

  /** Promisified read. */
  read<T = unknown>(path: string, parameters?: ReadParameters): Promise<T>;

  /** Promisified create. */
  create<T = unknown>(path: string, data: object, parameters?: WriteParameters): Promise<T>;

  /** Promisified update. */
  update<T = unknown>(path: string, data: object, parameters?: WriteParameters): Promise<T>;

  /** Promisified remove. */
  remove(path: string, parameters?: WriteParameters): Promise<void>;

  /** Promisified function import call with deferred group support. */
  callFunction<T = unknown>(functionName: string, parameters?: FunctionParameters): Promise<T>;

  destroy(): void;
}
```

### Types

```typescript
export enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH", // MERGE in OData V2
  DELETE = "DELETE",
}

interface ReadParameters {
  urlParameters?: Record<string, string>;
  filters?: Filter[];
  sorters?: Sorter[];
}

interface WriteParameters {
  urlParameters?: Record<string, string>;
  groupId?: string;
}

interface FunctionParameters {
  httpMethod?: HTTPMethod; // default: GET
  urlParameters?: Record<string, string>;
  groupId?: string;
}
```

### Method forwarding

The promisifier forwards selected non-promisified methods directly to the underlying model
for convenience. The list of forwarded methods is configurable:

```typescript
// Default forwarded methods
const FORWARDED_METHODS = ["createKey", "getProperty", "setProperty"] as const;

// Consumer can extend at construction:
const odataService = new ODataV2ModelPromisifier(model, {
  forwardMethods: [...FORWARDED_METHODS, "refresh", "resetChanges"],
});
```

### Component integration

```typescript
import ODataV2ModelPromisifier from "ui5/util/odata/ODataV2ModelPromisifier";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";

export default class Component extends UIComponent {
  private odataService!: ODataV2ModelPromisifier;

  public init(): void {
    super.init();
    const model = this.getModel() as ODataModel;
    this.odataService = new ODataV2ModelPromisifier(model);
  }

  public getODataService(): ODataV2ModelPromisifier {
    return this.odataService;
  }
}

// Controller usage
const result = await this.getOwnerComponent()
  .getODataService()
  .read<MyEntity[]>("/EntitySet", { filters: [myFilter] });
```

### UI5 APIs used (odata module)

| API                      | Import                             | Since | Replaces |
| ------------------------ | ---------------------------------- | ----- | -------- |
| `ODataModel` (type only) | `sap/ui/model/odata/v2/ODataModel` | 1.0   | N/A      |
| `Filter` (type only)     | `sap/ui/model/Filter`              | 1.0   | N/A      |
| `Sorter` (type only)     | `sap/ui/model/Sorter`              | 1.0   | N/A      |
| `BaseObject`             | `sap/ui/base/Object`               | 1.0   | N/A      |

## 8. Module: focus

### Purpose

Manages focus in scenarios where UI5's built-in `FocusHandler` is insufficient -- primarily
when the target control's DOM is not yet ready (async fragment loading, view navigation,
dialog content rendering).

### Background: UI5's native focus handling

UI5 has a built-in `FocusHandler` (internal, `sap/ui/core/FocusHandler`) that automatically
saves and restores focus across re-rendering cycles via `getFocusInfo()` / `applyFocusInfo()`.
For standard re-render scenarios, this is sufficient.

However, there are well-documented timing gaps:

- **Async module loading:** controls like SimpleForm load layout modules asynchronously;
  the target control's DOM may not exist when `onAfterRendering` fires
- **Dialog/Popover DOM slotting:** footer elements may not be fully rendered when
  `onAfterRendering` fires; UI5's own `Dialog` uses `setTimeout(applyInitialFocus, 0)`
  internally for this reason
- **View navigation:** cached views may not trigger `onAfterRendering` at all;
  `routePatternMatched` must be used instead, often with a deferred focus call

This module addresses these gaps.

### FocusHandler API

```typescript
import BaseObject from "sap/ui/base/Object";
import type View from "sap/ui/core/mvc/View";
import type Element from "sap/ui/core/Element";

export default class FocusHandler extends BaseObject {
  constructor(view: View);

  /**
   * Queue focus for end of current event loop tick.
   * Multiple calls in the same tick: last one wins.
   * Uses control.focus() (the UI5 API), never raw DOM focus.
   */
  set(element: string | Element, addDelay?: boolean): void;

  /** Immediate focus, bypasses queue. */
  force(element: string | Element): void;

  /** Blur the currently focused element. */
  clear(): void;

  /** Debug: returns array of queued element IDs, optionally logs on next flush. */
  trace(logOnFlush?: boolean): string[];

  destroy(): void;
}
```

### Internal design

- Accepts control IDs (string) or control instances
- String IDs resolved via `view.byId()` with `Element.getElementById()` (since 1.119) fallback
- Calls `control.focus()` -- the UI5 API that delegates to `getFocusDomRef()` and handles
  browser quirks (Safari scroll position, etc.)
- If a control supports `getValue()` and `selectText()`, auto-selects text on focus
- Uses `setTimeout(fn, 0)` for `set()` (defers to after current rendering cycle) and
  `setTimeout(fn, 1000)` when `addDelay=true` (for heavy async scenarios)
- Stack-based: multiple `set()` calls queue up, only the last one receives focus when the
  timeout fires
- `Element.getActiveElement()` (since 1.119) used for checking current focus state

### Component integration

```typescript
// Typically controller-scoped, not component-scoped
import FocusHandler from "ui5/util/focus/FocusHandler";

export default class Main extends Controller {
  private focusHandler!: FocusHandler;

  public onInit(): void {
    this.focusHandler = new FocusHandler(this.getView());
  }

  public onNavigateBack(): void {
    // Focus the search field after navigation (view may be cached)
    this.focusHandler.set("searchField");
  }

  public onExit(): void {
    this.focusHandler.destroy();
  }
}
```

### UI5 APIs used (focus module)

| API                          | Import                | Since | Replaces         |
| ---------------------------- | --------------------- | ----- | ---------------- |
| `Element.getElementById()`   | `sap/ui/core/Element` | 1.119 | `Core.byId()`    |
| `Element.getActiveElement()` | `sap/ui/core/Element` | 1.119 | N/A              |
| `Control.prototype.focus()`  | N/A (inherited)       | 1.0   | N/A              |
| `BaseObject`                 | `sap/ui/base/Object`  | 1.0   | N/A              |
| `Log`                        | `sap/base/Log`        | 1.58  | `jQuery.sap.log` |

## 9. Component lifecycle contract

All modules that are component-scoped follow this contract:

```typescript
export default class Component extends UIComponent {
  // Module instances
  private dialogManager!: DialogManager;
  private messageHandler!: MessageHandler;
  private messageBoxSequencer!: MessageBoxSequencer;
  private wsService!: WebSocketService;
  private odataService!: ODataV2ModelPromisifier;

  public init(): void {
    super.init();

    // Initialize all modules
    this.dialogManager = new DialogManager(this, {
      fragmentBasePath: "view/dialogs",
      controllerBasePath: "controller/dialogs",
    });
    this.messageHandler = new MessageHandler(this);
    this.messageBoxSequencer = new MessageBoxSequencer();
    this.wsService = new WebSocketService();
    this.odataService = new ODataV2ModelPromisifier(this.getModel() as ODataModel);

    // Register message model for view binding
    this.setModel(this.messageHandler.getMessageModel(), "message");
  }

  // Getters for controller access
  public getDialogManager(): DialogManager {
    return this.dialogManager;
  }
  public getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }
  public getMessageBoxSequencer(): MessageBoxSequencer {
    return this.messageBoxSequencer;
  }
  public getWebSocketService(): WebSocketService {
    return this.wsService;
  }
  public getODataService(): ODataV2ModelPromisifier {
    return this.odataService;
  }

  // FocusHandler is controller-scoped, not here

  public exit(): void {
    this.dialogManager.destroy();
    this.messageHandler.destroy();
    this.messageBoxSequencer.destroy();
    this.wsService.destroy();
    // ODataV2ModelPromisifier cleaned up with model
  }
}
```

**No static singletons. No cross-component state. FLP-safe.**

## 10. Testing strategy

### Structure

QUnit test suites with one subfolder per module under `test/qunit/`. Single
`testsuite.qunit.ts` at the root registering all tests. WDIO for browser-based execution.

### Test scope per module

| Module                | Test focus                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `dialog`              | Deferred event attachment, namespace resolution, open/close lifecycle, caching modes, overlay type detection, controller extension methods |
| `messaging`           | Display mode routing, i18n key parsing, error categorization, MessageModel integration, component scoping                                  |
| `messageBoxSequencer` | Queue ordering (FIFO), sequential display, unique ID per instance, cleanup                                                                 |
| `websocket`           | Connection lifecycle, action registry, custom parser, retry scheduling, event forwarding                                                   |
| `odata`               | Promise wrapping for each CRUD operation, deferred group handling, method forwarding                                                       |
| `focus`               | Queued focus (last wins), force focus, string ID resolution, text selection, delay                                                         |

### Test runner configuration

```yaml
# testsuite.qunit.ts pattern
{
  name: "QUnit test suite for ui5.util",
  defaults:
    {
      page: "ui5://test-resources/ui5/util/qunit/Test.qunit.html?testsuite={suite}&test={name}",
      qunit: { version: 2 },
      sinon: { version: 4 },
      ui5: { theme: "sap_horizon" },
    },
  tests: { "dialog/DialogProvider": { title: "..." }, "dialog/DialogManager": { title: "..." }, // ... etc. },
}
```

## 11. Demo app

The demo-app exercises all six modules in a single application:

- **Dialog examples:** open/close Dialog, Popover, and ResponsivePopover via DialogManager
  with dedicated controllers, event handling, and both caching modes
- **Messaging:** MessageHandler with MessagePopover (wired via fragment), error/success/
  warning/info display in all three modes
- **MessageBoxSequencer:** buttons that trigger multiple sequential messages
- **WebSocket:** mock echo service or local WebSocket server demonstrating connection,
  action handlers, custom parser, and reconnection
- **OData V2:** mock server with promisified CRUD operations
- **Focus:** form with queued and forced focus scenarios

## 12. Root README structure

1. **What this is** -- battle-tested UI5 utility patterns packaged as one library;
   equally a reference implementation
2. **Module overview** -- table with module name and description (no source attribution)
3. **Installation and consumption** -- npm dependency, ui5.yaml resource configuration
4. **Extraction guide** -- four paths for pulling modules out:
   - Native ES module (`type: module` in ui5.yaml)
   - TypeScript consumption
   - UI5 library extraction
   - Manual integration (copy into existing app)
5. **API compatibility** -- per-module table of 1.120+ APIs and their pre-1.120 equivalents
6. **Library preload note** -- acknowledged that the built library-preload ships all modules;
   deliberate choice; extraction guide above for consumers who want subsets
7. **Related repositories** -- cross-link to
   [ui5-websocket-demo](https://github.com/wridgeu/ui5-websocket-demo) for WebSocket handling,
   retry mechanisms, and custom control development with ECD

## 13. API compatibility reference (for extraction)

When extracting modules for use with UI5 versions below 1.120, the following APIs require
replacement:

| 1.120+ API                      | Pre-1.120 equivalent                                                    | Since             |
| ------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| `Element.getElementById(id)`    | `Core.byId(id)` (deprecated 1.119)                                      | 1.119             |
| `Element.getActiveElement()`    | `document.activeElement` + manual lookup                                | 1.119             |
| `Messaging.addMessages()`       | `sap.ui.getCore().getMessageManager().addMessages()` (deprecated 1.118) | 1.118             |
| `Messaging.removeMessages()`    | `sap.ui.getCore().getMessageManager().removeMessages()`                 | 1.118             |
| `Messaging.removeAllMessages()` | `sap.ui.getCore().getMessageManager().removeAllMessages()`              | 1.118             |
| `Messaging.getMessageModel()`   | `sap.ui.getCore().getMessageManager().getMessageModel()`                | 1.118             |
| `Lib.init()`                    | `sap.ui.getCore().initLibrary()` (deprecated 1.118)                     | 1.118             |
| `Log.getLogger()`               | `jQuery.sap.log.getLogger()` (deprecated 1.58)                          | 1.58              |
| `Fragment.load()`               | `sap.ui.xmlfragment()` (deprecated 1.58)                                | 1.58              |
| `Controller.create()`           | `sap.ui.controller()` (deprecated 1.56)                                 | 1.56              |
| `ControllerExtension.use()`     | Manual extension wiring                                                 | babel-plugin 7.5+ |
