import localFont from "next/font/local";

// Display faces, one per direction. Self-hosted like the others, so nothing
// here breaks an offline build. Only the winning direction's face is kept —
// the other two files get deleted once you've picked.
const spaceGrotesk = localFont({
  src: "../../../fonts/space-grotesk-var.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-grotesk",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const fraunces = localFont({
  src: "../../../fonts/fraunces-var.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-fraunces",
  fallback: ["ui-serif", "Georgia", "serif"],
});

const outfit = localFont({
  src: "../../../fonts/outfit-var.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-outfit",
  fallback: ["ui-rounded", "ui-sans-serif", "system-ui", "sans-serif"],
});

export default function DirectionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${fraunces.variable} ${outfit.variable}`}>
      {children}
    </div>
  );
}
