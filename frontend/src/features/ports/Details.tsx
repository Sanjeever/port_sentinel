import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@heroui/react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../desktop/types";
import { backend } from "../../desktop/api";
import { identityKey } from "./list";
import { LocalizedClose } from "../../components/LocalizedClose";
import { Feedback } from "../../components/Feedback";
export function Details({
  entry,
  entries,
  onClose,
  run,
}: {
  entry: Entry | null;
  entries: Entry[];
  onClose: () => void;
  run: (f: () => Promise<unknown>) => void;
}) {
  const { t } = useTranslation();
  if (!entry) return null;
  const p = entry.process;
  return (
    <Modal
      closeButton={<LocalizedClose />}
      isOpen
      onClose={onClose}
      placement="center"
      scrollBehavior="inside"
      classNames={{ wrapper: "detail-wrapper", base: "detail-panel" }}
    >
      <ModalContent>
        <ModalHeader>{t("details")}</ModalHeader>
        <ModalBody>
          <h2>
            {p.name || t(p.status === "no_pid" ? "no_pid" : "unreadable")}
          </h2>
          <dl className="details-grid">
            <dt>PID</dt>
            <dd>
              {p.pid > 0 ? p.pid : t("no_pid")}
              <Button
                isIconOnly
                variant="light"
                size="sm"
                aria-label={t("copyPID")}
                isDisabled={p.pid <= 0}
                onPress={() => run(() => backend().Copy(String(p.pid)))}
              >
                <Copy size={14} />
              </Button>
            </dd>
            <dt>{t("path")}</dt>
            <dd className="path">
              {p.path ||
                t(
                  p.pathStatus === "available"
                    ? "pathUnavailable"
                    : p.pathStatus,
                )}
              {p.path && (
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  aria-label={t("copyPath")}
                  onPress={() => run(() => backend().Copy(p.path))}
                >
                  <Copy size={14} />
                </Button>
              )}
            </dd>
            <dt>{t("state")}</dt>
            <dd>{t(p.status)}</dd>
          </dl>
          <Feedback
            error={
              p.diagnostic
                ? {
                    code: p.status !== "available" ? p.status : p.pathStatus,
                    detail: p.diagnostic,
                  }
                : null
            }
          />
          <h3>{t("related")}</h3>
          {entries
            .filter((e) => identityKey(e.process) === identityKey(p))
            .map((e) => (
              <dl className="connection-detail" key={e.id}>
                <dt>
                  {e.protocol} · {e.port}
                </dt>
                <dd>{e.local}</dd>
                <dd>{e.remote ?? t("noRemote")}</dd>
                <dd>{e.state}</dd>
              </dl>
            ))}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
