import { describe, it, expect } from "vitest";
import { visibleEntries, targets, retainSelection } from "./list";
import { en, zh, systemLanguage } from "./i18n";
import { row, preferences } from "./test-fixtures";
describe("connection list", () => {
  const entries = [
    row("a", 100, 2, "Node"),
    row("b", 20, 2, "Node", "UDP", "BOUND"),
    row("c", 3, 3, "Go", "TCP", "ESTABLISHED"),
  ];
  it("sorts numeric fields and retains UDP bindings in listening mode", () => {
    expect(visibleEntries(entries, preferences, "").map((e) => e.port)).toEqual(
      [20, 100],
    );
    expect(
      visibleEntries(entries, { ...preferences, scope: "all" }, "").map(
        (e) => e.port,
      ),
    ).toEqual([3, 20, 100]);
  });
  it("combines case insensitive search, protocol and scope", () => {
    expect(
      visibleEntries(entries, { ...preferences, protocol: "TCP" }, "NODE").map(
        (e) => e.id,
      ),
    ).toEqual(["a"]);
    expect(visibleEntries(entries, preferences, "2").map((e) => e.id)).toEqual([
      "b",
      "a",
    ]);
  });
  it("deduplicates identities and removes disappeared or reused row selections", () => {
    expect(targets(entries).map((p) => p.pid)).toEqual([2, 3]);
    expect([...retainSelection(new Set(["a", "old-pid-2"]), entries)]).toEqual([
      "a",
    ]);
  });
});
it("provides matching bilingual dictionaries and runtime system language", () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  expect(systemLanguage(["zh-TW"])).toBe("zh-CN");
  expect(systemLanguage(["de-DE"])).toBe("en");
  expect(systemLanguage(["en-US", "zh-CN"])).toBe("en");
});
