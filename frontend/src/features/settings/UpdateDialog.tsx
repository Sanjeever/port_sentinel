import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
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
  const size = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: "unit",
    unit: "byte",
    unitDisplay: "short",
  });
  return (
    <Modal
      closeButton={<LocalizedClose />}
      isOpen={isOpen}
      onClose={() => {
        if (!u.phase) onClose();
      }}
      disableAnimation
      scrollBehavior="inside"
      classNames={{ base: "dialog update-dialog", header: "dialog-header" }}
      isDismissable={!u.phase}
      isKeyboardDismissDisabled={!!u.phase}
      hideCloseButton={!!u.phase}
    >
      <ModalContent>
        <ModalHeader as="h2">
          {t("installConfirm", { version: u.version })}
        </ModalHeader>
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
                    type="button"
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
            <div className="download-progress">
              <progress
                aria-label={t("downloading")}
                value={u.total ? u.downloaded : undefined}
                max={u.total || undefined}
              />
              <p className="mono">
                {size.format(u.downloaded)}
                {u.total > 0 && <> / {size.format(u.total)}</>}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="dialog-actions">
          {u.error && (
            <Button
              variant="light"
              className="tool-button"
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
          )}
          {u.phase ? (
            <Button
              variant="flat"
              className="tool-button"
              disableRipple
              isDisabled={u.phase === "installing"}
              onPress={() => run(() => backend().CancelUpdate())}
            >
              {t(u.phase === "installing" ? "installing" : "cancel")}
            </Button>
          ) : (
            <>
              <Button
                variant="light"
                className="tool-button"
                disableRipple
                onPress={onClose}
                autoFocus
              >
                {t("cancel")}
              </Button>
              <Button
                color="primary"
                className="tool-button"
                disableRipple
                isDisabled={build.development}
                onPress={() => run(() => backend().InstallUpdate())}
              >
                {t("install")}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
