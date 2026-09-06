import AppHeader, { type AppHeaderProps } from "./AppHeader";

export interface PageShellProps extends AppHeaderProps {
  /** The page's one h1. Pass `titleSrOnly` when the design shows it another way. */
  title: React.ReactNode;
  titleSrOnly?: boolean;
  /** Small tracked label above the title — a Studio signature. */
  eyebrow?: string;
  /** Outlined step numeral beside the title. Decorative. */
  step?: string;
  lead?: string;
  width?: "narrow" | "wide";
  /** Hero pages get the large display treatment; inner pages stay compact. */
  size?: "hero" | "compact";
  children: React.ReactNode;
}

/**
 * Consistent page frame: header, a single h1, and the main landmark the skip
 * link targets.
 */
export default function PageShell({
  title, titleSrOnly, eyebrow, step, lead, width = "narrow", size = "compact",
  backHref, backLabel, children,
}: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader backHref={backHref} backLabel={backLabel} />
      <main
        id="main"
        tabIndex={-1}
        className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 ${
          width === "wide" ? "max-w-6xl" : "max-w-3xl"
        }`}
      >
        {!titleSrOnly && (
          <div className="flex items-start gap-4 sm:gap-6">
            {step && (
              <span aria-hidden className="stepnum hidden text-6xl font-medium sm:block sm:text-7xl">
                {step}
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
              <h1
                className={
                  size === "hero"
                    ? "text-4xl font-medium leading-[0.98] sm:text-5xl"
                    : "text-3xl font-medium sm:text-4xl"
                }
              >
                {title}
              </h1>
              {lead && <p className="mt-4 max-w-xl text-fg-muted">{lead}</p>}
            </div>
          </div>
        )}
        {titleSrOnly && <h1 className="sr-only">{title}</h1>}
        <div className={titleSrOnly ? "" : "mt-10"}>{children}</div>
      </main>
    </div>
  );
}
