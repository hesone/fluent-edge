"use client";
import { useState } from "react";
import { LuMic, LuPencil, LuRefreshCcw, LuVolume2 } from "react-icons/lu";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import Dialog from "@/components/ui/Dialog";
import { TextArea, TextField } from "@/components/ui/Field";
import FileDrop from "@/components/ui/FileDrop";
import Progress from "@/components/ui/Progress";
import ScoreTile from "@/components/ui/ScoreTile";
import { SkeletonText } from "@/components/ui/Skeleton";
import ThemeToggle from "@/components/ui/ThemeToggle";

/**
 * Design preview — not part of the product; delete before release.
 *
 * Every primitive the app is built from, in one place, so the visual direction,
 * the contrast and the interaction states can be reviewed together. Toggle the
 * theme in the header, and tab through the page to check focus and the arrow
 * key behaviour of the choice groups.
 */
export default function DesignPreview() {
  return (
    <main id="main" className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-xl font-bold">FluentEdge design preview</h1>
            <p className="text-sm text-fg-muted">Phases 1–2 — tokens, type and primitives</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-16 px-5 py-12">
        <Palette />
        <Typography />
        <Buttons />
        <Choices />
        <Fields />
        <Messages />
        <Scores />
        <Overlay />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Section({ title, hint, children }: {
  title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {hint && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className, note }: { name: string; className: string; note: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className={`h-14 w-full ${className}`} />
      <div className="px-3 py-2">
        <div className="font-mono text-xs font-semibold">{name}</div>
        <div className="text-2xs text-fg-muted">{note}</div>
      </div>
    </div>
  );
}

function Palette() {
  return (
    <Section
      title="Colour"
      hint="Near-black and acid lime. Lime is a surface colour, never text — it carries near-black at 15.3:1 in both themes, and gets a 2px edge in light mode where lime-on-canvas is only 1.14:1. Lime also doubles as the \u201cstrong\u201d score band, so there is no second green."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Swatch name="canvas" className="bg-canvas border-b border-line" note="page background" />
        <Swatch name="surface" className="bg-surface border-b border-line" note="cards, panels" />
        <Swatch name="surface-2" className="bg-surface-2" note="inset, muted areas" />
        <Swatch name="line-strong" className="bg-line-strong" note="interactive boundary, 3.6:1" />
        <Swatch name="accent" className="bg-accent" note="primary action + strong" />
        <Swatch name="accent-soft" className="bg-accent-soft" note="selected state" />
        <Swatch name="fg" className="bg-fg" note="body text, 16.8:1" />
        <Swatch name="fg-muted" className="bg-fg-muted" note="secondary text, 5.8:1" />
        <Swatch name="accent-text" className="bg-accent-text" note="lime as text (light: olive)" />
        <Swatch name="warning" className="bg-warning" note="score 50–79" />
        <Swatch name="danger" className="bg-danger" note="score < 50, errors" />
        <Swatch name="focus" className="bg-focus" note="focus ring, 3:1+" />
      </div>
    </Section>
  );
}

function Typography() {
  return (
    <Section
      title="Type"
      hint="Space Grotesk for headings, Inter for text, Vazirmatn for the Arabic script used by Farsi — all self-hosted, so offline builds keep working. Farsi headings fall back to Vazirmatn rather than to a random system serif."
    >
      <Card pad="lg" className="space-y-4">
        <p className="text-4xl font-bold">Tell me about yourself</p>
        <p className="text-2xl font-bold">Tell me about yourself</p>
        <p className="text-xl font-semibold">Tell me about yourself</p>
        <p className="text-base">
          I&apos;ve spent the last four years building data pipelines, most recently at a
          logistics company where I owned the ingestion layer end to end.
        </p>
        <p className="text-sm text-fg-muted">
          Secondary text — hints, captions and helper copy sit here at 5.8:1.
        </p>
        <p className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">Overline label</p>
        <hr className="border-line" />
        <p dir="rtl" lang="fa" className="font-arabic text-xl">کمی درباره‌ی خودت بگو</p>
        <p dir="rtl" lang="fa" className="font-arabic text-base text-fg-muted">
          چهار سال گذشته را صرف ساخت خطوط داده کرده‌ام.
        </p>
      </Card>
    </Section>
  );
}

function Buttons() {
  const [busy, setBusy] = useState(false);
  return (
    <Section
      title="Buttons"
      hint="Disabled uses a token colour rather than opacity, so the label stays readable. Loading keeps focus and its accessible name instead of dropping focus to the body."
    >
      <Card pad="md" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Start my practice session</Button>
          <Button variant="secondary">Edit answer</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Stop recording</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Building your session…</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" iconOnly aria-label="Read the answer aloud">
            <LuVolume2 aria-hidden className="h-4 w-4" />
          </Button>
          <Button variant="secondary" iconOnly aria-label="Edit this answer">
            <LuPencil aria-hidden className="h-4 w-4" />
          </Button>
          <Button variant="secondary" iconOnly aria-label="Regenerate this answer">
            <LuRefreshCcw aria-hidden className="h-4 w-4" />
          </Button>
          <Button size="lg" loading={busy}
            onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1600); }}>
            {!busy && <LuMic aria-hidden className="h-4 w-4" />}
            {busy ? "Listening…" : "Start recording"}
          </Button>
          <span className="text-sm text-fg-muted">← click to see the loading state</span>
        </div>
      </Card>
    </Section>
  );
}

