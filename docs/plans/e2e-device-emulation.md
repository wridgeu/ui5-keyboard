# E2E Device Emulation — Implementation Plan

Add phone and tablet device emulation to the WDIO E2E test suites for both
`kiosk-keyboard` (UI5 lib) and `kiosk-keyboard-webc`, covering CSS media
queries (`hover: none`, `pointer: coarse`, `forced-colors`, `prefers-reduced-motion`)
that are currently untested.

## Status quo

| Aspect             | kiosk-keyboard                            | kiosk-keyboard-webc                       |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| Port               | 8082                                      | 8084                                      |
| Server             | UI5 CLI (`createServerManager`)           | Static HTTP (`createStaticServerManager`) |
| Config type        | `wdi5Config` (imports `wdio-ui5-service`) | `WebdriverIO.Config`                      |
| Config file        | `test/e2e/wdio.conf.ts`                   | `test/e2e/wdio.conf.ts`                   |
| Viewport           | 1440x900 only                             | 1440x900 only                             |
| Visual baselines   | 13 images in `__baselines__/`             | 9 images in `__baselines__/`              |
| Baseline naming    | `{tag}-{logName}-{width}x{height}`        | `{tag}-{logName}-{width}x{height}`        |
| Mobile/touch tests | None                                      | None                                      |
| Extra configs      | `wdio-flp.conf.ts` (port 8083)            | None                                      |
| Services           | `"ui5"`, `"visual"`                       | `"visual"`                                |

### Existing WDIO config structure (both packages)

```ts
// Common pattern:
const chromeArgs = ["--window-size=1440,900", "--disable-gpu", "--no-sandbox"];
capabilities: [
  {
    browserName: "chrome",
    "goog:chromeOptions": { args: chromeArgs },
  },
];
```

### CSS media queries to cover

Both packages have identical media query blocks:

```css
@media (hover: none) → resets :hover styles for touch-only @media (forced-colors: active) → high-contrast key borders/backgrounds @media (prefers-reduced-motion: reduce) → disables transitions/transforms;
```

`(hover: none)` is triggered by Chrome `mobileEmulation` (phone/tablet profiles).
`(forced-colors)` and `(prefers-reduced-motion)` need CDP `Emulation.setEmulatedMedia`.

---

## Device profiles

| Profile                | Viewport | Touch | DPR | CSS media triggered              | Primary purpose     |
| ---------------------- | -------- | ----- | --- | -------------------------------- | ------------------- |
| **Desktop** (existing) | 1440x900 | No    | 1   | `hover: hover`, `pointer: fine`  | Functional + visual |
| **Phone** (new)        | 360x800  | Yes   | 3   | `hover: none`, `pointer: coarse` | Visual regression   |
| **Tablet** (new)       | 768x1024 | Yes   | 2   | `hover: none`, `pointer: coarse` | Visual regression   |

> Hybrid (1024x768, mouse+touch) deferred — its main value is `inputmode`
> auto-detection which can be a separate follow-up.

---

## Implementation steps

### Step 1: Shared device profiles — `tools/wdio-device-profiles.ts`

Create a reusable module alongside `tools/wdio-server.ts`.

```ts
export interface DeviceProfile {
  /** Short identifier for filenames and baseline subdirectories */
  id: string;
  /** Chrome --window-size argument value */
  windowSize: string;
  /** Chrome mobileEmulation capability (null = desktop, no emulation) */
  mobileEmulation: {
    deviceMetrics: {
      width: number;
      height: number;
      pixelRatio: number;
      mobile: boolean;
      touch: boolean;
    };
  } | null;
}

export const deviceProfiles = {
  phone: {
    id: "phone",
    windowSize: "360,800",
    mobileEmulation: {
      deviceMetrics: { width: 360, height: 800, pixelRatio: 3, mobile: true, touch: true },
    },
  },
  tablet: {
    id: "tablet",
    windowSize: "768,1024",
    mobileEmulation: {
      deviceMetrics: { width: 768, height: 1024, pixelRatio: 2, mobile: true, touch: true },
    },
  },
} as const satisfies Record<string, DeviceProfile>;

/**
 * Build goog:chromeOptions for a device profile.
 * When mobileEmulation is set, Chrome automatically triggers
 * CSS media features: (hover: none), (pointer: coarse).
 */
export function buildChromeOptions(profile: DeviceProfile, headless: boolean): Record<string, unknown> {
  const args = [`--window-size=${profile.windowSize}`, "--disable-gpu", "--no-sandbox"];
  if (headless) args.unshift("--headless=new");

  const options: Record<string, unknown> = { args };
  if (profile.mobileEmulation) {
    options.mobileEmulation = profile.mobileEmulation;
  }
  return options;
}
```

