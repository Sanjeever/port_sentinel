import { useCallback, useEffect, useRef, useState } from "react";
import { backend, subscribe } from "./api";
import type { View } from "./types";

export function useDesktop() {
  const [view, setView] = useState<View | null>(null);
  const [failure, setFailure] = useState<string>("");
  const revision = useRef(0);
  useEffect(() => {
    let alive = true;
    const receive = (next: View) => {
      if (alive && next.sequence >= revision.current) {
        revision.current = next.sequence;
        setView(next);
      }
    };
    const off = subscribe(receive);
    void Promise.resolve()
      .then(() => backend().GetState())
      .then(receive)
      .catch((e) => setFailure(String(e)));
    return () => {
      alive = false;
      off();
    };
  }, []);
  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      setFailure("");
      const result = await action();
      if (result === false) setFailure("busy");
    } catch (e) {
      setFailure(String(e));
    }
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void run(() => backend().SaveWindow());
      }, 600);
    };
    window.addEventListener("resize", resize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, [run]);
  return { view, failure, run };
}
