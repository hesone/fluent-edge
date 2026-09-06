"use client";
import { useEffect, useState } from "react";
import { LuMonitor, LuMoon, LuSun } from "react-icons/lu";
import { applyTheme, readStoredTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof LuSun }[] = [
  { value: "light", label: "Light", Icon: LuSun },
  { value: "dark", label: "Dark", Icon: LuMoon },
  { value: "system", label: "System", Icon: LuMonitor },
];

/**
 * Light / dark / system. Rendered as a real radio group so arrow keys move
 * between the options and a screen reader announces "Light, radio button,
 * 1 of 3" rather than three unrelated buttons.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setMounted(true);
  }, []);

  // When the preference is "system", follow the OS if it changes mid-session.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: the group is one tab stop, arrows move within it.
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" &&
                  e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
              const i = OPTIONS.findIndex((o) => o.value === theme);
              const next = OPTIONS[(i + dir + OPTIONS.length) % OPTIONS.length];
              choose(next.value);
              const group = e.currentTarget.parentElement;
              (group?.querySelectorAll("[role=radio]")[
                OPTIONS.indexOf(next)
              ] as HTMLElement | undefined)?.focus();
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-fast
              ${selected
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"}`}
          >
            <Icon aria-hidden className="h-4 w-4" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
