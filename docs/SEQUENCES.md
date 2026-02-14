# Multi-Key Sequences

> **Status: Implemented** — `SequenceManager` class in `src/SequenceManager.ts`.

Multi-key sequence support for vim-style `g g`, Emacs-style `C-x C-s`, and VS Code-style `Ctrl+K Ctrl+S` patterns.

## Usage

```ts
import SequenceManager from "ui5/hotkeys/SequenceManager";

const seq = SequenceManager.getInstance();

// Register a two-key sequence
seq.registerSequence(
  ["Ctrl+K", "Ctrl+C"],
  (event) => {
    // Comment selection
  },
  {
    description: "Comment selection",
    timeout: 1000, // ms between keys (default: 1000)
  },
);

// Register a simple two-key sequence without modifiers
seq.registerSequence(
  ["G", "G"],
  (event) => {
    // Go to top
  },
  {
    description: "Go to top",
    scope: "editor",
  },
);
```

`SequenceManager` is a separate singleton from `HotkeyManager`, with its own `getInstance()` / `destroy()` lifecycle. It reads the active scope from `HotkeyManager` for scope-based filtering.

## Architecture

### How It Works

1. On each keydown, check if the key matches the _first key_ of any registered sequence or the _next expected key_ in an in-progress sequence.
2. If it matches the first key, start a timer (default 1000ms) and add to active matches. Fire the pending callback to inform the UI.
3. If the next key arrives within the timeout and matches, advance the pointer. Fire the pending callback again.
4. If the full sequence completes, fire the callback, call `preventDefault()` and `stopPropagation()`, and clear all active matches.
5. If the timeout expires or a non-matching key is pressed, the active match is dropped.

### Scope Integration

Sequences use the same two-pass matching as `HotkeyManager`: active scope first, then global. The active scope is read from `HotkeyManager.getInstance().getActiveScope()` on each keydown.

### Pending Callback

Applications can display progress indicators by setting a pending callback:

```ts
seq.setPendingCallback((info) => {
  // info.completedSteps: number of matched keys so far
  // info.totalSteps: total keys in the sequence
  // info.nextKey: the next expected key string
  // info.sequence: the full sequence array
  statusBar.setText(`${info.completedSteps}/${info.totalSteps} — next: ${info.nextKey}`);
});
```

### Options

| Option         | Type                       | Default        | Description                               |
| -------------- | -------------------------- | -------------- | ----------------------------------------- |
| `description`  | `string`                   | `""`           | Human-readable description                |
| `timeout`      | `number`                   | `1000`         | Timeout in ms between keys before reset   |
| `scope`        | `string`                   | `"__global__"` | Scope for filtering                       |
| `enabled`      | `boolean \| () => boolean` | `true`         | Whether the sequence is active            |
| `ignoreInputs` | `boolean`                  | `true`         | Suppress when an input element is focused |

## Design Decisions

### Separate Class (not on HotkeyManager)

Sequences are implemented as a separate `SequenceManager` class rather than extending `HotkeyManager.registerSequence()`. This keeps the core `HotkeyManager` focused on single-chord hotkeys and avoids mixing two different matching algorithms in one class. The two managers share scope state but have independent registrations and listeners.

### No Standalone Hotkey Conflict Resolution

The current implementation does not delay standalone hotkeys when they share a prefix with a sequence. If `G` is registered as a standalone hotkey and `G G` as a sequence, pressing `G` fires the standalone immediately — the sequence is tracked independently by `SequenceManager`'s own listener. This avoids adding latency to standalone hotkeys.

### Overlapping Sequences

When two sequences share a prefix (e.g., `G E` and `G G`), both are tracked as active matches after the first key. When the second key arrives, only the matching sequence advances (the other is dropped).
