import type { Entry, Identity, Preferences } from "../../desktop/types";
export function identityKey(p: Pick<Identity, "pid" | "created">) {
  return `${p.pid}:${p.created}`;
}
export function inScope(entry: Entry, scope: Preferences["scope"]) {
  return (
    scope === "all" || entry.protocol === "UDP" || entry.state === "LISTEN"
  );
}
export function visibleEntries(
  entries: Entry[],
  p: Preferences,
  query: string,
) {
  const q = query.trim().toLocaleLowerCase();
  const number = Number(q);
  const numericQuery = /^\d+$/.test(q) && String(number) === q;
  const exact = (entry: Entry) =>
    entry.port === number || entry.process.pid === number;
  return entries
    .filter(
      (e) =>
        inScope(e, p.scope) &&
        (p.protocol === "ALL" || e.protocol === p.protocol) &&
        (!q ||
          String(e.port).includes(q) ||
          String(e.process.pid).includes(q) ||
          e.process.name.toLocaleLowerCase().includes(q)),
    )
    .sort((a, b) => {
      if (numericQuery) {
        const rank = Number(exact(b)) - Number(exact(a));
        if (rank) return rank;
      }
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
