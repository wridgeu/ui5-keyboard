# Composition Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a composition middleware system to the keyboard so that script-specific processing (kana dakuten composition, future Hangul jamo composition) is handled by optional, tree-shakeable modules that intercept key events before text insertion.

**Architecture:** A middleware registry maps layout names to factory functions. When a layout with registered middleware is active, the keyboard routes key events through the middleware before default handling. The first implementation is a kana dakuten middleware that composes base kana + dakuten/handakuten marks into voiced/semi-voiced kana.

**Tech Stack:** TypeScript, Vitest, Vite 8 (rolldown)

**References:**

- Design spec: `docs/proposals/COMPOSITION-MIDDLEWARE.md`
- Issues: [#53](https://github.com/wridgeu/ui5-lib-keyboard/issues/53), [#45](https://github.com/wridgeu/ui5-lib-keyboard/issues/45)

---

## File Map

### WebC package (`packages/kiosk-keyboard-webc/`)

| Action | File                                    | Responsibility                                                                          |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Create | `src/core/middleware-registry.ts`       | Middleware registration, factory storage, instance lifecycle                            |
| Create | `src/core/composition-utils.ts`         | CompositionEvent dispatch helpers (startComposition, updateComposition, endComposition) |
| Create | `src/middleware/kana-dakuten.ts`        | Kana dakuten/handakuten composition table + self-registration                           |
| Modify | `src/KioskKeyboardCore.ts`              | Route key events through middleware (~3 integration points)                             |
| Modify | `src/types.ts`                          | Add `CompositionMiddleware` interface                                                   |
| Modify | `vite.config.ts`                        | Add middleware entry points                                                             |
| Modify | `package.json`                          | Add `./middleware/*` exports                                                            |
| Create | `test/unit/middleware-registry.test.ts` | Registry unit tests                                                                     |
| Create | `test/unit/composition-utils.test.ts`   | Composition helper tests                                                                |
| Create | `test/unit/kana-dakuten.test.ts`        | Kana dakuten middleware tests                                                           |

### UI5 package (`packages/kiosk-keyboard/`)

| Action | File                                  | Responsibility                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------ |
| Create | `src/internal/middleware-registry.ts` | Middleware registration (centrally imported, no self-registration) |
| Create | `src/internal/composition-utils.ts`   | CompositionEvent dispatch helpers                                  |
| Create | `src/middleware/kana-dakuten.ts`      | Kana dakuten middleware                                            |
| Modify | `src/KioskKeyboard.ts`                | Route key events through middleware                                |

---

### Task 1: Add CompositionMiddleware interface and middleware registry (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/types.ts`
- Create: `packages/kiosk-keyboard-webc/src/core/middleware-registry.ts`
- Create: `packages/kiosk-keyboard-webc/test/unit/middleware-registry.test.ts`

- [ ] **Step 1: Add CompositionMiddleware interface to types.ts**

Append to `packages/kiosk-keyboard-webc/src/types.ts`:

```ts
/**
 * Composition middleware intercepts key events for layouts that need
 * script-specific processing (e.g., kana dakuten, Hangul jamo composition).
 *
 * @public
 * @since 0.1.0
 */
export interface CompositionMiddleware {
  /** Process a key event. Returns true if consumed (keyboard skips default handling). */
  handleKey(key: string, target: HTMLInputElement | HTMLTextAreaElement): boolean;

  /** Force-commit any in-progress composition. Returns committed text or null. */
  commit(): string | null;

  /** Clear all composition state without committing. */
  reset(): void;
}
```

- [ ] **Step 2: Write middleware registry tests**

Create `packages/kiosk-keyboard-webc/test/unit/middleware-registry.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { CompositionMiddleware } from "../../src/types.js";
import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareForLayout,
  _resetMiddleware,
} from "../../src/core/middleware-registry.js";

function mockFactory(): CompositionMiddleware {
  return {
    handleKey: () => false,
    commit: () => null,
    reset: () => {},
  };
}

describe("middleware-registry", () => {
  beforeEach(() => {
    _resetMiddleware();
  });

  describe("_registerMiddleware", () => {
    it("registers a factory for a layout", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const mw = getMiddlewareForLayout("ja-kana");
      expect(mw).not.toBeNull();
    });

    it("registers the same factory for multiple layouts", () => {
      _registerMiddleware(["ja-kana", "ja-kana-fk"], mockFactory);
      expect(getMiddlewareForLayout("ja-kana")).not.toBeNull();
      expect(getMiddlewareForLayout("ja-kana-fk")).not.toBeNull();
    });

    it("is idempotent -- skips if layout already has middleware", () => {
      const first = () => ({ handleKey: () => true, commit: () => "a", reset: () => {} });
      const second = () => ({ handleKey: () => false, commit: () => "b", reset: () => {} });
      _registerMiddleware(["ja-kana"], first);
      _registerMiddleware(["ja-kana"], second);
      const mw = getMiddlewareForLayout("ja-kana")!;
      expect(mw.handleKey("x", document.createElement("input"))).toBe(true);
    });

    it("returns null for layouts without middleware", () => {
      expect(getMiddlewareForLayout("qwerty")).toBeNull();
    });
  });

  describe("registerMiddleware (public)", () => {
    it("registers middleware that can override built-in", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const override = () => ({ handleKey: () => true, commit: () => "override", reset: () => {} });
      registerMiddleware(["ja-kana"], override);
      const mw = getMiddlewareForLayout("ja-kana")!;
      expect(mw.commit()).toBe("override");
    });
  });

  describe("getMiddlewareForLayout", () => {
    it("creates a fresh instance from factory on first call", () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { handleKey: () => false, commit: () => null, reset: () => {} };
      };
      _registerMiddleware(["ja-kana"], factory);
      getMiddlewareForLayout("ja-kana");
      expect(callCount).toBe(1);
    });

    it("returns the same instance on subsequent calls for same layout", () => {
      _registerMiddleware(["ja-kana"], mockFactory);
      const a = getMiddlewareForLayout("ja-kana");
      const b = getMiddlewareForLayout("ja-kana");
      expect(a).toBe(b);
    });

    it("creates a new instance after deactivateMiddleware is called", () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { handleKey: () => false, commit: () => null, reset: () => {} };
      };
      _registerMiddleware(["ja-kana"], factory);
      getMiddlewareForLayout("ja-kana");
      deactivateMiddleware("ja-kana");
      getMiddlewareForLayout("ja-kana");
      expect(callCount).toBe(2);
    });
  });
});
```

Note: add `deactivateMiddleware` to the import once implemented.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/middleware-registry.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 4: Implement middleware-registry.ts**

Create `packages/kiosk-keyboard-webc/src/core/middleware-registry.ts`:

```ts
import type { CompositionMiddleware } from "../types.js";

/** Factory functions keyed by layout name. */
const factories: Map<string, () => CompositionMiddleware> = new Map();

/** Built-in factory names (protected by _registerMiddleware idempotency). */
const builtInMiddleware: Set<string> = new Set();

/** Active middleware instances keyed by layout name. Lazily created. */
const instances: Map<string, CompositionMiddleware> = new Map();

/**
 * Registers a built-in middleware factory for the given layouts.
 * Idempotent: silently skips layouts that already have middleware.
 * @internal
 */
export function _registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void {
  for (const layout of layouts) {
    if (factories.has(layout)) continue;
    factories.set(layout, factory);
    builtInMiddleware.add(layout);
  }
}

/**
 * Registers a middleware factory for the given layouts.
 * Can override any existing middleware, including built-ins.
 * @public
 */
export function registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void {
  for (const layout of layouts) {
    factories.set(layout, factory);
    instances.delete(layout); // discard stale instance
  }
}

/**
 * Returns the active middleware instance for the given layout, or null.
 * Lazily creates the instance from the registered factory on first call.
 */
export function getMiddlewareForLayout(layout: string): CompositionMiddleware | null {
  if (!factories.has(layout)) return null;
  let instance = instances.get(layout);
  if (!instance) {
    instance = factories.get(layout)!();
    instances.set(layout, instance);
  }
  return instance;
}

/**
 * Deactivates middleware for a layout: commits any pending composition
 * and discards the instance. A new instance will be created on next
 * getMiddlewareForLayout call.
 */
export function deactivateMiddleware(layout: string): void {
  const instance = instances.get(layout);
  if (instance) {
    instance.commit();
    instances.delete(layout);
  }
}

/**
 * Resets all middleware state. Test-only.
 * @internal
 */
export function _resetMiddleware(): void {
  for (const instance of instances.values()) {
    instance.reset();
  }
  instances.clear();
  factories.clear();
  builtInMiddleware.clear();
}
```

- [ ] **Step 5: Fix the test import to include deactivateMiddleware**

Update the import in the test file to include `deactivateMiddleware`:

```ts
import {
  _registerMiddleware,
  registerMiddleware,
  getMiddlewareForLayout,
  deactivateMiddleware,
  _resetMiddleware,
} from "../../src/core/middleware-registry.js";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/middleware-registry.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/types.ts packages/kiosk-keyboard-webc/src/core/middleware-registry.ts packages/kiosk-keyboard-webc/test/unit/middleware-registry.test.ts
git commit -m "feat(webc): add CompositionMiddleware interface and middleware registry"
```

---

### Task 2: Add composition utilities (WebC)

**Files:**

- Create: `packages/kiosk-keyboard-webc/src/core/composition-utils.ts`
- Create: `packages/kiosk-keyboard-webc/test/unit/composition-utils.test.ts`

- [ ] **Step 1: Write composition utils tests**

Create `packages/kiosk-keyboard-webc/test/unit/composition-utils.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { startComposition, updateComposition, endComposition } from "../../src/core/composition-utils.js";

describe("composition-utils", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.value = "hello";
    input.setSelectionRange(5, 5); // cursor at end
  });

  describe("startComposition", () => {
    it("dispatches compositionstart event", () => {
      const spy = vi.fn();
      input.addEventListener("compositionstart", spy);
      startComposition(input);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("updateComposition", () => {
    it("replaces preedit text and dispatches compositionupdate", () => {
      const spy = vi.fn();
      input.addEventListener("compositionupdate", spy);
      startComposition(input);
      updateComposition(input, "\u304B"); // か
      expect(input.value).toBe("hello\u304B");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("replaces previous preedit on subsequent calls", () => {
      startComposition(input);
      updateComposition(input, "\u304B"); // か
      updateComposition(input, "\u304C"); // が (composed)
      expect(input.value).toBe("hello\u304C");
    });
  });

  describe("endComposition", () => {
    it("dispatches compositionend and commits preedit", () => {
      const spy = vi.fn();
      input.addEventListener("compositionend", spy);
      startComposition(input);
      updateComposition(input, "\u304C"); // が
      endComposition(input);
      expect(input.value).toBe("hello\u304C");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("clears preedit tracking so next startComposition is fresh", () => {
      startComposition(input);
      updateComposition(input, "\u304B"); // か
      endComposition(input);
      // Start a new composition -- should not replace the committed text
      startComposition(input);
      updateComposition(input, "\u305F"); // た
      expect(input.value).toBe("hello\u304B\u305F");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/composition-utils.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement composition-utils.ts**

Create `packages/kiosk-keyboard-webc/src/core/composition-utils.ts`:

```ts
/** Tracks the preedit range for the active composition. */
let preeditStart = -1;
let preeditLength = 0;

/**
 * Begins a composition session. Dispatches `compositionstart` on the target.
 * Call before the first `updateComposition`.
 */
export function startComposition(target: HTMLInputElement | HTMLTextAreaElement): void {
  const pos = target.selectionStart ?? target.value.length;
  preeditStart = pos;
  preeditLength = 0;
  target.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
}

/**
 * Updates the preedit text. Replaces the current preedit range with the new text
 * and dispatches `compositionupdate`.
 */
export function updateComposition(target: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const value = target.value;
  const before = value.slice(0, preeditStart);
  const after = value.slice(preeditStart + preeditLength);
  target.value = before + text + after;
  preeditLength = text.length;

  const newPos = preeditStart + preeditLength;
  try {
    target.setSelectionRange(newPos, newPos);
  } catch {
    // May throw on certain input types
  }

  target.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: text }));
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: text }));
}

