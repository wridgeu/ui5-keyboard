import { describe, it, expect, afterEach, vi } from "vitest";
import { KeyGridNavigation, type KeyGridNavigationHost } from "../../src/core/key-grid-navigation.js";
import type { KeyPosition } from "../../src/core/dom-utils.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";
import type { LayoutDefinition } from "../../src/types.js";

// QWERTY-shaped variable-width grid: the case a single-`rowSize`
// ItemNavigation cannot express, and the reason this navigator is hand-rolled.
const ROW_LENS = [11, 10, 9, 9, 5];

function buildLayout(rowLens: number[]): LayoutDefinition {
  return rowLens.map((len) => Array.from({ length: len }, (_, c) => ({ value: `k${c}` })));
}

interface Grid {
  nav: KeyGridNavigation;
  shadow: ShadowRoot;
  keyAt: (row: number, col: number) => HTMLElement;
  press: (el: HTMLElement, key: string, opts?: KeyboardEventInit) => KeyboardEvent;
  release: (el: HTMLElement, key: string, opts?: KeyboardEventInit) => KeyboardEvent;
  /** The grid position the navigator last reported as pressed, or null. */
  pressedKey: () => KeyPosition | null;
  tabbable: () => Array<{ row: number; col: number }>;
}

/**
 * Renders the grid into a real (jsdom) shadow root the way the component does,
 * wires the navigator as the keydown handler, and exposes helpers to drive and
 * observe it through its public surface only.
 *
 * The keys carry no `id`: navigation resolves through the grid coordinate
 * alone, so a fixture without ids proves no lookup falls back to one.
 */
function makeGrid(rowLens: number[] = ROW_LENS, rtl = false): Grid {
  const host = document.createElement("div");
  host.setAttribute("dir", rtl ? "rtl" : "ltr");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  rowLens.forEach((len, r) => {
    const rowEl = document.createElement("div");
    rowEl.className = "kiosk-row";
    for (let c = 0; c < len; c++) {
      const key = document.createElement("div");
      key.className = "kiosk-key";
      key.setAttribute("role", "button");
      key.setAttribute("data-key", `k${c}`);
      key.setAttribute(DOM.attributes.rowIndex, String(r));
      key.setAttribute(DOM.attributes.keyIndex, String(c));
      key.setAttribute("tabindex", r === 0 && c === 0 ? "0" : "-1");
      rowEl.appendChild(key);
    }
    shadow.appendChild(rowEl);
  });

  const layout = buildLayout(rowLens);
  let pressedKey: KeyPosition | null = null;
  const hostBridge: KeyGridNavigationHost = {
    getResolvedLayout: () => layout,
    getShadowRoot: () => shadow,
    isRtl: () => rtl,
    setPressedKey: (pos) => {
      pressedKey = pos;
    },
  };
  const nav = new KeyGridNavigation(hostBridge);
  shadow.addEventListener("keydown", (e) => nav.onKeyDown(e as KeyboardEvent));
  shadow.addEventListener("keyup", (e) => nav.onKeyUp(e as KeyboardEvent));

  const keyAt = (row: number, col: number) =>
    shadow.querySelector<HTMLElement>(DOM.selectors.keyByPosition(row, col)) as HTMLElement;

  const press = (el: HTMLElement, key: string, opts: KeyboardEventInit = {}) => {
    el.focus();
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
    el.dispatchEvent(ev);
    return ev;
  };

  const release = (el: HTMLElement, key: string, opts: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true, ...opts });
    el.dispatchEvent(ev);
    return ev;
  };

  const tabbable = () =>
    Array.from(shadow.querySelectorAll<HTMLElement>(DOM.selectors.focusableKey)).map((k) => ({
      row: Number(k.getAttribute(DOM.attributes.rowIndex)),
      col: Number(k.getAttribute(DOM.attributes.keyIndex)),
    }));

  return { nav, shadow, keyAt, press, release, tabbable, pressedKey: () => pressedKey };
}

let grids: Grid[] = [];
function grid(rowLens?: number[], rtl?: boolean): Grid {
  const g = makeGrid(rowLens, rtl);
  grids.push(g);
  return g;
}

afterEach(() => {
  for (const g of grids) g.shadow.host.remove();
  grids = [];
});

describe("KeyGridNavigation - arrow movement", () => {
  it("ArrowRight moves to the next column in the same row", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 0), "ArrowRight");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 1 });
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowLeft moves to the previous column in the same row", () => {
    const g = grid();
    g.press(g.keyAt(0, 5), "ArrowLeft");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 4 });
  });

  it("ArrowDown moves to the same column in the next row", () => {
    const g = grid();
    g.press(g.keyAt(0, 3), "ArrowDown");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 3 });
  });

  it("ArrowUp moves to the same column in the previous row", () => {
    const g = grid();
    g.press(g.keyAt(2, 3), "ArrowUp");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 3 });
  });
});

