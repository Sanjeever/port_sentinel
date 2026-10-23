import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import type { Update, View } from "../../desktop/types";
import { backend } from "../../desktop/api";
import { Feedback } from "../../components/Feedback";
import { LocalizedClose } from "../../components/LocalizedClose";

export function UpdateDialog({
  update: u,
  build,
  isOpen,
  onClose,
  run,
}: {
  update: Update;
  build: View["build"];
  isOpen: boolean;
  onClose: () => void;
  run: (f: () => Promise<unknown>) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Modal
      closeButton={<LocalizedClose />}
      isOpen={isOpen}
      onClose={() => {
        if (!u.phase) onClose();
      }}
      scrollBehavior="inside"
      classNames={{ base: "dialog update-dialog" }}
      isDismissable={!u.phase}
      hideCloseButton={!!u.phase}
    >
      <ModalContent>
        <ModalHeader>{t("installConfirm", { version: u.version })}</ModalHeader>
        <ModalBody>
          <p className="muted">
            {t("currentVersion", { version: build.version })}
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
                / {new Intl.NumberFormat(i18n.resolvedLanguage).format(u.total)}
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
                <Button variant="light" onPress={onClose}>
                  {t("cancel")}
                </Button>
                <Button
                  color="primary"
                  isDisabled={build.development}
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
  );
}
