describe("kiosk-keyboard web component", () => {
  before(async () => {
    await browser.url("/test/pages/index.html");
    // Wait for custom element to be defined
    await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
      timeout: 10_000,
      timeoutMsg: "kiosk-keyboard not registered",
    });
  });

  describe("rendering", () => {
    it("renders the QWERTY keyboard with keys", async () => {
      const keyCount = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        return kb?.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0;
      });
      expect(keyCount).toBeGreaterThan(0);
    });

    it("renders numpad with numpad class", async () => {
      const hasClass = await browser.execute(() => {
        const kb = document.querySelector('[keyboard-type="Numpad"]');
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--numpad") ?? false;
      });
      expect(hasClass).toBe(true);
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
      // Focus the text input
      const input = await $("#text-input");
      await input.click();
      await input.clearValue();

      // Click the "a" key in the second keyboard (for="text-input")
      const value = await browser.execute(() => {
        const kbs = document.querySelectorAll("kiosk-keyboard");
        // Find the one with for="text-input"
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
    it("starts with closed state", async () => {
      const isClosed = await browser.execute(() => {
        const kb = document.getElementById("kb-docked");
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--closed") ?? false;
      });
      expect(isClosed).toBe(true);
    });

    it("opens when show() is called", async () => {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked") as HTMLElement & { show(): void };
        kb.show();
      });

      const isClosed = await browser.execute(() => {
        const kb = document.getElementById("kb-docked");
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--closed") ?? false;
      });
      expect(isClosed).toBe(false);
    });

    it("closes when close() is called", async () => {
      await browser.execute(() => {
        const kb = document.getElementById("kb-docked") as HTMLElement & { close(): void };
        kb.close();
      });

      const isClosed = await browser.execute(() => {
        const kb = document.getElementById("kb-docked");
        return kb?.shadowRoot?.querySelector(".kiosk-keyboard")?.classList.contains("kiosk-keyboard--closed") ?? false;
      });
      expect(isClosed).toBe(true);
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

    it("keys have aria-label", async () => {
      const allHaveLabel = await browser.execute(() => {
        const kb = document.getElementById("kb-qwerty");
        const keys = kb?.shadowRoot?.querySelectorAll(".kiosk-key") ?? [];
        return Array.from(keys).every((k) => {
          const label = k.getAttribute("aria-label");
          return label !== null && label.length > 0;
        });
      });
      expect(allHaveLabel).toBe(true);
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
