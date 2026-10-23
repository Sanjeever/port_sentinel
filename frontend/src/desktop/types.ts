export interface Identity {
  pid: number;
  created: number;
  name: string;
  path: string;
  status: string;
  pathStatus: string;
  risk: boolean;
  diagnostic: string;
}
export interface Entry {
  id: string;
  protocol: string;
  port: number;
  local: string;
  remote: string | null;
  state: string;
  process: Identity;
}
export interface Preferences {
  language: "system" | "en" | "zh-CN";
  theme: "system" | "light" | "dark";
  autoRefresh: boolean;
  interval: number;
  scope: "listening" | "all";
  protocol: "ALL" | "TCP" | "UDP";
  sort: "port" | "protocol" | "pid" | "name";
  ascending: boolean;
  width: number;
  height: number;
  autoUpdate: boolean;
}
export interface Fault {
  code: string;
  detail: string;
}
export interface ProcessResult {
  target: Identity;
  status: string;
  detail: string;
}
export interface Update {
  phase: string;
  error: string;
  errorCode: string;
  version: string;
  notes: string;
  url: string;
  checked_at: string | null;
  downloaded: number;
  total: number;
}
export interface View {
  closeBlocked: boolean;
  entries: Entry[];
  visibility: string;
  lastSuccess: string | null;
  stale: boolean;
  task: string;
  error: Fault | null;
  settingsError: Fault | null;
  preferences: Preferences;
  results: ProcessResult[];
  build: { version: string; commit: string; development: boolean };
  update: Update;
  sequence: number;
}
