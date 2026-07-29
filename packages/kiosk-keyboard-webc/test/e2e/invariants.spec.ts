import { test, expect, type Page } from "@playwright/test";
import { openPage } from "./helpers.js";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/core/dom-contract.js";

// Structural invariants of the rendered keyboard, measured rather than
// snapshotted: they hold on every device project and under --ignore-snapshots,
// where the visual specs assert nothing.

const ROOT = DOM.selectors.root;
const KEY = DOM.selectors.key;
const KEY_ATTR = DOM.attributes.key;
const ICON = `.${DOM.classes.keyIcon}`;

// Sub-pixel tolerance for bounding-rect comparisons.
const EPSILON = 0.5;

// The key target-size floor and the container tier that lifts it, in rem as the
// stylesheet authors them.
const FLOOR_REM = 1.5;
const TIER_REM = 20;

// Fixtures spanning the row-density and icon-rendering range of the visual page.
// kb-narrow and kb-numpad cap their own width, so they sit below the container
// tier on every project while the full-width fixtures cross it.
const HOSTS = [
  "kb-qwerty",
  "kb-accent-variants",
  "kb-qwertz-de",
  "kb-ja-kana",
  "kb-numpad",
  "kb-numeric",
  "kb-fkeys",
  "kb-nav",
  "kb-narrow",
  "kb-icon-label-variations",
];

// Fixtures that render at least one SAP icon. A SAP icon is a `ui5-icon` custom
// element carrying its own shadow root and its own `:host` color; a unicode or
// emoji icon is a plain span that inherits regardless.
const ICON_HOSTS = ["kb-qwerty", "kb-numpad", "kb-nav", "kb-fkeys", "kb-icon-label-variations"];

type KeyBox = {
  key: string;
  left: number;
  right: number;
  width: number;
  height: number;
  /** Whether a hit test at the key's centre lands on the key or its own content. */
  reachable: boolean;
};

type Geometry = {
  /** Root font size in px: the floor and the tier threshold are both authored in rem. */
  remPx: number;
  /** Content-box inline size, which is what a `@container` size query resolves against. */
  containerWidth: number;
  /** Border-box edges of the keyboard root, where `:host { overflow: hidden }` clips. */
  left: number;
  right: number;
  keys: KeyBox[];
};

async function readGeometry(page: Page, hostId: string): Promise<Geometry> {
  // Hit testing is viewport-relative and the page stacks its hosts down a
  // scrolling column, so bring this one into view before measuring.
  await page.locator(`#${hostId}`).scrollIntoViewIfNeeded();
  return page.evaluate(
    async ({ id, rootSel, keySel, keyAttr }) => {
      await document.fonts.ready;
      const shadow = document.getElementById(id)!.shadowRoot!;
      const root = shadow.querySelector(rootSel) as HTMLElement;
      const rootBox = root.getBoundingClientRect();
      const rootStyle = getComputedStyle(root);
      return {
        remPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        containerWidth: root.clientWidth - parseFloat(rootStyle.paddingLeft) - parseFloat(rootStyle.paddingRight),
        left: rootBox.left,
        right: rootBox.right,
        keys: [...root.querySelectorAll(keySel)].map((k) => {
          const box = k.getBoundingClientRect();
          // Retargets to the host from `document`, so hit test inside the shadow tree.
          const hit = shadow.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            key: k.getAttribute(keyAttr) ?? "",
            left: box.left,
            right: box.right,
            width: box.width,
            height: box.height,
            reachable: k.contains(hit),
          };
        }),
      };
    },
    { id: hostId, rootSel: ROOT, keySel: KEY, keyAttr: KEY_ATTR },
  );
}

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
});

// A row that overflows is center-justified, so it is the outermost keys of the
// widest row that leave the box and get clipped by the host.
test("keys stay inside the keyboard box", async ({ page }) => {
  for (const id of HOSTS) {
    const geometry = await readGeometry(page, id);
    expect(geometry.keys.length, `${id} rendered no keys`).toBeGreaterThan(0);
    for (const key of geometry.keys) {
      expect(key.left, `${id} "${key.key}" overflows the leading edge`).toBeGreaterThanOrEqual(geometry.left - EPSILON);
      expect(key.right, `${id} "${key.key}" overflows the trailing edge`).toBeLessThanOrEqual(geometry.right + EPSILON);
    }
  }
});

