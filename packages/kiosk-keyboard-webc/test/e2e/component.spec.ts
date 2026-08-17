import { test, expect } from "@playwright/test";
import { openPage, waitForKeys, waitForDockedClosed, waitForDockedOpen } from "./helpers.js";

// Behavioral e2e for the <kiosk-keyboard> custom element. Desktop-only (the
// device matrix runs the visual specs). Each test navigates fresh for isolation.

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/index.html");
});

test.describe("rendering", () => {
  test("renders the QWERTY keyboard with keys", async ({ page }) => {
    const keyCount = await page.evaluate(
      () => document.getElementById("kb-qwerty")?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0,
    );
    expect(keyCount).toBeGreaterThan(0);
  });

  test("renders numpad keyboard-type with keys", async ({ page }) => {
    const keyCount = await page.evaluate(
      () => document.getElementById("kb-numpad")?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0,
    );
    expect(keyCount).toBeGreaterThan(0);
  });

  test("renders disabled keyboard with disabled class", async ({ page }) => {
    const hasClass = await page.evaluate(
      () =>
        document
          .querySelector("kiosk-keyboard[disabled]")
          ?.shadowRoot?.querySelector(".kiosk-keyboard")
          ?.classList.contains("kiosk-keyboard--disabled") ?? false,
    );
    expect(hasClass).toBe(true);
  });
});

test.describe("key interaction", () => {
  test("types into the target input", async ({ page }) => {
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { close(): void }).close());
    await waitForDockedClosed(page, "kb-docked");

    await page.locator("#text-input").click();
    await page.locator("#text-input").fill("");

    const value = await page.evaluate(() => {
      for (const kb of document.querySelectorAll("kiosk-keyboard")) {
        if (kb.getAttribute("controls") === "text-input") {
          const key = kb.shadowRoot?.querySelector('[data-key="a"]') as HTMLElement | null;
          if (key) {
            key.click();
            return (document.getElementById("text-input") as HTMLInputElement).value;
          }
        }
      }
      return null;
    });
    expect(value).toContain("a");
  });
});

test.describe("docked mode", () => {
  test("starts with hidden state", async ({ page }) => {
    const isHidden = await page.evaluate(
      () =>
        document
          .getElementById("kb-docked")
          ?.shadowRoot?.querySelector(".kiosk-keyboard")
          ?.classList.contains("kiosk-keyboard--hidden") ?? false,
    );
    expect(isHidden).toBe(true);
  });

  test("opens when show() is called", async ({ page }) => {
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { show(): void }).show());
    const state = await waitForDockedOpen(page, "kb-docked");
    expect(state.hiddenClass).toBe(false);
  });

  test("closes when close() is called", async ({ page }) => {
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { show(): void }).show());
    await waitForDockedOpen(page, "kb-docked");
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { close(): void }).close());
    const state = await waitForDockedClosed(page, "kb-docked");
    expect(state.hiddenClass).toBe(true);
  });
});

