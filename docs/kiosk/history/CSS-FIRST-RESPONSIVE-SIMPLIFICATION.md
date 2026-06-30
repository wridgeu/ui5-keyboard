# CSS-First Responsive Simplification

**Goal:** Remove the JS-driven width responsive path from both packages, keeping CSS `@container` queries as the sole width-responsive mechanism. Add browser compatibility documentation to both package READMEs.

**Architecture:** Width responsiveness moves from a dual CSS+JS system (CSS `@container` for defaults, JS `ResizeObserver` + classes for custom thresholds) to pure CSS `@container`. Height responsiveness stays JS-driven: there is no CSS equivalent for `container-type` height queries in this setup (`container-type: inline-size` only exposes width, and `container-type: size` would require explicit height containment that breaks the layout). The consumer-configurable width threshold CSS variables (`cqNarrowThreshold` / `cqCompactThreshold`) are removed as a feature. Consumers who need custom width breakpoints write their own `@container` rules targeting the keyboard's CSS custom properties.

**Tech Stack:** CSS (container queries), TypeScript, LESS, QUnit, Web Test Runner, WDIO visual regression

**Status:** Implemented

---

## Motivation

The previous responsive architecture combined four simultaneous mechanisms:

1. CSS `@container` queries (hardcoded width breakpoints)
2. JS `ResizeObserver` reading CSS custom property thresholds
3. JS class toggling (`cq-sm`/`cq-xs`/`cq-width-custom`)
4. CSS `@supports not (container-type)` fallback for pre-2023 browsers

This existed because CSS does not allow `var()` inside `@container` query expressions, forcing JS to bridge configurable thresholds to CSS. No other production component library (Shoelace, Material Web, UI5 Web Components, Vaadin) attempts this combination. The complexity created specificity conflicts and made the system brittle.

Container queries have been supported in all major browsers since 2023 (Chrome 105, Firefox 110, Safari 16, Edge 105). The `@supports not` fallback was dead code for the target audience (enterprise kiosks, SAP Fiori, modern tablets).

The JS width path (width measurement plus `cq-sm`/`cq-xs`/`cq-width-custom` class toggling) and the `--cqNarrowThreshold` / `--cqCompactThreshold` public CSS custom properties were removed. Removing those properties is a breaking change for consumers: a consumer who set them migrates to their own `@container` rules on an outer wrapper, which is more flexible. The JS height path (`ResizeObserver` / `ResizeHandler` toggling the `cqShort` / `cqTiny` classes) was kept, along with `container-type: inline-size; container-name: keyboard` on the root element.

## The LESS 1.6.3 `@container` limitation

The UI5 package builds its theme with `less-openui5`, which vendors LESS v1.6.3 (released 2014, now in maintenance). That parser has a switch of recognized at-rules (`@media`, `@supports`, `@keyframes`, ...) that it passes through as block directives. `@container` and `@layer` are not in the list, so `container-type: inline-size` declarations compile fine but a `@container keyboard (max-width: 30rem) { ... }` block is a parse error. `@container` support only landed in LESS v4.2.0, and `less-openui5` has no published upgrade plan.

This is handled by a local `less-openui5` patch (`patches/less-openui5+0.11.6.patch`, applied via `patch-package` on `postinstall`) that adds `@container` and `@layer` to the recognized directive list, following the modern LESS 4.x parser. With the patch in place the `@container` rules live **directly inside `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less`** under the `@layer kiosk-keyboard` wrapper; there is no separate plain-CSS file and no `@import (inline)`. The shipped keyboard-width queries are at 35rem (F-key row wrap), 30rem (key font-size cap), and 20rem (nav row wrap, narrow padding, and the smaller font-size cap, including the mixed width + `cqShort`/`cqTiny` height rule). The upstream fix is tracked in [SAP/less-openui5#453](https://github.com/SAP/less-openui5/pull/453); the patch can be dropped once `less-openui5` updates its vendored parser.

## Scope

Both packages undergo the same simplification: JS-driven width classes are removed entirely, replaced by pure CSS `@container` queries.

**Removed (both packages):**

- JS width measurement + `cq-sm`/`cq-xs`/`cq-width-custom` class toggling
- `differsFromDefaultThreshold()` function (WebC only, UI5 never had it)
- `@supports not (container-type: inline-size)` CSS fallback block (WebC only)
- `.kiosk-keyboard--cq-width-custom` CSS rules (WebC only)
- `.ui5KioskKeyboard--cq-sm/xs` JS-driven CSS rules (UI5 only)
- `--cqNarrowThreshold` / `--cqCompactThreshold` public CSS custom properties
- `rootCqSm` / `rootCqXs` / `rootCqWidthCustom` DOM contract entries
- `DISABLE_CONTAINER_QUERIES` test helper constant and associated visual fallback tests (WebC only)
- Tests asserting JS-driven width class toggling or custom width thresholds

**Kept (both packages):**

- CSS `@container keyboard` width rules
- `container-type: inline-size; container-name: keyboard` on root element
- JS `ResizeObserver` / `ResizeHandler` for height-only responsiveness
- `resolveRemThreshold()` function (used by height path)
- All height CSS custom properties and classes (`cqShort`/`cqTiny`)
