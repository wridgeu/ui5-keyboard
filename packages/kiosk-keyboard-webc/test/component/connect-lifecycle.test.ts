import { expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import { captureConsole } from "../helpers/console.js";

const DOM = KioskKeyboard.DOM;

const nextRender = renderFinished;

function makeKeyboard(): KioskKeyboard {
  return document.createElement("kiosk-keyboard") as KioskKeyboard;
}

function firstKey(el: KioskKeyboard): HTMLElement {
  const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.key);
  if (!key) throw new Error("the keyboard rendered no keycap");
  return key;
}

/** Dispatches a cancelable touchstart on a keycap and reports whether a listener handled it. */
function touchStartPrevented(el: KioskKeyboard): boolean {
  const event = new Event("touchstart", { bubbles: true, cancelable: true, composed: true });
  firstKey(el).dispatchEvent(event);
  return event.defaultPrevented;
}

describe("connect lifecycle", () => {
  let hosts: HTMLElement[] = [];

  function container(): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    hosts.push(host);
    return host;
  }

  afterEach(() => {
    for (const host of hosts) host.remove();
    hosts = [];
  });

  it("opens once when open is set before the element finishes connecting", async () => {
    const kb = makeKeyboard();
    kb.docked = true;
    container().append(kb);

    let opened = 0;
    kb.addEventListener("after-open", () => opened++);
    // isConnected is already true here, but onEnterDOM has not run yet: this is
    // the window a post-parse custom-element upgrade lands in.
    kb.open = true;
    await nextRender();

    expect(kb.open).to.equal(true);
    expect(opened).to.equal(1);
  });

  it("opens regardless of the order open and docked are set in", async () => {
    const kb = makeKeyboard();
    container().append(kb);

    const warnings = await captureConsole("warn", async () => {
      kb.setAttribute("open", "");
      kb.setAttribute("docked", "");
      await nextRender();
    });

    expect(kb.open).to.equal(true);
    expect(warnings.join(" ")).to.not.contain("no effect when docked=false");
  });

  it("arms its listeners once when connect runs twice without a disconnect", async () => {
    const kb = makeKeyboard();
    kb.docked = true;
    const from = container();
    const to = container();

    // A synchronous reparent inside the async connect window reaches onEnterDOM
    // twice with no onExitDOM in between.
    from.append(kb);
    to.append(kb);
    await nextRender();

    expect(touchStartPrevented(kb), "the surviving arm still handles touch").to.equal(true);

    const detached = kb.shadowRoot!;
    kb.remove();
    await nextRender();

    const event = new Event("touchstart", { bubbles: true, cancelable: true, composed: true });
    detached.querySelector<HTMLElement>(DOM.selectors.key)!.dispatchEvent(event);
    expect(event.defaultPrevented, "teardown removed every armed listener").to.equal(false);
  });

  it("opens once when connect runs twice without a disconnect", async () => {
    const kb = makeKeyboard();
    kb.docked = true;
    kb.open = true;

    let opened = 0;
    kb.addEventListener("after-open", () => opened++);

    const from = container();
    const to = container();
    from.append(kb);
    to.append(kb);
    await nextRender();

    expect(kb.open, "the keyboard is open").to.equal(true);
    expect(opened, "the second onEnterDOM does not re-open an open keyboard").to.equal(1);
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await nextRender();
    }
  }

  it("a detached keyboard arms no listeners and does not open on reattach", async () => {
    const host = container();
    const input = document.createElement("input");
    const kb = makeKeyboard();
    kb.mobileKeyboard = "Custom";
    host.append(input, kb);
    await nextRender();
    kb.remove();
    const events: string[] = [];
    kb.addEventListener("active-control-change", () => events.push("active-control-change"));
    kb.addEventListener("after-open", () => events.push("after-open"));

    kb.docked = true;
    kb.autoShow = true;
    input.focus();
    await settle();
    expect(kb.open, "detached").to.equal(false);

    host.append(kb);
    await settle();
    expect(kb.open, "reattached").to.equal(false);
    expect(events).to.deep.equal([]);
  });

  it("auto-show still opens after a detach and reattach", async () => {
    const host = container();
    const input = document.createElement("input");
    const kb = makeKeyboard();
    kb.mobileKeyboard = "Custom";
    kb.docked = true;
    kb.autoShow = true;
    host.append(input, kb);
    await nextRender();
    kb.remove();
    host.append(kb);
    await settle();

    input.focus();
    await settle();
    expect(kb.open).to.equal(true);
  });

  it("a rejected open leaves no open attribute", async () => {
    const kb = makeKeyboard();
    kb.setAttribute("open", "");
    await captureConsole("warn", async () => {
      container().append(kb);
      await settle();
    });

    expect(kb.open).to.equal(false);
    expect(kb.hasAttribute("open")).to.equal(false);
  });

  it("moving an open keyboard drops the open attribute with the property", async () => {
    const host = container();
    const kb = makeKeyboard();
    kb.mobileKeyboard = "Custom";
    kb.docked = true;
    host.append(kb);
    await nextRender();
    kb.show();
    await settle();
    expect(kb.hasAttribute("open"), "precondition: open reflected").to.equal(true);

    kb.remove();
    host.append(kb);
    await settle();
    expect(kb.open).to.equal(false);
    expect(kb.hasAttribute("open")).to.equal(false);
  });
});
