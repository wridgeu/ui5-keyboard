import { fixture, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import type KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";
import { createHangulComposeMiddleware } from "../../src/middleware/hangul-compose.js";
import { requireKey, setupWithLayout } from "../helpers/fixtures.js";

// These run in real Chromium, where `document.execCommand` exists and edits go
// through the platform: `maxlength`, the undo stack and the real `input` event
// are the browser's. The vitest suite runs in jsdom, which has no
// `execCommand`, so it only ever reaches the fallback.

const DECOY_VALUE = "decoy";

// Jamo enough to compose 가 and then steal its ㄴ into a second syllable,
// plus a non-jamo key whose press commits the live preedit.
const HANGUL_LAYOUT: LayoutDefinition = [[{ value: "ㄱ" }, { value: "ㅏ" }, { value: "ㄴ" }, { value: "x" }]];

interface Setup {
  kb: KioskKeyboard;
  input: HTMLInputElement;
  decoy: HTMLInputElement;
}

/**
 * Renders a qwerty keyboard targeting `target`, next to a second focusable
 * input the keyboard is never pointed at.
 */
async function mount<T extends HTMLInputElement | HTMLTextAreaElement>(
  target: T,
): Promise<{ kb: KioskKeyboard; decoy: HTMLInputElement }> {
  const container = document.createElement("div");
  const decoy = document.createElement("input");
  decoy.type = "text";
  decoy.value = DECOY_VALUE;
  const kb = document.createElement("kiosk-keyboard") as KioskKeyboard;
  kb.setAttribute("layout", "qwerty");
  container.append(target, decoy, kb);

  await fixture(container);
  kb.setTargetElement(target);
  await renderFinished();
  return { kb, decoy };
}

/** Mounts a text `<input>` as the target. */
async function setup(options: { value?: string; maxLength?: number } = {}): Promise<Setup> {
  const input = document.createElement("input");
  input.type = "text";
  if (options.maxLength !== undefined) input.maxLength = options.maxLength;
  const { kb, decoy } = await mount(input);
  if (options.value !== undefined) input.value = options.value;
  return { kb, input, decoy };
}

/** Focuses `el` with the caret parked after its last character. */
function focusAtEnd(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}

describe("native text insertion", () => {
  it("enforces maxlength: the fourth character does not fit a maxlength=3 input", async () => {
    const { kb, input } = await setup({ maxLength: 3 });
    focusAtEnd(input);

    for (const char of ["a", "b", "c", "d"]) requireKey(kb, char).click();

    expect(input.value, "the saturated field keeps its first three characters").to.equal("abc");
    expect(input.selectionStart, "the caret is read back from the DOM, not counted forward").to.equal(3);
  });

  it("undoes an inserted character through the platform undo stack", async () => {
    const { kb, input } = await setup({ value: "ab" });
    focusAtEnd(input);
    expect(document.activeElement, "the target is focused, so the edit is a platform edit").to.equal(input);

    requireKey(kb, "c").click();
    expect(input.value).to.equal("abc");

    document.execCommand("undo");
    expect(input.value, "undo reverts the insert").to.equal("ab");
  });

  it("inserts a newline into a focused textarea, and undo reverts it", async () => {
    const textarea = document.createElement("textarea");
    const { kb } = await mount(textarea);
    textarea.value = "ab";
    focusAtEnd(textarea);

    requireKey(kb, "{enter}").click();
    expect(textarea.value, "Enter inserts a newline rather than firing change").to.equal("ab\n");
    expect(textarea.selectionStart).to.equal(3);

    document.execCommand("undo");
    expect(textarea.value, "the newline was a revertible transaction").to.equal("ab");
  });

  it("undoes a backspace through the platform undo stack", async () => {
    const { kb, input } = await setup({ value: "abc" });
    focusAtEnd(input);

    requireKey(kb, "{backspace}").click();
    expect(input.value).to.equal("ab");

    document.execCommand("undo");
    expect(input.value, "undo restores the deleted character").to.equal("abc");
  });

  it("dispatches exactly one input event per insertion", async () => {
    const { kb, input } = await setup();
    focusAtEnd(input);

    let events = 0;
    input.addEventListener("input", () => {
      events++;
    });
    kb.insertText("x");

    expect(input.value).to.equal("x");
    expect(events, "the platform event is not doubled by a synthetic one").to.equal(1);
  });

  it("dispatches exactly one input event per backspace", async () => {
    const { kb, input } = await setup({ value: "abc" });
    focusAtEnd(input);

    let events = 0;
    input.addEventListener("input", () => {
      events++;
    });
    requireKey(kb, "{backspace}").click();

    expect(input.value).to.equal("ab");
    expect(events, "the platform event is not doubled by a synthetic one").to.equal(1);
  });

  // The range is selected before the platform delete runs, so the cluster the
  // engine would have picked itself never comes into play.
  const clusters: { name: string; cluster: string }[] = [
    { name: "combining acute accent", cluster: "e\u0301" },
    {
      name: "ZWJ family emoji",
      cluster: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}",
    },
    { name: "regional-indicator flag", cluster: "\u{1F1E9}\u{1F1EA}" },
    { name: "skin-tone modifier", cluster: "\u{1F44D}\u{1F3FB}" },
  ];

  for (const { name, cluster } of clusters) {
    it(`deletes a ${name} as one cluster`, async () => {
      const { kb, input } = await setup({ value: `a${cluster}` });
      focusAtEnd(input);

      requireKey(kb, "{backspace}").click();

      expect(input.value, "the whole cluster is gone, not a trailing code point").to.equal("a");
      expect(input.selectionStart).to.equal(1);
    });
  }

  // The committed syllable is inserted through the platform, so `maxlength` is
  // the browser's: the preedit that overran it while composing does not survive
  // the commit.
  it("enforces maxlength on the committed syllable", async () => {
    const { kb, input } = await setupWithLayout(HANGUL_LAYOUT, { middleware: createHangulComposeMiddleware });
    input.maxLength = 1;
    focusAtEnd(input);

    for (const jamo of ["ㄱ", "ㅏ", "ㄴ", "ㅏ"]) requireKey(kb, jamo).click();
    requireKey(kb, "x").click();

    expect(input.value, "the saturated field keeps the one syllable it has room for").to.equal("가");
  });

  // execCommand acts on whatever is focused. With the target unfocused the
  // platform edit is declined, so the keyboard writes the target itself and the
  // focused element stays out of it.
  describe("focus guard", () => {
    it("types into the unfocused target and leaves the focused decoy untouched", async () => {
      const { kb, input, decoy } = await setup();
      focusAtEnd(decoy);

      requireKey(kb, "z").click();

      expect(input.value, "the intended target receives the character").to.equal("z");
      expect(decoy.value, "the focused decoy is not edited").to.equal(DECOY_VALUE);
      expect(document.activeElement, "focus stays on the decoy").to.equal(decoy);
    });

    it("backspaces the unfocused target and leaves the focused decoy untouched", async () => {
      const { kb, input, decoy } = await setup({ value: "abc" });
      input.setSelectionRange(3, 3);
      focusAtEnd(decoy);

      requireKey(kb, "{backspace}").click();

      expect(input.value, "the intended target loses its last character").to.equal("ab");
      expect(decoy.value, "the focused decoy is not edited").to.equal(DECOY_VALUE);
      expect(document.activeElement, "focus stays on the decoy").to.equal(decoy);
    });
  });
});
