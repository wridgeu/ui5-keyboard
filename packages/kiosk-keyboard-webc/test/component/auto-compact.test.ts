import { fixture, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type CustomLayout from "../../src/CustomLayout.js";
import type { LayoutChangeEventDetail, LayoutDefinition } from "../../src/types.js";
import { customLayout, requireKey } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;

// The default threshold is 22rem, so 320px is narrow and 600px is not on any
// root font-size this suite runs at.
const NARROW_PX = 320;
const WIDE_PX = 600;

function readDataKeys(el: KioskKeyboard): string[][] {
  const rows = el.shadowRoot!.querySelectorAll(DOM.selectors.row);
  return Array.from(rows).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

interface Mounted {
  el: KioskKeyboard;
  /** The fixed-width box the keyboard fills, which is what the tier measures. */
  host: HTMLElement;
  /** Every `layout-change` fired since mount, in order. */
  changes: LayoutChangeEventDetail[];
  /** Resizes the box and lets the tier settle. */
  resize(width: number): Promise<void>;
}

/**
 * Mounts a keyboard inside a box of a fixed width, with its custom layouts attached
 * before it connects the way slotted markup arrives.
 */
async function mount(width: number, attributes: Record<string, string>, ...children: CustomLayout[]): Promise<Mounted> {
  const host = document.createElement("div");
  host.style.width = `${width}px`;
  const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.append(...children);
  host.appendChild(el);

  const changes: LayoutChangeEventDetail[] = [];
  el.addEventListener("layout-change", (e) => changes.push((e as CustomEvent<LayoutChangeEventDetail>).detail));

  await fixture(host);
  await settle();

  return {
    el,
    host,
    changes,
    async resize(next: number) {
      host.style.width = `${next}px`;
      await settle();
    },
  };
}

/**
 * Lets a width change work through the observer, the frame the tier is applied
 * from, and the re-render the swap triggers. Generous enough that a settled
 * keyboard stays settled, so a negative assertion after it is meaningful.
 */
async function settle(): Promise<void> {
  for (let frame = 0; frame < 4; frame++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await renderFinished();
  }
}

const away: LayoutDefinition = [[{ value: "a" }]];
const home: LayoutDefinition = [[{ value: "{layout:away}" }, { value: "h" }]];
const homeCompact: LayoutDefinition = [[{ value: "hc" }]];

/** The `home` / `home-c` pair plus the unrelated `away`, as slotted declarations. */
function pair(): CustomLayout[] {
  return [
    customLayout({ name: "home", rows: home, compact: "home-c" }),
    customLayout({ name: "home-c", rows: homeCompact }),
    customLayout({ name: "away", rows: away }),
  ];
}

describe("kiosk-keyboard - autoCompact", () => {
  it("is off by default", async () => {
    const { el } = await mount(NARROW_PX, { layout: "ja-kana" });

    expect(el.autoCompact).to.equal(false);
  });

  it("does not swap while it is off, however narrow the keyboard is", async () => {
    // ja-kana declares ja-kana-compact, so in a box this narrow the property is
    // the only thing holding the swap back.
    const off = await mount(NARROW_PX, { layout: "ja-kana" });
    const on = await mount(NARROW_PX, { layout: "ja-kana", "auto-compact": "" });

    expect(off.changes, "no layout change was fired").to.deep.equal([]);
    expect(on.changes, "the same box swaps with the property on").to.deep.equal([
      { layout: "ja-kana-compact", autoDetected: true },
    ]);
    expect(readDataKeys(off.el)).to.not.deep.equal(readDataKeys(on.el));
  });

  it("yields to the compact counterpart below the threshold and takes the layout back above it", async () => {
    const { el, changes, resize } = await mount(WIDE_PX, { layout: "ja-kana", "auto-compact": "" });
    const wideKeys = readDataKeys(el);
    expect(changes, "a keyboard with room to spare does not swap").to.deep.equal([]);

    await resize(NARROW_PX);
    expect(changes).to.deep.equal([{ layout: "ja-kana-compact", autoDetected: true }]);
    const narrowKeys = readDataKeys(el);
    expect(narrowKeys, "the compact rows replaced the wide ones").to.not.deep.equal(wideKeys);

    await resize(WIDE_PX);
    // Not the locale default and not the compact form: the layout that was asked for.
    expect(changes).to.deep.equal([
      { layout: "ja-kana-compact", autoDetected: true },
      { layout: "ja-kana", autoDetected: true },
    ]);
    expect(readDataKeys(el), "the requested layout is back key for key").to.deep.equal(wideKeys);
  });

  it("never swaps a layout that declares no counterpart", async () => {
    const { el, changes } = await mount(NARROW_PX, { layout: "qwerty", "auto-compact": "" });

    expect(changes).to.deep.equal([]);
    expect(readDataKeys(el).flat(), "qwerty is still on screen").to.include("q");
  });

  it("tiers a custom layout by the counterpart it declares itself", async () => {
    const { el, changes, resize } = await mount(WIDE_PX, { layout: "home", "auto-compact": "" }, ...pair());
    expect(readDataKeys(el)).to.deep.equal([["{layout:away}", "h"]]);

    await resize(NARROW_PX);
    expect(changes).to.deep.equal([{ layout: "home-c", autoDetected: true }]);
    expect(readDataKeys(el)).to.deep.equal([["hc"]]);

    await resize(WIDE_PX);
    expect(readDataKeys(el)).to.deep.equal([["{layout:away}", "h"]]);
  });

  it("keeps the layout when the counterpart it names is not registered", async () => {
    const { el, changes } = await mount(
      NARROW_PX,
      { layout: "lonely", "auto-compact": "" },
      customLayout({ name: "lonely", rows: [[{ value: "l" }]], compact: "nowhere" }),
    );

    expect(changes, "an unresolvable counterpart is not a layout change").to.deep.equal([]);
    // Specifically not the locale default: a consumer who named a missing layout
    // keeps the one they asked for.
    expect(readDataKeys(el)).to.deep.equal([["l"]]);
  });

  it("lets an explicit request win while narrow, and re-tiers from that request", async () => {
    const { el, changes, resize } = await mount(NARROW_PX, { layout: "away", "auto-compact": "" }, ...pair());
    expect(readDataKeys(el), "away declares no counterpart").to.deep.equal([["a"]]);

    el.layout = "home";
    await settle();

    // The request applied, and the tier then resolved against it rather than
    // against the layout it replaced.
    expect(changes).to.deep.equal([{ layout: "home-c", autoDetected: true }]);
    expect(readDataKeys(el)).to.deep.equal([["hc"]]);

    await resize(WIDE_PX);
    expect(readDataKeys(el), "the new request is what the room returns to").to.deep.equal([["{layout:away}", "h"]]);
  });

  it("fires layout-change with autoDetected false for a request and true for a tier swap", async () => {
    const requested = await mount(WIDE_PX, { layout: "home", "auto-compact": "" }, ...pair());
    requireKey(requested.el, "{layout:away}").click();
    await settle();

    expect(requested.changes).to.deep.equal([{ layout: "away", autoDetected: false }]);

    const tiered = await mount(NARROW_PX, { layout: "home", "auto-compact": "" }, ...pair());
    expect(tiered.changes).to.deep.equal([{ layout: "home-c", autoDetected: true }]);
  });

  it("follows the focused key to the seat the compact form gives it", async () => {
    const { el, resize } = await mount(WIDE_PX, { layout: "ja-kana", "auto-compact": "" });
    const backspace = requireKey(el, "{backspace}");
    expect(backspace.dataset.rowIndex, "the wide form seats Backspace on the digit row").to.equal("0");
    expect(backspace.dataset.keyIndex).to.equal("11");
    backspace.focus();

    await resize(NARROW_PX);

    // Key elements are identified by their grid position, so without the follow
    // the element at (0,11) is unmounted and focus falls to the document body.
    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused, "focus was not dropped to the document").to.not.be.null;
    expect(focused!.dataset.key, "focus is still on Backspace").to.equal("{backspace}");
    expect(focused!.getAttribute("tabindex"), "and it carries the tab stop").to.equal("0");
  });

  it("anchors on the first key when the swap drops the focused key", async () => {
    const { el, resize } = await mount(WIDE_PX, { layout: "ja-kana", "auto-compact": "" });
    // 。 has a key of its own only in the wide form, and the seat it holds there
    // (4,5) belongs to Backspace in the compact one.
    requireKey(el, "。").focus();

    await resize(NARROW_PX);

    const focused = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(focused, "focus was not dropped to the document").to.not.be.null;
    expect(focused!.dataset.rowIndex, "it anchored on the first key").to.equal("0");
    expect(focused!.dataset.keyIndex).to.equal("0");
  });

  it("announces the layout the width picked, in both directions", async () => {
    const { el, resize } = await mount(WIDE_PX, { layout: "ja-kana", "auto-compact": "" });
    const announced = () => el.shadowRoot!.querySelector('[role="status"]')!.textContent ?? "";
    expect(announced(), "a keyboard with room to spare announces nothing").to.equal("");

    await resize(NARROW_PX);
    expect(announced()).to.equal("Keyboard layout changed to ja-kana-compact");

    // A distinct text every time: a live region drops a repeat of what it already
    // holds, so alternating swaps would announce only the first.
    await resize(WIDE_PX);
    expect(announced()).to.equal("Keyboard layout changed to ja-kana");
  });

  it("says nothing when the layout switch was asked for", async () => {
    const { el } = await mount(WIDE_PX, { layout: "ja-kana", "auto-compact": "" });

    el.layout = "qwerty";
    await settle();

    // A switch the user asked for is its own feedback, and it moves focus onto
    // the key it followed, which announces itself.
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent ?? "").to.equal("");
  });

  it("tiers on the threshold custom property rather than a fixed width", async () => {
    const { el, changes, resize } = await mount(WIDE_PX, { layout: "home", "auto-compact": "" }, ...pair());
    expect(changes, "600px clears the 22rem default").to.deep.equal([]);

    el.style.setProperty("--kiosk-keyboard-auto-compact-threshold", "40rem");
    // A threshold move alone does not re-observe, so it lands with the next
    // observation the box delivers.
    await resize(WIDE_PX - 1);

    expect(changes).to.deep.equal([{ layout: "home-c", autoDetected: true }]);
    expect(readDataKeys(el)).to.deep.equal([["hc"]]);
  });
});
