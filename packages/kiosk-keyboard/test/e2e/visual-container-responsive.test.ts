import { $ } from "@wdio/globals";
import { openVisualPage, getKeyboard, matchElementSnapshotInSection } from "./test-helpers.js";

const HEIGHT_SNAPSHOT_OPTIONS = { ignoreAntialiasing: true };

describe("KioskKeyboard Responsive Height-Constrained Visual Regression", () => {
  before(async () => {
    await openVisualPage();
  });

  it("should match viewport-width height-constrained layout (250px)", async () => {
    const kb = await getKeyboard("kb-vw-height-short");
    await matchElementSnapshotInSection(kb, "kb-vw-height-short", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match viewport-width severely height-constrained layout (180px)", async () => {
    // Snapshot the container, not the keyboard: the keyboard's content overflows
    // its max-height constraint (overflow: hidden clips it), so the container
    // is the correct snapshot target (same pattern as kb-height-tiny).
    const container = await $("#kb-vw-height-tiny");
    await matchElementSnapshotInSection(container, "kb-vw-height-tiny", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match flex parent auto-detect (400x250, no CSS on keyboard)", async () => {
    const wrap = await $("#kb-flex-auto-wrap");
    await matchElementSnapshotInSection(wrap, "kb-flex-auto", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should match grid parent auto-detect (400x250, no CSS on keyboard)", async () => {
    const wrap = await $("#kb-grid-auto-wrap");
    await matchElementSnapshotInSection(wrap, "kb-grid-auto", HEIGHT_SNAPSHOT_OPTIONS);
  });

  it("should render unconstrained keyboard at full size (regression guard)", async () => {
    const kb = await getKeyboard("kb-unconstrained");
    await matchElementSnapshotInSection(kb, "kb-unconstrained", HEIGHT_SNAPSHOT_OPTIONS);
  });
});
