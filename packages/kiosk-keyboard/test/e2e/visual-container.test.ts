import { $, browser } from "@wdio/globals";
import { openVisualPage, getKeyboard, matchElementSnapshotInSection } from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

async function getViewportWidth(): Promise<number> {
  return browser.execute(() => window.innerWidth);
}

describe("KioskKeyboard Fixed Container Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match full width (600px) layout", async function () {
    const vw = await getViewportWidth();
    if (vw < 640) return this.skip();
    const kb = await getKeyboard("kb-wide");
    await matchElementSnapshotInSection(kb, "kb-wide");
  });

  it("should match narrow (320px) layout", async () => {
    const kb = await getKeyboard("kb-narrow");
    await matchElementSnapshotInSection(kb, "kb-narrow");
  });

  it("should match keyboard in fixed container (400x350)", async function () {
    const vw = await getViewportWidth();
    if (vw < 440) return this.skip();
    const container = await $("#kb-container-fixed");
    await matchElementSnapshotInSection(container, "kb-container-fixed");
  });

  it("should match height-constrained container (400x250)", async function () {
    const vw = await getViewportWidth();
    if (vw < 440) return this.skip();
    const container = await $("#kb-height-constrained");
    await matchElementSnapshotInSection(container, "kb-height-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match severely height-constrained container (400x180)", async function () {
    const vw = await getViewportWidth();
    if (vw < 440) return this.skip();
    const container = await $("#kb-height-tiny");
    await matchElementSnapshotInSection(container, "kb-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained container (flex parent 400x250)", async function () {
    const vw = await getViewportWidth();
    if (vw < 440) return this.skip();
    const wrap = await $("#kb-ancestor-constrained-wrap");
    await matchElementSnapshotInSection(wrap, "kb-ancestor-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained severely (flex parent 400x180)", async function () {
    const vw = await getViewportWidth();
    if (vw < 440) return this.skip();
    const wrap = await $("#kb-ancestor-tiny-wrap");
    await matchElementSnapshotInSection(wrap, "kb-ancestor-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match narrow + height-constrained container (320px x 250px)", async () => {
    const container = await $("#kb-narrow-short");
    await matchElementSnapshotInSection(container, "kb-narrow-short", HEIGHT_SNAPSHOT_OPTIONS);
  });
});
