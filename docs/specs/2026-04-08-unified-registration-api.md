# Unified Registration API

Merge sequence registration into `register()` using space-separated hotkey strings,
matching the conventions of [tinykeys](https://github.com/jamiebuilds/tinykeys) and
[@github/hotkey](https://github.com/github/hotkey).

## Motivation

The current API has two parallel registration paths:

```ts
manager.register("Ctrl+S", save);
manager.registerSequence(["g", "i"], goToIssues);
```

This doubles the public API surface: separate register/unregister methods, separate
introspection methods, separate types, separate handle types. Other libraries solve
this with a single entry point where spaces separate sequence steps:

```ts
// tinykeys
tinykeys(window, { "g i": goToIssues });

// @github/hotkey
<div data-hotkey="g i">

// ours (after this change)
manager.register("g i", goToIssues);
```

## Detection Rule

A hotkey string containing whitespace between key descriptors is a sequence.
Each whitespace-separated segment is one step.

| Input             | Interpretation                   |
| ----------------- | -------------------------------- |
| `"Ctrl+S"`        | Single hotkey                    |
| `"g i"`           | Sequence: `["g", "i"]`           |
| `"Ctrl+K Ctrl+C"` | Sequence: `["Ctrl+K", "Ctrl+C"]` |
| `"Space"`         | Single hotkey (the space bar)    |
| `"g Space"`       | Sequence: `["g", "Space"]`       |

No ambiguity: `"Space"` is already normalized as the key name for the space bar.
Literal whitespace in the string is always a step separator.

## API Changes

### HotkeyOptions

Two new optional fields:

```ts
interface HotkeyOptions {
  // ... existing fields ...
  timeout?: number; // Sequence step timeout in ms. Default: 1000. Ignored for single hotkeys.
  onPending?: SequencePendingCallback; // Progress callback for intermediate sequence steps. Ignored for single hotkeys.
}
```

`UpdatableHotkeyOptions` gains the same two fields.

### HotkeyRegistrationHandle

New property:

```ts
interface HotkeyRegistrationHandle {
  // ... existing fields ...
  readonly sequence: readonly string[] | null; // null for single hotkeys
}
```

### HotkeyRegistrationInfo

New fields:

```ts
interface HotkeyRegistrationInfo {
  // ... existing fields ...
  sequence: readonly string[] | null; // null for single hotkeys
  timeout: number | null; // null for single hotkeys
}
```

For sequence registrations, `hotkey` contains the original space-separated string
and `normalizedHotkey` contains the normalized form (each step normalized
individually, rejoined with spaces).

### Removed API

Removed from `HotkeyManager`:

- `registerSequence()`
- `getSequenceRegistrations()`
- `getSequenceRegistrationsForScope()`
- `findSequenceRegistrations()`
- `setSequencePendingHandler()`

Removed from `RegistrationGroup`:

- `registerSequence()`

Removed types:

- `SequenceOptions`
- `UpdatableSequenceOptions`
- `SequenceRegistrationHandle`
- `SequenceRegistrationInfo`

`SequencePendingCallback` is retained (used by `HotkeyOptions.onPending`).

### RegistrationGroup

`group.register("g i", cb, opts)` works identically to `manager.register("g i", cb, opts)`.
The group tracks the returned handle for cleanup via `destroyAll()`.

## Internal Architecture

SequenceManager remains as an internal class. No changes to:

- Dispatch pipeline (hotkeys pass 1, sequences pass 2)
- Timeout tracking
- Pending callback machinery
- Scope priority (active scope wins over global)
- Input suppression logic

The `register()` method on HotkeyManager detects sequences, splits the string,
maps options, delegates to SequenceManager, and wraps the returned
SequenceRegistrationHandle in a unified HotkeyRegistrationHandle.

### Introspection Integration

`getRegistrations()`, `getRegistrationsForScope()`, and `findRegistrations()`
merge results from both the hotkey registration map and SequenceManager.
Sequence registrations are mapped to `HotkeyRegistrationInfo` with
`sequence` and `timeout` populated.

## Validation

- Single-step "sequences" (e.g., a string that after splitting has one segment)
  are treated as regular hotkeys, not sequences.
- Empty strings and whitespace-only strings remain validation errors.
- Each step in a sequence is validated individually through `parseHotkey()`.
- `timeout` must be a positive finite number (existing SequenceManager validation).
- `timeout` and `onPending` on single-hotkey registrations are silently ignored
  (no warning, no error).

## Test Plan

- Existing sequence tests rewritten to use `register("g i", ...)` syntax
- Verify `getRegistrations()` includes sequences
- Verify `getRegistrationsForScope()` includes sequences
- Verify `findRegistrations()` can filter sequences
- Verify `HotkeyRegistrationHandle.sequence` is populated
- Verify `timeout` and `onPending` pass through correctly
- Verify `setOptions()` can update `timeout` and `onPending`
- Verify removed APIs no longer exist on HotkeyManager/RegistrationGroup
- Verify edge cases: `"Space"` as single key, `"g Space"` as sequence
- Verify RegistrationGroup tracks and cleans up sequence handles
