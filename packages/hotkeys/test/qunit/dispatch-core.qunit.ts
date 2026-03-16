import { findMatchInScope } from "ui5/hotkeys/internal/dispatch-core";
import { parseHotkey } from "ui5/hotkeys/parse";
import { UnhandledReason, GLOBAL_SCOPE } from "ui5/hotkeys/library";
import { type SkipInfo, type DebugSkipEntry } from "ui5/hotkeys/internal/skip-reason";

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

/** Actual HotkeyRegistration type, extracted from the function signature. */
type Registration = Parameters<typeof findMatchInScope>[0]["registrations"][number];

interface RegistrationOverrides {
  enabled?: boolean | (() => boolean);
  ignoreRepeat?: boolean;
  ignoreInputs?: boolean | "auto";
  suppressInPopups?: boolean;
  scope?: string;
}

function makeRegistration(id: string, hotkey: string, overrides?: RegistrationOverrides): Registration {
  return {
    id,
    hotkey,
    normalizedHotkey: hotkey,
    parsedHotkey: parseHotkey(hotkey, "windows"),
    callback: () => {},
    options: {
      enabled: overrides?.enabled ?? true,
      preventDefault: true,
      stopPropagation: true,
      ignoreInputs: overrides?.ignoreInputs ?? "auto",
      scope: overrides?.scope ?? GLOBAL_SCOPE,
      description: "",
      ignoreRepeat: overrides?.ignoreRepeat ?? true,
      suppressInPopups: overrides?.suppressInPopups ?? false,
      conflictBehavior: "warn",
      target: null,
    },
  };
}

function mockKeyEvent(overrides: { key: string } & Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: overrides.key,
    code: overrides.code ?? "",
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    metaKey: overrides.metaKey ?? false,
    repeat: overrides.repeat ?? false,
  } as unknown as KeyboardEvent;
}

/** Minimal toRegistrationInfo stub - only the id is inspected in assertions. */
// @ts-expect-error Partial stub: only `id` is needed for test assertions
const toInfo: Parameters<typeof findMatchInScope>[0]["toRegistrationInfo"] = (reg) => ({ id: reg.id });

const LOG_COMPONENT = "test.dispatch-core";

// ──────────────────────────────────────────────
// findMatchInScope
// ──────────────────────────────────────────────

QUnit.module("dispatch-core - findMatchInScope");

QUnit.test("Returns matching registration when all conditions pass", (assert) => {
  const reg = makeRegistration("esc", "Escape");
  const event = mockKeyEvent({ key: "Escape" });

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result?.id, "esc", "Matching registration returned");
});

QUnit.test("Returns null when no registration matches the key", (assert) => {
  const reg = makeRegistration("esc", "Escape");
  const event = mockKeyEvent({ key: "Enter" });

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "No match returned");
});

QUnit.test("Returns first matching registration in order", (assert) => {
  const first = makeRegistration("first", "Escape");
  const second = makeRegistration("second", "Escape");
  const event = mockKeyEvent({ key: "Escape" });

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [first, second],
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result?.id, "first", "First matching registration wins");
});

// ──────────────────────────────────────────────
// findMatchInScope - skip reasons
// ──────────────────────────────────────────────

QUnit.module("dispatch-core - findMatchInScope skip reasons");

QUnit.test("Skips disabled registration (boolean false)", (assert) => {
  const reg = makeRegistration("dis", "Escape", { enabled: false });
  const event = mockKeyEvent({ key: "Escape" });
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "Disabled registration skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Skip reason is Disabled");
});

QUnit.test("Skips when enabled() function returns false", (assert) => {
  const reg = makeRegistration("fn-dis", "Escape", { enabled: () => false });
  const event = mockKeyEvent({ key: "Escape" });
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "Registration with enabled()→false skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Skip reason is Disabled");
});

QUnit.test("Treats enabled() that throws as disabled", (assert) => {
  const reg = makeRegistration("err", "Escape", {
    enabled: () => {
      throw new Error("boom");
    },
  });
  const event = mockKeyEvent({ key: "Escape" });
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "Registration with throwing enabled() skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Skip reason is Disabled");
});

