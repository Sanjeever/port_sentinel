import type { Entry, Preferences, View } from "../desktop/types";
export const preferences: Preferences = {
  language: "en",
  theme: "system",
  autoRefresh: true,
  interval: 5,
  scope: "listening",
  protocol: "ALL",
  sort: "port",
  ascending: true,
  width: 1180,
  height: 760,
  autoUpdate: true,
};

export function initialView(entries: Entry[]): View {
  return {
    closeBlocked: false,
    entries,
    visibility: "ordinary",
    lastSuccess: "2026-10-22T01:00:00Z",
    stale: false,
    task: "",
    error: null,
    settingsError: null,
    preferences: { ...preferences },
    results: [],
    endpoints: [],
    resultRevision: 0,
    build: { version: "2.0.0", commit: "abcdef", development: true },
    update: {
      phase: "",
      error: "",
      errorCode: "",
      version: "",
      notes: "",
      url: "",
      checked_at: null,
      downloaded: 0,
      total: 0,
    },
    sequence: 1,
  };
}

export function row(
  id: string,
  port: number,
  pid: number,
  name: string,
  protocol = "TCP",
  state = "LISTEN",
): Entry {
  return {
    id,
    port,
    protocol,
    state,
    local: `127.0.0.1:${port}`,
    remote: null,
    process: {
      pid,
      created: 123,
      name,
      path: "/test/" + name,
      status: "available",
      pathStatus: "available",
      risk: false,
      diagnostic: "",
    },
  };
}
