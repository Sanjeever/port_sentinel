import { useEffect, useRef } from "react";
import type { Preferences } from "./types";
import { backend } from "./api";

export function usePreferenceSave(
  preferences: Preferences | undefined,
  run: (f: () => Promise<unknown>) => Promise<void>,
) {
  const draft = useRef(preferences);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    if (pending.current === 0) draft.current = preferences;
  }, [preferences]);
  return (change: Partial<Preferences>) => {
    if (!draft.current) return;
    const next = { ...draft.current, ...change };
    draft.current = next;
    pending.current++;
    const write = () => backend().SavePreferences(next);
    const operation = queue.current.then(write, write).finally(() => {
      pending.current--;
    });
    queue.current = operation;
    void run(() => operation);
  };
}
