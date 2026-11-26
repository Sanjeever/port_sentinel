import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Switch } from "@heroui/react";
import { Settings as SettingsIcon, Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "../desktop/api";
import { useDesktop } from "../desktop/useDesktop";
import {
  visibleEntries,
  retainSelection,
  targets,
  identityKey,
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
  const save = usePreferenceSave(p, run);
  useEffect(() => {
    if (p) {
      void i18n.changeLanguage(resolveLanguage(p.language));
      document.documentElement.lang = resolveLanguage(p.language);
    }
  }, [p?.language]);
  useEffect(() => {
    if (!p) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        p.theme === "dark" || (p.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [p?.theme]);
  useEffect(() => {
    if (view) setSelected((old) => retainSelection(old, view.entries));
  }, [view?.entries]);
  const rows = useMemo(
    () => (view && p ? visibleEntries(view.entries, p, query) : []),
    [view?.entries, p, query],
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
  const busy = !!view.task;
  const filtered = !!query.trim() || view.preferences.protocol !== "ALL";
  const empty = rows.length === 0 && (
    <div className="empty-state">
      {view.task === "scanning" && !view.lastSuccess ? (
        <p role="status">{t("scanning")}</p>
      ) : view.error && !view.lastSuccess ? (
        <Button
          className="tool-button"
          variant="bordered"
          onPress={() => run(() => backend().Refresh(false))}
          isDisabled={busy}
        >
          {t("refresh")}
        </Button>
      ) : (
        <>
          <p role="status">
            {filtered && view.entries.length
              ? t("noResults")
              : t(
                  view.preferences.scope === "listening" ? "empty" : "emptyAll",
                )}
          </p>
          {filtered && view.entries.length > 0 && (
            <Button
              className="tool-button"
              variant="bordered"
              onPress={() => {
                search.current?.focus();
                setQuery("");
                if (view.preferences.protocol !== "ALL")
                  save({ protocol: "ALL" });
              }}
            >
              {t("clearFilters")}
            </Button>
          )}
          {!filtered &&
            view.preferences.scope === "listening" &&
            view.entries.length > 0 && (
              <Button
                className="tool-button"
                variant="bordered"
                onPress={() => {
                  search.current?.focus();
                  save({ scope: "all" });
                }}
              >
                {t("allConnections")}
              </Button>
            )}
        </>
      )}
    </div>
  );
  const confirm = (
    entries: Entry[],
    force = false,
    processes = targets(entries),
  ) => {
    if (processes.length)
      setConfirmation({ targets: processes, force, entries: view.entries });
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
      <header className="app-header">
        <div className="brand">
          <Network size={19} aria-hidden="true" />
          <h1>Port Sentinel</h1>
        </div>
        <Button
          variant="light"
          size="sm"
          className="tool-button"
          disableRipple
          startContent={<SettingsIcon size={16} aria-hidden="true" />}
          aria-label={t(view.update.version ? "newUpdate" : "settings")}
          onPress={() => setSettings(true)}
        >
          {t("settings")}
          {view.update.version && <span className="update-dot" />}
        </Button>
      </header>
      <PortToolbar
        query={query}
        setQuery={setQuery}
        search={search}
        preferences={view.preferences}
        task={view.task}
        save={save}
        refresh={(authorized) => run(() => backend().Refresh(authorized))}
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
          <span>
            {t("selected", {
              processes: selectedTargets.length,
              ports: chosen.length,
            })}
          </span>
          <Button
            color="danger"
            variant="flat"
            size="sm"
            isDisabled={busy || !selectedTargets.length}
            onPress={() => confirm(chosen)}
          >
            {t("terminateMany")}
          </Button>
          <Button
            variant="light"
            size="sm"
            onPress={() => setSelected(new Set())}
          >
            {t("clear")}
          </Button>
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
            onClose={() => setDismissedResultRevision(view.resultRevision)}
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
