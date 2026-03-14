# Test Pages

Standalone pages for manual testing, screenshot generation, and visual inspection of `kiosk-keyboard-webc`.

## Pages

- `index.html`: main standalone demo with native inputs, UI5 Web Components inputs, docked mode, and event logging
- `key-style-demo.html`: key type comparison page used for README screenshots
- `visual.html`: visual regression matrix used by WebdriverIO
- `visual-themes.html`: focused theme preview page for theme-specific visual checks

## Running

From the repo root:

```bash
npm run start:kiosk-webc
```

From the package root:

```bash
npm start
npm run start:key-style-demo
```

Default URLs:

- `http://localhost:8084/test/pages/index.html`
- `http://localhost:8084/test/pages/key-style-demo.html`
- `http://localhost:8084/test/pages/visual.html`
- `http://localhost:8084/test/pages/visual-themes.html`

`npm start` runs `generate` through the package `prestart` hook. The explicit page scripts also ensure generated theme and i18n assets are available before Vite starts serving the page.

## Vite Configuration Notes

The page scripts import `src/bundle.esm.ts` directly, so Vite transpiles TypeScript on the fly and no full `npm run build` is required for these pages.

The `vite.config.ts` file includes `resolve.dedupe: ["@ui5/webcomponents-base"]` to ensure the UI5 Web Components framework is loaded as a single instance. Without this, Vite's dependency pre-bundling can create separate copies of internal framework singletons, causing `setTheme()` to operate on a different theme registry than the one the component uses.

The page scripts live in separate `.js` files instead of inline `<script type="module">` blocks for the same reason. Vite's HTML proxy transform for inline scripts can bypass the deduplication and split the framework instance.
