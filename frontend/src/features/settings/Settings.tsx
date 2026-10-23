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
import ReactMarkdown from "react-markdown";
import type { Preferences, View } from "../../desktop/types";
import { backend } from "../../desktop/api";
import { Feedback } from "../../components/Feedback";
import { LocalizedClose } from "../../components/LocalizedClose";

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
  const { t, i18n } = useTranslation();
  const [install, setInstall] = useState(false);
  const p = view.preferences;
  const u = view.update;
  return (
    <>
      <Modal
        closeButton={<LocalizedClose />}
        isOpen
        onClose={onClose}
        scrollBehavior="inside"
        classNames={{ base: "dialog settings-dialog" }}
      >
        <ModalContent>
          <ModalHeader>{t("settings")}</ModalHeader>
          <ModalBody>
            <Tabs aria-label={t("settings")} variant="underlined">
              <Tab key="general" title={t("general")}>
                <div className="settings-fields">
                  <label>
                    {t("language")}
                    <select
                      aria-label={t("language")}
                      value={p.language}
                      onChange={(e) =>
                        save({
                          language: e.target.value as Preferences["language"],
                        })
                      }
                    >
                      <option value="system">{t("system")}</option>
                      <option value="zh-CN">简体中文</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label>
                    {t("theme")}
                    <select
                      aria-label={t("theme")}
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
                    </select>
                  </label>
                  <Switch
                    size="sm"
                    isSelected={p.autoRefresh}
                    onValueChange={(v) => save({ autoRefresh: v })}
                  >
                    {t("autoRefresh")}
                  </Switch>
                  <label>
                    {t("interval")}
                    <select
                      aria-label={t("interval")}
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
                    </select>
                  </label>
                </div>
              </Tab>
              <Tab key="about" title={t("about")}>
                <dl className="build-info">
                  <dt>{t("version")}</dt>
                  <dd>
                    {view.build.version}{" "}
                    {view.build.development && (
                      <span>· {t("development")}</span>
                    )}
                  </dd>
                  <dt>{t("commit")}</dt>
                  <dd className="mono">
                    {view.build.commit.slice(0, 12) || "—"}
                  </dd>
                </dl>
                <Switch
                  size="sm"
                  isSelected={p.autoUpdate}
                  onValueChange={(v) => save({ autoUpdate: v })}
                >
                  {t("autoUpdate")}
                </Switch>
                <div className="update-actions">
                  <Button
                    size="sm"
                    variant="flat"
                    isDisabled={view.build.development || !!u.phase}
                    onPress={() => run(() => backend().CheckUpdate())}
                  >
                    {t(u.phase === "checking" ? "checking" : "checkUpdate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
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
                    onPress={() => setInstall(true)}
                  >
                    {t("updateAvailable")} · {u.version}
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
      <Modal
        closeButton={<LocalizedClose />}
        isOpen={install}
        onClose={() => {
          if (!u.phase) setInstall(false);
        }}
        scrollBehavior="inside"
        classNames={{ base: "dialog update-dialog" }}
        isDismissable={!u.phase}
        hideCloseButton={!!u.phase}
      >
        <ModalContent>
          <ModalHeader>
            {t("installConfirm", { version: u.version })}
          </ModalHeader>
          <ModalBody>
            <p className="muted">
              {t("currentVersion", { version: view.build.version })}
            </p>
            <div className="release-notes">
              <ReactMarkdown
                skipHtml
                components={{
                  a: ({ children, href }) => (
                    <button
                      className="text-link"
                      onClick={() => {
                        if (href) run(() => backend().OpenURL(href));
                      }}
                    >
                      {children}
                    </button>
                  ),
                  img: () => null,
                }}
              >
                {u.notes}
              </ReactMarkdown>
            </div>
            <Feedback
              error={
                u.error
                  ? { code: u.errorCode || "update_failed", detail: u.error }
                  : null
              }
            />
            {u.phase === "downloading" && (
              <>
                <progress value={u.downloaded} max={u.total || undefined} />
                <p className="mono">
                  {new Intl.NumberFormat(i18n.resolvedLanguage).format(
                    u.downloaded,
                  )}{" "}
                  /{" "}
                  {new Intl.NumberFormat(i18n.resolvedLanguage).format(u.total)}
                </p>
              </>
            )}
            <div className="update-actions">
              {u.error && (
                <Button
                  variant="light"
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
              )}
              {u.phase ? (
                <Button
                  variant="flat"
                  isDisabled={u.phase === "installing"}
                  onPress={() => run(() => backend().CancelUpdate())}
                >
                  {t(u.phase === "installing" ? "installing" : "cancel")}
                </Button>
              ) : (
                <>
                  <Button variant="light" onPress={() => setInstall(false)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    color="primary"
                    isDisabled={view.build.development}
                    onPress={() => run(() => backend().InstallUpdate())}
                  >
                    {t("install")}
                  </Button>
                </>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
