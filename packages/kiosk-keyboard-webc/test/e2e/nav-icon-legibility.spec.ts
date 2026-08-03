import { test, expect } from "@playwright/test";
import { openPage } from "./helpers.js";
import navRow from "../../src/layouts/nav-row.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";

// Below the dual-key threshold a nav key hides its label, so its icon carries
// the whole meaning. Two nav icons that point the same way then read as the
// same key: `PgUp` drawn as an up arrow is not tellable from `Up` at a glance,
// and the 2x4 compact row puts both in the same column. This measures the
// rendered glyphs rather than asserting codepoints, so it fails for the reason
// the defect actually had - shapes that collide - rather than on any edit.

/**
 * Pairs whose glyphs are mirror images by design. Direction is what
 * distinguishes them, which pixel overlap cannot see, so they are exempt.
 * Keyed on the two labels sorted, so the exemption does not depend on where
 * the keys sit in the row.
 */
const MIRROR_PAIRS = new Set(["End/Home", "Down/Up", "Left/Right", "PgDn/PgUp"]);

/**
 * Minimum ink-overlap distance for every other pair. The shipped row measures
 * 0.85 at its closest; the shapes this guards against measure below 0.70.
 */
const MIN_DISTANCE = 0.78;

const NAV_KEYS = navRow.map((key) => ({
  name: key.label!,
  icon: key.icon!,
}));

test("nav key icons are tellable apart when the label is hidden", async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");

  const distances = await page.evaluate(
    async ({ keys, hostId, keySel, iconCls }) => {
      await document.fonts.ready;

      // Measure in the icon's own resolved style: the symbol-font fallback
      // stack is the whole reason these glyphs render at all.
      const shadow = document.getElementById(hostId)!.shadowRoot!;
      const sample = shadow.querySelector(`${keySel} .${iconCls}`) as HTMLElement;
      const style = getComputedStyle(sample);
      const px = Number.parseFloat(style.fontSize);
      const scale = 2;
      const w = Math.ceil(px * 2) * scale;
      const h = Math.ceil(px * 2.2) * scale;

      const raster = (ch: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(scale, scale);
        ctx.font = `${px}px ${style.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.fillText(ch, px, px * 1.1);
        const data = ctx.getImageData(0, 0, w, h).data;
        const alpha = new Float64Array(w * h);
        for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3]! / 255;
        return alpha;
      };

      // Ink-normalised symmetric difference (1 - intersection/union of coverage):
      // 0 is the same shape, 1 shares no ink at all. Insensitive to the glyph's
      // absolute weight, which varies per platform font.
      const distance = (a: Float64Array, b: Float64Array) => {
        let intersection = 0;
        let union = 0;
        for (let i = 0; i < a.length; i++) {
          intersection += Math.min(a[i]!, b[i]!);
          union += Math.max(a[i]!, b[i]!);
        }
        return union === 0 ? 0 : 1 - intersection / union;
      };

      const rasters = keys.map((k) => ({ name: k.name, ink: raster(k.icon) }));
      const blank = rasters.filter((r) => r.ink.every((v) => v === 0)).map((r) => r.name);

      const pairs: { pair: string; distance: number }[] = [];
      for (let i = 0; i < rasters.length; i++) {
        for (let j = i + 1; j < rasters.length; j++) {
          const one = rasters[i]!.name;
          const two = rasters[j]!.name;
          pairs.push({
            pair: one < two ? `${one}/${two}` : `${two}/${one}`,
            distance: Math.round(distance(rasters[i]!.ink, rasters[j]!.ink) * 1000) / 1000,
          });
        }
      }
      return { pairs, blank, fontSize: px };
    },
    { keys: NAV_KEYS, hostId: "kb-nav", keySel: DOM.selectors.key, iconCls: DOM.classes.keyIcon },
  );

  // A font with no glyph for an icon renders nothing, which would make every
  // comparison against it trivially pass. Fail loudly instead.
  expect(distances.blank, "nav icons render no ink in this font stack").toEqual([]);
  expect(distances.pairs).toHaveLength((NAV_KEYS.length * (NAV_KEYS.length - 1)) / 2);

  const tooClose = distances.pairs.filter((p) => !MIRROR_PAIRS.has(p.pair) && p.distance < MIN_DISTANCE);

  expect(tooClose, `nav icons collide at ${distances.fontSize}px: ${JSON.stringify(tooClose)}`).toEqual([]);
});
