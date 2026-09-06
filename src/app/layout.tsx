import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import DocumentLanguage from "@/components/DocumentLanguage";
import { themeInitScript } from "@/lib/theme";

// Self-hosted variable fonts: no network call at build or at run time, so the
// offline/local mode keeps working. Inter covers Latin; Vazirmatn covers the
// Arabic script used by Farsi.
const sans = localFont({
  src: "../fonts/inter-latin-var.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// Display face for headings — the Studio direction's voice.
const display = localFont({
  src: "../fonts/space-grotesk-var.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-display",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const arabic = localFont({
  src: "../fonts/vazirmatn-arabic-var.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-arabic",
  fallback: ["Tahoma", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "FluentEdge — AI language practice",
    template: "%s · FluentEdge",
  },
  description:
    "Practise interviews and everyday conversation in English, German, French, Spanish or Farsi, with instant feedback on grammar, pronunciation and delivery.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#101012" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` and `dir` are a starting point only — DocumentLanguage updates them
    // to match the chosen practice language once the store has hydrated.
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${sans.variable} ${display.variable} ${arabic.variable} font-sans`}>
        {/* Glow + grain, fixed behind every route. */}
        <div aria-hidden className="app-bg" />
        <a href="#main" className="sr-only-focusable">
          Skip to main content
        </a>
        <DocumentLanguage />
        {children}
      </body>
    </html>
  );
}
