import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
export function LocalizedClose(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { t } = useTranslation();
  return (
    <button {...props} aria-label={t("close")}>
      <X size={17} />
    </button>
  );
}
