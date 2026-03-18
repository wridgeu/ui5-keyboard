/**
 * NPS (nps-utils) build scripts for kiosk-keyboard-webc.
 *
 * Uses @ui5/webcomponents-tools to process:
 *   - CSS:  src/themes/KioskKeyboard.css → src/generated/themes/KioskKeyboard.css.ts
 *   - CSS:  src/themes/{theme}/parameters-bundle.css → src/generated/themes/{theme}/parameters-bundle.css.ts
 *   - i18n: src/i18n/messagebundle*.properties → src/generated/i18n/i18n-defaults.ts
 *   - i18n: src/i18n/messagebundle*.properties → dist/generated/assets/i18n/*.json
 *   - sync: dist/generated/assets → src/generated/assets (so source-based
 *           imports resolve the JSON theme/i18n assets without tsc)
 *
 * Entry point: `ui5nps generate` (called from `npm run generate`).
 *
 * @see https://github.com/SAP/ui5-webcomponents/tree/main/packages/tools
 */

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const LIB = path.join(path.dirname(require.resolve("@ui5/webcomponents-tools/package.json")), "lib");

const scripts = {
  __ui5envs: {
    UI5_TS: "true",
  },

  generateAPI: {
    default: "ui5nps generateAPI.generateCEM generateAPI.validateCEM",
    generateCEM: `ui5nps-script "${LIB}/cem/cem.js" analyze --config "${LIB}/cem/custom-elements-manifest.config.mjs"`,
    validateCEM: `ui5nps-script "${LIB}/cem/validate.js"`,
  },

  generate: {
    default: "ui5nps generate.styles generate.i18n generate.jsonImports generate.syncAssets generateAPI",
    styles: {
      default: "ui5nps generate.styles.components generate.styles.themes",
      components: `ui5nps-script "${LIB}/css-processors/css-processor-components.mjs"`,
      themes: `ui5nps-script "${LIB}/css-processors/css-processor-themes.mjs"`,
    },
    i18n: {
      default: "ui5nps generate.i18n.defaults generate.i18n.json",
      defaults: `ui5nps-script "${LIB}/i18n/defaults.js" src/i18n src/generated/i18n`,
      json: `ui5nps-script "${LIB}/i18n/toJSON.js" src/i18n dist/generated/assets/i18n`,
    },
    jsonImports: {
      default: "ui5nps generate.jsonImports.i18n generate.jsonImports.themes",
      i18n: `ui5nps-script "${LIB}/generate-json-imports/i18n.js" src/i18n src/generated/json-imports`,
      themes: `ui5nps-script "${LIB}/generate-json-imports/themes.js" src/themes src/generated/json-imports`,
    },
    // Sync JSON assets into src/generated/assets so that the generated
    // json-imports (which use relative ../assets/ paths) resolve correctly
    // when Vite serves from source. The upstream tools hardcode the JSON
    // output to dist/generated/assets; this copies them to the source tree.
    syncAssets: "node ./sync-generated-assets.mjs",
  },
};

export default { scripts };
