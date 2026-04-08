import { browser } from "@wdio/globals";
import {
  getKeyboardRoot,
  injectShadowStyleOverride,
  removeShadowStyleOverride,
  DISABLE_COLOR_MIX,
  matchElementSnapshotInSection,
} from "./test-helpers.js";

const THEMES = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcb", "sap_horizon_hcw"];

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
  // __setTheme resolves after the UI5 Web Components theme change event fires.
  // Then verify the CSS custom properties have propagated before updating backgrounds.
  await browser.executeAsync((t: string, done: () => void) => {
    window.__setTheme(t).then(done);
  }, theme);

  await browser.waitUntil(
    async () =>
      browser.execute((t) => {
        const meta = getComputedStyle(document.documentElement).getPropertyValue("--sapThemeMetaData-Base-baseLib");
        return meta.includes(t);
      }, theme),
    { timeout: 5_000, timeoutMsg: `Theme ${theme} did not apply within 5s` },
  );

  await browser.execute((bg) => {
    document.body.style.background = bg;
  }, THEME_BACKGROUNDS[theme]);
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
        await matchElementSnapshotInSection(kb, `webc-qwerty-${theme}`);
      });

      it(`should match Numpad layout in ${theme}`, async () => {
        const kb = await getKeyboardRoot("kb-numpad");
        await matchElementSnapshotInSection(kb, `webc-numpad-${theme}`);
      });
    });
  }
});

/**
 * color-mix() fallback tests across themes where the visual delta is largest.
 *
 * In sap_horizon (light), --sapContent_ShadowColor is #223548 which matches
 * the static rgba(34,53,72,...) fallback, so the difference is invisible.
 * In HCB the shadow color is #fff (white shadows) and in HCW/dark it is #000,
 * making the fallback (dark blue shadows) visually distinct.
 */
describe("KioskKeyboard WebC - Fallback: color-mix() across themes", () => {
  before(async () => {
    await openThemePage();
  });

  for (const theme of ["sap_horizon_hcb", "sap_horizon_hcw"] as const) {
    it(`should match QWERTY without color-mix() in ${theme}`, async () => {
      await switchTheme(theme);
      await injectShadowStyleOverride(DISABLE_COLOR_MIX, "disable-color-mix");
      try {
        const kb = await getKeyboardRoot("kb-qwerty");
        await matchElementSnapshotInSection(kb, `webc-qwerty-no-color-mix-${theme}`);
      } finally {
        await removeShadowStyleOverride("disable-color-mix");
      }
    });
  }
});
