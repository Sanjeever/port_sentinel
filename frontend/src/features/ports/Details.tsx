import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from "@heroui/react";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry, ProcessDetails } from "../../desktop/types";
import { backend } from "../../desktop/api";
import { identityKey } from "./list";
import { LocalizedClose } from "../../components/LocalizedClose";
import { Feedback } from "../../components/Feedback";

function ProcessContext({ pid, created }: { pid: number; created: number }) {
  const { t } = useTranslation();
  const [details, setDetails] = useState<ProcessDetails>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    let closed = false;
    void Promise.resolve()
      .then(() => backend().ProcessDetails(pid, created))
      .then((result) => {
        if (!closed) setDetails(result);
      })
      .catch((error) => {
        if (!closed) setFailure(String(error));
      });
    return () => {
      closed = true;
    };
  }, [pid, created]);

  const parents = details?.parents ?? [];
  const diagnostic = [
    failure,
    details?.error?.detail,
    details?.workingDirError?.detail,
    details?.parentsError?.detail,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <div className="process-context">
      <p className="muted" role="status">
        {failure
          ? t("detailsUnavailable")
          : details?.error
            ? t(details.error.code)
            : ""}
      </p>
      {!details && !failure && <p className="muted">{t("readingProcess")}</p>}
      {details && !details.error && (
        <dl className="details-grid">
          <dt>{t("workingDir")}</dt>
          <dd className={details.workingDir ? "path" : "muted"}>
            {details.workingDir ||
              t(details.workingDirError?.code ?? "workingDirUnavailable")}
          </dd>
          <dt>{t("currentParents")}</dt>
          <dd className="process-parent-chain">
            {parents.length > 0 && (
              <ol role="list">
                {parents.map((parent) => (
                  <li key={`${parent.pid}:${parent.created}`}>
                    <span>{parent.name || t("unreadable")}</span>
                    <span className="mono muted">PID {parent.pid}</span>
                  </li>
                ))}
              </ol>
            )}
            {details.parentsError ? (
              <p className="muted">
                {t("parentChainIssue", {
                  reason: t(details.parentsError.code),
                })}
              </p>
            ) : (
              parents.length === 0 && <p className="muted">{t("noParents")}</p>
            )}
          </dd>
        </dl>
      )}
      {diagnostic && (
        <details className="process-context-diagnostic">
          <summary>{t("errorDetails")}</summary>
          <pre>{diagnostic}</pre>
        </details>
      )}
    </div>
  );
}

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
  const { t, i18n } = useTranslation();
  if (!entry) return null;
  const p = entry.process;
  const hasIdentity = p.pid > 0 && p.created > 0;
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
            {hasIdentity && (
              <>
                <dt>{t("startedAt")}</dt>
                <dd>
                  {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  }).format(p.created)}
                </dd>
              </>
            )}
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
          {hasIdentity && (
            <ProcessContext
              key={identityKey(p)}
              pid={p.pid}
              created={p.created}
            />
          )}
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