test.describe("nav layout and arrow keys", () => {
  test.beforeEach(async ({ page }) => {
    // Close docked so it does not auto-show on input focus.
    await page.evaluate(() => (document.getElementById("kb-docked") as HTMLElement & { close(): void }).close());
    await waitForDockedClosed(page, "kb-docked");
  });

  test("renders nav layout with navigation keys", async ({ page }) => {
    const count = await page.evaluate(() => {
      const kb = document.getElementById("kb-nav");
      const navKeys = [
        "{fkey:ArrowUp}",
        "{fkey:ArrowDown}",
        "{fkey:ArrowLeft}",
        "{fkey:ArrowRight}",
        "{fkey:Home}",
        "{fkey:End}",
        "{fkey:PageUp}",
        "{fkey:PageDown}",
      ];
      return navKeys.filter((k) => kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(k)}"]`) !== null).length;
    });
    expect(count).toBe(8);
  });

  // Regression for #157: on the wide standalone nav layout the fkey icon was
  // sized clamp(1em, 15cqi, 3em); the 3em cap plus the 1.25em icon box made the
  // icon taller than the 3rem key, so the stacked label was clipped by the
  // dual key's overflow:hidden. The demo grid is single-column (nav keyboard
  // wide, ~297px keys) around a 1000px viewport; at the 1440 desktop default it
  // is multi-column and narrow, so the width is forced here.
  test("nav fkey icon+label stack fits within the key at wide widths", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await waitForKeys(page, "kb-nav");
    const keys = await page.evaluate(() => {
      const root = document.getElementById("kb-nav")?.shadowRoot;
      return Array.from(root?.querySelectorAll("[data-fkey]") ?? []).map((k) => {
        const kr = k.getBoundingClientRect();
        const icon = k.querySelector(".kiosk-key__icon")!.getBoundingClientRect();
        const label = k.querySelector(".kiosk-key__label")!.getBoundingClientRect();
        return {
          label: k.querySelector(".kiosk-key__label")?.textContent ?? "",
          keyW: Math.round(kr.width),
          iconTopClip: +(kr.top - icon.top).toFixed(2),
          labelBottomClip: +(label.bottom - kr.bottom).toFixed(2),
        };
      });
    });
    expect(keys.length).toBe(8);
    // Guard against a vacuous pass: the bug only manifests once keys are wide
    // enough to drive the icon to its cap (and the label is not sr-only hidden,
    // which happens below 7rem key width).
    expect(Math.max(...keys.map((k) => k.keyW))).toBeGreaterThan(250);
    for (const k of keys) {
      expect(k.iconTopClip, `icon overflows top of "${k.label}"`).toBeLessThanOrEqual(0.5);
      expect(k.labelBottomClip, `label clipped at bottom of "${k.label}"`).toBeLessThanOrEqual(0.5);
    }
  });

  for (const { name, dataKey, start, expected } of [
    { name: "ArrowRight moves cursor one position right", dataKey: "{fkey:ArrowRight}", start: 5, expected: 6 },
    { name: "Home moves cursor to start", dataKey: "{fkey:Home}", start: 5, expected: 0 },
    { name: "End moves cursor to end", dataKey: "{fkey:End}", start: 3, expected: 11 },
  ]) {
    test(name, async ({ page }) => {
      const result = await page.evaluate(
        ({ dataKey, start }) => {
          const input = document.getElementById("nav-input") as HTMLInputElement;
          input.value = "hello world";
          input.focus();
          input.setSelectionRange(start, start);
          const k = document
            .getElementById("kb-nav")
            ?.shadowRoot?.querySelector(`[data-key="${CSS.escape(dataKey)}"]`) as HTMLElement | null;
          if (!k) return { error: `Key ${dataKey} not found` };
          k.click();
          return { cursor: input.selectionStart };
        },
        { dataKey, start },
      );
      expect(result.error).toBeUndefined();
      expect(result.cursor).toBe(expected);
    });
  }
});

test.describe("accessibility", () => {
  test("keys have role=button", async ({ page }) => {
    const result = await page.evaluate(() => {
      const keys = Array.from(document.getElementById("kb-qwerty")?.shadowRoot?.querySelectorAll(".kiosk-key") ?? []);
      return { count: keys.length, allHaveRole: keys.every((k) => k.getAttribute("role") === "button") };
    });
    expect(result.count).toBeGreaterThan(0);
    expect(result.allHaveRole).toBe(true);
  });

  test("special keys are accessible via visible text or aria-label", async ({ page }) => {
    const accessible = await page.evaluate(() => {
      const kb = document.getElementById("kb-qwerty");
      return ["{shift}", "{enter}", "{backspace}"].every((keyVal) => {
        const k = kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(keyVal)}"]`);
        if (!k) return false;
        const visibleLabel = k.querySelector(".kiosk-key__label");
        const ariaLabel = k.getAttribute("aria-label");
        return (visibleLabel?.textContent?.length ?? 0) > 0 || (ariaLabel?.length ?? 0) > 0;
      });
    });
    expect(accessible).toBe(true);
  });

  test("has a live region", async ({ page }) => {
    const hasLiveRegion = await page.evaluate(
      () =>
        document.getElementById("kb-qwerty")?.shadowRoot?.querySelector('[role="status"][aria-live="polite"]') !== null,
    );
    expect(hasLiveRegion).toBe(true);
  });

  test("one key has tabindex=0 (roving tabindex)", async ({ page }) => {
    const count = await page.evaluate(
      () => document.getElementById("kb-qwerty")?.shadowRoot?.querySelectorAll('.kiosk-key[tabindex="0"]').length ?? 0,
    );
    expect(count).toBe(1);
  });
});

test.describe("row classification (data-row-kind)", () => {
  test("marks F-key rows as fkey and leaves control row unclassified", async ({ page }) => {
    await waitForKeys(page, "kb-fkeys");
    const kinds = await page.evaluate(() =>
      Array.from(document.getElementById("kb-fkeys")?.shadowRoot?.querySelectorAll(".kiosk-row") ?? []).map((r) =>
        r.getAttribute("data-row-kind"),
      ),
    );
    // The two F-key rows are classified; the remaining control row is not.
    // Assert by predicate, not a fixed row index, so a layout reorder surfaces
    // as a classification regression rather than a positional break.
    expect(kinds.filter((k) => k === "fkey").length).toBe(2);
    expect(kinds.filter((k) => k === null).length).toBeGreaterThan(0);
  });

  test("marks nav rows as nav", async ({ page }) => {
    await waitForKeys(page, "kb-nav");
    const kinds = await page.evaluate(() =>
      Array.from(document.getElementById("kb-nav")?.shadowRoot?.querySelectorAll(".kiosk-row") ?? []).map((r) =>
        r.getAttribute("data-row-kind"),
      ),
    );
    expect(kinds.filter((k) => k === "nav").length).toBeGreaterThan(0);
    expect(kinds.filter((k) => k === null).length).toBeGreaterThan(0);
  });

  test("does not classify regular character rows", async ({ page }) => {
    await waitForKeys(page, "kb-qwerty");
    const kinds = await page.evaluate(() =>
      Array.from(document.getElementById("kb-qwerty")?.shadowRoot?.querySelectorAll(".kiosk-row") ?? []).map((r) =>
        r.getAttribute("data-row-kind"),
      ),
    );
    expect(kinds.every((k) => k === null)).toBe(true);
  });
});

