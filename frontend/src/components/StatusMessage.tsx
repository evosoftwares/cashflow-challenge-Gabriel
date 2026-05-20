import type { ReactNode } from "react";

type StatusMessageProps = {
  tone: "success" | "warning" | "error" | "info";
  children: ReactNode;
};

export function StatusMessage({ tone, children }: StatusMessageProps) {
  return (
    <div className={`status-message status-message--${tone}`} role="status">
      <span className="status-message__dot" aria-hidden="true" />
      {children}
    </div>
  );
}
