# Test Pages

Demo pages for manual testing and screenshot generation.

## Pages

- **`key-style-demo.html`** — Key type comparison (default vs modifier) and full keyboard previews (QWERTY, Numpad, Numeric) with theme switching. Used to generate the README screenshots.

## Running

Pages are served by the Vite dev server. From the package root:

```bash
npm run build          # required — pages import from dist/
npx vite serve --port 8100
```

Then open `http://localhost:8100/test/pages/key-style-demo.html`.

## Vite Configuration Notes

The `vite.config.ts` includes `resolve.dedupe: ["@ui5/webcomponents-base"]` to ensure that the UI5 Web Components framework is loaded as a single instance. Without this, Vite's dependency pre-bundling can create separate copies of internal framework singletons, causing `setTheme()` to operate on a different theme registry than the one the component uses. This manifests as theme switching having no visible effect on the keyboard keys.

The demo page script is in a separate `.js` file (not inline in the HTML) for the same reason: Vite's HTML proxy transform for inline `<script type="module">` creates an isolated module entry that bypasses the deduplication, resulting in a split framework instance.