No changes to `tools/tsconfig.json` needed — it already includes `./*.ts`.

### Step 2: Device-specific WDIO configs (4 files)

Each device config follows the existing `wdio-flp.conf.ts` pattern: a small file
that imports shared infra and overrides only what differs.

#### 2a. `packages/kiosk-keyboard/test/e2e/wdio-phone.conf.ts`

```ts
import url from "node:url";
import path from "node:path";
import type { wdi5Config } from "wdio-ui5-service";
import { createServerManager } from "../../../../tools/wdio-server.js";
import { deviceProfiles, buildChromeOptions } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8082;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const profile = deviceProfiles.phone;

const server = createServerManager(PORT, PACKAGE_ROOT);
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

export const config: wdi5Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  // Only visual tests — functional tests are device-independent
  specs: [path.resolve(__dirname, "visual.test.ts")],

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": buildChromeOptions(profile, headless),
    },
  ],

  logLevel: "warn",
  baseUrl: `http://localhost:${PORT}`,

  wdi5: { skipInjectUI5OnStart: true, waitForUI5Timeout: 20_000 },

  framework: "mocha",
  mochaOpts: { ui: "bdd", timeout: 60_000 },

  reporters: ["spec"],

  services: [
    "ui5",
    [
      "visual",
      {
        baselineFolder: path.resolve(__dirname, "__baselines__", profile.id),
        formatImageName: "{tag}-{logName}-{width}x{height}",
        screenshotPath: path.resolve(__dirname, "__screenshots__", profile.id),
        autoSaveBaseline: updateVisualBaseline,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
```

#### 2b. `packages/kiosk-keyboard/test/e2e/wdio-tablet.conf.ts`

Same as phone config but uses `deviceProfiles.tablet`.

#### 2c. `packages/kiosk-keyboard-webc/test/e2e/wdio-phone.conf.ts`

```ts
import url from "node:url";
import path from "node:path";
import { createStaticServerManager } from "../../../../tools/wdio-server.js";
import { deviceProfiles, buildChromeOptions } from "../../../../tools/wdio-device-profiles.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PORT = 8084;
const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const profile = deviceProfiles.phone;

const server = createStaticServerManager(PORT, PACKAGE_ROOT);
const headless = !process.env.HEADED && !process.argv.includes("--headed");
const updateVisualBaseline = process.argv.includes("--update-visual-baseline");

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: path.resolve(__dirname, "tsconfig.json"),

  // Only visual tests
  specs: [path.resolve(__dirname, "visual.test.ts")],

  maxInstances: 1,
  maxInstancesPerCapability: 1,

  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": buildChromeOptions(profile, headless),
    },
  ],

  logLevel: "warn",
  baseUrl: `http://localhost:${PORT}`,

  framework: "mocha",
  mochaOpts: { ui: "bdd", timeout: 60_000 },

  reporters: ["spec"],

  services: [
    [
      "visual",
      {
        baselineFolder: path.resolve(__dirname, "__baselines__", profile.id),
        formatImageName: "{tag}-{logName}-{width}x{height}",
        screenshotPath: path.resolve(__dirname, "__screenshots__", profile.id),
        autoSaveBaseline: updateVisualBaseline,
        disableCSSAnimation: true,
        hideScrollBars: true,
        waitForFontsLoaded: true,
      },
    ],
  ],

  onPrepare: () => server.onPrepare(),
  onComplete: () => server.onComplete(),
};
```

#### 2d. `packages/kiosk-keyboard-webc/test/e2e/wdio-tablet.conf.ts`

Same as phone config but uses `deviceProfiles.tablet`.

### Step 3: Visual baseline directories

Create empty baseline subdirectories (will be populated on first run):

```
packages/kiosk-keyboard/test/e2e/__baselines__/phone/
packages/kiosk-keyboard/test/e2e/__baselines__/tablet/
packages/kiosk-keyboard-webc/test/e2e/__baselines__/phone/
packages/kiosk-keyboard-webc/test/e2e/__baselines__/tablet/
```

Add `__screenshots__/` subdirectories to `.gitignore` if not already covered by
the existing `__screenshots__` ignore pattern.

### Step 4: Accessibility media query visual tests (CDP emulation)

Add tests to the **existing** desktop `visual.test.ts` in both packages.
These do not need separate device profiles — they use CDP runtime emulation.

#### 4a. `packages/kiosk-keyboard/test/e2e/visual.test.ts` — append:

```ts
describe("KioskKeyboard Accessibility Media Emulation", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match forced-colors (high contrast) mode", async () => {
    await browser.execute(() => ((window as any).__cdp_emulateMedia = true));
    // CDP: override forced-colors media feature
    const puppeteer = await browser.getPuppeteer();
    const [page] = await puppeteer.pages();
    await page.emulateMediaFeatures([{ name: "forced-colors", value: "active" }]);

    // Re-navigate to let CSS re-evaluate
    await openVisualPage();
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-forced-colors");

    // Restore
    await page.emulateMediaFeatures([]);
  });

  it("should match prefers-reduced-motion mode", async () => {
    const puppeteer = await browser.getPuppeteer();
    const [page] = await puppeteer.pages();
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

    await openVisualPage();
    const kb = await getKeyboard("kb-qwerty");
    await expect(kb).toMatchElementSnapshot("kb-qwerty-reduced-motion");

    await page.emulateMediaFeatures([]);
  });
});
```

#### 4b. `packages/kiosk-keyboard-webc/test/e2e/visual.test.ts` — append:

Same pattern, using `getKeyboardRoot("kb-qwerty")` and `webc-` prefixed tags.

### Step 5: NPM scripts

#### 5a. `packages/kiosk-keyboard/package.json` — add:

```json
"test:e2e:phone": "wdio run test/e2e/wdio-phone.conf.ts",
"test:e2e:tablet": "wdio run test/e2e/wdio-tablet.conf.ts",
"test:e2e:phone:update": "wdio run test/e2e/wdio-phone.conf.ts -- --update-visual-baseline",
"test:e2e:tablet:update": "wdio run test/e2e/wdio-tablet.conf.ts -- --update-visual-baseline",
"test:e2e:all-devices": "npm run test:e2e && npm run test:e2e:phone && npm run test:e2e:tablet"
```

#### 5b. `packages/kiosk-keyboard-webc/package.json` — add:

```json
"test:e2e:phone": "wdio run test/e2e/wdio-phone.conf.ts",
"test:e2e:tablet": "wdio run test/e2e/wdio-tablet.conf.ts",
"test:e2e:phone:update": "wdio run test/e2e/wdio-phone.conf.ts -- --update-visual-baseline",
"test:e2e:tablet:update": "wdio run test/e2e/wdio-tablet.conf.ts -- --update-visual-baseline",
"test:e2e:all-devices": "npm run test:e2e && npm run test:e2e:phone && npm run test:e2e:tablet",
"test:e2e:update": "wdio run test/e2e/wdio.conf.ts -- --update-visual-baseline"
```

Note: `kiosk-keyboard-webc` currently lacks `test:e2e:update` and `test:e2e:open`
scripts — add them for parity with `kiosk-keyboard`.

#### 5c. Root `package.json` — add:

```json
"test:kiosk:e2e:phone": "npm run test:e2e:phone -w packages/kiosk-keyboard",
"test:kiosk:e2e:tablet": "npm run test:e2e:tablet -w packages/kiosk-keyboard",
"test:kiosk-webc:e2e:phone": "npm run test:e2e:phone -w packages/kiosk-keyboard-webc",
"test:kiosk-webc:e2e:tablet": "npm run test:e2e:tablet -w packages/kiosk-keyboard-webc",
"test:e2e:all-devices": "npm run test:e2e:all-devices -w packages/kiosk-keyboard && npm run test:e2e:all-devices -w packages/kiosk-keyboard-webc"
```

### Step 6: Generate initial baselines

After creating all configs, run the update commands to capture initial baselines:

```bash
# kiosk-keyboard
npm run test:e2e:phone:update -w packages/kiosk-keyboard
npm run test:e2e:tablet:update -w packages/kiosk-keyboard

