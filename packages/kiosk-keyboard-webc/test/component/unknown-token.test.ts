import { expect } from "@open-wc/testing";
import { requireKey as queryKey, setupWithLayout as setup } from "../helpers/fixtures.js";
import { captureConsole } from "../helpers/console.js";

describe("kiosk-keyboard - unrecognized {token} keys", () => {
  it("does not type the literal braces for an unknown token", async () => {
    // `{bcksp}` is a typo for `{backspace}` (an unrecognized token).
    const { kb, input } = await setup([[{ value: "{bcksp}", label: "x" }]]);
    const warnings = await captureConsole("warn", () => {
      queryKey(kb, "{bcksp}").click();
    });
    expect(input.value).to.equal("");
    expect(warnings.some((w) => w.includes("{bcksp}"))).to.equal(true);
  });

  it("fires key-press with char: undefined for an unknown token (char must not lie)", async () => {
    const { kb, input } = await setup([[{ value: "{bcksp}", label: "x" }]]);
    let detail: { key: string; char?: string } | undefined;
    kb.addEventListener(
      "key-press",
      (e: Event) => {
        detail = (e as CustomEvent<{ key: string; char?: string }>).detail;
      },
      { once: true },
    );
    queryKey(kb, "{bcksp}").click();
    // `char` is documented as the character that gets inserted; for an unknown
    // token nothing is inserted, so it must be undefined, not the literal token.
    expect(detail?.key).to.equal("{bcksp}");
    expect(detail?.char).to.equal(undefined);
    expect(input.value).to.equal("");
  });

  it("does not warn when a consumer prevents key-press", async () => {
    // A consumer that handles a custom token via key-press + preventDefault
    // owns the behavior, so the keyboard must stay silent. Insertion is
    // suppressed for any unknown token regardless, so the absence of a
    // warning is the only assertion that distinguishes the vetoed path.
    const { kb } = await setup([[{ value: "{paste}", label: "p" }]]);
    kb.addEventListener("key-press", (e: Event) => e.preventDefault(), { once: true });
    const warnings = await captureConsole("warn", () => {
      queryKey(kb, "{paste}").click();
    });
    expect(warnings.some((w) => w.includes("{paste}"))).to.equal(false);
  });

  it("still inserts a lone brace character", async () => {
    const { kb, input } = await setup([[{ value: "{" }, { value: "}" }]]);
    queryKey(kb, "{").click();
    queryKey(kb, "}").click();
    expect(input.value).to.equal("{}");
  });

  it("leaves regular character keys unaffected", async () => {
    const { kb, input } = await setup([[{ value: "a" }, { value: "b" }]]);
    queryKey(kb, "a").click();
    queryKey(kb, "b").click();
    expect(input.value).to.equal("ab");
  });
});
