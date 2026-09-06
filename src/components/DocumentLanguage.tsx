"use client";
import { useEffect } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { isRTL, toBCP47 } from "@/lib/i18n";

/**
 * Keeps <html lang> and <html dir> in sync with the practice language.
 *
 * This matters more than it looks: assistive technology picks its speech
 * synthesiser from `lang`, so with the previous hardcoded `lang="en"` a screen
 * reader would read Farsi and German content with an English voice. `dir` also
 * belongs on <html> rather than on each <main>, so that scrollbars, text
 * selection and any portalled UI (dialogs) inherit the right direction.
 */
export default function DocumentLanguage() {
  const language = useSessionStore((s) => s.language);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = toBCP47(language);
    el.dir = isRTL(language) ? "rtl" : "ltr";
  }, [language]);

  return null;
}
