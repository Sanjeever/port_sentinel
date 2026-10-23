import { Button, Input, Switch } from "@heroui/react";
import { RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Preferences } from "../../desktop/types";

export function PortToolbar({
  query,
  setQuery,
  preferences,
  task,
  save,
  refresh,
}: {
  query: string;
  setQuery: (value: string) => void;
  preferences: Preferences;
  task: string;
  save: (change: Partial<Preferences>) => void;
  refresh: (authorized: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="toolbar" aria-label={t("actions")}>
      <Input
        aria-label={t("search")}
        placeholder={t("search")}
        startContent={<Search size={17} />}
        value={query}
        onValueChange={setQuery}
        className="search-input"
        size="sm"
        variant="bordered"
        endContent={
          query ? (
            <Button
              isIconOnly
              variant="light"
              size="sm"
              aria-label={t("clear")}
              onPress={() => setQuery("")}
            >
              <X size={14} />
            </Button>
          ) : null
        }
      />
      <div className="toolbar-controls">
        <div className="filters">
          <select
            aria-label={t("allConnections")}
            value={preferences.scope}
            onChange={(e) =>
              save({ scope: e.target.value as Preferences["scope"] })
            }
          >
            <option value="listening">{t("listening")}</option>
            <option value="all">{t("allConnections")}</option>
          </select>
          <select
            aria-label={t("protocol")}
            value={preferences.protocol}
            onChange={(e) =>
              save({ protocol: e.target.value as Preferences["protocol"] })
            }
          >
            <option value="ALL">{t("allProtocols")}</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
          </select>
        </div>
        <div className="refresh-controls">
          <Switch
            size="sm"
            isSelected={preferences.autoRefresh}
            onValueChange={(v) => save({ autoRefresh: v })}
          >
            {t("autoRefresh")}
          </Switch>
          <Button
            size="sm"
            variant="flat"
            isDisabled={!!task}
            startContent={
              <RefreshCw
                size={15}
                className={task === "scanning" ? "spinning" : ""}
              />
            }
            onPress={() => refresh(false)}
          >
            {t("refresh")}
          </Button>
          <Button
            size="sm"
            variant="bordered"
            isDisabled={!!task}
            startContent={<ShieldCheck size={15} />}
            onPress={() => refresh(true)}
          >
            {t("authorize")}
          </Button>
        </div>
      </div>
    </section>
  );
}
