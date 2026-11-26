import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

export function SelectControl(props: ComponentPropsWithoutRef<"select">) {
  return (
    <span className="select-control">
      <select {...props} />
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  );
}
