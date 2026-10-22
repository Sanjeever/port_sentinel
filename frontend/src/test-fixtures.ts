import type { Entry, Preferences } from "./types";
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
