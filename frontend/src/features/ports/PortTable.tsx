import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { ArrowDown, ArrowUp, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { Entry, Preferences } from "../../desktop/types";
import { backend } from "../../desktop/api";

export function PortTable({
  rows,
  preferences,
  selected,
  setSelected,
  sort,
  details,
  end,
  run,
}: {
  rows: Entry[];
  preferences: Preferences;
  selected: Set<string>;
  setSelected: (v: Set<string>) => void;
  sort: (key: Preferences["sort"]) => void;
  details: (e: Entry) => void;
  end: (entries: Entry[]) => void;
  run: (f: () => Promise<unknown>) => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<string | null>(null);
  const actionable = rows.filter(
    (e) => e.process.pid > 1 && e.process.created > 0,
  );
  const all =
    actionable.length > 0 && actionable.every((e) => selected.has(e.id));
  const some = actionable.some((e) => selected.has(e.id));
  const choose = (e: Entry, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(e.id);
    else next.delete(e.id);
    setSelected(next);
  };
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="select-cell">
              <input
                aria-label={t("selectAll")}
                type="checkbox"
                checked={all}
                ref={(node) => {
                  if (node) node.indeterminate = some && !all;
                }}
                onChange={(e) => {
                  const next = new Set(selected);
                  for (const r of actionable) {
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                  }
                  setSelected(next);
                }}
              />
            </th>
            {(["port", "protocol", "pid", "name"] as const).map((key) => (
              <th
                key={key}
                aria-sort={
                  preferences.sort === key
                    ? preferences.ascending
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button className="sort-button" onClick={() => sort(key)}>
                  {t(key)}
                  {preferences.sort === key &&
                    (preferences.ascending ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    ))}
                </button>
              </th>
            ))}
            <th className="secondary-column">{t("local")}</th>
            <th className="secondary-column">{t("remote")}</th>
            <th className="secondary-column">{t("state")}</th>
            <th className="action-cell">
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr
              key={e.id}
              data-selected={selected.has(e.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu(e.id);
              }}
            >
              <td className="select-cell">
                <input
                  type="checkbox"
                  aria-label={t("selectRow", {
                    port: e.port,
                    pid: e.process.pid,
                  })}
                  disabled={e.process.pid <= 1 || !e.process.created}
                  checked={selected.has(e.id)}
                  onChange={(event) => choose(e, event.target.checked)}
                />
              </td>
              <td className="mono port-value">{e.port}</td>
              <td>
                <span className="protocol-label">{e.protocol}</span>
              </td>
              <td className="mono">
                {e.process.pid > 0 ? e.process.pid : "—"}
              </td>
              <td className="process-cell">
                <button
                  className="process-link"
                  title={e.process.name || t("details")}
                  onClick={() => details(e)}
                >
                  {e.process.name ||
                    t(e.process.status === "no_pid" ? "no_pid" : "unreadable")}
                </button>
              </td>
              <td className="secondary-column mono ellipsis" title={e.local}>
                {e.local}
              </td>
              <td
                className="secondary-column mono ellipsis"
                title={e.remote ?? ""}
              >
                {e.remote ?? "—"}
              </td>
              <td className="secondary-column status-value">{e.state}</td>
              <td className="action-cell">
                <Dropdown
                  isOpen={menu === e.id}
                  onOpenChange={(open) => setMenu(open ? e.id : null)}
                >
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      aria-label={t("actions") + ` ${e.port}`}
                    >
                      <MoreHorizontal size={17} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label={t("actions")}
                    onAction={(key) => {
                      if (key === "pid")
                        run(() => backend().Copy(String(e.process.pid)));
                      if (key === "port")
                        run(() => backend().Copy(String(e.port)));
                      if (key === "details") details(e);
                      if (key === "end") end([e]);
                    }}
                    disabledKeys={
                      e.process.pid <= 1 || !e.process.created ? ["end"] : []
                    }
                  >
                    <DropdownItem key="details">{t("details")}</DropdownItem>
                    <DropdownItem key="pid">{t("copyPID")}</DropdownItem>
                    <DropdownItem key="port">{t("copyPort")}</DropdownItem>
                    <DropdownItem
                      key="end"
                      color="danger"
                      className="text-danger"
                    >
                      {t("terminate")}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