# kiosk-keyboard-webc (requires build first)
npm run build:kiosk-webc
npm run test:e2e:phone:update -w packages/kiosk-keyboard-webc
npm run test:e2e:tablet:update -w packages/kiosk-keyboard-webc

# Desktop accessibility media baselines (update existing desktop baselines)
npm run test:e2e:update -w packages/kiosk-keyboard
npm run test:e2e:update -w packages/kiosk-keyboard-webc
```

---

## File inventory

### New files (8)

| File                                                                  | Purpose                                    |
| --------------------------------------------------------------------- | ------------------------------------------ |
| `tools/wdio-device-profiles.ts`                                       | Shared device profile definitions + helper |
| `packages/kiosk-keyboard/test/e2e/wdio-phone.conf.ts`                 | Phone WDIO config                          |
| `packages/kiosk-keyboard/test/e2e/wdio-tablet.conf.ts`                | Tablet WDIO config                         |
| `packages/kiosk-keyboard-webc/test/e2e/wdio-phone.conf.ts`            | Phone WDIO config                          |
| `packages/kiosk-keyboard-webc/test/e2e/wdio-tablet.conf.ts`           | Tablet WDIO config                         |
| `packages/kiosk-keyboard/test/e2e/__baselines__/phone/.gitkeep`       | Baseline dir                               |
| `packages/kiosk-keyboard/test/e2e/__baselines__/tablet/.gitkeep`      | Baseline dir                               |
| `packages/kiosk-keyboard-webc/test/e2e/__baselines__/phone/.gitkeep`  | Baseline dir                               |
| `packages/kiosk-keyboard-webc/test/e2e/__baselines__/tablet/.gitkeep` | Baseline dir                               |

> Note: The `.gitkeep` files are placeholders — they get replaced by actual
> baseline PNGs on the first `--update-visual-baseline` run.

### Modified files (4)

| File                                                   | Changes                                          |
| ------------------------------------------------------ | ------------------------------------------------ |
| `packages/kiosk-keyboard/test/e2e/visual.test.ts`      | Add accessibility media describe block           |
| `packages/kiosk-keyboard-webc/test/e2e/visual.test.ts` | Add accessibility media describe block           |
| `packages/kiosk-keyboard/package.json`                 | Add device e2e scripts                           |
| `packages/kiosk-keyboard-webc/package.json`            | Add device e2e scripts + missing `update`/`open` |
| `package.json` (root)                                  | Add root-level device e2e scripts                |

---

## Testing checklist

- [ ] `tools/wdio-device-profiles.ts` compiles without errors (`npm run typecheck:tools`)
- [ ] Phone config runs and generates baselines for both packages
- [ ] Tablet config runs and generates baselines for both packages
- [ ] Desktop visual tests still pass (no regressions from accessibility media additions)
- [ ] Phone baselines visually show `(hover: none)` CSS active (no hover border-color changes)
- [ ] Forced-colors baseline shows system color overrides on keys
- [ ] Reduced-motion baseline shows no transform on key states
- [ ] All new npm scripts work from root and package level
- [ ] `npm run typecheck` passes across all packages

---

## Estimated CI impact

Each phone/tablet run executes only `visual.test.ts` (~13 visual checks for kiosk,
~9 for webc). Expected per-run time: 20-30 seconds.

Total added time: ~2 minutes across both packages (4 device runs + 2 CDP
accessibility tests in existing desktop runs).

---

## Open questions / future work

- **Hybrid device profile** (laptop with touch, 1024x768): Deferred. Main value
  is for `inputmode` auto-detection tests — can be a follow-up.
- **Config factoring**: If the 3 configs per package (desktop/phone/tablet) become
  hard to maintain, extract a `wdio-base.ts` config builder. Not needed initially.
- **CI gating**: Consider running device tests only on PRs targeting `main`,
  not on every push, to save CI time.