function Choices() {
  const [conv, setConv] = useState("workspace");
  const [lang, setLang] = useState("en");
  const [level, setLevel] = useState("b2");
  return (
    <Section
      title="Choice groups"
      hint="One tab stop per group; arrow keys move within it and respect RTL. Announced as “Workspace, radio button, 1 of 2”. Selection is marked with a check and a heavier border, not colour alone."
    >
      <Card pad="lg" className="space-y-8">
        <ChoiceGroup
          legend="Conversation type"
          value={conv}
          onChange={setConv}
          columns={2}
          options={[
            { value: "workspace", label: "Workspace", icon: "💼", description: "Interviews and professional conversation" },
            { value: "general", label: "General", icon: "🌞", description: "Everyday situations and small talk" },
          ]}
        />
        <ChoiceGroup
          legend="Practice language"
          variant="tile"
          columns={5}
          value={lang}
          onChange={setLang}
          options={[
            { value: "en", label: "English", icon: "🇬🇧" },
            { value: "de", label: "Deutsch", icon: "🇩🇪" },
            { value: "fr", label: "Français", icon: "🇫🇷" },
            { value: "es", label: "Español", icon: "🇪🇸" },
            { value: "fa", label: "فارسی", icon: "🇮🇷" },
          ]}
        />
        <ChoiceGroup
          legend="Language level"
          hint="The CEFR level you want the questions pitched at."
          variant="compact"
          columns={6}
          value={level}
          onChange={setLevel}
          options={["a1", "a2", "b1", "b2", "c1", "c2"].map((v) => ({
            value: v, label: v.toUpperCase(),
          }))}
        />
      </Card>
    </Section>
  );
}

function Fields() {
  const [situation, setSituation] = useState("");
  const [file, setFile] = useState<string>();
  return (
    <Section
      title="Fields"
      hint="Labels, hints and errors are wired to the control with generated ids — the old markup had labels associated with nothing at all."
    >
      <Card pad="lg" className="space-y-6">
        <TextField
          label="Situation"
          hint="Describe where you want to practise — a café, a stand-up, a visa appointment."
          placeholder="Ordering at a busy café"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
        />
        <TextField
          label="Situation"
          error="Tell us a little about the situation before continuing."
          placeholder="Ordering at a busy café"
        />
        <TextArea
          label="Your answer"
          hint="Leave this blank and the AI writes one for you."
          rows={4}
          placeholder="I usually start by…"
        />
        <FileDrop
          label="Upload your résumé"
          hint="Used to make the interview questions specific to your experience."
          fileName={file}
          status={file ? "Résumé read — 2,481 characters extracted." : undefined}
          onFile={(f) => setFile(f.name)}
        />
      </Card>
    </Section>
  );
}

function Messages() {
  return (
    <Section
      title="Messages"
      hint="Errors are assertive live regions, everything else polite. Each tone carries an icon as well as a colour."
    >
      <div className="space-y-3">
        <Alert tone="error" title="Couldn't build your session">
          Check your OpenRouter key and connection, then try again.
        </Alert>
        <Alert tone="warning" title="Speech recognition is limited in this browser">
          Chrome or Edge gives the most reliable transcription.
        </Alert>
        <Alert tone="success" title="Résumé read">
          2,481 characters extracted.
        </Alert>
        <Card pad="sm">
          <div className="mb-3 text-2xs font-semibold uppercase tracking-wider text-fg-muted">
            Loading skeleton
          </div>
          <SkeletonText lines={4} label="Writing an example answer…" />
        </Card>
      </div>
    </Section>
  );
}

function Scores() {
  return (
    <Section
      title="Scores and progress"
      hint="Each tile states its band in words as well as colour, and is read as “Grammar: 64 out of 100, Fair”. Numbers use tabular figures so they stop jittering as they update."
    >
      <div className="grid grid-cols-3 gap-3">
        <ScoreTile label="Delivery" value={88} />
        <ScoreTile label="Grammar" value={64} />
        <ScoreTile label="Pronunciation" value={41} />
      </div>
      <Card pad="md">
        <Progress current={2} total={6} />
      </Card>
    </Section>
  );
}

function Overlay() {
  const [open, setOpen] = useState(false);
  return (
    <Section
      title="Dialog"
      hint="Built on the native dialog element, so the focus trap, Escape, page inertness and focus restore are real. Open it, press Escape, and check focus returns to the button."
    >
      <Card pad="md">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open replay dialog
        </Button>
      </Card>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Replay with scores"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={() => setOpen(false)}>Practise again</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-surface-2 text-sm text-fg-muted">
            Recording would play here
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ScoreTile label="Delivery" value={88} />
            <ScoreTile label="Grammar" value={64} />
            <ScoreTile label="Combined" value={76} emphasis />
          </div>
        </div>
      </Dialog>
    </Section>
  );
}
