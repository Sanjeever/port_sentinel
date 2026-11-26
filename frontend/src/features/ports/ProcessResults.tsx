import { Button } from "@heroui/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  EndpointResult,
  Identity,
  ProcessResult,
} from "../../desktop/types";
import { identityKey } from "./list";

export function ProcessResults({
  results,
  endpoints,
  canForce,
  busy,
  onClose,
  onForce,
}: {
  results: ProcessResult[];
  endpoints: EndpointResult[];
  canForce: Identity[];
  busy: boolean;
  onClose: () => void;
  onForce: () => void;
}) {
  const { t, i18n } = useTranslation();
  const exited = results.filter((result) => result.status === "exited").length;
  const unseen = endpoints.filter(
    (endpoint) => endpoint.status === "binding_unseen",
  ).length;
  const unconfirmed = endpoints.filter(
    (endpoint) =>
      endpoint.status === "visibility_changed" ||
      endpoint.status === "recheck_failed",
  ).length;
  return (
    <section className="results-panel" aria-labelledby="operation-results">
      <div className="results-heading">
        <h2 id="operation-results">{t("results")}</h2>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          disableRipple
          aria-label={t("close")}
          onPress={onClose}
        >
          <X size={15} aria-hidden="true" />
        </Button>
      </div>
      <div
        className="results-body"
        data-recheck={endpoints.length > 0}
        tabIndex={0}
        role="group"
        aria-labelledby="operation-results"
      >
        <div className="results-group">
          <header className="results-summary">
            <h3>{t("processOutcome")}</h3>
            <p>{t("processSummary", { exited, count: results.length })}</p>
          </header>
          <ul className="process-outcomes" role="list">
            {results.map((r) => (
              <li key={identityKey(r.target)}>
                <span className="target-identity">
                  <strong>{r.target.name || t("unreadable")}</strong>
                  <span className="mono muted">PID {r.target.pid}</span>
                </span>
                <span
                  className={r.status === "exited" ? "muted" : "danger-text"}
                >
                  {t(i18n.exists(r.status) ? r.status : "system_error")}
                </span>
                {r.detail && (
                  <details>
                    <summary>{t("errorDetails")}</summary>
                    <pre>{r.detail}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {canForce.length > 0 && (
            <Button
              size="sm"
              color="danger"
              variant="flat"
              disableRipple
              isDisabled={busy}
              onPress={onForce}
            >
              {t("force")}
            </Button>
          )}
        </div>
        {endpoints.length > 0 && (
          <div className="results-group">
            <header className="results-summary">
              <h3>{t("endpointRecheck")}</h3>
              <p>{t("endpointSummary", { unseen, count: endpoints.length })}</p>
              {unconfirmed > 0 && (
                <p>{t("recheckUnconfirmed", { count: unconfirmed })}</p>
              )}
            </header>
            <dl className="endpoint-results">
              {endpoints.map((endpoint) => (
                <div key={`${endpoint.protocol}:${endpoint.local}`}>
                  <dt>
                    <span>{endpoint.protocol}</span>
                    <span className="mono">{endpoint.local}</span>
                  </dt>
                  <dd>
                    {endpoint.bindings.length === 0 ? (
                      <span className="muted">{t(endpoint.status)}</span>
                    ) : (
                      <ul role="list">
                        {endpoint.bindings.map(({ local, process, status }) => (
                          <li key={`${local}:${identityKey(process)}`}>
                            <span>{t(status)}</span>
                            {process.pid > 0 && (
                              <span className="endpoint-owner">
                                {process.name && <span>{process.name}</span>}
                                <span className="mono muted">
                                  PID {process.pid}
                                </span>
                              </span>
                            )}
                            {local !== endpoint.local && (
                              <span className="mono muted">{local}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
