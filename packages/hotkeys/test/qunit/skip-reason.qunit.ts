import { recordSkip, type SkipInfo } from "ui5/hotkeys/internal/skip-reason";
import { UnhandledReason } from "ui5/hotkeys/library";
import { parseHotkey } from "ui5/hotkeys/parse";

/** Actual HotkeyRegistration type, extracted from the function signature. */
type Registration = Parameters<typeof recordSkip>[2];

function makeRegistration(id: string): Registration {
  return {
    id,
    hotkey: "Escape",
    normalizedHotkey: "Escape",
    parsedHotkey: parseHotkey("Escape", "windows"),
    callback: () => {},
    options: {
      enabled: true,
      preventDefault: true,
      stopPropagation: true,
      ignoreInputs: "auto",
      scope: "__global__",
      description: "",
      ignoreRepeat: true,
      suppressInPopups: false,
      conflictBehavior: "warn",
      target: null,
    },
  };
}

/** Minimal toRegistrationInfo stub - only the id is inspected in assertions. */
// @ts-expect-error Partial stub: only `id` is needed for test assertions
const toInfo: Parameters<typeof recordSkip>[3] = (reg) => ({ id: reg.id });

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

QUnit.module("skip-reason - recordSkip");

QUnit.test("No-op when skipInfo is null", (assert) => {
  recordSkip(null, UnhandledReason.Disabled, makeRegistration("a"), toInfo);
  assert.ok(true, "No error thrown for null skipInfo");
});

QUnit.test("No-op when skipInfo is undefined", (assert) => {
  recordSkip(undefined, UnhandledReason.Disabled, makeRegistration("a"), toInfo);
  assert.ok(true, "No error thrown for undefined skipInfo");
});

QUnit.test("Higher-priority reason overwrites lower", (assert) => {
  const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };
  const reg = makeRegistration("disabled-reg");

  recordSkip(skipInfo, UnhandledReason.Disabled, reg, toInfo);

  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Reason upgraded to Disabled");
  assert.strictEqual(skipInfo.registration?.id, "disabled-reg", "Registration recorded");
});

QUnit.test("Lower-priority reason does not overwrite higher", (assert) => {
  // @ts-expect-error Partial stub: only `id` is needed for test assertions
  const origInfo: SkipInfo["registration"] = { id: "orig" };
  const skipInfo: SkipInfo = { reason: UnhandledReason.Disabled, registration: origInfo };

  recordSkip(skipInfo, UnhandledReason.RepeatIgnored, makeRegistration("lower"), toInfo);

  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Reason unchanged");
  assert.strictEqual(skipInfo.registration?.id, "orig", "Original registration preserved");
});

QUnit.test("Equal-priority reason does not overwrite", (assert) => {
  // @ts-expect-error Partial stub: only `id` is needed for test assertions
  const firstInfo: SkipInfo["registration"] = { id: "first" };
  const skipInfo: SkipInfo = { reason: UnhandledReason.InputSuppressed, registration: firstInfo };

  recordSkip(skipInfo, UnhandledReason.InputSuppressed, makeRegistration("second"), toInfo);

  assert.strictEqual(skipInfo.reason, UnhandledReason.InputSuppressed, "Reason unchanged");
  assert.strictEqual(skipInfo.registration?.id, "first", "First registration kept");
});

QUnit.test(
  "Full ascending priority chain: NoMatch → RepeatIgnored → InputSuppressed → PopupSuppressed → Disabled",
  (assert) => {
    const skipInfo: SkipInfo = { reason: UnhandledReason.NoMatch };

    recordSkip(skipInfo, UnhandledReason.RepeatIgnored, makeRegistration("repeat"), toInfo);
    assert.strictEqual(skipInfo.reason, UnhandledReason.RepeatIgnored, "NoMatch → RepeatIgnored");
    assert.strictEqual(skipInfo.registration?.id, "repeat", "Registration updated");

    recordSkip(skipInfo, UnhandledReason.InputSuppressed, makeRegistration("input"), toInfo);
    assert.strictEqual(skipInfo.reason, UnhandledReason.InputSuppressed, "RepeatIgnored → InputSuppressed");
    assert.strictEqual(skipInfo.registration?.id, "input", "Registration updated");

    recordSkip(skipInfo, UnhandledReason.PopupSuppressed, makeRegistration("popup"), toInfo);
    assert.strictEqual(skipInfo.reason, UnhandledReason.PopupSuppressed, "InputSuppressed → PopupSuppressed");
    assert.strictEqual(skipInfo.registration?.id, "popup", "Registration updated");

    recordSkip(skipInfo, UnhandledReason.Disabled, makeRegistration("disabled"), toInfo);
    assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "PopupSuppressed → Disabled");
    assert.strictEqual(skipInfo.registration?.id, "disabled", "Registration updated");
  },
);

QUnit.test("Downgrade attempts after Disabled are all rejected", (assert) => {
  // @ts-expect-error Partial stub: only `id` is needed for test assertions
  const topInfo: SkipInfo["registration"] = { id: "top" };
  const skipInfo: SkipInfo = { reason: UnhandledReason.Disabled, registration: topInfo };

  recordSkip(skipInfo, UnhandledReason.PopupSuppressed, makeRegistration("popup"), toInfo);
  recordSkip(skipInfo, UnhandledReason.InputSuppressed, makeRegistration("input"), toInfo);
  recordSkip(skipInfo, UnhandledReason.RepeatIgnored, makeRegistration("repeat"), toInfo);

  assert.strictEqual(skipInfo.reason, UnhandledReason.Disabled, "Reason stays at Disabled");
  assert.strictEqual(skipInfo.registration?.id, "top", "Original registration preserved");
});
