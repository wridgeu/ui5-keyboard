# Feature: Black-Box QUnit Test Plan for `ui5.hotkeys`

> Status: Proposal

## Goal

Strengthen `ui5.hotkeys` confidence with black-box tests that assert only public
contracts and observable behavior (callbacks, event cancellation, scope effects,
and DOM-target behavior), without relying on internals.

## Scope

- QUnit only.
- No mutation tooling.
- No private/internal API assertions.

## Planned Test Additions

### 1) New suite: `packages/hotkeys/test/qunit/HotkeyManager-blackbox.qunit.ts`

1. **Active scope precedence over global**
   - Register `Escape` globally and in `editor` scope.
   - Push `editor` scope and assert only scoped callback fires.
2. **Target-bound registration isolation**
   - Register `Escape` with `target: elementA`.
   - Fire on `elementB` (no callback), then `elementA` (callback fires).
3. **`preventDefault` contract**
   - Register with `preventDefault: false` and assert `defaultPrevented === false`.
   - Register default behavior and assert `defaultPrevented === true`.
4. **`stopPropagation` contract**
   - Attach parent listener and assert propagation is blocked by default.
   - Set `stopPropagation: false` and assert parent receives event.
5. **Input suppression contract (`ignoreInputs: "auto"`)**
   - Assert single-key hotkey is suppressed inside input.
   - Assert Ctrl/Meta combo still fires inside input.
   - Assert `Escape` still fires inside input.
6. **Lifecycle cleanup contract**
   - Assert `unregister()` immediately stops handling.
   - Assert `destroy()` removes active handling and does not crash on repeated calls.

### 2) New suite: `packages/hotkeys/test/qunit/SequenceManager-blackbox.qunit.ts`

1. **Basic sequence completion**
   - Register `g e`, fire keys in order, assert callback fires once.
2. **Mismatch reset**
   - Start `g`, then wrong key, then `e`; assert sequence does not complete.
3. **Timeout reset**
   - Start sequence, wait beyond timeout, finish keys; assert no completion.
4. **Scoped sequence precedence**
   - Same sequence in global + active scope; assert active scope callback wins.
5. **Unhandled callback interaction**
   - Set unhandled callback and assert sequence progression/completion does not emit
     `no_match` for matching sequence keys.
6. **Runtime enable/disable contract**
   - Disable sequence via handle options and assert no callback.
   - Re-enable and assert callback works again.

### 3) Suite registration update

- Add entries in `packages/hotkeys/test/qunit/testsuite.qunit.ts`:
  - `HotkeyManager-blackbox`
  - `SequenceManager-blackbox`

## Notes

- Existing tests that already cover a case can stay; these additions enforce a
  clear black-box contract layer that remains stable across refactors.
