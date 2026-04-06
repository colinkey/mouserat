import { describe, it, expect } from "bun:test";
import { computeScrollWindow } from "./ScrollableText.tsx";

describe("computeScrollWindow", () => {
  const lines = ["a", "b", "c", "d", "e"];

  it("returns first N lines at offset 0", () => {
    expect(computeScrollWindow(lines, 0, 3)).toEqual(["a", "b", "c"]);
  });

  it("returns correct slice at middle offset", () => {
    expect(computeScrollWindow(lines, 2, 3)).toEqual(["c", "d", "e"]);
  });

  it("clamps offset to max (lines.length - height)", () => {
    expect(computeScrollWindow(lines, 99, 3)).toEqual(["c", "d", "e"]);
  });

  it("clamps offset to 0 when negative", () => {
    expect(computeScrollWindow(lines, -5, 3)).toEqual(["a", "b", "c"]);
  });

  it("returns all lines when height >= lines.length", () => {
    expect(computeScrollWindow(lines, 0, 10)).toEqual(lines);
  });

  it("returns all lines when height equals lines.length", () => {
    expect(computeScrollWindow(lines, 0, 5)).toEqual(lines);
  });

  it("returns empty array when height is 0", () => {
    expect(computeScrollWindow(lines, 0, 0)).toEqual([]);
  });

  it("returns empty array when height is negative", () => {
    expect(computeScrollWindow(lines, 0, -1)).toEqual([]);
  });

  it("returns empty array for empty lines", () => {
    expect(computeScrollWindow([], 0, 5)).toEqual([]);
  });

  it("returns last line at max offset with height 1", () => {
    expect(computeScrollWindow(lines, 4, 1)).toEqual(["e"]);
  });

  it("handles single line", () => {
    expect(computeScrollWindow(["only"], 0, 3)).toEqual(["only"]);
  });
});
