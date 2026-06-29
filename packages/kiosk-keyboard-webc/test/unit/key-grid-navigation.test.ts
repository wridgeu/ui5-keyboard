import { describe, it, expect, afterEach, vi } from "vitest";
import { KeyGridNavigation, type KeyGridNavigationHost } from "../../src/core/key-grid-navigation.js";
import type { LayoutDefinition } from "../../src/types.js";

// QWERTY-shaped variable-width grid: the case a single-`rowSize`
// ItemNavigation cannot express, and the reason this navigator is hand-rolled.
const ROW_LENS = [11, 10, 9, 9, 5];
const COMPONENT_ID = "kb";

function buildLayout(rowLens: number[]): LayoutDefinition {
  return rowLens.map((len) => Array.from({ length: len }, (_, c) => ({ value: `k${c}` })));
}

interface Grid {
  nav: KeyGridNavigation;
  shadow: ShadowRoot;
  keyAt: (row: number, col: number) => HTMLElement;
  press: (el: HTMLElement, key: string, opts?: KeyboardEventInit) => KeyboardEvent;
  tabbableIds: () => string[];
}

/**
 * Renders the grid into a real (jsdom) shadow root the way the component does,
 * wires the navigator as the keydown handler, and exposes helpers to drive and
 * observe it through its public surface only.
 */
function makeGrid(rowLens: number[] = ROW_LENS): Grid {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  rowLens.forEach((len, r) => {
    const rowEl = document.createElement("div");
    rowEl.className = "kiosk-row";
    for (let c = 0; c < len; c++) {
      const key = document.createElement("div");
      key.id = `${COMPONENT_ID}-key-${r}-${c}`;
      key.className = "kiosk-key";
      key.setAttribute("role", "button");
      key.setAttribute("data-key", `k${c}`);
      key.setAttribute("tabindex", r === 0 && c === 0 ? "0" : "-1");
      rowEl.appendChild(key);
    }
    shadow.appendChild(rowEl);
  });

  const layout = buildLayout(rowLens);
  const hostBridge: KeyGridNavigationHost = {
    getResolvedLayout: () => layout,
    getShadowRoot: () => shadow,
    getComponentId: () => COMPONENT_ID,
  };
  const nav = new KeyGridNavigation(hostBridge);
  shadow.addEventListener("keydown", (e) => nav.onKeyDown(e as KeyboardEvent));

  const keyAt = (row: number, col: number) => shadow.getElementById(`${COMPONENT_ID}-key-${row}-${col}`) as HTMLElement;

  const press = (el: HTMLElement, key: string, opts: KeyboardEventInit = {}) => {
    el.focus();
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
    el.dispatchEvent(ev);
    return ev;
  };

  const tabbableIds = () =>
    Array.from(shadow.querySelectorAll<HTMLElement>('.kiosk-key[tabindex="0"]')).map((k) => k.id);

  return { nav, shadow, keyAt, press, tabbableIds };
}

let grids: Grid[] = [];
function grid(rowLens?: number[]): Grid {
  const g = makeGrid(rowLens);
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
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-0-1");
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowLeft moves to the previous column in the same row", () => {
    const g = grid();
    g.press(g.keyAt(0, 5), "ArrowLeft");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-0-4");
  });

  it("ArrowDown moves to the same column in the next row", () => {
    const g = grid();
    g.press(g.keyAt(0, 3), "ArrowDown");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-1-3");
  });

  it("ArrowUp moves to the same column in the previous row", () => {
    const g = grid();
    g.press(g.keyAt(2, 3), "ArrowUp");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-1-3");
  });
});

describe("KeyGridNavigation - row-boundary continuation (APG layout grid)", () => {
  it("ArrowRight at the row end continues onto the first key of the next row", () => {
    const g = grid();
    g.press(g.keyAt(0, 10), "ArrowRight"); // row 0 has 11 keys (0..10)
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-1-0");
  });

  it("ArrowLeft at the row start continues onto the last key of the previous row", () => {
    const g = grid();
    g.press(g.keyAt(1, 0), "ArrowLeft");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-0-10");
  });
});

