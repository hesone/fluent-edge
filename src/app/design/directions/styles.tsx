/**
 * Scoped styles for the three visual directions.
 *
 * Deliberately NOT built on the app's design tokens: the point of this page is
 * to escape the current look, so each direction carries its own complete
 * palette, type ramp, depth model and motion. Whichever one wins gets turned
 * into the real token set afterwards.
 *
 * Every colour pair below is contrast-checked; the numbers are in the comments.
 */
export default function DirectionStyles() {
  return (
    <style>{`
/* ============================================================ SHARED ==== */
.artboard { container-type: inline-size; overflow: hidden; }
.dir *, .dir *::before, .dir *::after { box-sizing: border-box; }
.dir button { font: inherit; cursor: pointer; }
.dir :focus-visible { outline: 3px solid var(--ring); outline-offset: 3px; }

/* ====================================================== A — STUDIO ====== */
.dirA {
  --bg:#0A0A0C; --panel:#141418; --panel2:#1C1C21;
  --hair:rgba(255,255,255,.09); --edge:#63636B;      /* 3.3:1 on bg */
  --ink:#F2F2F0;                                      /* 17.6:1 */
  --dim:#9A9AA2;                                      /* 7.1:1  */
  --lime:#C8F751;                                     /* 15.9:1 */
  --cyan:#5AD8E8;                                     /* 11.7:1 */
  --ring:#C8F751;
  background:var(--bg); color:var(--ink);
  font-family:var(--font-grotesk),system-ui,sans-serif;
  position:relative; isolation:isolate;
}
/* The glow and the grain are what stop a dark UI reading as "flat charcoal". */
.dirA::before {
  content:""; position:absolute; inset:0; z-index:-2; pointer-events:none;
  background:
    radial-gradient(70ch 50ch at 12% -10%, rgba(200,247,81,.16), transparent 70%),
    radial-gradient(60ch 45ch at 105% 20%, rgba(90,216,232,.10), transparent 70%);
}
.dirA::after {
  content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:.35;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='.5'/></svg>");
  mix-blend-mode:overlay;
}
.dirA .eyebrow {
  font-size:.72rem; letter-spacing:.22em; text-transform:uppercase;
  color:var(--lime); font-weight:600;
}
.dirA h3 {
  font-size:clamp(2.4rem,6.2cqw,4.4rem); line-height:.94; letter-spacing:-.045em;
  font-weight:500; margin:.5rem 0 0; text-wrap:balance;
}
.dirA h3 em { font-style:normal; color:var(--lime); }
.dirA .sub { color:var(--dim); max-width:46ch; margin-top:1rem; line-height:1.6; font-size:1.02rem; }
.dirA .step {
  font-size:clamp(4rem,11cqw,8rem); line-height:.8; font-weight:500;
  color:transparent; -webkit-text-stroke:1.5px var(--edge); letter-spacing:-.05em;
}
/* Signature: the voice itself as the recurring graphic. */
.dirA .wave { display:flex; align-items:flex-end; gap:3px; height:56px; }
.dirA .wave i {
  flex:1; height:100%;   /* empty flex children collapse to 0 without this */
  border-radius:99px; background:linear-gradient(180deg,var(--lime),var(--cyan));
  animation:wv 1.4s ease-in-out infinite alternate; transform-origin:bottom;
}
@keyframes wv { from{transform:scaleY(.18)} to{transform:scaleY(1)} }
.dirA .panel {
  background:var(--panel); border:1px solid var(--hair); border-radius:18px;
  box-shadow:0 1px 0 rgba(255,255,255,.05) inset, 0 24px 60px -30px rgba(0,0,0,.9);
}
.dirA .opt {
  display:block; width:100%; text-align:start; padding:1.15rem 1.25rem; border-radius:16px;
  background:var(--panel); border:1px solid var(--hair); color:var(--ink);
  transition:border-color .18s, background .18s, transform .18s;
}
.dirA .opt:hover { border-color:var(--edge); transform:translateY(-2px); }
.dirA .opt[aria-checked="true"] {
  border-color:var(--lime); background:linear-gradient(180deg,rgba(200,247,81,.13),var(--panel));
}
.dirA .opt b { display:block; font-weight:600; font-size:1.05rem; }
.dirA .opt span { display:block; color:var(--dim); font-size:.88rem; margin-top:.2rem; }
.dirA .chip {
  padding:.6rem .95rem; border-radius:99px; background:var(--panel2);
  border:1px solid var(--hair); color:var(--dim); font-size:.85rem; font-weight:500;
}
.dirA .chip[aria-checked="true"] { background:var(--lime); color:#0A0A0C; border-color:var(--lime); }
.dirA .cta {
  display:inline-flex; align-items:center; gap:.6rem; padding:1.05rem 2rem; border-radius:99px;
  background:var(--lime); color:#0A0A0C; font-weight:600; font-size:1.05rem; border:0;
  box-shadow:0 0 0 0 rgba(200,247,81,.45); transition:box-shadow .3s, transform .18s;
}
.dirA .cta:hover { box-shadow:0 0 44px -6px rgba(200,247,81,.55); transform:translateY(-2px); }
.dirA .metric b { font-size:2rem; font-weight:500; letter-spacing:-.03em; display:block; }
.dirA .metric span { color:var(--dim); font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; }

/* =================================================== B — EDITORIAL ====== */
.dirB {
  --paper:#FDFBF7; --ink:#16120E;                     /* 18.0:1 */
  --dim:#6E6459;                                      /* 5.6:1  */
  --blue:#10399B;                                     /* 9.8:1  */
  --rule:#DED5C8; --ruleStrong:#98897A;               /* 3.3:1  */
  --mark:#FFE9A8; --ring:#10399B;
  background:var(--paper); color:var(--ink);
  font-family:var(--font-fraunces),Georgia,serif;
}
.dirB .eyebrow {
  font-family:var(--font-sans),system-ui,sans-serif;
  font-size:.7rem; letter-spacing:.2em; text-transform:uppercase; color:var(--dim); font-weight:600;
}
.dirB h3 {
  font-size:clamp(2.6rem,7cqw,5.2rem); line-height:.98; letter-spacing:-.028em;
  font-weight:600; margin:.75rem 0 0; font-variation-settings:"SOFT" 0,"WONK" 1,"opsz" 120;
  text-wrap:balance;
}
/* The marker is drawn behind the text, so the ink keeps its full contrast. */
.dirB mark {
  background:linear-gradient(180deg,transparent 58%,var(--mark) 58%);
  color:inherit; padding:0 .06em; margin-inline-end:.12em;
}
.dirB .sub {
  font-family:var(--font-sans),system-ui,sans-serif;
  color:var(--dim); max-width:52ch; margin-top:1.15rem; line-height:1.65; font-size:1.05rem;
}
.dirB .num {
  /* --rule is a hairline colour (1.4:1) and was far too faint for 74px text.
     --ruleStrong clears the 3:1 large-text threshold and reads better anyway. */
  font-size:clamp(2.6rem,7cqw,4.6rem); line-height:1; font-weight:600; color:var(--ruleStrong);
  font-variation-settings:"opsz" 144;
}
.dirB .lbl {
  font-family:var(--font-sans),system-ui,sans-serif; font-size:.78rem;
  letter-spacing:.16em; text-transform:uppercase; color:var(--dim); font-weight:600;
}
/* No cards anywhere — hierarchy comes from rules, scale and space. */
.dirB .row {
  display:flex; align-items:baseline; gap:1.25rem; width:100%; text-align:start;
  padding:1.05rem .25rem; background:none; border:0; border-bottom:1px solid var(--rule);
  color:var(--ink); transition:padding-inline-start .18s, border-color .18s;
}
.dirB .row:hover { padding-inline-start:.9rem; border-color:var(--ruleStrong); }
.dirB .row[aria-checked="true"] { border-bottom:2px solid var(--blue); padding-inline-start:.9rem; }
.dirB .row .k {
  font-family:var(--font-sans),system-ui,sans-serif; font-size:.72rem; color:var(--dim);
  letter-spacing:.14em; min-width:2.2ch; font-weight:700;
}
.dirB .row[aria-checked="true"] .k { color:var(--blue); }
.dirB .row .t { font-size:1.5rem; font-weight:600; letter-spacing:-.02em; }
.dirB .row .d {
  font-family:var(--font-sans),system-ui,sans-serif; font-size:.9rem; color:var(--dim);
  margin-inline-start:auto; text-align:end;
}
.dirB .tag {
  font-family:var(--font-sans),system-ui,sans-serif; font-size:.86rem; font-weight:600;
  padding:.5rem .2rem; background:none; border:0; border-bottom:2px solid transparent; color:var(--dim);
}
.dirB .tag[aria-checked="true"] { color:var(--ink); border-bottom-color:var(--blue); }
.dirB .cta {
  font-family:var(--font-sans),system-ui,sans-serif;
  display:inline-flex; align-items:center; gap:.6rem; padding:1.05rem 2.1rem;
  background:var(--blue); color:#fff; font-weight:600; font-size:1rem; border:0; border-radius:2px;
  transition:transform .18s, box-shadow .18s;
}
.dirB .cta:hover { transform:translate(-2px,-2px); box-shadow:5px 5px 0 var(--ink); }
.dirB .metric b { font-size:2.6rem; font-weight:600; display:block; letter-spacing:-.03em; }
.dirB .metric span {
  font-family:var(--font-sans),system-ui,sans-serif; font-size:.72rem;
  letter-spacing:.14em; text-transform:uppercase; color:var(--dim);
}

/* ======================================================== C — SOFT ====== */
.dirC {
  --bg:#FFF7F0; --card:#FFFFFF; --ink:#2A1B14;        /* 15.7:1 */
  --dim:#7A6156;                                      /* 5.4:1  */
  --coral:#C2340F;                                    /* 5.2:1  */
  --gA:#A83A11; --gB:#C94A17;                         /* white 6.4:1 / 4.7:1 */
  --mint:#0F766E;                                     /* 5.2:1  */
  --line:#F2E2D6; --edge:#9E7A62;                     /* 3.3:1  */
  --ring:#C2340F;
  background:var(--bg); color:var(--ink);
  font-family:var(--font-outfit),system-ui,sans-serif;
  position:relative; isolation:isolate;
}
.dirC::before {
  content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
  background:
    radial-gradient(38ch 30ch at 88% -6%, rgba(255,169,77,.34), transparent 68%),
    radial-gradient(34ch 28ch at -6% 32%, rgba(45,212,191,.24), transparent 68%),
    radial-gradient(30ch 26ch at 70% 108%, rgba(244,114,182,.20), transparent 68%);
}
.dirC .eyebrow {
  display:inline-block; font-size:.78rem; font-weight:700; letter-spacing:.04em;
  color:var(--coral); background:#FFE9DF; padding:.4rem .85rem; border-radius:99px;
}
.dirC h3 {
  font-size:clamp(2.5rem,6.6cqw,4.6rem); line-height:1.02; letter-spacing:-.035em;
  font-weight:700; margin:.9rem 0 0; text-wrap:balance;
}
.dirC h3 em {
  font-style:normal;
  background:linear-gradient(100deg,var(--gA),#D9531B 55%,#B8860B);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.dirC .sub { color:var(--dim); max-width:46ch; margin-top:1rem; line-height:1.65; font-size:1.05rem; font-weight:400; }
/* Soft, *coloured* shadows — grey drop-shadows are what make a card look cheap. */
.dirC .card {
  background:var(--card); border-radius:26px; border:1px solid var(--line);
  box-shadow:0 18px 40px -22px rgba(168,58,17,.35), 0 2px 0 rgba(168,58,17,.05);
}
.dirC .opt {
  display:block; width:100%; text-align:start; padding:1.3rem; border-radius:22px;
  background:var(--card); border:2px solid var(--line); color:var(--ink);
  transition:transform .2s cubic-bezier(.34,1.56,.64,1), border-color .2s, box-shadow .2s;
}
.dirC .opt:hover { transform:translateY(-3px) scale(1.012); border-color:var(--edge); }
.dirC .opt[aria-checked="true"] {
  border-color:var(--coral); background:#FFF3EC;
  box-shadow:0 14px 28px -16px rgba(194,52,15,.5);
}
.dirC .opt .em { font-size:1.9rem; display:block; line-height:1; }
.dirC .opt b { display:block; font-weight:700; font-size:1.1rem; margin-top:.55rem; }
.dirC .opt span { display:block; color:var(--dim); font-size:.9rem; margin-top:.15rem; }
/* Scoped under .opt so it outranks the .dirC .opt span rule, which was
   overriding the colour and painting the tick brown-on-coral at 1.03:1. */
.dirC .opt .tick {
  position:absolute; inset-inline-end:.9rem; inset-block-start:.9rem;
  width:26px; height:26px; border-radius:99px; display:grid; place-items:center;
  background:var(--coral); color:#fff;                /* 4.6:1 */
  font-size:.8rem; font-weight:700; transform:rotate(-8deg); margin:0;
}
.dirC .chip {
  padding:.75rem .5rem; border-radius:16px; background:var(--card); border:2px solid var(--line);
  color:var(--ink); font-weight:600; font-size:.82rem; transition:transform .2s cubic-bezier(.34,1.56,.64,1), border-color .2s;
}
.dirC .chip:hover { transform:translateY(-2px); border-color:var(--edge); }
.dirC .chip[aria-checked="true"] { border-color:var(--coral); background:#FFF3EC; color:var(--coral); }
.dirC .cta {
  display:inline-flex; align-items:center; gap:.6rem; padding:1.15rem 2.2rem; border-radius:99px;
  background:linear-gradient(100deg,var(--gA),var(--gB)); color:#fff; font-weight:700; font-size:1.08rem; border:0;
  box-shadow:0 16px 30px -14px rgba(168,58,17,.7);
  transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
}
.dirC .cta:hover { transform:translateY(-3px) scale(1.02); box-shadow:0 22px 38px -14px rgba(168,58,17,.8); }
.dirC .cta:active { transform:translateY(0) scale(.98); }
.dirC .metric b { font-size:2.3rem; font-weight:700; display:block; letter-spacing:-.03em; }
.dirC .metric span { color:var(--dim); font-size:.78rem; font-weight:600; }
    `}</style>
  );
}
