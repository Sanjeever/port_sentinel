import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
export function LocalizedClose({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      {...props}
      className={`dialog-close ${className ?? ""}`}
      aria-label={t("close")}
    >
      <X size={17} aria-hidden="true" />
    </button>
  );
}