test.describe("ja-kana layout toggle", () => {
  test("switches from ja-romaji to ja-kana via toggle key", async ({ page }) => {
    await waitForKeys(page, "kb-ja-romaji");
    const toggled = await page.evaluate(() => {
      const toggle = document
        .getElementById("kb-ja-romaji")
        ?.shadowRoot?.querySelector('[data-key="\\{layout:ja-kana\\}"]') as HTMLElement | null;
      toggle?.click();
      return !!toggle;
    });
    expect(toggled).toBe(true);

    await page.waitForFunction(
      () =>
        document
          .getElementById("kb-ja-romaji")
          ?.shadowRoot?.querySelector('[role="button"]')
          ?.getAttribute("data-key") === "ぬ",
      null,
      { timeout: 3_000 },
    );

    const switchedBack = await page.evaluate(() => {
      const toggle = document
        .getElementById("kb-ja-romaji")
        ?.shadowRoot?.querySelector('[data-key="\\{layout:ja-romaji\\}"]') as HTMLElement | null;
      toggle?.click();
      return !!toggle;
    });
    expect(switchedBack).toBe(true);

    await page.waitForFunction(
      () =>
        document
          .getElementById("kb-ja-romaji")
          ?.shadowRoot?.querySelector('[role="button"]')
          ?.getAttribute("data-key") === "1",
      null,
      { timeout: 3_000 },
    );
  });

  test("pressing a kana key produces a hiragana character", async ({ page }) => {
    await waitForKeys(page, "kb-ja-romaji");
    await page.evaluate(() => {
      const toggle = document
        .getElementById("kb-ja-romaji")
        ?.shadowRoot?.querySelector('[data-key="\\{layout:ja-kana\\}"]') as HTMLElement | null;
      toggle?.click();
    });
    await page.waitForFunction(
      () => document.getElementById("kb-ja-romaji")?.shadowRoot?.querySelector('[data-key="ぬ"]') !== null,
      null,
      { timeout: 3_000 },
    );

    await page.evaluate(() => {
      const input = document.getElementById("ja-kana-input") as HTMLInputElement;
      input.value = "";
      input.focus();
      const taKey = document
        .getElementById("kb-ja-romaji")
        ?.shadowRoot?.querySelector('[data-key="た"]') as HTMLElement | null;
      taKey?.click();
    });

    const value = await page.evaluate(() => (document.getElementById("ja-kana-input") as HTMLInputElement).value);
    expect(value).toBe("た");
  });
});

test.describe("docked keyboard + accent-variant popover", () => {
  test("stays open while the accent-variant popover is open", async ({ page }) => {
    // The shared page leaves accent variants off on the docked keyboard; enable
    // them so its letter keys expose the long-press popover.
    await page.evaluate(() => document.getElementById("kb-docked")!.setAttribute("accent-variants", ""));
    await page.locator("#docked-input-name").locator("input").focus();
    await waitForDockedOpen(page, "kb-docked");

    // Open the popover through the right-click gesture (deterministic: no hold
    // timer). It renders into the keyboard's own shadow-root ui5-popover and
    // moves focus to its first option.
    await page.evaluate(() => {
      const key = document.getElementById("kb-docked")!.shadowRoot!.querySelector('[data-key="a"]') as HTMLElement;
      key.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true }));
    });
    await page.waitForFunction(
      () => {
        const pop = document.getElementById("kb-docked")!.shadowRoot!.querySelector("ui5-popover") as
          | (HTMLElement & { open?: boolean })
          | null;
        return !!pop?.open;
      },
      null,
      { timeout: 3_000 },
    );

    // Focus moved into the popover option, firing a focusout on the input. The
    // docked auto-show must keep the keyboard open behind its own overlay.
    const open = await page.evaluate(
      () => (document.getElementById("kb-docked") as HTMLElement & { open: boolean }).open,
    );
    expect(open).toBe(true);
  });
});
