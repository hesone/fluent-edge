"use client";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  // The 2px accent-edge is what gives the lime button a perceivable boundary in
  // light mode, where lime-on-canvas is only 1.14:1. In dark mode the edge is
  // the lime itself, since the fill already clears 15:1 against the canvas.
  primary:
    "bg-accent text-accent-fg border-2 border-accent-edge shadow-sm " +
    "hover:brightness-105 active:translate-y-px",
  secondary:
    "bg-surface text-fg border-2 border-line-strong hover:border-fg hover:bg-surface-2 active:translate-y-px",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg border-2 border-transparent",
  danger:
    "bg-danger text-danger-fg border-2 border-danger shadow-sm hover:brightness-110 active:translate-y-px",
};

// Every size clears the 24px AA minimum target (WCAG 2.5.8); md and lg clear
// the 44px comfortable target.
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-13 px-7 text-base gap-2.5 rounded-full",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, marks the control busy and swallows repeat clicks. */
  loading?: boolean;
  /** Square, for a button whose only child is an icon. Still needs a label. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

/**
 * The one button in the app.
 *
 * Two decisions worth keeping:
 * - Disabled uses token colours, not `opacity-40`. Opacity drags the label
 *   below 4.5:1 and makes disabled states genuinely unreadable.
 * - A loading button is `aria-busy`/`aria-disabled` rather than `disabled`, so
 *   it keeps focus and its accessible name instead of dropping the user's
 *   focus to <body> mid-interaction.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconOnly = false,
    fullWidth = false,
    className = "",
    children,
    disabled,
    onClick,
    type = "button",
    ...rest
  },
  ref
) {
  const inert = Boolean(disabled) || loading;

  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      aria-busy={loading || undefined}
      aria-disabled={inert || undefined}
      disabled={Boolean(disabled) && !loading}
      onClick={(e) => {
        if (inert) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={[
        "relative inline-flex select-none items-center justify-center font-semibold",
        "transition-[background-color,color,transform,box-shadow] duration-fast ease-out",
        SIZE[size],
        iconOnly ? "aspect-square px-0" : "",
        fullWidth ? "w-full" : "",
        inert
          ? "cursor-not-allowed border-2 border-line bg-surface-2 text-fg-muted shadow-none active:translate-y-0"
          : VARIANT[variant],
        className,
      ].join(" ")}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
