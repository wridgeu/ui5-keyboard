import { describe, it, expect } from "vitest";
import { build, type Rollup } from "vite";
import path from "node:path";

const __dirname = import.meta.dirname;

// Regression guard for issue #108.
//
// The built-in layouts and composition middleware reach the standalone bundle
// only through the value imports in core/layout-registry.ts and
// core/middleware-registry.ts. An earlier design registered them via
// side-effect-only imports (`import "./layouts/qwerty.js"`), which the
// production tree-shaker legitimately dropped: the published
// kiosk-keyboard.bundle.js shipped with an empty layout registry and every
// keyboard threw "Built-in default layout 'qwerty' is missing" at render.
//
// CI never built this bundle, so nothing caught it. This test runs the real
// `vite build` (the same vite.config.ts that produces the published bundle) and
// asserts the emitted code still contains the layouts and middleware. It goes
// red if a future change reintroduces droppable registration. Variable/function
// names are mangled in the output, so every assertion is on a STRING LITERAL
// that only survives if the corresponding source module survived tree-shaking.

const BUILTIN_LAYOUTS = [
  "qwerty",
  "qwertz-de",
  "numeric",
  "special",
  "numpad",
  "fkeys",
  "nav",
  "ja-romaji",
  "ja-kana",
  "arabic",
  "ko-hangul",
  "qwerty-es",
] as const;

async function buildBundleCode(): Promise<string> {
  const result = await build({
    configFile: path.resolve(__dirname, "../../vite.config.ts"),
    logLevel: "silent",
    // Keep the build in memory: do not touch the committed dist/ output.
    build: { write: false },
  });
  const outputs: Rollup.RollupOutput[] = Array.isArray(result)
    ? (result as Rollup.RollupOutput[])
    : [result as Rollup.RollupOutput];
  return outputs
    .flatMap((o) => o.output)
    .filter((chunk): chunk is Rollup.OutputChunk => chunk.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
}

describe("standalone bundle tree-shaking guard (issue #108)", () => {
  it("retains every built-in layout and the composition middleware", async () => {
    const code = await buildBundleCode();
    expect(code.length).toBeGreaterThan(0);

    // Layout DATA markers: `{layout:*}` navigation tokens exist only if the
    // layout definition modules were bundled (not tree-shaken away).
    expect(code).toContain("{layout:numeric}");
    expect(code).toContain("{layout:fkeys}");

    // Every built-in layout must be registered under its name.
    for (const name of BUILTIN_LAYOUTS) {
      expect(code, `built-in layout "${name}" missing from bundle`).toContain(`"${name}"`);
    }

    // The custom-layout element is the only way to declare a per-instance layout,
    // so a bundle that dropped it would define no `<kiosk-keyboard-custom-layout>`
    // and every slotted declaration would be ignored.
    expect(code, "custom-layout element missing from bundle").toContain("kiosk-keyboard-custom-layout");

    // Composition middleware must be wired in too (it was previously never
    // registered in production: only tests imported it). These literals are
    // unique to the middleware modules: U+3071 ("ぱ") only appears in the
    // kana-dakuten map, and "LVT" is the hangul-compose phase label.
    expect(code, "kana-dakuten middleware missing from bundle").toContain("ぱ");
    expect(code, "hangul-compose middleware missing from bundle").toContain("LVT");
  }, 120_000);
});
