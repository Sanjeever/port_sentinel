import { Button } from "@heroui/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Identity, ProcessResult } from "../../desktop/types";
import { identityKey } from "./list";

export function ProcessResults({
  results,
  canForce,
  busy,
  onClose,
  onForce,
}: {
  results: ProcessResult[];
  canForce: Identity[];
  busy: boolean;
  onClose: () => void;
  onForce: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <section className="results-panel" aria-label={t("results")}>
      <div className="results-heading">
        <h2>{t("results")}</h2>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label={t("close")}
          onPress={onClose}
        >
          <X size={15} />
        </Button>
      </div>
      <ul>
        {results.map((r) => (
          <li key={identityKey(r.target)}>
            <span>
              {r.target.name || t("unreadable")}{" "}
              <span className="mono">· {r.target.pid}</span>
            </span>
            <span className={r.status === "exited" ? "muted" : "danger-text"}>
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
          isDisabled={busy}
          onPress={onForce}
        >
          {t("force")}
        </Button>
      )}
    </section>
  );
}