describe("KeyGridNavigation - edges do not wrap (focus stays, scroll prevented)", () => {
  it("ArrowLeft at the first key of the grid stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 0), "ArrowLeft");
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
    expect(g.keyAt(0, 0).getAttribute("tabindex")).toBe("0");
    expect(ev.defaultPrevented).toBe(true); // handled key: page does not scroll
  });

  it("ArrowRight at the last key of the grid stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(4, 4), "ArrowRight"); // last row, last key
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowUp at the top row stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 3), "ArrowUp");
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ArrowDown at the bottom row stays put", () => {
    const g = grid();
    const ev = g.press(g.keyAt(4, 0), "ArrowDown");
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("KeyGridNavigation - column clamping on variable-width rows", () => {
  it("ArrowDown clamps the column to the narrower target row", () => {
    const g = grid();
    // row 0 col 10 -> row 1 (10 keys, max col 9): clamp to col 9, not skip a row
    g.press(g.keyAt(0, 10), "ArrowDown");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-1-9");
  });

  it("ArrowDown clamps again descending into an even narrower row", () => {
    const g = grid();
    // row 1 col 9 -> row 2 (9 keys, max col 8): clamp to col 8
    g.press(g.keyAt(1, 9), "ArrowDown");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-2-8");
  });

  it("ArrowUp keeps the column when the target row is wide enough (no clamp)", () => {
    const g = grid();
    // row 1 col 9 -> row 0 (11 keys): no clamp needed, stays col 9
    g.press(g.keyAt(1, 9), "ArrowUp");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-0-9");
  });
});

describe("KeyGridNavigation - Home / End", () => {
  it("Home moves to the first column of the current row", () => {
    const g = grid();
    g.press(g.keyAt(1, 5), "Home");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-1-0");
  });

  it("End moves to the last column of the current row", () => {
    const g = grid();
    g.press(g.keyAt(1, 5), "End");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-1-9");
  });

  it("Ctrl+Home jumps to the first key of the whole grid", () => {
    const g = grid();
    g.press(g.keyAt(3, 3), "Home", { ctrlKey: true });
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-0-0");
  });

  it("Ctrl+End jumps to the last key of the whole grid", () => {
    const g = grid();
    g.press(g.keyAt(1, 2), "End", { ctrlKey: true });
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-4-4");
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
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
  });

  it("Space activates the focused key", () => {
    const g = grid();
    const key = g.keyAt(1, 2);
    const onClick = vi.fn();
    key.addEventListener("click", onClick);
    g.press(key, " ");
    expect(onClick).toHaveBeenCalledOnce();
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
});

describe("KeyGridNavigation - roving tabindex", () => {
  it("keeps exactly one key tabbable as focus moves", () => {
    const g = grid();
    expect(g.tabbableIds()).toEqual(["kb-key-0-0"]);

    let current = g.keyAt(0, 0);
    for (const key of ["ArrowRight", "ArrowDown", "ArrowDown", "End", "ArrowUp"]) {
      g.press(current, key);
      const tabbable = g.tabbableIds();
      expect(tabbable).toHaveLength(1);
      current = g.shadow.getElementById(tabbable[0]!) as HTMLElement;
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
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
  });

  it("ignores unhandled keys", () => {
    const g = grid();
    const ev = g.press(g.keyAt(0, 0), "Escape");
    expect(ev.defaultPrevented).toBe(false);
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
  });
});

describe("KeyGridNavigation - last-focused-key tracking", () => {
  it("exposes and clears the last focused key id", () => {
    const g = grid();
    g.press(g.keyAt(0, 0), "ArrowRight");
    expect(g.nav.getLastFocusedKeyId()).toBe("kb-key-0-1");
    g.nav.setLastFocusedKeyId(null);
    expect(g.nav.getLastFocusedKeyId()).toBeNull();
  });
});
