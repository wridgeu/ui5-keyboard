describe("kiosk-keyboard web component", () => {
  before(async () => {
    await browser.url("/test/pages/index.html");
    // Wait for custom element to be defined
    await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
      timeout: 10_000,
      timeoutMsg: "kiosk-keyboard not registered",
    });
    // Wait for initial render
    await browser.pause(500);
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
      await browser.pause(200);

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
      await browser.pause(500);

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
      await browser.pause(200);

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
      await browser.pause(200);

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
      await browser.pause(200);
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
      const allHaveRole = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const keys = kb?.shadowRoot?.querySelectorAll(".kiosk-key") ?? [];
        return Array.from(keys).every((k) => k.getAttribute("role") === "button");
      });
      expect(allHaveRole).toBe(true);
    });

    it("special keys have aria-label", async () => {
      const specialKeysHaveLabel = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const specialKeys = ["{shift}", "{enter}", "{backspace}"];
        return specialKeys.every((keyVal) => {
          const key = kb?.shadowRoot?.querySelector(`[data-key="${CSS.escape(keyVal)}"]`);
          const label = key?.getAttribute("aria-label");
          return label !== null && label !== undefined && label.length > 0;
        });
      });
      expect(specialKeysHaveLabel).toBe(true);
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
});
