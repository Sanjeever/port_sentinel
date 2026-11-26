import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { ArrowDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useId, useState, type ReactNode } from "react";
import type { Entry, Preferences } from "../../desktop/types";
import { backend } from "../../desktop/api";

export function PortTable({
  rows,
  preferences,
  selected,
  setSelected,
  sort,
  details,
  inspected,
  end,
  run,
  empty,
}: {
  rows: Entry[];
  preferences: Preferences;
  selected: Set<string>;
  setSelected: (v: Set<string>) => void;
  sort: (key: Preferences["sort"]) => void;
  details: (entry: Entry, trigger: HTMLElement | null) => void;
  inspected: string | undefined;
  end: (entries: Entry[]) => void;
  run: (f: () => Promise<unknown>) => void;
  empty: ReactNode;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<string | null>(null);
  const caption = useId();
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
    <div
      className="table-scroll"
      role="region"
      aria-labelledby={caption}
      tabIndex={0}
    >
      <table className="port-table" data-scope={preferences.scope}>
        <caption className="sr-only" id={caption}>
          {t("connections")}
        </caption>
        <thead>
          <tr>
            <th className="select-cell" scope="col">
              <label className="row-check">
                <input
                  aria-label={t("selectAll")}
                  type="checkbox"
                  disabled={!actionable.length}
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
              </label>
            </th>
            {(["port", "name", "pid", "protocol"] as const).map((key) => (
              <th
                key={key}
                scope="col"
                className={`column-${key} sortable-column`}
                aria-sort={
                  preferences.sort === key
                    ? preferences.ascending
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => sort(key)}
                >
                  {t(key)}
                  <ArrowDown size={12} aria-hidden="true" />
                </button>
              </th>
            ))}
            <th className="column-local" scope="col">
              {t("local")}
            </th>
            <th className="column-remote" scope="col">
              {t("remote")}
            </th>
            <th className="column-state" scope="col">
              {t("state")}
            </th>
            <th className="action-cell" scope="col">
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr
              key={e.id}
              data-selected={selected.has(e.id)}
              data-inspected={inspected === e.id}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu(e.id);
              }}
            >
              <td className="select-cell">
                <label className="row-check">
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
                </label>
              </td>
              <th scope="row" className="mono port-value">
                {e.port}
              </th>
              <td className="process-cell">
                <button
                  id={`${caption}-process-${e.id}`}
                  type="button"
                  className="process-link"
                  aria-expanded={inspected === e.id}
                  title={e.process.name || t("details")}
                  onClick={(event) => details(e, event.currentTarget)}
                >
                  <span>
                    {e.process.name ||
                      t(
                        e.process.status === "no_pid" ? "no_pid" : "unreadable",
                      )}
                  </span>
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </td>
              <td className="mono">
                {e.process.pid > 0 ? e.process.pid : "—"}
              </td>
              <td className="protocol-label">{e.protocol}</td>
              <td className="column-local">
                <span className="mono ellipsis" title={e.local}>
                  {e.local}
                </span>
                <span className="status-value compact-state">
                  <span className="sr-only">{t("state")} </span>
                  {t(`state_${e.state}`, { defaultValue: e.state || "—" })}
                </span>
              </td>
              <td
                className="column-remote mono ellipsis"
                title={e.remote ?? ""}
              >
                {e.remote ?? "—"}
              </td>
              <td className="column-state status-value">
                {t(`state_${e.state}`, { defaultValue: e.state || "—" })}
              </td>
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
                      className="row-menu-button"
                      disableRipple
                      aria-label={t("actions") + ` ${e.port}`}
                    >
                      <MoreHorizontal size={17} aria-hidden="true" />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label={t("actions")}
                    onAction={(key) => {
                      if (key === "pid")
                        run(() => backend().Copy(String(e.process.pid)));
                      if (key === "port")
                        run(() => backend().Copy(String(e.port)));
                      if (key === "local") run(() => backend().Copy(e.local));
                      if (key === "details")
                        details(
                          e,
                          document.getElementById(`${caption}-process-${e.id}`),
                        );
                      if (key === "end") end([e]);
                    }}
                    disabledKeys={
                      e.process.pid <= 1 || !e.process.created ? ["end"] : []
                    }
                  >
                    <DropdownItem key="details">{t("details")}</DropdownItem>
                    <DropdownItem key="pid">{t("copyPID")}</DropdownItem>
                    <DropdownItem key="port">{t("copyPort")}</DropdownItem>
                    <DropdownItem key="local">{t("copyLocal")}</DropdownItem>
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
      {empty}
    </div>
  );
}
