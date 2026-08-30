import { test, expect, type Locator, type Page } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";
import { openPage, keyboardRoot, setDocumentDirection } from "./helpers.js";

// Structural invariants of the rendered keyboard (desktop + device matrix).
// Geometry and computed style only, so unlike the visual specs these carry no
// baseline: they assert the same thing on every device profile and on any OS,
// and still gate under --ignore-snapshots.

// Every fixture renders the qwerty layout. kb-qwerty follows the viewport
// width, kb-narrow is pinned to a 320px container (below the narrowest tier on
// every profile, including desktop), kb-accent-variants arms the long-press
// variants that carry the corner hint, and kb-qwerty-nav-compact prepends the
// 2x4 navigation rows.
const FIXTURES = ["kb-qwerty", "kb-narrow", "kb-accent-variants", "kb-qwerty-nav-compact"];

// Fixtures whose host caps the keyboard's height, directly or through an
// ancestor. The block half of the target-size floor never lifts, so these are
// the fixtures where it can push the last row past `overflow: hidden`.
// Addressed by container id, which for the ancestor cases is the wrapper the
// keyboard is placed into (see test/e2e/visual/init.js). The caps sit on both
// sides of the tier thresholds: below them a `--cqShort`/`--cqTiny` shrink
// takes the rows in, above them (kb-container-fixed) no tier applies and the
// keyboard has to fit the box at its authored size.
const HEIGHT_CAPPED_FIXTURES = [
  "kb-height-constrained",
  "kb-height-tiny",
  "kb-ancestor-constrained-wrap",
  "kb-ancestor-tiny-wrap",
  "kb-narrow-short",
  "kb-container-fixed",
];

/** WCAG 2.5.8 (AA) target size, less a sub-pixel rounding allowance. */
const TARGET_SIZE = 23.99;
/** Sub-pixel slack when comparing a key rect against the keyboard rect. */
const EDGE_EPSILON = 0.5;
/** Container tier at or below which the inline floor yields to reachability (see the LESS). */
const NARROW_TIER_REM = 20;
/** The keyboard box the kana spacing claim is made about: a docked keyboard on a 320px screen. */
const KANA_PREMISE_PX = 320;
/** The `autoCompact` default threshold, 22rem at the default root font size. */
const AUTO_COMPACT_THRESHOLD_PX = 352;

interface KeyBox {
  key: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  /** Whether a hit test at the key's center lands on the key or its own content. */
  reachable: boolean;
}

interface KeyboardGeometry {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Inline content box: the box `@container keyboard (max-width: ...)` is evaluated against. */
  contentInline: number;
  narrowTier: boolean;
  keys: KeyBox[];
}

/** The keyboard root inside a container, once it has rendered its keys. */
async function renderedKeyboard(page: Page, containerId: string): Promise<Locator> {
  const root = keyboardRoot(page, containerId);
  await root.locator(DOM.selectors.key).first().waitFor();
  return root;
}

async function measureKeyboard(page: Page, containerId: string): Promise<KeyboardGeometry> {
  const root = await renderedKeyboard(page, containerId);
  // Hit testing is viewport-relative, so bring the keyboard into view first.
  await root.scrollIntoViewIfNeeded();
  return root.evaluate(
    async (board, { keySelector, narrowTierRem }) => {
      // Late web fonts still move the layout, so settle them before measuring.
      await document.fonts.ready;
      const style = getComputedStyle(board);
      const rect = board.getBoundingClientRect();
      const contentInline =
        rect.width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) -
        parseFloat(style.borderLeftWidth) -
        parseFloat(style.borderRightWidth);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        contentInline,
        narrowTier: contentInline <= narrowTierRem * rem,
        keys: [...board.querySelectorAll<HTMLElement>(keySelector)].map((el) => {
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            key: el.dataset.key ?? "",
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            reachable: el.contains(hit),
          };
        }),
      };
    },
    { keySelector: DOM.selectors.key, narrowTierRem: NARROW_TIER_REM },
  );
}

/**
 * The closest pair of key centres, which is the quantity SC 2.5.8's spacing
 * exception is about: the 24px-diameter circles it draws around two keys may not
 * intersect, which puts their centres at least 24px apart. Every pair, not just
 * row neighbours - the criterion is about circles, so a key in the row below
 * counts as much as the one beside it.
 */
