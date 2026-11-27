import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Switch } from "@heroui/react";
import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "../desktop/api";
import { useDesktop } from "../desktop/useDesktop";
import {
  visibleEntries,
  retainSelection,
  targets,
  identityKey,
  inScope,
} from "../features/ports/list";
import i18n, { resolveLanguage } from "../i18n";
import type { Entry } from "../desktop/types";
import { Feedback } from "../components/Feedback";
import { PortTable } from "../features/ports/PortTable";
import { Details } from "../features/ports/Details";
import {
  ProcessDialog,
  type Confirmation,
} from "../features/ports/ProcessDialog";
import { Settings } from "../features/settings/Settings";
import { usePreferenceSave } from "../features/settings/usePreferenceSave";
import { PortToolbar } from "../features/ports/PortToolbar";
import { ProcessResults } from "../features/ports/ProcessResults";

export default function App() {
  const { view, failure, run } = useDesktop();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(new Set<string>());
  const [detail, setDetail] = useState<Entry | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const [settings, setSettings] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dismissedResultRevision, setDismissedResultRevision] = useState(0);
  const p = view?.preferences;
  const language = p?.language;
  const theme = p?.theme;
  const entries = view?.entries;
  const save = usePreferenceSave(p, run);
  useEffect(() => {
    if (language === undefined) return;
    const resolved = resolveLanguage(language);
    void i18n.changeLanguage(resolved);
    document.documentElement.lang = resolved;
  }, [language]);
  useEffect(() => {
    if (theme === undefined) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (entries) setSelected((old) => retainSelection(old, entries));
  }, [entries]);
  const rows = useMemo(
    () => (entries && p ? visibleEntries(entries, p, query) : []),
    [entries, p, query],
  );
  if (!view)
    return (
      <main className="startup">
        <Network size={28} />
        <h1>Port Sentinel</h1>
        <Feedback error={failure || null} />
        {!failure && <p>{t("scanning")}</p>}
      </main>
    );
  const chosen = view.entries.filter((e) => selected.has(e.id));
  const selectedTargets = targets(chosen);
  const visibleSelection = chosen.length
    ? rows.filter((entry) => selected.has(entry.id)).map((entry) => entry.id)
    : [];
  const hiddenSelection = chosen.length - visibleSelection.length;
  const busy = !!view.task;
  let empty = null;
  if (!rows.length) {
    const { scope, protocol } = view.preferences;
    const hasScopedEntries = view.entries.some((entry) =>
      inScope(entry, scope),
    );
    let message = t(scope === "listening" ? "empty" : "emptyAll");
    let recovery: { label: string; press: () => void } | undefined;
    if (view.task === "scanning" && !view.lastSuccess) {
      message = t("scanning");
    } else if (view.error && !view.lastSuccess) {
      message = "";
      recovery = {
        label: t("refresh"),
        press: () => run(() => backend().Refresh(false)),
      };
    } else if (hasScopedEntries) {
      message = t("noResults");
      recovery =
        protocol !== "ALL"
          ? {
              label: t("showAllProtocols"),
              press: () => save({ protocol: "ALL" }),
            }
          : { label: t("clearSearch"), press: () => setQuery("") };
    } else if (scope === "listening" && view.entries.length) {
      recovery = {
        label: t("allConnections"),
        press: () => save({ scope: "all" }),
      };
    }
    const action = recovery;
    empty = (
      <div className="empty-state">
        {message && <p role="status">{message}</p>}
        {action && (
          <Button
            className="tool-button tool-button-outlined"
            variant="bordered"
            isDisabled={!view.lastSuccess && busy}
            onPress={() => {
              search.current?.focus();
              action.press();
            }}
          >
            {action.label}
          </Button>
        )}
      </div>
    );
  }
  const confirm = (
    entries: Entry[],
    force = false,
    processes = targets(entries),
  ) => {
    if (processes.length)
      setConfirmation({
        targets: processes,
        force,
        entries: view.entries,
        selectedIds: new Set(entries.map((entry) => entry.id)),
      });
  };
  const canForce = view.results
    .filter(
      (r) =>
        ["still_running", "graceful_unsupported"].includes(r.status) &&
        view.entries.some(
          (e) => identityKey(e.process) === identityKey(r.target),
        ),
    )
    .map((r) => r.target);
  return (
    <main className="workspace">
      <PortToolbar
        query={query}
        setQuery={setQuery}
        search={search}
        preferences={view.preferences}
        task={view.task}
        save={save}
        refresh={(authorized) => run(() => backend().Refresh(authorized))}
        openSettings={() => setSettings(true)}
        hasUpdate={!!view.update.version}
      />
      <Feedback error={view.error} />
      <Feedback error={view.settingsError} />
      {view.closeBlocked && (
        <Button
          className="mx-6 mb-3 self-start"
          size="sm"
          color="danger"
          variant="flat"
          onPress={() => run(() => backend().ExitWithoutSaving())}
        >
          {t("exitWithoutSaving")}
        </Button>
      )}
      <Feedback error={failure} />
      {view.stale && (
        <p className="scan-stale" role="status">
          {t("stale")}
        </p>
      )}
      {chosen.length > 0 && (
        <div className="batch-bar">
          <div className="batch-summary">
            <div className="batch-counts" role="status">
              <strong>{t("selectedRows", { count: chosen.length })}</strong>
              <span>
                {t("processCount", { count: selectedTargets.length })}
              </span>
            </div>
            {hiddenSelection > 0 && (
              <div className="batch-hidden">
                <strong role="status">
                  {t("hiddenSelection", { count: hiddenSelection })}
                </strong>
                <Button
                  variant="light"
                  size="sm"
                  disableRipple
                  onPress={() => {
                    setSelected(new Set(visibleSelection));
                    search.current?.focus();
                  }}
                >
                  {t("clearHiddenSelection")}
                </Button>
              </div>
            )}
          </div>
          <div className="batch-actions">
            <Button
              variant="light"
              size="sm"
              disableRipple
              onPress={() => {
                setSelected(new Set());
                search.current?.focus();
              }}
            >
              {t("clear")}
            </Button>
            <Button
              color="danger"
              variant="flat"
              size="sm"
              disableRipple
              isDisabled={busy || !selectedTargets.length}
              onPress={() => confirm(chosen)}
            >
              {t(selectedTargets.length === 1 ? "terminate" : "terminateMany")}
            </Button>
          </div>
        </div>
      )}
      <div className="work-area" data-inspecting={!!detail}>
        <PortTable
          rows={rows}
          preferences={view.preferences}
          selected={selected}
          setSelected={setSelected}
          sort={(key) =>
            save({
              sort: key,
              ascending:
                key === view.preferences.sort
                  ? !view.preferences.ascending
                  : true,
            })
          }
          inspected={detail?.id}
          details={(entry, trigger) => {
            detailTrigger.current = trigger;
            setDetail(entry);
          }}
          end={(entries) => {
            if (!busy) confirm(entries);
          }}
          run={run}
          empty={empty}
        />
        <Details
          entry={detail}
          entries={view.entries}
          onClose={() => {
            setDetail(null);
            const trigger = detailTrigger.current;
            detailTrigger.current = null;
            requestAnimationFrame(() => {
              if (trigger?.isConnected) trigger.focus({ preventScroll: true });
              else search.current?.focus();
            });
          }}
          run={run}
        />
      </div>
      {view.results.length > 0 &&
        view.resultRevision !== dismissedResultRevision && (
          <ProcessResults
            results={view.results}
            endpoints={view.endpoints}
            canForce={canForce}
            busy={busy}
            onClose={() => {
              setDismissedResultRevision(view.resultRevision);
              search.current?.focus();
            }}
            onForce={() => confirm([], true, canForce)}
          />
        )}
      <footer className="status-bar">
        <div className="status-meta">
          <span>{t("count", { count: rows.length })}</span>
          <span>
            {view.lastSuccess
              ? t("lastRefresh", {
                  time: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(new Date(view.lastSuccess)),
                })
              : t("never")}
          </span>
        </div>
        <div className="scan-controls">
          {busy && (
            <>
              <span role="status">{t(view.task)}</span>
              <Button
                size="sm"
                variant="light"
                onPress={() => run(() => backend().CancelTask())}
              >
                {t("cancel")}
              </Button>
            </>
          )}
          {view.visibility && (
            <span className="visibility">{t(view.visibility)}</span>
          )}
          <Switch
            size="sm"
            classNames={{ label: "switch-label" }}
            isSelected={view.preferences.autoRefresh}
            onValueChange={(value) => save({ autoRefresh: value })}
          >
            {t("autoRefresh")}
          </Switch>
        </div>
      </footer>
      <ProcessDialog
        value={confirmation}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) {
            const c = confirmation;
            setConfirmation(null);
            void run(() => backend().Terminate(c.targets, c.force));
          }
        }}
      />
      {settings && (
        <Settings
          view={view}
          onClose={() => setSettings(false)}
          save={save}
          run={run}
        />
      )}
    </main>
  );
}
