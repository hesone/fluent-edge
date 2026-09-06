"use client";
import { useState } from "react";
import DirectionStyles from "./styles";

/**
 * Three visual directions, same content in each, so the comparison is fair.
 *
 * Not part of the product. Each is shown in its native mode — Studio is
 * dark-first, the other two light-first; the winner gets the full two-theme
 * token treatment afterwards.
 */
export default function Directions() {
  return (
    <main id="main" style={{ background: "#EFEDEA", minHeight: "100vh" }}>
      <DirectionStyles />

      <header className="mx-auto max-w-6xl px-5 pb-2 pt-10">
        <h1 className="text-3xl font-bold text-[#16120E]">Three directions</h1>
        <p className="mt-2 max-w-2xl text-[#5A544D]">
          The same screen, three points of view. Each is a real, contrast-checked
          treatment rather than a mood board — colour, type, depth, layout and motion
          all change together. Pick one and it becomes the token set.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-14 px-5 py-10">
        <Board
          letter="A"
          name="Studio"
          idea="Dark, cinematic, voice-first. Your own speech is the recurring graphic — a live waveform runs through the whole product. Acid lime on near-black, oversized grotesk, glow and film grain for depth."
          feels="Closest to: Linear, Arc, a recording booth."
        >
          <StudioPanel />
        </Board>

        <Board
          letter="B"
          name="Editorial"
          idea="Light, typographic, no cards anywhere. Hierarchy comes from scale, hairline rules and space instead of boxes. A high-contrast serif at display size, options as rows you underline rather than tiles you tick."
          feels="Closest to: a well-set magazine, Stripe's long-form pages."
        >
          <EditorialPanel />
        </Board>

        <Board
          letter="C"
          name="Soft"
          idea="Warm, tactile and encouraging. Gradient light in the background, chunky rounded shapes, coloured shadows instead of grey ones, and springy motion on every press. Built to lower the stakes for someone about to speak on camera."
          feels="Closest to: Duolingo, Headspace."
        >
          <SoftPanel />
        </Board>
      </div>
    </main>
  );
}

