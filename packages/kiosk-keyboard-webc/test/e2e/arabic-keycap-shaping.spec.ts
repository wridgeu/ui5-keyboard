import { test, expect } from "@playwright/test";
import { openPage } from "./helpers.js";
import arabic from "../../src/layouts/arabic.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";

// A keycap is a specimen: it shows the character the key inserts, standing alone
// with no joining neighbours. Shaping an Arabic keycap as running text lets the
// font apply a positional substitution - Segoe UI turns U+0647 HEH into a
// two-lobed form - so the keycap depicts a letter shape the key does not type.
// The stylesheet turns the `isol` feature off on Arabic glyph labels.

const HEH = "ه";
/** ARABIC LETTER HEH ISOLATED FORM: the specimen shape, by Unicode definition. */
const HEH_ISOLATED = "ﻩ";

const ARABIC_GLYPHS = [
  ...new Set(
    arabic
      .flat()
      .flatMap((key) => [key.value, key.shiftValue])
      .filter((value): value is string => !!value && [...value].length === 1),
  ),
];

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
});

test("the heh keycap shows the isolated letter, not a positional form", async ({ page }) => {
  const measured = await page.evaluate(
    async ({ hostId, keyAttr, labelCls, heh, isolated }) => {
      await document.fonts.ready;
      const shadow = document.getElementById(hostId)!.shadowRoot!;
      const label = shadow.querySelector(`[${keyAttr}="${heh}"] .${labelCls}`) as HTMLElement;
      const style = getComputedStyle(label);

      // Both sides render free-standing in the keycap's own resolved style, so
      // this compares the glyph the shaper picks and nothing else. Measuring the
      // laid-out label instead would fold in the key's width per device profile.
      const probe = (ch: string) => {
        const s = document.createElement("span");
        s.textContent = ch;
        s.setAttribute("lang", "ar");
        s.style.cssText = `position:absolute;white-space:pre;font:${style.font};font-family:${style.fontFamily};font-feature-settings:${style.fontFeatureSettings}`;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return Math.round(w * 100) / 100;
      };

      return { keycap: probe(label.textContent!), isolatedForm: probe(isolated) };
    },
    {
      hostId: "kb-arabic",
      keyAttr: DOM.attributes.key,
      labelCls: DOM.classes.keyLabel,
      heh: HEH,
      isolated: HEH_ISOLATED,
    },
  );

  expect(measured.keycap, "heh keycap does not render the isolated form").toBe(measured.isolatedForm);
});

test("no keycap other than heh is reshaped by the feature settings", async ({ page }) => {
  const changed = await page.evaluate(
    async ({ chars, hostId, keySel, labelCls }) => {
      await document.fonts.ready;
      const shadow = document.getElementById(hostId)!.shadowRoot!;
      const sample = shadow.querySelector(`${keySel} .${labelCls}[data-glyph-script="arabic"]`) as HTMLElement;
      const style = getComputedStyle(sample);

      const probe = (ch: string, features: string) => {
        const s = document.createElement("span");
        s.textContent = ch;
        s.setAttribute("lang", "ar");
        s.style.cssText = `position:absolute;white-space:pre;font:${style.font};font-family:${style.fontFamily};font-feature-settings:${features}`;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return Math.round(w * 100) / 100;
      };

      return chars.filter((ch) => probe(ch, style.fontFeatureSettings) !== probe(ch, "normal"));
    },
    { chars: ARABIC_GLYPHS, hostId: "kb-arabic", keySel: DOM.selectors.key, labelCls: DOM.classes.keyLabel },
  );

  // Which glyphs an `isol` lookup substitutes belongs to the resolved font, not to the
  // stylesheet: a font without that lookup reshapes nothing, so heh is not required to
  // appear here. What must hold everywhere is the upper bound - no other keycap moves.
  expect(ARABIC_GLYPHS.length).toBeGreaterThan(50);
  expect(
    changed.filter((ch) => ch !== HEH),
    "the stylesheet must reshape no glyph but heh",
  ).toEqual([]);
});

test("keycap labels keep the language tag the shaping fix works around", async ({ page }) => {
  const shadow = page.locator("#kb-arabic");
  await expect(shadow.locator(`[${DOM.attributes.key}="${HEH}"] .${DOM.classes.keyLabel}`)).toHaveAttribute(
    "lang",
    "ar",
  );
});
