import type { Identity, Preferences, View } from "./types";

// 这层是业务适配器；Wails 的生成目录由 wails dev/build 管理。
export interface Bridge {
  GetState(): Promise<View>;
  Refresh(authorized: boolean): Promise<boolean>;
  CancelTask(): Promise<void>;
  Terminate(targets: Identity[], force: boolean): Promise<boolean>;
  SavePreferences(p: Preferences): Promise<void>;
  SaveWindow(): Promise<void>;
  Copy(value: string): Promise<void>;
  CheckUpdate(): Promise<void>;
  InstallUpdate(): Promise<void>;
  CancelUpdate(): Promise<void>;
  OpenURL(url: string): Promise<void>;
  ExitWithoutSaving(): Promise<void>;
}
declare global {
  interface Window {
    go?: { main: { App: Bridge } };
    runtime?: {
      EventsOnMultiple: (
        name: string,
        callback: (data: View) => void,
        count: number,
      ) => () => void;
    };
  }
}
export function backend(): Bridge {
  if (!window.go) throw new Error("desktop_required");
  return window.go.main.App;
}
export function subscribe(callback: (data: View) => void) {
  return (
    window.runtime?.EventsOnMultiple("sentinel:state", callback, -1) ??
    (() => {})
  );
}
