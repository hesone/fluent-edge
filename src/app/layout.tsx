import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FluentEdge — AI English Coach",
  description: "Practice interviews & professional English with local AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}