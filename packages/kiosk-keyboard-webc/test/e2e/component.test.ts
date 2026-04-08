/** Waits until the given keyboard has rendered at least one key in its shadow DOM. */
async function waitForKeys(kbId: string, timeout = 5000): Promise<void> {
  await browser.waitUntil(
    async () =>
      browser.execute((id: string) => {
        const kb = document.getElementById(id);
        return (kb?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0) > 0;
      }, kbId),
    { timeout, timeoutMsg: `${kbId} did not render keys within ${timeout}ms` },
  );
}

/** Waits until the docked keyboard reaches the expected hidden/visible state. */
async function waitForDockedState(kbId: string, hidden: boolean, timeout = 5000): Promise<void> {
  await browser.waitUntil(
    async () =>
      browser.execute(
        (id: string, expectHidden: boolean) => {
          const root = document.getElementById(id)?.shadowRoot?.querySelector(".kiosk-keyboard");
          if (!root) return false;
          const isHidden = root.classList.contains("kiosk-keyboard--hidden");
          return isHidden === expectHidden;
        },
        kbId,
        hidden,
      ),
    { timeout, timeoutMsg: `${kbId} did not become ${hidden ? "hidden" : "visible"} within ${timeout}ms` },
  );
}

describe("kiosk-keyboard web component", () => {
  before(async () => {
    await browser.url("/test/pages/index.html");
    // Wait for custom element to be defined
    await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
      timeout: 10_000,
      timeoutMsg: "kiosk-keyboard not registered",
    });
    // Wait for initial render
    await waitForKeys("kb-qwerty");
  });

  describe("rendering", () => {
    it("renders the QWERTY keyboard with keys", async () => {
      const keyCount = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        return kb?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0;
      });
      expect(keyCount).toBeGreaterThan(0);
    });

    it("renders numpad keyboard-type with keys", async () => {
      const keyCount = await browser.execute(() => {
        const kb = document.getElementById("kb-numpad");
        return kb?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0;
      });
      expect(keyCount).toBeGreaterThan(0);
    });

    it("renders disabled keyboard with disabled class", async () => {
      const hasClass = await browser.execute(() => {
        const kb = document.querySelector("kiosk-keyboard[disabled]");
        return (
          kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--disabled") ?? false
        );
      });
      expect(hasClass).toBe(true);
    });
  });

  describe("key interaction", () => {
    it("types into the target input", async () => {
      // Close any open docked keyboard first
      await browser.execute(() => {
        const docked = document.getElementById("kb-docked") as HTMLElement & { close(): void };
        if (docked) docked.close();
      });
      await waitForDockedState("kb-docked", true);

      // Focus the text input
      const input = await $("#text-input");
      await input.click();
      await input.clearValue();

      // Click the "a" key in the keyboard with for="text-input"
      const value = await browser.execute(() => {
        const kbs = document.querySelectorAll("kiosk-keyboard");
        for (const kb of kbs) {
          if (kb.getAttribute("for") === "text-input") {
            const key = kb.shadowRoot?.querySelector('[data-key="a"]');
            if (key) {
              (key as HTMLElement).click();
              return (document.getElementById("text-input") as HTMLInputElement)?.value;
            }
          }
        }
        return null;
      });
      expect(value).toContain("a");
    });
  });

  describe("docked mode", () => {
    it("starts with hidden state", async () => {
      // Reload to get fresh state
      await browser.url("/test/pages/index.html");
      await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
        timeout: 10_000,
      });
      await waitForKeys("kb-qwerty");

      const isHidden = await browser.execute(() => {
        const kb = document.getElementById("kb-docked");
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--hidden") ?? false;
      });
      expect(isHidden).toBe(true);
    });

    it("opens when show() is called", async () => {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked") as HTMLElement & { show(): void };
        kb.show();
      });
      await waitForDockedState("kb-docked", false);

      const isHidden = await browser.execute(() => {
        const kb = document.getElementById("kb-docked");
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--hidden") ?? false;
      });
      expect(isHidden).toBe(false);
    });

    it("closes when close() is called", async () => {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked") as HTMLElement & { close(): void };
        kb.close();
      });
      await waitForDockedState("kb-docked", true);

      const isHidden = await browser.execute(() => {
        const kb = document.getElementById("kb-docked");
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--hidden") ?? false;
      });
      expect(isHidden).toBe(true);
    });
  });

  describe("nav layout and arrow keys", () => {
    before(async () => {
      // Close docked keyboard to prevent auto-show interference on focus
      await browser.execute(() => {
        const docked = document.getElementById("kb-docked") as HTMLElement & { close(): void };
        if (docked) docked.close();
      });
      await waitForDockedState("kb-docked", true);
    });

    it("renders nav layout with navigation keys", async () => {
      const keys = await browser.execute(() => {
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
        return navKeys.filter((k) => kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(k)}"]`) !== null);
      });
      expect(keys.length).toBe(8);
    });

    it("ArrowRight moves cursor one position right", async () => {
      const result = await browser.execute((dataKey: string) => {
        const input = document.getElementById("nav-input") as HTMLInputElement;
        input.value = "hello world";
        input.focus();
        input.setSelectionRange(5, 5);

        const kb = document.getElementById("kb-nav");
        const key = kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(dataKey)}"]`) as HTMLElement | null;
        if (!key) return { error: `Key ${dataKey} not found` };
        key.click();
        return { cursor: input.selectionStart };
      }, "{fkey:ArrowRight}");
      expect(result).not.toHaveProperty("error");
      expect((result as { cursor: number }).cursor).toBe(6);
    });

    it("Home moves cursor to start", async () => {
      const result = await browser.execute((dataKey: string) => {
        const input = document.getElementById("nav-input") as HTMLInputElement;
        input.value = "hello world";
        input.focus();
        input.setSelectionRange(5, 5);

        const kb = document.getElementById("kb-nav");
        const key = kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(dataKey)}"]`) as HTMLElement | null;
        if (!key) return { error: `Key ${dataKey} not found` };
        key.click();
        return { cursor: input.selectionStart };
      }, "{fkey:Home}");
      expect(result).not.toHaveProperty("error");
      expect((result as { cursor: number }).cursor).toBe(0);
    });

    it("End moves cursor to end", async () => {
      const result = await browser.execute((dataKey: string) => {
        const input = document.getElementById("nav-input") as HTMLInputElement;
        input.value = "hello world";
        input.focus();
        input.setSelectionRange(3, 3);

        const kb = document.getElementById("kb-nav");
        const key = kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(dataKey)}"]`) as HTMLElement | null;
        if (!key) return { error: `Key ${dataKey} not found` };
        key.click();
        return { cursor: input.selectionStart };
      }, "{fkey:End}");
      expect(result).not.toHaveProperty("error");
      expect((result as { cursor: number }).cursor).toBe(11);
    });
  });

  describe("accessibility", () => {
    it("keys have role=button", async () => {
      const result = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const keys = Array.from(kb?.shadowRoot?.querySelectorAll(".kiosk-key") ?? []);
        return {
          count: keys.length,
          allHaveRole: keys.every((k) => k.getAttribute("role") === "button"),
        };
      });
      expect(result.count).toBeGreaterThan(0);
      expect(result.allHaveRole).toBe(true);
    });

    it("special keys are accessible via visible text or aria-label", async () => {
      const specialKeysAccessible = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const specialKeys = ["{shift}", "{enter}", "{backspace}"];
        return specialKeys.every((keyVal) => {
          const key = kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(keyVal)}"]`);
          if (!key) return false;
          const visibleLabel = key.querySelector(".kiosk-key__label");
          const ariaLabel = key.getAttribute("aria-label");
          return (visibleLabel?.textContent?.length ?? 0) > 0 || (ariaLabel?.length ?? 0) > 0;
        });
      });
      expect(specialKeysAccessible).toBe(true);
    });

    it("has a live region", async () => {
      const hasLiveRegion = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        return kb?.shadowRoot?.querySelector('[role="status"][aria-live="polite"]') !== null;
      });
      expect(hasLiveRegion).toBe(true);
    });

    it("one key has tabindex=0 (roving tabindex)", async () => {
      const count = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        return kb?.shadowRoot?.querySelectorAll('.kiosk-key[tabindex="0"]').length ?? 0;
      });
      expect(count).toBe(1);
    });
  });

  describe("row classification (data-row-kind)", () => {
    it("marks F-key rows as fkey and leaves control row unclassified", async () => {
      await waitForKeys("kb-fkeys");
      const kinds = await browser.execute(() => {
        const kb = document.getElementById("kb-fkeys");
        const rows = Array.from(kb?.shadowRoot?.querySelectorAll(".kiosk-row") ?? []);
        return rows.map((r) => r.getAttribute("data-row-kind"));
      });
      // fkeys standalone layout: first two rows are fkey rows, last row is control
      expect(kinds[0]).toBe("fkey");
      expect(kinds[1]).toBe("fkey");
      expect(kinds[2]).toBe(null);
    });

    it("marks nav rows as nav", async () => {
      await waitForKeys("kb-nav");
      const kinds = await browser.execute(() => {
        const kb = document.getElementById("kb-nav");
        const rows = Array.from(kb?.shadowRoot?.querySelectorAll(".kiosk-row") ?? []);
        return rows.map((r) => r.getAttribute("data-row-kind"));
      });
      // Nav layout has nav rows followed by a control row (ABC, Backspace, Fn)
      const navCount = kinds.filter((k) => k === "nav").length;
      const nullCount = kinds.filter((k) => k === null).length;
      expect(navCount).toBeGreaterThan(0);
      expect(nullCount).toBeGreaterThan(0);
    });

    it("does not classify regular character rows", async () => {
      await waitForKeys("kb-qwerty");
      const kinds = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const rows = Array.from(kb?.shadowRoot?.querySelectorAll(".kiosk-row") ?? []);
        return rows.map((r) => r.getAttribute("data-row-kind"));
      });
      expect(kinds.every((k) => k === null)).toBe(true);
    });
  });

  describe("ja-kana layout toggle", () => {
    it("switches from ja-romaji to ja-kana via toggle key", async () => {
      await waitForKeys("kb-ja-romaji");
      // The ja-romaji layout has a かな toggle key
      const toggled = await browser.execute(() => {
        const kb = document.getElementById("kb-ja-romaji");
        const toggle = kb?.shadowRoot?.querySelector('[data-key="\\{layout:ja-kana\\}"]') as HTMLElement | null;
        toggle?.click();
        return !!toggle;
      });
      expect(toggled).toBe(true);

      // After toggle, the first key should be a hiragana character (ぬ = U+306C)
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const kb = document.getElementById("kb-ja-romaji");
            const firstKey = kb?.shadowRoot?.querySelector('[role="button"]');
            return firstKey?.getAttribute("data-key") === "\u306C";
          }),
        { timeout: 3_000, timeoutMsg: "Layout did not switch to ja-kana" },
      );

      // Switch back via the ローマ字 toggle key
      const switchedBack = await browser.execute(() => {
        const kb = document.getElementById("kb-ja-romaji");
        const toggle = kb?.shadowRoot?.querySelector('[data-key="\\{layout:ja-romaji\\}"]') as HTMLElement | null;
        toggle?.click();
        return !!toggle;
      });
      expect(switchedBack).toBe(true);

      // Verify we're back on romaji (first key should be "1")
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const kb = document.getElementById("kb-ja-romaji");
            const firstKey = kb?.shadowRoot?.querySelector('[role="button"]');
            return firstKey?.getAttribute("data-key") === "1";
          }),
        { timeout: 3_000, timeoutMsg: "Layout did not switch back to ja-romaji" },
      );
    });

    it("pressing a kana key produces a hiragana character", async () => {
      // First switch to ja-kana
      await browser.execute(() => {
        const kb = document.getElementById("kb-ja-romaji");
        const toggle = kb?.shadowRoot?.querySelector('[data-key="\\{layout:ja-kana\\}"]') as HTMLElement | null;
        toggle?.click();
      });
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const kb = document.getElementById("kb-ja-romaji");
            return kb?.shadowRoot?.querySelector('[data-key="\u306C"]') !== null;
          }),
        { timeout: 3_000 },
      );

      // Clear input and click a kana key (た = U+305F, Q position)
      await browser.execute(() => {
        const input = document.getElementById("ja-kana-input") as HTMLInputElement;
        input.value = "";
        input.focus();
      });
      await browser.execute(() => {
        const kb = document.getElementById("kb-ja-romaji");
        const taKey = kb?.shadowRoot?.querySelector('[data-key="\u305F"]') as HTMLElement | null;
        taKey?.click();
      });

      const value = await browser.execute(() => {
        return (document.getElementById("ja-kana-input") as HTMLInputElement).value;
      });
      expect(value).toBe("\u305F"); // た

      // Switch back to romaji for cleanup
      await browser.execute(() => {
        const kb = document.getElementById("kb-ja-romaji");
        const toggle = kb?.shadowRoot?.querySelector('[data-key="\\{layout:ja-romaji\\}"]') as HTMLElement | null;
        toggle?.click();
      });
    });
  });
});