describe("KeyGridNavigation - row-boundary continuation (APG layout grid)", () => {
  it("ArrowRight at the row end continues onto the first key of the next row", () => {
    const g = grid();
    g.press(g.keyAt(0, 10), "ArrowRight"); // row 0 has 11 keys (0..10)
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 0 });
  });

  it("ArrowLeft at the row start continues onto the last key of the previous row", () => {
    const g = grid();
    g.press(g.keyAt(1, 0), "ArrowLeft");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 10 });
  });
});

describe("KeyGridNavigation - edges do not wrap (focus stays, scroll prevented)", () => {
  it("ArrowLeft at the first key of the grid stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 0), "ArrowLeft");
    expect(g.nav.getLastFocusedKey()).toBeNull();
    expect(g.keyAt(0, 0).getAttribute("tabindex")).toBe("0");
    expect(ev.defaultPrevented).toBe(true); // handled key: page does not scroll
  });

  it("ArrowRight at the last key of the grid stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(4, 4), "ArrowRight"); // last row, last key
    expect(g.nav.getLastFocusedKey()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowUp at the top row stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 3), "ArrowUp");
    expect(g.nav.getLastFocusedKey()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowDown at the bottom row stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(4, 0), "ArrowDown");
    expect(g.nav.getLastFocusedKey()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("KeyGridNavigation - column clamping on variable-width rows", () => {
  it("ArrowDown clamps the column to the narrower target row", () => {
    const g = grid();
    // row 0 col 10 -> row 1 (10 keys, max col 9): clamp to col 9, not skip a row
    g.press(g.keyAt(0, 10), "ArrowDown");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 9 });
  });

  it("ArrowDown clamps again descending into an even narrower row", () => {
    const g = grid();
    // row 1 col 9 -> row 2 (9 keys, max col 8): clamp to col 8
    g.press(g.keyAt(1, 9), "ArrowDown");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 2, col: 8 });
  });

  it("ArrowUp keeps the column when the target row is wide enough (no clamp)", () => {
    const g = grid();
    // row 1 col 9 -> row 0 (11 keys): no clamp needed, stays col 9
    g.press(g.keyAt(1, 9), "ArrowUp");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 9 });
  });
});

describe("KeyGridNavigation - Home / End", () => {
  it("Home moves to the first column of the current row", () => {
    const g = grid();
    g.press(g.keyAt(1, 5), "Home");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 0 });
  });

  it("End moves to the last column of the current row", () => {
    const g = grid();
    g.press(g.keyAt(1, 5), "End");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 9 });
  });

  it("Ctrl+Home jumps to the first key of the whole grid", () => {
    const g = grid();
    g.press(g.keyAt(3, 3), "Home", { ctrlKey: true });
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 0 });
  });

  it("Ctrl+End jumps to the last key of the whole grid", () => {
    const g = grid();
    g.press(g.keyAt(1, 2), "End", { ctrlKey: true });
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 4, col: 4 });
  });
});

describe("KeyGridNavigation - RTL horizontal arrows", () => {
  it("ArrowLeft moves visually forward within the row", () => {
    const g = grid(ROW_LENS, true);
    g.press(g.keyAt(0, 0), "ArrowLeft");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 1 });
  });

  it("ArrowRight stays put at the first key of the grid", () => {
    const g = grid(ROW_LENS, true);
    const ev = g.press(g.keyAt(0, 0), "ArrowRight");
    expect(g.nav.getLastFocusedKey()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowRight at the start of a row continues onto the previous row", () => {
    const g = grid(ROW_LENS, true);
    g.press(g.keyAt(1, 0), "ArrowRight");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: ROW_LENS[0]! - 1 });
  });

  it("ArrowLeft at the end of a row continues onto the next row", () => {
    const g = grid(ROW_LENS, true);
    g.press(g.keyAt(0, ROW_LENS[0]! - 1), "ArrowLeft");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 1, col: 0 });
  });
});

describe("KeyGridNavigation - activation (Enter / Space)", () => {
  it("Enter activates the focused key without moving focus", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    const ev = g.press(key, "Enter");
    expect(onClick).toHaveBeenCalledOnce();
    expect(ev.defaultPrevented).toBe(true);
    expect(g.nav.getLastFocusedKey()).toBeNull();
  });

  it("Space does not activate on press, but suppresses the page scroll", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    const ev = g.press(key, " ");
    expect(onClick).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("Space activates the focused key on release", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.press(key, " ");
    const ev = g.release(key, " ");
    expect(onClick).toHaveBeenCalledOnce();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("a held Space does not repeat-activate and yields one click on release", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.press(key, " ");
    g.press(key, " ", { repeat: true });
    g.press(key, " ", { repeat: true });
    expect(onClick).not.toHaveBeenCalled();
    g.release(key, " ");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("a Space release with no matching press does not activate", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.release(key, " ");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not activate when a modifier is held (Ctrl/Alt/Meta)", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    const ev = g.press(key, "Enter", { ctrlKey: true });
    expect(onClick).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it("Enter carries Shift onto the activation click", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.press(key, "Enter", { shiftKey: true });
    expect(onClick).toHaveBeenCalledOnce();
    expect((onClick.mock.calls[0]![0] as MouseEvent).shiftKey).toBe(true);
  });

  it("Space carries Shift onto the activation click at release", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.press(key, " ", { shiftKey: true });
    g.release(key, " ", { shiftKey: true });
    expect((onClick.mock.calls[0]![0] as MouseEvent).shiftKey).toBe(true);
  });

  it("an unmodified activation click carries no Shift", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.press(key, "Enter");
    expect((onClick.mock.calls[0]![0] as MouseEvent).shiftKey).toBe(false);
  });
});

