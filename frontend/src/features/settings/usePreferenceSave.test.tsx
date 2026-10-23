import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePreferenceSave } from "./usePreferenceSave";
import { preferences } from "../../test/fixtures";
import type { Preferences } from "../../desktop/types";

it("serializes rapid preference edits without reverting the previous choice", async () => {
  const writes: Preferences[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const SavePreferences = vi.fn(async (p: Preferences) => {
    writes.push(p);
    if (writes.length === 1) await gate;
  });
  const original = window.go;
  window.go = { main: { App: { SavePreferences } as never } };
  const tasks: Promise<unknown>[] = [];
  const run = async (f: () => Promise<unknown>) => {
    const task = f();
    tasks.push(task);
    await task;
  };
  const { result } = renderHook(() => usePreferenceSave(preferences, run));
  act(() => {
    result.current({ language: "zh-CN" });
    result.current({ theme: "dark" });
  });
  await act(async () => {
    release();
    await Promise.all(tasks);
  });
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ language: "zh-CN", theme: "dark" });
  window.go = original;
});
