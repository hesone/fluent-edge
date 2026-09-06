"use client";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from "react-icons/lu";

type Tone = "error" | "warning" | "success" | "info";

const TONE = {
  error: { cls: "border-danger/30 bg-danger-soft", title: "text-danger", Icon: LuCircleAlert },
  warning: { cls: "border-warning/30 bg-warning-soft", title: "text-warning", Icon: LuTriangleAlert },
  success: { cls: "border-accent-text/30 bg-accent-soft", title: "text-accent-text", Icon: LuCircleCheck },
  info: { cls: "border-line bg-surface-2", title: "text-fg", Icon: LuInfo },
} as const;

export interface AlertProps {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  /** Set false for a message that is on screen from the start and needn't be announced. */
  live?: boolean;
}

/**
 * Messages that must actually reach the user.
 *
 * The previous build rendered errors as a plain <p>, so a screen-reader user
 * got no notification at all when question generation failed. Errors here are
 * `role="alert"` (interrupts) and everything else is `role="status"` (waits for
 * a pause). Every tone carries an icon as well as a colour, so the meaning
 * survives without colour vision.
 */
export default function Alert({
  tone = "info", title, children, className = "", live = true,
}: AlertProps) {
  const { cls, title: titleCls, Icon } = TONE[tone];
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      aria-live={live ? (tone === "error" ? "assertive" : "polite") : undefined}
      className={`flex gap-3 rounded-xl border p-4 ${cls} ${className}`}
    >
      <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${titleCls}`} />
      <div className="min-w-0 flex-1">
        {title && <p className={`font-semibold ${titleCls}`}>{title}</p>}
        {children && (
          <div className={`text-sm ${title ? "mt-0.5 text-fg-muted" : "text-fg"}`}>{children}</div>
        )}
      </div>
    </div>
  );
}
