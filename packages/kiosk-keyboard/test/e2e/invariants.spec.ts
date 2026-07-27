import { test, expect, type Locator, type Page } from "@playwright/test";
import { KIOSK_KEYBOARD_DOM as DOM } from "../../src/internal/dom-contract.js";
import { openPage, keyboardRoot } from "./helpers.js";

// Structural invariants of the rendered keyboard (desktop + device matrix).
// Geometry and computed style only, so unlike the visual specs these carry no
// baseline: they assert the same thing on every device profile and on any OS,
// and still gate under --ignore-snapshots.

// All three fixtures render the qwerty layout. kb-qwerty follows the viewport
// width, kb-narrow is pinned to a 320px container (below the narrowest tier on
// every profile, including desktop), and kb-accent-variants arms the long-press
// variants that carry the corner hint.
const FIXTURES = ["kb-qwerty", "kb-narrow", "kb-accent-variants"];

/** WCAG 2.5.8 (AA) target size, less a sub-pixel rounding allowance. */
const TARGET_SIZE = 23.99;
/** Sub-pixel slack when comparing a key rect against the keyboard rect. */
const EDGE_EPSILON = 0.5;
/** Container tier at or below which the inline floor yields to reachability (see the LESS). */
const NARROW_TIER_REM = 20;

interface KeyBox {
  key: string;
  left: number;
  right: number;
  width: number;
  height: number;
  /** Whether a hit test at the key's center lands on the key or its own content. */
  reachable: boolean;
}

interface KeyboardGeometry {
  left: number;
  right: number;
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
        contentInline,
        narrowTier: contentInline <= narrowTierRem * rem,
        keys: [...board.querySelectorAll<HTMLElement>(keySelector)].map((el) => {
          const box = el.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return {
            key: el.dataset.key ?? "",
            left: box.left,
            right: box.right,
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
          width: parseFloat(after.width),
          height: parseFloat(after.height),
        };
      }),
    `${DOM.selectors.key}[${DOM.attributes.hasVariants}]`,
  );

  expect(hints.length, "the fixture arms variant keys").toBeGreaterThan(0);
  for (const hint of hints) {
    // `content` and `clip-path` both survive `display: none`, so only these
    // three separate a painted hint from a suppressed one.
    expect(hint.display, `hint on '${hint.key}' is not suppressed`).not.toBe("none");
    expect(hint.width, `hint on '${hint.key}' has an inline size`).toBeGreaterThan(0);
    expect(hint.height, `hint on '${hint.key}' has a block size`).toBeGreaterThan(0);
  }
});

for (const id of FIXTURES) {
  test(`${id}: no key escapes the keyboard on the inline axis`, async ({ page }) => {
    const geometry = await measureKeyboard(page, id);
    expect(geometry.keys.length, "the keyboard rendered its keys").toBeGreaterThan(0);
    // Rows are center-justified inside an overflow: hidden root, so a row that
    // does not fit is clipped at BOTH edges, taking its outermost keys with it.
    for (const box of geometry.keys) {
      expect(box.left, `key '${box.key}' is not clipped at the leading edge`).toBeGreaterThanOrEqual(
        geometry.left - EDGE_EPSILON,
      );
      expect(box.right, `key '${box.key}' is not clipped at the trailing edge`).toBeLessThanOrEqual(
        geometry.right + EDGE_EPSILON,
      );
    }
  });

  test(`${id}: keys hold the target-size floor, or stay reachable below the tier`, async ({ page }) => {
    const geometry = await measureKeyboard(page, id);
    expect(geometry.keys.length, "the keyboard rendered its keys").toBeGreaterThan(0);
    const where = `${geometry.contentInline.toFixed(0)}px keyboard`;
    for (const box of geometry.keys) {
      // Only the inline floor is lifted at the narrowest tier; the block one holds everywhere.
      expect(box.height, `key '${box.key}' holds 24px block in a ${where}`).toBeGreaterThanOrEqual(TARGET_SIZE);
      if (geometry.narrowTier) {
        expect(box.reachable, `key '${box.key}' is hit-testable in a ${where}`).toBe(true);
      } else {
        expect(box.width, `key '${box.key}' holds 24px inline in a ${where}`).toBeGreaterThanOrEqual(TARGET_SIZE);
      }
    }
  });
}

test("key icons paint in their key's color", async ({ page }) => {
  const root = await renderedKeyboard(page, "kb-qwerty");
  const icons = await root.evaluate(
    (board, { keySelector, iconSelector }) =>
      [...board.querySelectorAll<HTMLElement>(keySelector)].flatMap((key) => {
        const icon = key.querySelector<HTMLElement>(iconSelector);
        if (!icon) return [];
        return [
          {
            key: key.dataset.key ?? "",
            // A SAP icon URI renders as an icon-font span carrying `sapUiIcon`,
            // a unicode glyph as a bare span. Only the former can pick up an
            // icon color of its own instead of inheriting the key's.
            iconFont: icon.classList.contains("sapUiIcon"),
            iconColor: getComputedStyle(icon).color,
            keyColor: getComputedStyle(key).color,
          },
        ];
      }),
    { keySelector: DOM.selectors.key, iconSelector: `.${DOM.classes.keyIcon}` },
  );

  expect(icons.length, "the fixture renders icon keys").toBeGreaterThan(0);
  expect(
    icons.some((icon) => icon.iconFont),
    "an icon-font key is covered",
  ).toBe(true);
  for (const icon of icons) {
    expect(icon.iconColor, `icon on '${icon.key}' tracks its key color`).toBe(icon.keyColor);
  }
});
