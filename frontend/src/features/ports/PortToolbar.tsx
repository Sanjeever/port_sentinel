import { Button, Input } from "@heroui/react";
import {
  Network,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Preferences } from "../../desktop/types";
import { SelectControl } from "../../components/SelectControl";

export function PortToolbar({
  query,
  setQuery,
  search,
  preferences,
  task,
  save,
  refresh,
  openSettings,
  hasUpdate,
}: {
  query: string;
  setQuery: (value: string) => void;
  search: RefObject<HTMLInputElement | null>;
  preferences: Preferences;
  task: string;
  save: (change: Partial<Preferences>) => void;
  refresh: (authorized: boolean) => void;
  openSettings: () => void;
  hasUpdate: boolean;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "f" ||
        document.querySelector('[aria-modal="true"]')
      ) {
        return;
      }
      event.preventDefault();
      search.current?.focus();
      search.current?.select();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [search]);

  const settingsLabel = t(hasUpdate ? "newUpdate" : "settings");

  return (
    <section className="toolbar" aria-label={t("actions")}>
      <div className="brand">
        <Network size={18} aria-hidden="true" />
        <h1>Port Sentinel</h1>
      </div>
      <Input
        ref={search}
        aria-label={t("search")}
        aria-keyshortcuts="Meta+F Control+F"
        placeholder={t("search")}
        startContent={<Search size={16} aria-hidden="true" />}
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
              disableRipple
              aria-label={t("clearSearch")}
              onPress={() => {
                setQuery("");
                search.current?.focus();
              }}
            >
              <X size={14} aria-hidden="true" />
            </Button>
          ) : (
            <kbd aria-hidden="true">
              {/Mac/.test(navigator.platform) ? "⌘ F" : "Ctrl F"}
            </kbd>
          )
        }
      />
      <div className="filters">
        <SelectControl
          aria-label={t("scope")}
          value={preferences.scope}
          onChange={(e) =>
            save({ scope: e.target.value as Preferences["scope"] })
          }
        >
          <option value="listening">{t("listening")}</option>
          <option value="all">{t("allConnections")}</option>
        </SelectControl>
        <SelectControl
          aria-label={t("protocol")}
          value={preferences.protocol}
          onChange={(e) =>
            save({ protocol: e.target.value as Preferences["protocol"] })
          }
        >
          <option value="ALL">{t("allProtocols")}</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
        </SelectControl>
      </div>
      <div className="refresh-controls">
        <Button
          size="sm"
          color="primary"
          className="tool-button"
          disableRipple
          isDisabled={!!task}
          startContent={
            <RefreshCw
              size={15}
              aria-hidden="true"
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
          className="tool-button tool-button-outlined"
          disableRipple
          isDisabled={!!task}
          startContent={<ShieldCheck size={15} aria-hidden="true" />}
          onPress={() => refresh(true)}
        >
          {t("authorize")}
        </Button>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="tool-button settings-trigger"
          disableRipple
          aria-label={settingsLabel}
          title={settingsLabel}
          onPress={openSettings}
        >
          <Settings size={17} aria-hidden="true" />
          {hasUpdate && <span className="update-dot" aria-hidden="true" />}
        </Button>
      </div>
    </section>
  );
}
