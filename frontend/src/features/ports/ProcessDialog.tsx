import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { Entry, Identity } from "../../desktop/types";
import { identityKey } from "./list";
import { LocalizedClose } from "../../components/LocalizedClose";
export interface Confirmation {
  targets: Identity[];
  force: boolean;
  entries: Entry[];
}
export function ProcessDialog({
  value,
  onClose,
  onConfirm,
}: {
  value: Confirmation | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      closeButton={<LocalizedClose />}
      isOpen={!!value}
      onClose={onClose}
      placement="center"
      classNames={{ base: "dialog" }}
    >
      <ModalContent>
        {value && (
          <>
            <ModalHeader>
              {t(value.force ? "confirmForce" : "confirmEnd", {
                count: value.targets.length,
              })}
            </ModalHeader>
            <ModalBody>
              <p>{t("scopeWarning")}</p>
              {value.force && (
                <p className="danger-text">{t("forceWarning")}</p>
              )}
              {value.targets.some((p) => p.risk) && (
                <p className="danger-text">{t("criticalWarning")}</p>
              )}
              <ul className="target-list">
                {value.targets.map((p) => (
                  <li key={identityKey(p)}>
                    <strong>{p.name || t("unreadable")}</strong>
                    <span className="mono">PID {p.pid}</span>
                    <span>
                      {[
                        ...new Set(
                          value.entries
                            .filter(
                              (e) => identityKey(e.process) === identityKey(p),
                            )
                            .map((e) => e.port),
                        ),
                      ]
                        .sort((a, b) => a - b)
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} autoFocus>
                {t("cancel")}
              </Button>
              <Button color="danger" onPress={onConfirm}>
                {t(value.force ? "force" : "terminateMany")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
