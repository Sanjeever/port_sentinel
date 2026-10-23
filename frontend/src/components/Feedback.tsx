import { useTranslation } from "react-i18next";
import type { Fault } from "../desktop/types";
export function Feedback({ error }: { error: Fault | string | null }) {
  const { t, i18n } = useTranslation();
  if (!error) return null;
  const code = typeof error === "string" ? error : error.code;
  const known = i18n.exists(code);
  const detail =
    typeof error === "string" ? (known ? "" : error) : error.detail;
  return (
    <div className="feedback" role="alert">
      <span>{t(known ? code : "system_error")}</span>
      {detail && (
        <details>
          <summary>{t("errorDetails")}</summary>
          <pre>{detail}</pre>
        </details>
      )}
    </div>
  );
}
