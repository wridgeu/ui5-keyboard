import { describe, it, expect, vi } from "vitest";
import { MemoMapView } from "../../src/core/memo-map-view.js";

const passThrough = (_name: string, value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

describe("MemoMapView", () => {
  it("builds a Map keyed by trimmed, lowercased names", () => {
    const view = new MemoMapView<string>(passThrough);
    const map = view.get({ " Foo ": "a", BAR: "b" })!;
    expect(map.get("foo")).toBe("a");
    expect(map.get("bar")).toBe("b");
    expect(map.size).toBe(2);
  });

  it("memoizes on source identity: same object returns the same Map without revalidating", () => {
    const validate = vi.fn(passThrough);
    const view = new MemoMapView<string>(validate);
    const source = { a: "x" };

    const first = view.get(source);
    const second = view.get(source);
    expect(second).toBe(first);
    expect(validate).toHaveBeenCalledTimes(1);

    // A new object identity rebuilds, even with equal content.
    const third = view.get({ a: "x" });
    expect(third).not.toBe(first);
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("skips entries the validator rejects and stores transformed values", () => {
    const view = new MemoMapView<string>((_name, value) =>
      typeof value === "string" ? value.toUpperCase() : undefined,
    );
    const map = view.get({ keep: "x", drop: 42 })!;
    expect(map.get("keep")).toBe("X");
    expect(map.has("drop")).toBe(false);
  });

  it("skips entries whose name normalizes to the empty string", () => {
    const view = new MemoMapView<string>(passThrough);
    const map = view.get({ "   ": "a", ok: "b" })!;
    expect(map.size).toBe(1);
    expect(map.get("ok")).toBe("b");
  });

  it("returns undefined for null sources and for maps with no valid entries", () => {
    const view = new MemoMapView<string>(passThrough);
    expect(view.get(null)).toBeUndefined();
    expect(view.get({})).toBeUndefined();
    expect(view.get({ invalid: 1 })).toBeUndefined();
  });

  it("clears the memo when the source becomes null", () => {
    const view = new MemoMapView<string>(passThrough);
    const source = { a: "x" };
    const first = view.get(source);
    view.get(null);
    const rebuilt = view.get(source);
    expect(rebuilt).not.toBe(first);
    expect(rebuilt!.get("a")).toBe("x");
  });
});
