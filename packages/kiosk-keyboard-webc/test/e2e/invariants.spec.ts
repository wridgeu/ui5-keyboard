import { test, expect, type Page } from "@playwright/test";
import { openPage, setDocumentDirection } from "./helpers.js";
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

// The keyboard box the kana spacing claim is made about (a docked keyboard on a
// 320px screen), and the `auto-compact` default threshold of 22rem.
const KANA_PREMISE_PX = 320;
const AUTO_COMPACT_THRESHOLD_PX = 352;

// Fixtures spanning the row-density and icon-rendering range of the visual page.
// kb-narrow and kb-numpad cap their own width, so they sit below the container
// tier on every project while the full-width fixtures cross it;
// kb-height-padded-host caps its height and takes its own padding and border out
// of both budgets, so what fits it is what the tier controller measured.
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
  "kb-qwerty-nav-compact",
  "kb-height-padded-host",
];

// Fixtures whose host caps the keyboard's height, directly or through an
// ancestor. The block half of the target-size floor never lifts, so these are
// the fixtures where it can push the last row past `overflow: hidden`.
const HEIGHT_CAPPED_HOSTS = [
  "kb-height-constrained",
  "kb-height-tiny",
  "kb-ancestor-constrained",
  "kb-ancestor-tiny",
  "kb-narrow-short",
];

// Fixtures that render at least one SAP icon. A SAP icon is a `ui5-icon` custom
// element carrying its own shadow root and its own `:host` color; a unicode or
// emoji icon is a plain span that inherits regardless.
const ICON_HOSTS = ["kb-qwerty", "kb-numpad", "kb-nav", "kb-fkeys", "kb-icon-label-variations"];