QUnit.test("Skips repeated event when ignoreRepeat is true", (assert) => {
  const reg = makeRegistration("rep", "Escape", { ignoreRepeat: true });
  const event = mockKeyEvent({ key: "Escape", repeat: true });
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "Repeated event skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.RepeatIgnored, "Skip reason is RepeatIgnored");
});

QUnit.test("Allows non-repeated event when ignoreRepeat is true", (assert) => {
  const reg = makeRegistration("rep-ok", "Escape");
  const event = mockKeyEvent({ key: "Escape", repeat: false });

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: [reg],
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result?.id, "rep-ok", "Non-repeated event matches");
});

QUnit.test("Skips in input when ignoreInputs resolves to true", (assert) => {
  // Plain "A" with ignoreInputs: true → always suppressed in inputs
  const reg = makeRegistration("inp", "A", { ignoreInputs: true, ignoreRepeat: false });
  const event = mockKeyEvent({ key: "A" });
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: true,
    popupOpen: false,
    registrations: [reg],
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "Input-suppressed registration skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.InputSuppressed, "Skip reason is InputSuppressed");
});

QUnit.test("Allows Ctrl combo in input with ignoreInputs 'auto'", (assert) => {
  // Ctrl+S with ignoreInputs: "auto" → resolveIgnoreInputs returns false (allow in inputs)
  const reg = makeRegistration("ctrl-s", "Ctrl+S", { ignoreRepeat: false });
  const event = mockKeyEvent({ key: "s", ctrlKey: true });

  const result = findMatchInScope({
    event,
    isInput: true,
    popupOpen: false,
    registrations: [reg],
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result?.id, "ctrl-s", "Ctrl combo allowed in input with auto ignoreInputs");
});

QUnit.test("Skips when popup is open and suppressInPopups is true", (assert) => {
  const reg = makeRegistration("popup", "Escape", { suppressInPopups: true, ignoreRepeat: false });
  const event = mockKeyEvent({ key: "Escape" });
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: false,
    popupOpen: true,
    registrations: [reg],
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "Popup-suppressed registration skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.PopupSuppressed, "Skip reason is PopupSuppressed");
});

QUnit.test("Skip priority: highest reason wins across multiple registrations", (assert) => {
  // Order: RepeatIgnored(1) → InputSuppressed(2) → PopupSuppressed(3) → Disabled(4)
  const event = mockKeyEvent({ key: "A", repeat: true });
  const regs = [
    makeRegistration("r1", "A", { ignoreRepeat: true, ignoreInputs: false, suppressInPopups: false }),
    makeRegistration("r2", "A", { ignoreRepeat: false, ignoreInputs: true, suppressInPopups: false }),
    makeRegistration("r3", "A", { ignoreRepeat: false, ignoreInputs: false, suppressInPopups: true }),
    makeRegistration("r4", "A", { enabled: false, ignoreRepeat: false, ignoreInputs: false }),
  ];
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

  const result = findMatchInScope({
    event,
    isInput: true,
    popupOpen: true,
    registrations: regs,
    skipInfo,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(result, null, "All registrations skipped");
  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Highest-priority reason (Disabled) wins");
  assert.strictEqual(skipInfo.registration?.id, "r4", "Registration with Disabled reason recorded");
});

QUnit.test("Populates debugSkips array for every skipped registration", (assert) => {
  const event = mockKeyEvent({ key: "Escape" });
  const regs = [
    makeRegistration("d1", "Escape", { enabled: false }),
    makeRegistration("d2", "Escape", { enabled: false }),
  ];
  const debugSkips: DebugSkipEntry[] = [];

  findMatchInScope({
    event,
    isInput: false,
    popupOpen: false,
    registrations: regs,
    debugSkips,
    toRegistrationInfo: toInfo,
    logComponent: LOG_COMPONENT,
  });

  assert.strictEqual(debugSkips.length, 2, "Both skips recorded");
  assert.strictEqual(debugSkips[0].registration.id, "d1", "First skip has correct registration");
  assert.strictEqual(debugSkips[0].reason, UnhandledReason.Disabled, "First skip reason correct");
  assert.strictEqual(debugSkips[1].registration.id, "d2", "Second skip has correct registration");
  assert.strictEqual(debugSkips[1].reason, UnhandledReason.Disabled, "Second skip reason correct");
});
