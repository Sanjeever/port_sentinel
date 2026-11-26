import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Entry, Identity } from "../../desktop/types";
import { identityKey } from "./list";
import { LocalizedClose } from "../../components/LocalizedClose";
export interface Confirmation {
  targets: Identity[];
  force: boolean;
  entries: Entry[];
  selectedIds: ReadonlySet<string>;
}

function AffectedConnections({
  label,
  entries,
}: {
  label: string;
  entries: Entry[];
}) {
  const { t } = useTranslation();
  if (!entries.length) return null;
  const items = entries.map((entry) => (
    <li key={entry.id}>
      <span>{entry.protocol}</span>
      <span className="mono">{entry.local || entry.port}</span>
      {entry.remote && (
        <span className="mono muted">
          {t("remote")} {entry.remote}
        </span>
      )}
    </li>
  ));
  return (
    <div className="affected-connections">
      <p>{label}</p>
      <ul role="list">{items.slice(0, 3)}</ul>
      {entries.length > 3 && (
        <details>
          <summary>
            {t("moreConnections", { count: entries.length - 3 })}
          </summary>
          <ul role="list">{items.slice(3)}</ul>
        </details>
      )}
    </div>
  );
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
  const cancel = useRef<HTMLButtonElement>(null);
  const warningsId = useId();
  const isOpen = !!value;
  useEffect(() => {
    if (isOpen) cancel.current?.focus({ preventScroll: true });
  }, [isOpen]);
  const connectionsByProcess = new Map(
    value?.targets.map((target) => [identityKey(target), [] as Entry[]]),
  );
  for (const entry of value?.entries ?? []) {
    connectionsByProcess.get(identityKey(entry.process))?.push(entry);
  }
  return (
    <Modal
      closeButton={<LocalizedClose />}
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation
      placement="center"
      scrollBehavior="inside"
      classNames={{ base: "dialog process-dialog", header: "dialog-header" }}
    >
      <ModalContent>
        {value && (
          <>
            <ModalHeader as="h2">
              {t(value.force ? "confirmForce" : "confirmEnd", {
                count: value.targets.length,
              })}
            </ModalHeader>
            <ModalBody>
              <ul className="target-list" role="list">
                {value.targets.map((p) => {
                  const key = identityKey(p);
                  const connections = connectionsByProcess.get(key) ?? [];
                  return (
                    <li key={key}>
                      <div className="target-identity">
                        <strong>{p.name || t("unreadable")}</strong>
                        <span className="mono muted">PID {p.pid}</span>
                      </div>
                      <AffectedConnections
                        label={t("affectedSelection")}
                        entries={connections.filter((entry) =>
                          value.selectedIds.has(entry.id),
                        )}
                      />
                      <AffectedConnections
                        label={t(value.force ? "knownConnections" : "related")}
                        entries={connections.filter(
                          (entry) => !value.selectedIds.has(entry.id),
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            </ModalBody>
            <ModalFooter className="dialog-actions process-dialog-footer">
              <div className="process-dialog-warnings" id={warningsId}>
                <p>{t("scopeWarning")}</p>
                {value.force && (
                  <p className="danger-text">{t("forceWarning")}</p>
                )}
                {value.targets.some((p) => p.risk) && (
                  <p className="danger-text">{t("criticalWarning")}</p>
                )}
              </div>
              <div className="process-dialog-buttons">
                <Button
                  ref={cancel}
                  variant="light"
                  className="tool-button"
                  disableRipple
                  onPress={onClose}
                >
                  {t("cancel")}
                </Button>
                <Button
                  color="danger"
                  className="tool-button"
                  disableRipple
                  aria-describedby={warningsId}
                  onPress={onConfirm}
                >
                  {t(
                    value.force
                      ? "force"
                      : value.targets.length === 1
                        ? "terminate"
                        : "terminateMany",
                  )}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
