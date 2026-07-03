import { describe, it, expect } from "vitest";
import { SPECIAL_KEY_ICON_NAMES, SPECIAL_KEY_I18N_KEYS } from "../../src/core/key-action-meta.js";

// Pins the canonical special-key metadata that both twins derive their icon and
// label maps from. The twin-drift check guarantees the kiosk copy is identical,
// so pinning it here (fast vitest) also protects the kiosk side. A changed icon
// name or i18n key is a visible/announced regression, so it must break a test.

describe("special-key canonical metadata", () => {
  it("has the expected bare SAP icon names", () => {
    expect(SPECIAL_KEY_ICON_NAMES).toEqual({
      backspace: "arrow-left",
      shift: "arrow-top",
      enter: "accept",
      capsLock: "locked",
      layoutReturn: "nav-back",
    });
  });

  it("has the expected i18n label keys", () => {
    expect(SPECIAL_KEY_I18N_KEYS).toEqual({
      backspace: "KEY_BACKSPACE",
      enter: "KEY_ENTER",
      shift: "KEY_SHIFT",
      space: "KEY_SPACE",
    });
  });
});