describe("KeyGridNavigation - keyboard press feedback", () => {
  it("reports the key pressed while Enter is held and clears it on release", () => {
    const g = grid();
    const key = g.keyAt(1, 2);

    g.press(key, "Enter");
    expect(g.pressedKey()).toEqual({ row: 1, col: 2 });
    expect(key.classList.contains(DOM.classes.keyPressed)).toBe(true);

    g.release(key, "Enter");
    expect(g.pressedKey()).toBeNull();
    expect(key.classList.contains(DOM.classes.keyPressed)).toBe(false);
  });

  it("reports the key pressed for the whole Space hold, through the activating release", () => {
    const g = grid();
    const key = g.keyAt(1, 2);

    g.press(key, " ");
    expect(g.pressedKey()).toEqual({ row: 1, col: 2 });

    g.release(key, " ");
    expect(g.pressedKey()).toBeNull();
    expect(key.classList.contains(DOM.classes.keyPressed)).toBe(false);
  });

  it("clears the pressed report when focus leaves before the release", () => {
    const g = grid();
    const key = g.keyAt(1, 2);

    g.press(key, "Enter");
    expect(g.pressedKey()).toEqual({ row: 1, col: 2 });

    g.nav.onFocusOut();
    expect(g.pressedKey()).toBeNull();
    expect(key.classList.contains(DOM.classes.keyPressed)).toBe(false);
  });

  it("a Space release after focus loss does not activate", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);

    g.press(key, " ");
    g.nav.onFocusOut();
    g.release(key, " ");

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("KeyGridNavigation - roving tabindex", () => {
  it("keeps exactly one key tabbable as focus moves", () => {
    const g = grid();
    expect(g.tabbable()).toEqual([{ row: 0, col: 0 }]);

    let current = g.keyAt(0, 0);
    for (const key of ["ArrowRight", "ArrowDown", "ArrowDown", "End", "ArrowUp"]) {
      g.press(current, key);
      const tabbable = g.tabbable();
      expect(tabbable).toHaveLength(1);
      current = g.keyAt(tabbable[0]!.row, tabbable[0]!.col);
    }
  });

  it("demotes the previous key and promotes the next on a move", () => {
    const g = grid();
    g.press(g.keyAt(0, 0), "ArrowRight");
    expect(g.keyAt(0, 0).getAttribute("tabindex")).toBe("-1");
    expect(g.keyAt(0, 1).getAttribute("tabindex")).toBe("0");
  });
});

describe("KeyGridNavigation - non-key and no-op events", () => {
  it("ignores keydown that does not originate from a key", () => {
    const g = grid();
    const stray = document.createElement("div");
    g.shadow.appendChild(stray);
    const ev = g.press(stray, "ArrowRight");
    expect(ev.defaultPrevented).toBe(false);
    expect(g.nav.getLastFocusedKey()).toBeNull();
  });

  it("ignores unhandled keys", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 0), "Escape");
    expect(ev.defaultPrevented).toBe(false);
    expect(g.nav.getLastFocusedKey()).toBeNull();
  });

  it("ignores a key element that carries no grid coordinate", () => {
    const g = grid();
    const origin = g.keyAt(0, 0);
    origin.removeAttribute(DOM.attributes.rowIndex);
    const ev = g.press(origin, "ArrowRight");
    expect(ev.defaultPrevented).toBe(false);
    expect(g.nav.getLastFocusedKey()).toBeNull();
  });
});

describe("KeyGridNavigation - element ids take no part in resolution", () => {
  it("moves onto the coordinate neighbour whatever id it carries", () => {
    const g = grid();
    const target = g.keyAt(0, 1);
    target.id = "not-a-key-id";
    g.press(g.keyAt(0, 0), "ArrowRight");
    expect(g.shadow.activeElement).toBe(target);
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 1 });
  });
});

describe("KeyGridNavigation - last-focused-key tracking", () => {
  it("exposes and clears the last focused key position", () => {
    const g = grid();
    g.press(g.keyAt(0, 0), "ArrowRight");
    expect(g.nav.getLastFocusedKey()).toEqual({ row: 0, col: 1 });
    g.nav.setLastFocusedKey(null);
    expect(g.nav.getLastFocusedKey()).toBeNull();
  });
});
