import type { Entry, Identity, Preferences } from "./types";
export function identityKey(p: Identity) {
  return `${p.pid}:${p.created}`;
}
export function visibleEntries(
  entries: Entry[],
  p: Preferences,
  query: string,
) {
  const q = query.trim().toLocaleLowerCase();
  return entries
    .filter(
      (e) =>
        (p.scope === "all" || e.protocol === "UDP" || e.state === "LISTEN") &&
        (p.protocol === "ALL" || e.protocol === p.protocol) &&
        (!q ||
          String(e.port).includes(q) ||
          String(e.process.pid).includes(q) ||
          e.process.name.toLocaleLowerCase().includes(q)),
    )
    .sort((a, b) => {
      let n = 0;
      switch (p.sort) {
        case "port":
          n = a.port - b.port;
          break;
        case "pid":
          n = a.process.pid - b.process.pid;
          break;
        case "protocol":
          n = a.protocol.localeCompare(b.protocol);
          break;
        case "name":
          n = a.process.name.localeCompare(b.process.name);
          break;
      }
      return (p.ascending ? 1 : -1) * n || a.id.localeCompare(b.id);
    });
}
export function targets(entries: Entry[]) {
  return [
    ...new Map(
      entries
        .filter((e) => e.process.pid > 1 && e.process.created > 0)
        .map((e) => [identityKey(e.process), e.process]),
    ).values(),
  ];
}
export function retainSelection(selected: Set<string>, entries: Entry[]) {
  const ids = new Set(entries.map((e) => e.id));
  return new Set([...selected].filter((id) => ids.has(id)));
}
