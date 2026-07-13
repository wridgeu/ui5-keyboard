import path from "node:path";

const PACKAGE_ROOT = import.meta.dirname;

/**
 * Vite plugin that resolves the generated json-imports' relative `../assets/`
 * theme and i18n JSON imports straight from `dist/generated/assets`, where
 * `@ui5/webcomponents-tools` emits them. The source tree therefore carries no
 * duplicate copy of the generated assets, and a live dev server has no second
 * tree that a regenerate could delete out from under it.
 *
 * Shared by `vite.config.ts` (library bundle, unit + e2e) and
 * `vite.demo.config.ts` (demo page) so both resolve assets identically.
 */
export const generatedAssetsRedirect = () => ({
  name: "kiosk-generated-assets",
  enforce: "pre",
  resolveId(source, importer) {
    if (importer && /[\\/]src[\\/]generated[\\/]json-imports[\\/]/.test(importer) && source.startsWith("../assets/")) {
      return path.resolve(PACKAGE_ROOT, "dist/generated", source.slice("../".length));
    }
  },
});
