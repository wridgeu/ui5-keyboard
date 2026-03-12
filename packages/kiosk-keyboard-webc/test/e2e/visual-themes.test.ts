import { browser, expect, $ } from "@wdio/globals";

const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"] as const;

/** Background colors that match each theme for the page body. */
const THEME_BACKGROUNDS: Record<string, string> = {
  sap_horizon: "#f5f6f7",
  sap_horizon_dark: "#12171c",
  sap_horizon_hcb: "#000",
  sap_horizon_hcw: "#fff",
};

async function openThemePage(): Promise<void> {
  await browser.url("/test/pages/visual-themes.html");
  await browser.waitUntil(async () => browser.execute(() => customElements.get("kiosk-keyboard") !== undefined), {
    timeout: 10_000,
    timeoutMsg: "kiosk-keyboard not registered",
  });
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const keyboards = document.querySelectorAll("kiosk-keyboard");
        if (keyboards.length === 0) return false;
        return [...keyboards].every((kb) => (kb.shadowRoot?.querySelectorAll('[role="button"]').length ?? 0) > 0);
      }),
    { timeout: 10_000, timeoutMsg: "Not all keyboards have rendered keys" },
  );
}

async function switchTheme(theme: string): Promise<void> {
  await browser.execute(async (t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).__setTheme(t);
  }, theme);

  // Wait for the theme CSS custom properties to propagate
  await browser.waitUntil(
    async () =>
      browser.execute((t) => {
        const meta = getComputedStyle(document.documentElement).getPropertyValue("--sapThemeMetaData-Base-baseLib");
        return meta.includes(t);
      }, theme),
    { timeout: 5_000, timeoutMsg: `Theme ${theme} did not apply within 5s` },
  );

  // Update body background to match theme (so dark theme screenshots have correct bg)
  await browser.execute((bg) => {
    document.body.style.background = bg;
  }, THEME_BACKGROUNDS[theme]);
}

function getKeyboardRoot(hostId: string) {
  return $(`#${hostId}`).$(">>>.kiosk-keyboard");
}

describe("KioskKeyboard Web Component - Theme Visual Regression", () => {
  before(async () => {
    await openThemePage();
  });

  for (const theme of THEMES) {
    describe(`${theme}`, () => {
      before(async () => {
        await switchTheme(theme);
      });

      it(`should match QWERTY layout in ${theme}`, async () => {
        const kb = await getKeyboardRoot("kb-qwerty");
        await expect(kb).toMatchElementSnapshot(`webc-qwerty-${theme}`);
      });

      it(`should match Numpad layout in ${theme}`, async () => {
        const kb = await getKeyboardRoot("kb-numpad");
        await expect(kb).toMatchElementSnapshot(`webc-numpad-${theme}`);
      });
    });
  }
});