function closestKeyCentres(geometry: KeyboardGeometry): { distance: number; pair: string } {
  const centre = (box: KeyBox) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
  let closest = { distance: Infinity, pair: "" };
  for (let i = 0; i < geometry.keys.length; i++) {
    for (let j = i + 1; j < geometry.keys.length; j++) {
      const a = centre(geometry.keys[i]);
      const b = centre(geometry.keys[j]);
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < closest.distance) {
        closest = { distance, pair: `'${geometry.keys[i].key}' and '${geometry.keys[j].key}'` };
      }
    }
  }
  return closest;
}

/** Asserts every key centre keeps SC 2.5.8's 24px from every other one. */
function expectKeyCentresApart(geometry: KeyboardGeometry, id: string): void {
  const closest = closestKeyCentres(geometry);
  expect(closest.distance, `${id}: keys ${closest.pair} keep 24px between their centres`).toBeGreaterThanOrEqual(
    TARGET_SIZE,
  );
}

/**
 * Give a fixture the keyboard box the assertion names, padding included, so the
 * measurement is of the width under discussion rather than of whatever the
 * viewport leaves a fixture on the device projects.
 */
async function pinKeyboardWidth(page: Page, containerIds: string[], px: number): Promise<void> {
  await page.addStyleTag({
    content: containerIds.map((id) => `#${id} { width: ${px}px; padding: 0; }`).join("\n"),
  });
  // Container queries resolve during layout, so let the resize settle first.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** A navigation key by the `{fkey:*}` token it carries as its data-key. */
function navKey(geometry: KeyboardGeometry, fkey: string): KeyBox {
  const box = geometry.keys.find((k) => k.key === `{fkey:${fkey}}`);
  expect(box, `the fixture renders a '${fkey}' key`).toBeDefined();
  return box!;
}

test.beforeEach(async ({ page }) => {
  await openPage(page);
});

test("variant keys paint their corner hint", async ({ page }) => {
  const root = await renderedKeyboard(page, "kb-accent-variants");
  const hints = await root.evaluate(
    (board, selector) =>
      [...board.querySelectorAll<HTMLElement>(selector)].map((el) => {
        const after = getComputedStyle(el, "::after");
        return {
          key: el.dataset.key ?? "",
          display: after.display,
          content: after.content,
          background: after.backgroundColor,
          width: parseFloat(after.width),
          height: parseFloat(after.height),
        };
      }),
    `${DOM.selectors.key}[${DOM.attributes.hasVariants}]`,
  );

  expect(hints.length, "the fixture arms variant keys").toBeGreaterThan(0);
  for (const hint of hints) {
    // Every one of these can suppress the mark on its own while the others still
    // report a painted hint, so each is asserted separately.
    expect(hint.display, `hint on '${hint.key}' is not suppressed`).not.toBe("none");
    expect(hint.content, `hint on '${hint.key}' generates a box`).not.toBe("none");
    expect(hint.background, `hint on '${hint.key}' is not fully transparent`).not.toBe("rgba(0, 0, 0, 0)");
    expect(hint.width, `hint on '${hint.key}' has an inline size`).toBeGreaterThan(0);
    expect(hint.height, `hint on '${hint.key}' has a block size`).toBeGreaterThan(0);
  }
});

test("no key escapes the keyboard box", async ({ page }) => {
  for (const id of [...FIXTURES, ...HEIGHT_CAPPED_FIXTURES]) {
    const geometry = await measureKeyboard(page, id);
    expect(geometry.keys.length, `${id} rendered its keys`).toBeGreaterThan(0);
    // Rows are center-justified inside an overflow: hidden root, so a row that
    // does not fit is clipped at BOTH edges, taking its outermost keys with it.
    // The block axis clips the same way, and the block half of the target-size
    // floor never lifts, so a height-capped host is where it can push a row out.
    for (const box of geometry.keys) {
      expect(box.left, `${id}: key '${box.key}' is not clipped at the leading edge`).toBeGreaterThanOrEqual(
        geometry.left - EDGE_EPSILON,
      );
      expect(box.right, `${id}: key '${box.key}' is not clipped at the trailing edge`).toBeLessThanOrEqual(
        geometry.right + EDGE_EPSILON,
      );
      expect(box.top, `${id}: key '${box.key}' is not clipped at the top edge`).toBeGreaterThanOrEqual(
        geometry.top - EDGE_EPSILON,
      );
      expect(box.bottom, `${id}: key '${box.key}' is not clipped at the bottom edge`).toBeLessThanOrEqual(
        geometry.bottom + EDGE_EPSILON,
      );
    }
  }
});

test("keys hold the target-size floor, or stay reachable below the tier", async ({ page }) => {
  for (const id of FIXTURES) {
    const geometry = await measureKeyboard(page, id);
    expect(geometry.keys.length, `${id} rendered its keys`).toBeGreaterThan(0);
    const where = `${geometry.contentInline.toFixed(0)}px keyboard`;
    for (const box of geometry.keys) {
      // Only the inline floor is lifted at the narrowest tier; the block one holds everywhere.
      expect(box.height, `${id}: key '${box.key}' holds 24px block in a ${where}`).toBeGreaterThanOrEqual(TARGET_SIZE);
      if (geometry.narrowTier) {
        expect(box.reachable, `${id}: key '${box.key}' is hit-testable in a ${where}`).toBe(true);
      } else {
        expect(box.width, `${id}: key '${box.key}' holds 24px inline in a ${where}`).toBeGreaterThanOrEqual(
          TARGET_SIZE,
        );
      }
    }
  }
});

// The premise `ja-kana-compact` and the `autoCompact` property both exist for,
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
// did - so the compact layout and the `autoCompact` property have to be
// re-justified, and the spacing table in
// docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md re-measured, before anything here
// moves.
test("ja-kana falls under 24px key spacing in a 320px keyboard, where ja-kana-compact clears it", async ({ page }) => {
  await pinKeyboardWidth(page, ["kb-ja-kana", "kb-ja-kana-compact"], KANA_PREMISE_PX);
  const wide = await measureKeyboard(page, "kb-ja-kana");
  const compact = await measureKeyboard(page, "kb-ja-kana-compact");

  expect(wide.keys.length, "the wide fixture rendered its keys").toBeGreaterThan(0);
  expect(compact.keys.length, "the compact fixture rendered its keys").toBeGreaterThan(0);
  expect(wide.right - wide.left, `the wide form is measured in a ${KANA_PREMISE_PX}px keyboard`).toBeCloseTo(
    KANA_PREMISE_PX,
    1,
  );
  expect(
    Math.abs(wide.contentInline - compact.contentInline),
    "both forms are measured in the same box",
  ).toBeLessThanOrEqual(EDGE_EPSILON);

  const widest = closestKeyCentres(wide);
  const closest = closestKeyCentres(compact);
  expect(
    widest.distance,
    `ja-kana leaves keys ${widest.pair} under 24px apart (${widest.distance.toFixed(2)}px)`,
  ).toBeLessThan(TARGET_SIZE);
  expect(
    closest.distance,
    `ja-kana-compact keeps keys ${closest.pair} 24px apart (${closest.distance.toFixed(2)}px)`,
  ).toBeGreaterThanOrEqual(TARGET_SIZE);
  expect(closest.distance, "the compact rows buy spacing over the rows they replace").toBeGreaterThan(widest.distance);
});

// The same criterion, reached by the `autoCompact` property rather than by naming
// the compact layout: the fixture asks for `ja-kana` and is given a 320px box, so
// the counterpart is what has to be on screen for the spacing to hold.
test("autoCompact puts a 320px kana keyboard on the rows that clear 24px key spacing", async ({ page }) => {
  await pinKeyboardWidth(page, ["kb-ja-kana-auto", "kb-ja-kana-compact"], KANA_PREMISE_PX);
  const auto = await measureKeyboard(page, "kb-ja-kana-auto");
  const compact = await measureKeyboard(page, "kb-ja-kana-compact");
  const wide = await measureKeyboard(page, "kb-ja-kana");
  const rendered = (geometry: KeyboardGeometry) => geometry.keys.map((box) => box.key);

  expect(auto.keys.length, "the fixture rendered its keys").toBeGreaterThan(0);
  expect(auto.narrowTier, "the fixture sits below the tier that lifts the inline floor").toBe(true);
  expect(rendered(auto), "the compact rows are what rendered").toEqual(rendered(compact));
  expect(rendered(auto), "and not the rows the fixture asked for").not.toEqual(rendered(wide));

  expectKeyCentresApart(auto, "kb-ja-kana-auto");
});

// The other side of the premise above, at the width `autoCompact` takes the
// compact form on. 22rem is above the 20rem tier, so the inline target-size
// floor still holds there and both kana forms clear the criterion on target
// size alone - which is what puts the default threshold clear of the width at
// which the wide form starts relying on spacing and losing it.
test("both kana forms clear 24px key spacing at the 22rem autoCompact threshold", async ({ page }) => {
  await pinKeyboardWidth(page, ["kb-ja-kana", "kb-ja-kana-compact"], AUTO_COMPACT_THRESHOLD_PX);
  const wide = await measureKeyboard(page, "kb-ja-kana");
  const compact = await measureKeyboard(page, "kb-ja-kana-compact");

  expect(wide.keys.length, "the wide fixture rendered its keys").toBeGreaterThan(0);
  expect(compact.keys.length, "the compact fixture rendered its keys").toBeGreaterThan(0);
  expect(wide.right - wide.left, `the wide form is measured in a ${AUTO_COMPACT_THRESHOLD_PX}px keyboard`).toBeCloseTo(
    AUTO_COMPACT_THRESHOLD_PX,
    1,
  );
  expect(wide.narrowTier, "the threshold sits above the tier that lifts the inline floor").toBe(false);

  expectKeyCentresApart(wide, "kb-ja-kana");
  expectKeyCentresApart(compact, "kb-ja-kana-compact");
});

// Rows are flex containers, so the compact navigation rows mirror with the
// document direction. The relations the 2x4 arrangement exists for survive the
// mirroring: Up keeps Down's column, and ArrowLeft/ArrowRight keep flanking
// Down. Which of the two renders on which side follows the direction, and
// arrow-key navigation mirrors with it.
test("the compact nav rows mirror with the document direction", async ({ page }) => {
  const ltr = await measureKeyboard(page, "kb-qwerty-nav-compact");
  await setDocumentDirection(page, "rtl");
  const rtl = await measureKeyboard(page, "kb-qwerty-nav-compact");

  const up = navKey(rtl, "ArrowUp");
  const down = navKey(rtl, "ArrowDown");
  expect(Math.abs(up.left - down.left), "Up keeps Down's column in RTL").toBeLessThanOrEqual(EDGE_EPSILON);
  expect(Math.abs(up.right - down.right), "Up keeps Down's column in RTL").toBeLessThanOrEqual(EDGE_EPSILON);
  expect(up.bottom, "Up sits above Down in RTL").toBeLessThanOrEqual(down.top + EDGE_EPSILON);

  const left = navKey(rtl, "ArrowLeft");
  const right = navKey(rtl, "ArrowRight");
  expect(Math.abs(left.top - down.top), "ArrowLeft keeps Down's row in RTL").toBeLessThanOrEqual(EDGE_EPSILON);
  expect(Math.abs(right.top - down.top), "ArrowRight keeps Down's row in RTL").toBeLessThanOrEqual(EDGE_EPSILON);
  // The nearer inner edge of the two sits at or before Down's leading edge and
  // the farther outer edge at or after its trailing edge, so one arrow is on
  // each side of Down whichever way the row runs.
  expect(Math.min(left.right, right.right), "the horizontal arrows flank Down in RTL").toBeLessThanOrEqual(
    down.left + EDGE_EPSILON,
  );
  expect(Math.max(left.left, right.left), "the horizontal arrows flank Down in RTL").toBeGreaterThanOrEqual(
    down.right - EDGE_EPSILON,
  );

  expect(navKey(ltr, "ArrowLeft").left, "ArrowLeft precedes ArrowRight on screen in LTR").toBeLessThan(
    navKey(ltr, "ArrowRight").left,
  );
  expect(left.left, "the horizontal arrow pair mirrors in RTL").toBeGreaterThan(right.left);
});
