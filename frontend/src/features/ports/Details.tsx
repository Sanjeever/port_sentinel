import { Button, Modal, ModalContent, ModalHeader } from "@heroui/react";
import { Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Entry, ProcessDetails } from "../../desktop/types";
import { backend } from "../../desktop/api";
import { identityKey } from "./list";
import { LocalizedClose } from "../../components/LocalizedClose";
import { Feedback } from "../../components/Feedback";

const wideInspector = "(min-width: 1120px)";

function RelatedEndpoint({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  return (
    <li className="connection-detail">
      <span className="mono">{entry.local || entry.port}</span>
      <span className="endpoint-meta">
        <span>{entry.protocol}</span>
        <span>
          {t(`state_${entry.state}`, { defaultValue: entry.state || "—" })}
        </span>
      </span>
      {entry.remote && (
        <span className="mono muted connection-remote">
          {t("remote")} {entry.remote}
        </span>
      )}
    </li>
  );
}

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
        <dl className="process-context-fields">
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
  const [wide, setWide] = useState(
    () => window.matchMedia(wideInspector).matches,
  );
  const close = useRef<HTMLButtonElement>(null);
  const entryId = entry?.id;
  useEffect(() => {
    const media = window.matchMedia(wideInspector);
    const resize = () => setWide(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (wide && entryId !== undefined)
      close.current?.focus({ preventScroll: true });
  }, [wide, entryId]);

  if (!entry) return null;
  const current = entries.find((candidate) => candidate.id === entry.id);
  const endpoint = current ?? entry;
  const p = endpoint.process;
  const hasIdentity = p.pid > 0 && p.created > 0;
  const related = hasIdentity
    ? entries.filter(
        (candidate) =>
          candidate.id !== endpoint.id &&
          identityKey(candidate.process) === identityKey(p),
      )
    : [];
  const title = endpoint.local || String(endpoint.port);
  const copyEndpoint = (
    <Button
      isIconOnly
      variant="light"
      size="sm"
      disableRipple
      aria-label={t("copyLocal")}
      title={t("copyLocal")}
      isDisabled={!endpoint.local}
      onPress={() => run(() => backend().Copy(endpoint.local))}
    >
      <Copy size={14} aria-hidden="true" />
    </Button>
  );
  const content = (
    <>
      <div className="inspector-section endpoint-overview">
        <div className="inspector-process">
          <strong>
            {p.name || t(p.status === "no_pid" ? "no_pid" : "unreadable")}
          </strong>
          {p.pid > 0 && (
            <>
              <span className="mono muted">PID {p.pid}</span>
              <Button
                isIconOnly
                variant="light"
                size="sm"
                disableRipple
                aria-label={t("copyPID")}
                title={t("copyPID")}
                onPress={() => run(() => backend().Copy(String(p.pid)))}
              >
                <Copy size={14} aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
        <p className="endpoint-meta">
          <span>{endpoint.protocol}</span>
          <span>
            {t(`state_${endpoint.state}`, {
              defaultValue: endpoint.state || "—",
            })}
          </span>
        </p>
        {endpoint.remote && (
          <dl className="details-grid">
            <dt>{t("remote")}</dt>
            <dd className="mono">{endpoint.remote}</dd>
          </dl>
        )}
        {!current && (
          <p className="muted" role="status">
            {t("endpointMissing")}
          </p>
        )}
      </div>
      {related.length > 0 && (
        <section className="inspector-section">
          <h3>{t("related")}</h3>
          <ul className="related-endpoints" role="list">
            {related.slice(0, 3).map((connection) => (
              <RelatedEndpoint key={connection.id} entry={connection} />
            ))}
          </ul>
          {related.length > 3 && (
            <details className="more-endpoints" key={identityKey(p)}>
              <summary>
                {t("moreConnections", { count: related.length - 3 })}
              </summary>
              <ul className="related-endpoints" role="list">
                {related.slice(3).map((connection) => (
                  <RelatedEndpoint key={connection.id} entry={connection} />
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <section className="inspector-section">
        <h3>{t("processInfo")}</h3>
        <dl className="process-path">
          <dt>{t("path")}</dt>
          <dd className="detail-value-action">
            <span className={p.path ? "path" : undefined}>
              {p.path ||
                t(
                  p.pathStatus === "available"
                    ? "pathUnavailable"
                    : p.pathStatus,
                )}
            </span>
            {p.path && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                disableRipple
                aria-label={t("copyPath")}
                title={t("copyPath")}
                onPress={() => run(() => backend().Copy(p.path))}
              >
                <Copy size={14} aria-hidden="true" />
              </Button>
            )}
          </dd>
        </dl>
        <dl className="details-grid">
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
      </section>
    </>
  );

  if (wide) {
    return (
      <aside
        className="inspector"
        aria-labelledby="inspector-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="inspector-header">
          <div className="endpoint-title">
            <h2 className="mono" id="inspector-title">
              {title}
            </h2>
            {copyEndpoint}
          </div>
          <Button
            ref={close}
            isIconOnly
            variant="light"
            size="sm"
            disableRipple
            aria-label={t("close")}
            onPress={onClose}
          >
            <X size={17} aria-hidden="true" />
          </Button>
        </header>
        <div className="inspector-body">{content}</div>
      </aside>
    );
  }

  return (
    <Modal
      closeButton={<LocalizedClose />}
      isOpen
      onClose={onClose}
      disableAnimation
      placement="center"
      scrollBehavior="inside"
      classNames={{
        wrapper: "detail-wrapper",
        base: "detail-panel",
      }}
    >
      <ModalContent>
        <header className="inspector-header">
          <div className="endpoint-title">
            <ModalHeader as="h2" className="mono">
              {title}
            </ModalHeader>
            {copyEndpoint}
          </div>
        </header>
        <div className="inspector-body">{content}</div>
      </ModalContent>
    </Modal>
  );
}
