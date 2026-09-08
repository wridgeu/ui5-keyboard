# Multi-Key Sequences

> **Status: Implemented.** `SequenceManager` class in `src/internal/SequenceManager.ts`.

Multi-key sequence support for vim-style `g g`, Emacs-style `C-x C-s`, and VS Code-style `Ctrl+K Ctrl+S` patterns.

## Usage

```ts
import HotkeyManager from "ui5/hotkeys/HotkeyManager";

const manager = new HotkeyManager();

// Register a two-key sequence (space-separated string)
manager.register(
  "Ctrl+K Ctrl+C",
  (event) => {
    // Comment selection
  },
  {
    description: "Comment selection",
    timeout: 1000, // ms between keys (default: 1000)
  },
);

// Register a simple two-key sequence without modifiers
manager.register(
  "G G",
  (event) => {
    // Go to top
  },
  {
    description: "Go to top",
    scope: "editor",
  },
);
```

`SequenceManager` is an internal class managed by `HotkeyManager`. Access sequence functionality through `HotkeyManager.register()`. A space-separated hotkey string is automatically detected as a sequence. The `SequenceManager` receives pre-filtered key events from the EventDispatcher pipeline (step 6, after hotkey matching) and reads the active scope from `HotkeyManager` for scope-based filtering.

## Architecture

### How It Works

1. On each keydown, check if the key matches the _first key_ of any registered sequence or the _next expected key_ in an in-progress sequence.
2. If it matches the first key, start a timer (default 1000ms) and add to active matches. Fire the pending callback to inform the UI.
3. If the next key arrives within the timeout and matches, advance the pointer. Fire the pending callback again.
4. If the full sequence completes, fire the callback, call `preventDefault()` and `stopPropagation()` as the registration's flags allow, and clear all active matches.
5. If the timeout expires or a non-matching key is pressed, the active match is dropped.

### Scope Integration

Sequences use the same two-pass matching as `HotkeyManager`: active scope first, then global. The active scope is read via a scope-provider callback supplied by `HotkeyManager` (no reverse singleton lookup) on each keydown.

### Pending Callback

Applications can display mid-sequence progress using the per-registration `onPending` callback:

```ts
manager.register(
  "G E",
  (event) => {
    router.navTo("editor");
  },
  {
    description: "Go to editor",
    onPending: (info) => {
      // info.completedSteps: number of matched keys so far
      // info.totalSteps: total keys in the sequence
      // info.nextKey: the next expected key string
      // info.sequence: the full sequence array
      statusBar.setText(`${info.completedSteps}/${info.totalSteps} - next: ${info.nextKey}`);
    },
  },
);
```

`onPending` dies with the registration, so no manual cleanup needed. When the handle is unregistered (or the group is destroyed), the callback is gone.

### Options

| Option             | Type                       | Default        | Description                                                     |
| ------------------ | -------------------------- | -------------- | --------------------------------------------------------------- |
| `description`      | `string`                   | `""`           | Human-readable description                                      |
| `timeout`          | `number`                   | `1000`         | Timeout in ms between keys before reset; must be finite and > 0 |
| `scope`            | `string`                   | `"__global__"` | Scope for filtering                                             |
| `enabled`          | `boolean \| () => boolean` | `true`         | Whether the sequence is active                                  |
| `ignoreInputs`     | `boolean \| "auto"`        | `"auto"`       | Suppress in inputs; auto allows Ctrl/Meta combos and Escape     |
| `preventDefault`   | `boolean`                  | `true`         | Call `event.preventDefault()` when the full sequence matches    |
| `stopPropagation`  | `boolean`                  | `true`         | Call `event.stopPropagation()` when the full sequence matches   |
| `suppressInPopups` | `boolean`                  | `true`         | Suppress this sequence when a UI5 dialog or popover is open     |
| `onPending`        | `SequencePendingCallback`  | -              | Per-registration mid-sequence progress callback                 |

## Design Decisions

### Separate Class (not on HotkeyManager)

Sequences are implemented as a separate `SequenceManager` class with its own matching algorithm. This keeps the core `HotkeyManager` focused on single-chord hotkeys. The two systems share scope state and the centralized EventDispatcher. Step 6 of the dispatch pipeline calls `SequenceManager.processKeyEvent()` after hotkey matching (step 5).

### No Standalone Hotkey Conflict Resolution

The current implementation does not delay standalone hotkeys when they share a prefix with a sequence. If `G` is registered as a standalone hotkey and `G G` as a sequence, pressing `G` fires the standalone immediately. The sequence is tracked independently by `SequenceManager`. This avoids adding latency to standalone hotkeys.

### Overlapping Sequences

When two sequences share a prefix (e.g., `G E` and `G G`), both are tracked as active matches after the first key. When the second key arrives, only the matching sequence advances (the other is dropped).