function Board({
  letter, name, idea, feels, children,
}: { letter: string; name: string; idea: string; feels: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded bg-[#16120E] px-2 py-0.5 text-xs font-bold text-white">{letter}</span>
        <h2 className="text-2xl font-bold text-[#16120E]">{name}</h2>
        <span className="text-sm text-[#5A544D]">{feels}</span>
      </div>
      <p className="mb-5 max-w-3xl text-[#3D3833]">{idea}</p>
      <div className="artboard overflow-hidden rounded-2xl shadow-[0_30px_60px_-30px_rgba(0,0,0,.45)] ring-1 ring-black/10">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const CONV = [
  { v: "workspace", em: "💼", t: "Workspace", d: "Interviews and professional conversation" },
  { v: "general", em: "🌞", t: "General", d: "Everyday situations and small talk" },
];
const LANGS = [
  { v: "en", f: "🇬🇧", t: "English" }, { v: "de", f: "🇩🇪", t: "Deutsch" },
  { v: "fr", f: "🇫🇷", t: "Français" }, { v: "es", f: "🇪🇸", t: "Español" },
  { v: "fa", f: "🇮🇷", t: "فارسی" },
];

function StudioPanel() {
  const [conv, setConv] = useState("workspace");
  const [lang, setLang] = useState("en");
  return (
    <div className="dir dirA" style={{ padding: "clamp(1.75rem,4cqw,3.5rem)" }}>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
        <div className="lg:w-[52%]">
          <div className="flex items-start gap-5">
            <span aria-hidden className="step">01</span>
            <div className="pt-2">
              <p className="eyebrow">Set up · 30 seconds</p>
              <h3>Speak it until it <em>sounds like you.</em></h3>
            </div>
          </div>
          <p className="sub">
            Six questions, your camera, and a read on how you actually come across —
            pace, grammar, eye contact. Nothing is recorded until you press start.
          </p>

          <div aria-hidden className="wave mt-9">
            {Array.from({ length: 44 }, (_, i) => (
              <i key={i} style={{
                animationDelay: `${(i % 11) * 0.09}s`,
                opacity: 0.35 + Math.abs(Math.sin(i * 0.7)) * 0.65,
              }} />
            ))}
          </div>

          <button className="cta mt-9">
            Start my session
            <span aria-hidden>→</span>
          </button>
          <p className="sub" style={{ fontSize: ".85rem", marginTop: ".9rem" }}>
            You&apos;ll review the questions first.
          </p>
        </div>

        <div className="flex-1 space-y-7">
          <fieldset>
            <legend className="eyebrow mb-3">Conversation type</legend>
            <div role="radiogroup" aria-label="Conversation type" className="grid gap-3">
              {CONV.map((o) => (
                <button key={o.v} role="radio" aria-checked={conv === o.v}
                  tabIndex={conv === o.v ? 0 : -1}
                  onClick={() => setConv(o.v)} className="opt">
                  <span aria-hidden style={{ fontSize: "1.4rem" }}>{o.em}</span>
                  <b>{o.t}</b>
                  <span>{o.d}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-3">Language</legend>
            <div role="radiogroup" aria-label="Language" className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <button key={l.v} role="radio" aria-checked={lang === l.v}
                  tabIndex={lang === l.v ? 0 : -1}
                  onClick={() => setLang(l.v)} className="chip">
                  <span aria-hidden className="me-1.5">{l.f}</span>{l.t}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="panel grid grid-cols-3 gap-4 p-5">
            {[["88", "Delivery"], ["91", "Grammar"], ["90", "Overall"]].map(([v, k]) => (
              <p key={k} className="metric"><b>{v}</b><span>{k}</span></p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorialPanel() {
  const [conv, setConv] = useState("workspace");
  const [lang, setLang] = useState("en");
  return (
    <div className="dir dirB" style={{ padding: "clamp(1.75rem,4cqw,3.75rem)" }}>
      <div className="grid gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div>
          <p className="eyebrow">FluentEdge — Session set-up</p>
          <h3>
            Practise the <mark>hard questions</mark> before they&apos;re asked.
          </h3>
          <p className="sub">
            Six questions written for your rôle and your level. You answer out loud, on
            camera, and get a read on grammar, pronunciation and delivery — the parts
            you can&apos;t hear yourself.
          </p>
          <button className="cta mt-9">Start my session →</button>
          <p className="sub" style={{ fontSize: ".88rem", marginTop: "1rem" }}>
            You&apos;ll review the questions first. Nothing is recorded until you choose to start.
          </p>

          <div className="mt-12 flex gap-10 border-t pt-6" style={{ borderColor: "var(--rule)" }}>
            {[["88", "Delivery"], ["91", "Grammar"], ["90", "Overall"]].map(([v, k]) => (
              <p key={k} className="metric"><b>{v}</b><span>{k}</span></p>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          <fieldset>
            <div className="flex items-baseline gap-4">
              <span aria-hidden className="num">01</span>
              <legend className="lbl">Conversation type</legend>
            </div>
            <div role="radiogroup" aria-label="Conversation type" className="mt-2">
              {CONV.map((o, i) => (
                <button key={o.v} role="radio" aria-checked={conv === o.v}
                  tabIndex={conv === o.v ? 0 : -1}
                  onClick={() => setConv(o.v)} className="row">
                  <span aria-hidden className="k">{String(i + 1).padStart(2, "0")}</span>
                  <span className="t">{o.t}</span>
                  <span className="d">{o.d}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-baseline gap-4">
              <span aria-hidden className="num">02</span>
              <legend className="lbl">Language</legend>
            </div>
            <div role="radiogroup" aria-label="Language" className="mt-3 flex flex-wrap gap-x-6">
              {LANGS.map((l) => (
                <button key={l.v} role="radio" aria-checked={lang === l.v}
                  tabIndex={lang === l.v ? 0 : -1}
                  onClick={() => setLang(l.v)} className="tag">
                  {l.t}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

function SoftPanel() {
  const [conv, setConv] = useState("workspace");
  const [lang, setLang] = useState("en");
  return (
    <div className="dir dirC" style={{ padding: "clamp(1.75rem,4cqw,3.5rem)" }}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
        <div>
          <p className="eyebrow">✦ 30 seconds to set up</p>
          <h3>Get comfortable <em>saying it out loud.</em></h3>
          <p className="sub">
            Six questions, at your level. Answer them on camera and we&apos;ll tell you
            what landed — kindly, and with something to fix next time.
          </p>
          <button className="cta mt-8">
            Start my session
            <span aria-hidden>→</span>
          </button>
          <p className="sub" style={{ fontSize: ".88rem", marginTop: ".9rem" }}>
            Nothing is recorded until you press start.
          </p>

          <div className="card mt-9 grid grid-cols-3 gap-4 p-5">
            {[["88", "Delivery"], ["91", "Grammar"], ["90", "Overall"]].map(([v, k]) => (
              <p key={k} className="metric"><b style={{ color: "var(--mint)" }}>{v}</b><span>{k}</span></p>
            ))}
          </div>
        </div>

        <div className="space-y-7">
          <fieldset>
            <legend className="mb-3 block text-sm font-bold" style={{ letterSpacing: ".02em" }}>
              What do you want to practise?
            </legend>
            <div role="radiogroup" aria-label="Conversation type" className="grid gap-3">
              {CONV.map((o) => (
                <button key={o.v} role="radio" aria-checked={conv === o.v}
                  tabIndex={conv === o.v ? 0 : -1}
                  onClick={() => setConv(o.v)} className="opt relative">
                  <span aria-hidden className="em">{o.em}</span>
                  <b>{o.t}</b>
                  <span>{o.d}</span>
                  {conv === o.v && <span aria-hidden className="tick">✓</span>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 block text-sm font-bold">Which language?</legend>
            <div role="radiogroup" aria-label="Language" className="grid grid-cols-5 gap-2">
              {LANGS.map((l) => (
                <button key={l.v} role="radio" aria-checked={lang === l.v}
                  tabIndex={lang === l.v ? 0 : -1}
                  onClick={() => setLang(l.v)} className="chip grid gap-1">
                  <span aria-hidden style={{ fontSize: "1.4rem" }}>{l.f}</span>
                  {l.t}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
