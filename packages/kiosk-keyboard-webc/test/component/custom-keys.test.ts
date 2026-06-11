import { expect } from "@open-wc/testing";
import type KioskKeyboard from "../../src/KioskKeyboard.js";
import { requireKey as queryKey, setupWithLayout as setup } from "../helpers/fixtures.js";
import { captureConsole } from "../helpers/console.js";

describe("kiosk-keyboard - custom keys via enriched key-press", () => {
  // ── key-press contract ──

  it("fires a cancelable key-press for a custom {paste} key (no literal insertion)", async () => {
    const { kb, input } = await setup([[{ value: "{paste}", label: "P" }]]);
    let detail: { key: string } | undefined;
    let cancelable = false;
    kb.addEventListener(
      "key-press",
      (e: Event) => {
        detail = (e as CustomEvent<{ key: string }>).detail;
        cancelable = e.cancelable;
      },
      { once: true },
    );
    queryKey(kb, "{paste}").click();
    expect(detail?.key).to.equal("{paste}");
    expect(cancelable).to.equal(true);
    expect(input.value).to.equal("");
  });

  it("preventDefault on the custom key-press suppresses the default no-op warning", async () => {
    const { kb, input } = await setup([[{ value: "{paste}", label: "P" }]]);
    kb.addEventListener("key-press", (e: Event) => e.preventDefault(), { once: true });
    const warnings = await captureConsole("warn", () => {
      queryKey(kb, "{paste}").click();
    });
    expect(warnings.some((w) => w.includes("{paste}"))).to.equal(false);
    expect(input.value).to.equal("");
  });

  // ── public input API ──

  it("insertText inserts at the caret of the active target and dispatches input", async () => {
    const { kb, input } = await setup([[{ value: "{paste}", label: "P" }]]);
    let inputFired = false;
    input.addEventListener("input", () => (inputFired = true));
    kb.addEventListener("key-press", (e: Event) => {
      if ((e as CustomEvent<{ key: string }>).detail.key === "{paste}") {
        e.preventDefault();
        kb.insertText("x");
      }
    });
    queryKey(kb, "{paste}").click();
    expect(input.value).to.equal("x");
    expect(inputFired).to.equal(true);
  });

  it("deleteBackward deletes one grapheme before the caret", async () => {
    const { kb, input } = await setup([[{ value: "a" }, { value: "{del}", label: "D" }]]);
    let removed: boolean | undefined;
    kb.addEventListener("key-press", (e: Event) => {
      if ((e as CustomEvent<{ key: string }>).detail.key === "{del}") {
        e.preventDefault();
        removed = kb.deleteBackward();
      }
    });
    queryKey(kb, "a").click();
    queryKey(kb, "a").click();
    expect(input.value).to.equal("aa");
    queryKey(kb, "{del}").click();
    expect(removed).to.equal(true);
    expect(input.value).to.equal("a");
  });

  it("insertText/deleteBackward are safe no-ops with no active target", async () => {
    const { kb } = await setup([[{ value: "x" }]]);
    kb.setTargetElement(null);
    expect(kb.getActiveTargetElement()).to.equal(null);
    kb.insertText("z"); // must not throw
    expect(kb.deleteBackward()).to.equal(false);
  });

  // ── accessibility ──

  it("KeyDefinition.ariaLabel sets the accessible name for an icon-only key", async () => {
    const { kb } = await setup([[{ value: "{paste}", label: "", icon: "sap-icon://paste", ariaLabel: "Paste" }]]);
    expect(queryKey(kb, "{paste}").getAttribute("aria-label")).to.equal("Paste");
  });

  it("an icon-only key with no ariaLabel/label warns and falls back to value", async () => {
    let kb!: KioskKeyboard;
    const warnings = await captureConsole("warn", async () => {
      ({ kb } = await setup([[{ value: "{paste}", label: "", icon: "sap-icon://paste" }]]));
    });
    expect(queryKey(kb, "{paste}").getAttribute("aria-label")).to.equal("{paste}");
    expect(warnings.some((w) => w.includes("{paste}") && /accessible name/i.test(w))).to.equal(true);
  });
});
