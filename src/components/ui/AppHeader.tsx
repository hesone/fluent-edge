"use client";
import Link from "next/link";
import { LuArrowLeft } from "react-icons/lu";
import ThemeToggle from "./ThemeToggle";

export interface AppHeaderProps {
  /** Where the back control goes. Omit on the first screen. */
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

/**
 * The shared header.
 *
 * Gives every route a consistent landmark, a way back (there was none once you
 * left onboarding), and the theme control. The wordmark is a link home rather
 * than decorative text.
 */
export default function AppHeader({ backHref, backLabel = "Back", children }: AppHeaderProps) {
  return (
    <header className="border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        {backHref ? (
          <Link
            href={backHref}
            className="-ms-2 flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium
                       text-fg-muted transition-colors duration-fast hover:bg-surface-2 hover:text-fg"
          >
            {/* flip-rtl mirrors the arrow so it points "back" in Farsi too */}
            <LuArrowLeft aria-hidden className="flip-rtl h-4 w-4" />
            {backLabel}
          </Link>
        ) : (
          <Link
            href="/"
            className="-ms-2 flex h-11 items-center rounded-lg px-2 text-lg font-bold tracking-tight
                       transition-colors duration-fast hover:bg-surface-2"
          >
            Fluent<span className="text-accent-text">Edge</span>
          </Link>
        )}
        <div className="ms-auto flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