type KeyBox = {
  key: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
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
  top: number;
  bottom: number;
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
        top: rootBox.top,
        bottom: rootBox.bottom,
        keys: [...root.querySelectorAll(keySel)].map((k) => {
          const box = k.getBoundingClientRect();
          // Retargets to the host from `document`, so hit test inside the shadow tree.
          const hit = shadow.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            key: k.getAttribute(keyAttr) ?? "",
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
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

/**
 * The closest pair of key centres, which is the quantity SC 2.5.8's spacing
 * exception is about: the 24px circle it draws around a key may reach no other
 * key's centre. Every pair, not just row neighbours - the criterion is about
 * circles, so a key in the row below counts as much as the one beside it.
 */
function closestKeyCentres(geometry: Geometry): { distance: number; pair: string } {
  const centre = (box: KeyBox) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
  let closest = { distance: Infinity, pair: "" };
  for (let i = 0; i < geometry.keys.length; i++) {
    for (let j = i + 1; j < geometry.keys.length; j++) {
      const a = centre(geometry.keys[i]!);
      const b = centre(geometry.keys[j]!);
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < closest.distance) {
        closest = { distance, pair: `"${geometry.keys[i]!.key}" and "${geometry.keys[j]!.key}"` };
      }
    }
  }
  return closest;
}

/** Asserts every key centre keeps SC 2.5.8's 24px from every other one. */
function expectKeyCentresApart(geometry: Geometry, id: string): void {
  const closest = closestKeyCentres(geometry);
  expect(closest.distance, `${id}: ${closest.pair} keep 24px between their centres`).toBeGreaterThanOrEqual(
    FLOOR_REM * geometry.remPx,
  );
}

/**
 * Give a host the keyboard box the assertion names, so the measurement is of the
 * width under discussion rather than of whatever the viewport leaves a fixture
 * that only caps its width on the device projects.
 */
async function pinKeyboardWidth(page: Page, hostIds: string[], px: number): Promise<void> {
  await page.addStyleTag({ content: hostIds.map((id) => `#${id} { width: ${px}px; }`).join("\n") });
  // Container queries resolve during layout, and the auto-compact controller
  // re-tiers off a ResizeObserver, so let the resize settle first.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** A navigation key by the `{fkey:*}` token it carries as its data-key. */
function navKey(geometry: Geometry, fkey: string): KeyBox {
  const box = geometry.keys.find((k) => k.key === `{fkey:${fkey}}`);
  expect(box, `no "${fkey}" key rendered`).toBeDefined();
  return box!;
}

test.beforeEach(async ({ page }) => {
  await openPage(page, "/test/pages/visual.html");
});

// A row that overflows is center-justified, so it is the outermost keys of the
// widest row that leave the box and get clipped by the host. The block axis
// matters for the same reason: the key floor holds at every width, so a
// height-capped host is where it can push the last row out of the box.
test("keys stay inside the keyboard box", async ({ page }) => {
  for (const id of [...HOSTS, ...HEIGHT_CAPPED_HOSTS]) {
    const geometry = await readGeometry(page, id);
    expect(geometry.keys.length, `${id} rendered no keys`).toBeGreaterThan(0);
    for (const key of geometry.keys) {
      expect(key.left, `${id} "${key.key}" overflows the leading edge`).toBeGreaterThanOrEqual(geometry.left - EPSILON);
      expect(key.right, `${id} "${key.key}" overflows the trailing edge`).toBeLessThanOrEqual(geometry.right + EPSILON);
      expect(key.top, `${id} "${key.key}" overflows the top edge`).toBeGreaterThanOrEqual(geometry.top - EPSILON);
      expect(key.bottom, `${id} "${key.key}" overflows the bottom edge`).toBeLessThanOrEqual(geometry.bottom + EPSILON);
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

// The premise `ja-kana-compact` and the `auto-compact` attribute both exist for,
// held to a measurement. Below the 20rem tier the inline target-size floor is
// lifted, so SC 2.5.8 is met there only through its spacing exception: a 24px
// circle centred on a key may not reach another key's. `ja-kana` follows a
// physical JIS keyboard, whose Backspace row and shift/enter row come to 12.5
// and 13 key widths, and leaves less than that in a 320px keyboard;
// `ja-kana-compact` holds every row to 12 widths and clears it. Both are
// measured in the same box, so what is compared is the two layouts and not two
// widths.
//
// A red on the `ja-kana` assertion is not a defect report and is not to be
// relaxed. It says the premise changed - those rows now get more room than they
// did - so the compact layout and the `auto-compact` attribute have to be
// re-justified, and the spacing table in
// docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md re-measured, before anything here
// moves.
test("ja-kana falls under 24px key spacing in a 320px keyboard, where ja-kana-compact clears it", async ({ page }) => {
  await pinKeyboardWidth(page, ["kb-ja-kana", "kb-ja-kana-compact"], KANA_PREMISE_PX);
  const wide = await readGeometry(page, "kb-ja-kana");
  const compact = await readGeometry(page, "kb-ja-kana-compact");

  expect(wide.keys.length, "the wide fixture rendered no keys").toBeGreaterThan(0);
  expect(compact.keys.length, "the compact fixture rendered no keys").toBeGreaterThan(0);
  expect(wide.right - wide.left, `the wide form is not measured in a ${KANA_PREMISE_PX}px keyboard`).toBeCloseTo(
    KANA_PREMISE_PX,
    1,
  );
  expect(
    Math.abs(wide.containerWidth - compact.containerWidth),
    "the two forms are measured in different boxes",
  ).toBeLessThanOrEqual(EPSILON);
  expect(wide.containerWidth, "the box does not sit below the tier that lifts the inline floor").toBeLessThanOrEqual(
    TIER_REM * wide.remPx,
  );

  const widest = closestKeyCentres(wide);
  const closest = closestKeyCentres(compact);
  expect(
    widest.distance,
    `ja-kana leaves ${widest.pair} under 24px apart (${widest.distance.toFixed(2)}px)`,
  ).toBeLessThan(FLOOR_REM * wide.remPx);
  expect(
    closest.distance,
    `ja-kana-compact keeps ${closest.pair} 24px apart (${closest.distance.toFixed(2)}px)`,
  ).toBeGreaterThanOrEqual(FLOOR_REM * compact.remPx);
  expect(closest.distance, "the compact rows buy no spacing over the rows they replace").toBeGreaterThan(
    widest.distance,
  );
});

// The same criterion, reached by the `autoCompact` property rather than by naming
// the compact layout: the fixture asks for `ja-kana` and is given a 320px box, so
// the counterpart is what has to be on screen for the spacing to hold.
test("autoCompact puts a 320px kana keyboard on the rows that clear 24px key spacing", async ({ page }) => {
  await pinKeyboardWidth(page, ["kb-ja-kana-auto", "kb-ja-kana-compact"], KANA_PREMISE_PX);
  const auto = await readGeometry(page, "kb-ja-kana-auto");
  const compact = await readGeometry(page, "kb-ja-kana-compact");
  const wide = await readGeometry(page, "kb-ja-kana");
  const rendered = (geometry: Geometry) => geometry.keys.map((box) => box.key);

  expect(auto.keys.length, "the fixture rendered no keys").toBeGreaterThan(0);
  expect(auto.containerWidth, "the fixture sits below the tier that lifts the inline floor").toBeLessThanOrEqual(
    TIER_REM * auto.remPx,
  );
  expect(rendered(auto), "the compact rows are what rendered").toEqual(rendered(compact));
  expect(rendered(auto), "and not the rows the fixture asked for").not.toEqual(rendered(wide));

  expectKeyCentresApart(auto, "kb-ja-kana-auto");
});

// The other side of the premise above, at the width `auto-compact` takes the
// compact form on. 22rem is above the 20rem tier, so the inline target-size
// floor still holds there and both kana forms clear the criterion on target size
// alone - which is what puts the default threshold clear of the width at which
// the wide form starts relying on spacing and losing it.
test("both kana forms clear 24px key spacing at the 22rem autoCompact threshold", async ({ page }) => {
  await pinKeyboardWidth(page, ["kb-ja-kana", "kb-ja-kana-compact"], AUTO_COMPACT_THRESHOLD_PX);
  const wide = await readGeometry(page, "kb-ja-kana");
  const compact = await readGeometry(page, "kb-ja-kana-compact");

  expect(wide.keys.length, "the wide fixture rendered no keys").toBeGreaterThan(0);
  expect(compact.keys.length, "the compact fixture rendered no keys").toBeGreaterThan(0);
  expect(
    wide.right - wide.left,
    `the wide form is not measured in a ${AUTO_COMPACT_THRESHOLD_PX}px keyboard`,
  ).toBeCloseTo(AUTO_COMPACT_THRESHOLD_PX, 1);
  expect(wide.containerWidth, "the threshold does not sit above the tier that lifts the inline floor").toBeGreaterThan(
    TIER_REM * wide.remPx,
  );

  expectKeyCentresApart(wide, "kb-ja-kana");
  expectKeyCentresApart(compact, "kb-ja-kana-compact");
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

// The grid coordinate arrow-key navigation moves on is published per key. A
// coordinate that disagrees with the key's actual place in the DOM would send
// consumer CSS and tests to a key the user sees somewhere else.
test("keys carry the grid coordinate they occupy", async ({ page }) => {
  for (const id of HOSTS) {
    const rows = await page.evaluate(
      ({ hostId, rootSel, rowSel, keySel, rowAttr, colAttr }) => {
        const root = document.getElementById(hostId)!.shadowRoot!.querySelector(rootSel)!;
        return [...root.querySelectorAll(rowSel)].map((row) =>
          [...row.querySelectorAll(keySel)].map((k) => `${k.getAttribute(rowAttr)},${k.getAttribute(colAttr)}`),
        );
      },
      {
        hostId: id,
        rootSel: ROOT,
        rowSel: DOM.selectors.row,
        keySel: KEY,
        rowAttr: DOM.attributes.rowIndex,
        colAttr: DOM.attributes.keyIndex,
      },
    );

    // Derived from the rendered shape, so it asserts the attribute values
    // against where each key actually sits rather than against itself.
    const occupied = rows.map((row, r) => row.map((_, c) => `${r},${c}`));

    expect(rows.length, `${id} rendered no rows`).toBeGreaterThan(0);
    expect(rows.flat().length, `${id} rendered no keys`).toBeGreaterThan(0);
    expect(rows, `${id} grid coordinates drift from DOM position`).toEqual(occupied);
  }
});

// Rows are flex containers, so the compact nav row mirrors with the document
// direction. The relations the 2x4 arrangement exists for survive the mirroring:
// Up keeps Down's column, and ArrowLeft/ArrowRight keep flanking Down. Which of
// the two renders on which side follows the direction, and arrow-key navigation
// mirrors with it.
test("the compact nav row mirrors with the document direction", async ({ page }) => {
  const ltr = await readGeometry(page, "kb-qwerty-nav-compact");
  await setDocumentDirection(page, "rtl");
  const rtl = await readGeometry(page, "kb-qwerty-nav-compact");

  const up = navKey(rtl, "ArrowUp");
  const down = navKey(rtl, "ArrowDown");
  expect(Math.abs(up.left - down.left), "Up leaves Down's column in RTL").toBeLessThanOrEqual(EPSILON);
  expect(Math.abs(up.right - down.right), "Up leaves Down's column in RTL").toBeLessThanOrEqual(EPSILON);
  expect(up.bottom, "Up does not sit above Down in RTL").toBeLessThanOrEqual(down.top + EPSILON);

  const left = navKey(rtl, "ArrowLeft");
  const right = navKey(rtl, "ArrowRight");
  expect(Math.abs(left.top - down.top), "ArrowLeft leaves Down's row in RTL").toBeLessThanOrEqual(EPSILON);
  expect(Math.abs(right.top - down.top), "ArrowRight leaves Down's row in RTL").toBeLessThanOrEqual(EPSILON);
  // The nearer inner edge of the two sits at or before Down's leading edge and
  // the farther outer edge at or after its trailing edge, so one arrow is on
  // each side of Down whichever way the row runs.
  expect(Math.min(left.right, right.right), "the horizontal arrows do not flank Down in RTL").toBeLessThanOrEqual(
    down.left + EPSILON,
  );
  expect(Math.max(left.left, right.left), "the horizontal arrows do not flank Down in RTL").toBeGreaterThanOrEqual(
    down.right - EPSILON,
  );

  expect(navKey(ltr, "ArrowLeft").left, "ArrowLeft does not precede ArrowRight on screen in LTR").toBeLessThan(
    navKey(ltr, "ArrowRight").left,
  );
  expect(left.left, "the horizontal arrow pair does not mirror in RTL").toBeGreaterThan(right.left);
});