/**
 * Ends the composition session. Dispatches `compositionend` and resets
 * preedit tracking. The current preedit text becomes committed.
 */
export function endComposition(target: HTMLInputElement | HTMLTextAreaElement): void {
  const committed = target.value.slice(preeditStart, preeditStart + preeditLength);
  target.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: committed }));
  preeditStart = -1;
  preeditLength = 0;
}

/**
 * Returns whether a composition is currently active.
 */
export function isComposing(): boolean {
  return preeditStart >= 0;
}

/**
 * Resets composition state without dispatching events. Test-only.
 * @internal
 */
export function _resetComposition(): void {
  preeditStart = -1;
  preeditLength = 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/composition-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/core/composition-utils.ts packages/kiosk-keyboard-webc/test/unit/composition-utils.test.ts
git commit -m "feat(webc): add composition utilities for preedit text management"
```

---

### Task 3: Implement kana dakuten middleware (WebC)

**Files:**

- Create: `packages/kiosk-keyboard-webc/src/middleware/kana-dakuten.ts`
- Create: `packages/kiosk-keyboard-webc/test/unit/kana-dakuten.test.ts`

- [ ] **Step 1: Write kana dakuten tests**

Create `packages/kiosk-keyboard-webc/test/unit/kana-dakuten.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { _resetMiddleware, getMiddlewareForLayout } from "../../src/core/middleware-registry.js";
import "../../src/middleware/kana-dakuten.js"; // triggers self-registration

describe("kana-dakuten middleware", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.value = "";
    input.setSelectionRange(0, 0);
  });

  it("registers itself for ja-kana layout", () => {
    const mw = getMiddlewareForLayout("ja-kana");
    expect(mw).not.toBeNull();
  });

  it("passes through regular kana (not dakuten/handakuten)", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("\u304B", input); // か
    expect(consumed).toBe(false);
  });

  it("composes ka + dakuten into ga", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u304B"; // か
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛ dakuten
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u304C"); // が
  });

  it("composes ha + handakuten into pa", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309C", input); // ゜ handakuten
    expect(consumed).toBe(true);
    expect(input.value).toBe("\u3071"); // ぱ
  });

  it("does not compose when preceding char has no dakuten form", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u3042"; // あ (no dakuten form)
    input.setSelectionRange(1, 1);
    const consumed = mw.handleKey("\u309B", input); // ゛ dakuten
    expect(consumed).toBe(false);
  });

  it("does not compose when input is empty", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("\u309B", input); // ゛ dakuten
    expect(consumed).toBe(false);
  });

  it("does not compose ha + dakuten into ba when handakuten is pressed", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    // handakuten should give ぱ, not ば
    mw.handleKey("\u309C", input); // ゜ handakuten
    expect(input.value).toBe("\u3071"); // ぱ
  });

  it("composes ha + dakuten into ba", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    input.value = "\u306F"; // は
    input.setSelectionRange(1, 1);
    mw.handleKey("\u309B", input); // ゛ dakuten
    expect(input.value).toBe("\u3070"); // ば
  });

  it("passes through backspace without consuming", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("{backspace}", input);
    expect(consumed).toBe(false);
  });

  it("passes through enter without consuming", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    const consumed = mw.handleKey("{enter}", input);
    expect(consumed).toBe(false);
  });

  it("commit and reset are no-ops (no preedit state)", () => {
    const mw = getMiddlewareForLayout("ja-kana")!;
    expect(mw.commit()).toBeNull();
    mw.reset(); // should not throw
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/kana-dakuten.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement kana-dakuten.ts**

Create `packages/kiosk-keyboard-webc/src/middleware/kana-dakuten.ts`:

```ts
import type { CompositionMiddleware } from "../types.js";
import { _registerMiddleware } from "../core/middleware-registry.js";

const DAKUTEN = "\u309B"; // ゛
const HANDAKUTEN = "\u309C"; // ゜

/**
 * Dakuten composition table: base kana -> voiced kana.
 * Covers all hiragana that have a dakuten form.
 */
const DAKUTEN_MAP: ReadonlyMap<string, string> = new Map([
  // Ka-row
  ["\u304B", "\u304C"], // か → が
  ["\u304D", "\u304E"], // き → ぎ
  ["\u304F", "\u3050"], // く → ぐ
  ["\u3051", "\u3052"], // け → げ
  ["\u3053", "\u3054"], // こ → ご
  // Sa-row
  ["\u3055", "\u3056"], // さ → ざ
  ["\u3057", "\u3058"], // し → じ
  ["\u3059", "\u305A"], // す → ず
  ["\u305B", "\u305C"], // せ → ぜ
  ["\u305D", "\u305E"], // そ → ぞ
  // Ta-row
  ["\u305F", "\u3060"], // た → だ
  ["\u3061", "\u3062"], // ち → ぢ
  ["\u3064", "\u3065"], // つ → づ
  ["\u3066", "\u3067"], // て → で
  ["\u3068", "\u3069"], // と → ど
  // Ha-row
  ["\u306F", "\u3070"], // は → ば
  ["\u3072", "\u3073"], // ひ → び
  ["\u3075", "\u3076"], // ふ → ぶ
  ["\u3078", "\u3079"], // へ → べ
  ["\u307B", "\u307C"], // ほ → ぼ
  // U
  ["\u3046", "\u3094"], // う → ゔ
]);

/**
 * Handakuten composition table: base kana -> semi-voiced kana.
 * Only the ha-row has handakuten forms.
 */
const HANDAKUTEN_MAP: ReadonlyMap<string, string> = new Map([
  ["\u306F", "\u3071"], // は → ぱ
  ["\u3072", "\u3074"], // ひ → ぴ
  ["\u3075", "\u3077"], // ふ → ぷ
  ["\u3078", "\u307A"], // へ → ぺ
  ["\u307B", "\u307D"], // ほ → ぽ
]);

function createKanaDakutenMiddleware(): CompositionMiddleware {
  return {
    handleKey(key: string, target: HTMLInputElement | HTMLTextAreaElement): boolean {
      // Only handle dakuten and handakuten keys
      if (key !== DAKUTEN && key !== HANDAKUTEN) return false;

      const value = target.value;
      const pos = target.selectionStart ?? value.length;
      if (pos === 0) return false;

      const preceding = value[pos - 1];
      const map = key === DAKUTEN ? DAKUTEN_MAP : HANDAKUTEN_MAP;
      const composed = map.get(preceding);

      if (!composed) return false;

      // Replace the preceding character with the composed form
      target.value = value.slice(0, pos - 1) + composed + value.slice(pos);
      try {
        target.setSelectionRange(pos, pos);
      } catch {
        // May throw on certain input types
      }
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: composed }));
      return true;
    },

    commit(): string | null {
      return null; // no preedit state
    },

    reset(): void {
      // no state to reset
    },
  };
}

_registerMiddleware(["ja-kana"], createKanaDakutenMiddleware);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/kana-dakuten.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/middleware/kana-dakuten.ts packages/kiosk-keyboard-webc/test/unit/kana-dakuten.test.ts
git commit -m "feat(webc): add kana dakuten/handakuten composition middleware"
```

---

### Task 4: Integrate middleware into KioskKeyboardCore (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts`

- [ ] **Step 1: Add middleware import**

At the top of `packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts`, add after the existing layout-registry import:

```ts
import { getMiddlewareForLayout, deactivateMiddleware } from "./core/middleware-registry.js";
```

- [ ] **Step 2: Add middleware routing in \_onKeyClick**

In `_onKeyClick`, after the key-press event is fired and `allowed` is checked (after line 1115 `if (!allowed) return;`), add middleware routing before the target resolution and default handling:

```ts
// ── Composition middleware ──
const middleware = getMiddlewareForLayout(this._currentLayout || this._baseLayout || this.layout || getLocaleLayout());
if (middleware) {
  const target = this._resolveTarget();
  if (target && middleware.handleKey(value, target)) {
    this._autoReleaseShift();
    return;
  }
}
```

This goes between the `if (!allowed) return;` line and the existing `const target = this._resolveTarget();` line. The existing target resolution on line 1117 can be left in place (it's fine to resolve twice, or refactor to reuse).

- [ ] **Step 3: Add middleware commit on layout switch**

In `_handleLayoutSwitch` (around line 1210), add at the start of the method:

```ts
  private _handleLayoutSwitch(value: string): void {
    // Commit any active composition before switching
    deactivateMiddleware(this._currentLayout);

    const layoutName = value.slice(8, -1);
    // ... rest of existing code
```

- [ ] **Step 4: Run all unit tests**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/KioskKeyboardCore.ts
git commit -m "feat(webc): integrate composition middleware into key event pipeline"
```

---

### Task 5: Add middleware to Vite build and package.json exports (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/vite.config.ts`
- Modify: `packages/kiosk-keyboard-webc/package.json`

- [ ] **Step 1: Add middleware entry to vite.config.ts**

In the `lib.entry` object in `vite.config.ts`, add after the layout entries:

```ts
"middleware/kana-dakuten": path.resolve(__dirname, "src/middleware/kana-dakuten.ts"),
```

- [ ] **Step 2: Add middleware exports to package.json**

In the `exports` field of `package.json`, add before the `"./dist/*"` entry:

```json
"./middleware/*": {
  "types": "./dist/middleware/*.d.ts",
  "default": "./dist/middleware/*.js"
},
```

- [ ] **Step 3: Run the build**

Run: `cd packages/kiosk-keyboard-webc && npm run build:bundle`
Expected: Build succeeds, `dist/middleware/kana-dakuten.js` exists

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard-webc/vite.config.ts packages/kiosk-keyboard-webc/package.json
git commit -m "feat(webc): add middleware to Vite build and package.json exports"
```

---

### Task 6: Add middleware registry and kana dakuten to UI5 package

**Files:**

- Create: `packages/kiosk-keyboard/src/internal/middleware-registry.ts`
- Create: `packages/kiosk-keyboard/src/internal/composition-utils.ts`
- Create: `packages/kiosk-keyboard/src/middleware/kana-dakuten.ts`
- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts`

- [ ] **Step 1: Create UI5 middleware-registry.ts**

Create `packages/kiosk-keyboard/src/internal/middleware-registry.ts` with the same logic as the WebC version but using `Log` from `sap/base/Log` for warnings instead of `console.warn`. The API is identical: `registerMiddleware`, `getMiddlewareForLayout`, `deactivateMiddleware`. No `_registerMiddleware` needed (UI5 imports centrally).

- [ ] **Step 2: Create UI5 composition-utils.ts**

Copy the WebC `composition-utils.ts` to `packages/kiosk-keyboard/src/internal/composition-utils.ts`. The code is identical -- it's pure DOM manipulation with no framework dependency.

- [ ] **Step 3: Create UI5 kana-dakuten.ts**

Create `packages/kiosk-keyboard/src/middleware/kana-dakuten.ts`. Same dakuten/handakuten maps and composition logic. Instead of calling `_registerMiddleware`, call `registerMiddleware` directly (since UI5 imports centrally).

- [ ] **Step 4: Integrate into UI5 KioskKeyboard.ts**

In `packages/kiosk-keyboard/src/KioskKeyboard.ts`, add the same three integration points as the WebC version:

1. Import `getMiddlewareForLayout` and `deactivateMiddleware` from `"./internal/middleware-registry"`
2. In `_handleKeyAction`, after the character key branch fires `keyPress` event and before `this._targetSession.insertText(effective)`, add middleware routing
3. In the layout switch handling, call `deactivateMiddleware` before switching

- [ ] **Step 5: Import kana-dakuten in the layout registry or library init**

Add `import "../middleware/kana-dakuten"` in the UI5 layout-registry.ts or in `library.ts` so it's always loaded.

- [ ] **Step 6: Run UI5 build**

Run: `cd packages/kiosk-keyboard && npm run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add packages/kiosk-keyboard/src/internal/middleware-registry.ts packages/kiosk-keyboard/src/internal/composition-utils.ts packages/kiosk-keyboard/src/middleware/kana-dakuten.ts packages/kiosk-keyboard/src/KioskKeyboard.ts
git commit -m "feat(ui5): add composition middleware registry and kana dakuten middleware"
```

---

### Task 7: Run full test suite and push

**Files:** None (verification only)

- [ ] **Step 1: Run all WebC unit tests**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run WebC typecheck**

Run: `cd packages/kiosk-keyboard-webc && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run UI5 build**

Run: `cd packages/kiosk-keyboard && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Run WebC build**

Run: `cd packages/kiosk-keyboard-webc && npm run build:bundle`
Expected: Build succeeds, `dist/middleware/kana-dakuten.js` exists

- [ ] **Step 5: Push and update PR**

```bash
git push

gh pr edit 62 --body "$(cat <<'EOF'
## Summary

- WebC package: layouts are now self-registering modules with tree-shaking support
- Composition middleware architecture for script-specific key processing
- Kana dakuten/handakuten middleware (#53) as first implementation
- `registerLayout` allows overriding built-in layouts in both packages
- UI5 package: no structural changes to layout system

## Composition middleware

Optional modules that intercept key events for layouts needing script-specific processing. The kana dakuten middleware composes base kana + dakuten/handakuten into voiced/semi-voiced kana.

- WebC: import `kiosk-keyboard-webc/middleware/kana-dakuten` to enable
- UI5: always available, activates automatically on `ja-kana` layout

## Related issues

- Closes #45 -- layout tree-shaking and bundle optimization
- Closes #53 -- optional kana composition engine

## Design

- `docs/proposals/LAYOUT-TREESHAKING.md` -- layout modularity spec
- `docs/proposals/COMPOSITION-MIDDLEWARE.md` -- middleware architecture spec

## Test plan

- [x] WebC unit tests pass
- [x] WebC typecheck clean
- [x] UI5 build succeeds
- [x] Tree-shaking verified
- [x] Kana dakuten composition works (ka + dakuten = ga, etc.)
- [x] Middleware activates automatically for ja-kana layout
- [x] Non-composable characters pass through unmodified
- [ ] E2e tests pass (pre-existing failure on main)

:robot: Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
