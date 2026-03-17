import { $ } from "@wdio/globals";
import { openVisualPage, getKeyboardRoot, matchElementSnapshotInSection } from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true } as const;

describe("KioskKeyboard Web Component - Fixed Container Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match narrow container (320px)", async () => {
    const kb = await getKeyboardRoot("kb-narrow");
    await matchElementSnapshotInSection(kb, "webc-narrow");
  });

  it("should match glyph stress layout in a narrow container", async () => {
    const kb = await getKeyboardRoot("kb-glyph-stress");
    await matchElementSnapshotInSection(kb, "webc-glyph-stress");
  });

  it("should match height-constrained container (250px)", async () => {
    const kb = await getKeyboardRoot("kb-height-constrained");
    await matchElementSnapshotInSection(kb, "webc-height-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match severely height-constrained container (180px)", async () => {
    const kb = await getKeyboardRoot("kb-height-tiny");
    await matchElementSnapshotInSection(kb, "webc-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained container (flex parent 250px)", async () => {
    const wrap = await $("#kb-ancestor-constrained-wrap");
    await matchElementSnapshotInSection(wrap, "webc-ancestor-constrained", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match ancestor-constrained severely (flex parent 180px)", async () => {
    const wrap = await $("#kb-ancestor-tiny-wrap");
    await matchElementSnapshotInSection(wrap, "webc-ancestor-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match height-constrained host with padding and border", async () => {
    const kb = await getKeyboardRoot("kb-height-padded-host");
    await matchElementSnapshotInSection(kb, "webc-height-padded-host", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match narrow + height-constrained container (320px x 250px)", async () => {
    const kb = await getKeyboardRoot("kb-narrow-short");
    await matchElementSnapshotInSection(kb, "webc-narrow-short", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match custom threshold override (cq-short at 18rem)", async () => {
    const kb = await getKeyboardRoot("kb-custom-threshold");
    await matchElementSnapshotInSection(kb, "webc-custom-threshold", HEIGHT_SNAPSHOT_OPTIONS);
  });
});
