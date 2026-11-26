import { useState } from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Switch,
  Tabs,
  Tab,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { Preferences, View } from "../../desktop/types";
import { backend } from "../../desktop/api";
import { Feedback } from "../../components/Feedback";
import { LocalizedClose } from "../../components/LocalizedClose";
import { SelectControl } from "../../components/SelectControl";
import { UpdateDialog } from "./UpdateDialog";

export function Settings({
  view,
  onClose,
  save,
  run,
}: {
  view: View;
  onClose: () => void;
  save: (p: Partial<Preferences>) => void;
  run: (f: () => Promise<unknown>) => void;
}) {
  const { t } = useTranslation();
  const [install, setInstall] = useState(false);
  const p = view.preferences;
  const u = view.update;
  return (
    <>
      <Modal
        closeButton={<LocalizedClose />}
        isOpen
        onClose={onClose}
        disableAnimation
        scrollBehavior="inside"
        classNames={{
          base: "dialog settings-dialog",
          header: "dialog-header",
          body: "settings-body",
        }}
      >
        <ModalContent>
          <ModalHeader as="h2">{t("settings")}</ModalHeader>
          <ModalBody>
            <Tabs
              aria-label={t("settings")}
              color="primary"
              variant="underlined"
              classNames={{
                tabList: "settings-tabs",
                panel: "settings-tab-panel",
              }}
            >
              <Tab key="general" title={t("general")}>
                <div className="settings-fields">
                  <label>
                    {t("language")}
                    <SelectControl
                      value={p.language}
                      onChange={(e) =>
                        save({
                          language: e.target.value as Preferences["language"],
                        })
                      }
                    >
                      <option value="system">{t("system")}</option>
                      <option value="zh-CN" lang="zh-CN">
                        简体中文
                      </option>
                      <option value="en" lang="en">
                        English
                      </option>
                    </SelectControl>
                  </label>
                  <label>
                    {t("theme")}
                    <SelectControl
                      value={p.theme}
                      onChange={(e) =>
                        save({ theme: e.target.value as Preferences["theme"] })
                      }
                    >
                      {(["system", "light", "dark"] as const).map((v) => (
                        <option key={v} value={v}>
                          {t(v)}
                        </option>
                      ))}
                    </SelectControl>
                  </label>
                  <div className="refresh-settings">
                    <Switch
                      className="setting-toggle"
                      classNames={{ label: "switch-label" }}
                      size="sm"
                      isSelected={p.autoRefresh}
                      onValueChange={(v) => save({ autoRefresh: v })}
                    >
                      {t("autoRefresh")}
                    </Switch>
                    <label>
                      {t("interval")}
                      <SelectControl
                        value={p.interval}
                        onChange={(e) =>
                          save({ interval: Number(e.target.value) })
                        }
                      >
                        {[2, 5, 10, 30].map((v) => (
                          <option key={v} value={v}>
                            {t("seconds", { count: v })}
                          </option>
                        ))}
                      </SelectControl>
                    </label>
                  </div>
                </div>
              </Tab>
              <Tab key="about" title={t("about")}>
                <dl className="build-info">
                  <dt>{t("version")}</dt>
                  <dd className="version-value">
                    <span className="mono">{view.build.version}</span>
                    {view.build.development && (
                      <span className="muted">{t("development")}</span>
                    )}
                  </dd>
                  <dt>{t("commit")}</dt>
                  <dd className="mono">
                    {view.build.commit.slice(0, 12) || "—"}
                  </dd>
                </dl>
                <Switch
                  className="setting-toggle"
                  classNames={{ label: "switch-label" }}
                  size="sm"
                  isSelected={p.autoUpdate}
                  onValueChange={(v) => save({ autoUpdate: v })}
                >
                  {t("autoUpdate")}
                </Switch>
                <div className="update-actions">
                  <Button
                    size="sm"
                    className="tool-button tool-button-outlined"
                    variant="bordered"
                    disableRipple
                    isDisabled={view.build.development || !!u.phase}
                    onPress={() => run(() => backend().CheckUpdate())}
                  >
                    {t(u.phase === "checking" ? "checking" : "checkUpdate")}
                  </Button>
                  <Button
                    size="sm"
                    className="tool-button"
                    variant="light"
                    disableRipple
                    onPress={() =>
                      run(() =>
                        backend().OpenURL(
                          "https://github.com/Sanjeever/port_sentinel/releases",
                        ),
                      )
                    }
                  >
                    {t("manualDownload")}
                  </Button>
                </div>
                {u.checked_at && !u.version && !u.error && (
                  <p className="muted">{t("upToDate")}</p>
                )}
                {u.version && (
                  <Button
                    size="sm"
                    color="primary"
                    className="tool-button"
                    disableRipple
                    onPress={() => setInstall(true)}
                  >
                    {t("updateAvailable", { version: u.version })}
                  </Button>
                )}
                <Feedback
                  error={
                    u.error
                      ? {
                          code: u.errorCode || "update_failed",
                          detail: u.error,
                        }
                      : null
                  }
                />
              </Tab>
            </Tabs>
            <Feedback error={view.settingsError} />
          </ModalBody>
        </ModalContent>
      </Modal>
      <UpdateDialog
        update={u}
        build={view.build}
        isOpen={install}
        onClose={() => setInstall(false)}
        run={run}
      />
    </>
  );
}
