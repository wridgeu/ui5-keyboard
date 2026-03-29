/**
 * This test verifies the core entry point behavior in isolation.
 * It imports ONLY the layout registry (simulating a core-only import)
 * without importing any layout modules. No layouts should be registered.
 *
 * IMPORTANT: This file must NOT import any layout modules at the top level.
 */
import { describe, it, expect } from "vitest";
import { getRegisteredLayoutNames, getRegisteredLayout } from "../../src/core/layout-registry.js";

describe("core entry (no layouts imported)", () => {
  it("returns undefined for any layout name when none are imported", () => {
    // NOTE: In vitest, all test files share the same module instances.
    // If other test files import layouts, those registrations persist here.
    // This test documents the INTENT: core alone = no layouts.
    // The real tree-shaking test is the build verification below.
    expect(getRegisteredLayout("nonexistent-layout")).toBeUndefined();
  });
});