// WCAG 2.5.8 (AA) asks for 24x24. The inline half of the floor is lifted inside
// `@container keyboard (max-width: 20rem)`, where holding it pushes the densest
// rows out of the box; the block half holds at every width. The regime follows
// the measured container width, so a fixture that caps its own width is checked
// against the same rule as the viewport-wide ones.
test("keys hold the target-size floor their container tier allows", async ({ page }) => {
  for (const id of HOSTS) {
    const geometry = await readGeometry(page, id);
    const floor = FLOOR_REM * geometry.remPx;
    const inlineFloored = geometry.containerWidth > TIER_REM * geometry.remPx;
    expect(geometry.keys.length, `${id} rendered no keys`).toBeGreaterThan(0);
    for (const key of geometry.keys) {
      expect(key.height, `${id} "${key.key}" under the block target-size floor`).toBeGreaterThanOrEqual(
        floor - EPSILON,
      );
      if (inlineFloored) {
        expect(key.width, `${id} "${key.key}" under the inline target-size floor`).toBeGreaterThanOrEqual(
          floor - EPSILON,
        );
      } else {
        expect(key.reachable, `${id} "${key.key}" is not hit-testable`).toBe(true);
      }
    }
  }
});

// The long-press affordance is a `::after` triangle. `content` and `clip-path`
// both survive `display: none`, so the generated box is what has to be read:
// display, the resolved size, and the colour it paints in.
test("variant keys paint their corner hint", async ({ page }) => {
  const hints = await page.evaluate(
    ({ id, rootSel, keySel, keyAttr, variantsAttr }) => {
      const root = document.getElementById(id)!.shadowRoot!.querySelector(rootSel) as HTMLElement;
      return [...root.querySelectorAll(`${keySel}[${variantsAttr}]`)].map((k) => {
        const hint = getComputedStyle(k, "::after");
        return {
          key: k.getAttribute(keyAttr) ?? "",
          display: hint.display,
          content: hint.content,
          background: hint.backgroundColor,
          width: parseFloat(hint.width),
          height: parseFloat(hint.height),
        };
      });
    },
    {
      id: "kb-accent-variants",
      rootSel: ROOT,
      keySel: KEY,
      keyAttr: KEY_ATTR,
      variantsAttr: DOM.attributes.hasVariants,
    },
  );

  expect(hints.length, "no key carries variants").toBeGreaterThan(0);
  for (const hint of hints) {
    expect(hint.display, `"${hint.key}" hint generates no box`).not.toBe("none");
    expect(hint.content, `"${hint.key}" hint has no content`).not.toMatch(/^(none|normal)$/);
    expect(hint.background, `"${hint.key}" hint is fully transparent`).not.toBe("rgba(0, 0, 0, 0)");
    expect(hint.width, `"${hint.key}" hint has zero inline size`).toBeGreaterThan(0);
    expect(hint.height, `"${hint.key}" hint has zero block size`).toBeGreaterThan(0);
  }
});

// A `ui5-icon` sets `color: var(--sapContent_IconColor)` on its own `:host`, so
// without the outer-tree `color: inherit` a key icon paints the theme icon color
// instead of the key's - a dark glyph on the blue fill of an Emphasized key.
test("key icons paint in their key's color", async ({ page }) => {
  for (const id of ICON_HOSTS) {
    const icons = await page.evaluate(
      ({ hostId, rootSel, keySel, iconSel, keyAttr }) => {
        const root = document.getElementById(hostId)!.shadowRoot!.querySelector(rootSel) as HTMLElement;
        return [...root.querySelectorAll(iconSel)].map((icon) => {
          const keyEl = icon.closest(keySel)!;
          return {
            key: keyEl.getAttribute(keyAttr) ?? "",
            tag: icon.tagName.toLowerCase(),
            color: getComputedStyle(icon).color,
            keyColor: getComputedStyle(keyEl).color,
            themeIconColor: getComputedStyle(icon).getPropertyValue("--sapContent_IconColor").trim(),
          };
        });
      },
      { hostId: id, rootSel: ROOT, keySel: KEY, iconSel: ICON, keyAttr: KEY_ATTR },
    );

    const sapIcons = icons.filter((icon) => icon.tag === "ui5-icon");
    expect(sapIcons.length, `${id} rendered no SAP icon`).toBeGreaterThan(0);
    for (const icon of sapIcons) {
      // Without a resolved theme token the `:host` color is invalid at
      // computed-value time and falls back to inheritance, which would make the
      // comparison below pass whether or not the icon tracks its key.
      expect(icon.themeIconColor, `${id} "${icon.key}" resolves no theme icon color`).not.toBe("");
    }
    for (const icon of icons) {
      expect(icon.color, `${id} "${icon.key}" icon color drifts from its key`).toBe(icon.keyColor);
    }
  }
});
