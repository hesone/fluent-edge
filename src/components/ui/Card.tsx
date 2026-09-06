import { forwardRef } from "react";

type Tone = "default" | "accent";
type Pad = "none" | "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  default: "border-line bg-surface",
  accent: "border-accent-text/30 bg-accent-soft",
};

const PAD: Record<Pad, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-6 sm:p-8",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  pad?: Pad;
  /** Renders as <section>; pass a heading id to label it for assistive tech. */
  as?: "div" | "section" | "article";
}

/** The shared panel shell. One place to change the app's surface treatment. */
const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = "default", pad = "md", as: Tag = "div", className = "", ...rest },
  ref
) {
  return (
    <Tag
      ref={ref as never}
      className={`rounded-2xl border ${TONE[tone]} ${PAD[pad]} ${className}`}
      {...rest}
    />
  );
});

export default Card;
