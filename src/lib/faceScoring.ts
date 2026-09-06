// Delivery scoring from MediaPipe FaceMesh landmarks.
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface FaceMetrics {
  confidence: number;   // 0-100 overall
  eyeContact: number;   // 0-100
  nervousness: number;  // 0-100 (higher = more nervous)
  engagement: number;   // 0-100
  headStability: number;
  /** True while learning this person's neutral pose. Scores aren't meaningful yet. */
  calibrating: boolean;
}

// landmark indices (FaceMesh 478, iris included)
const L_IRIS = 468, R_IRIS = 473;
const L_EYE_OUT = 33, L_EYE_IN = 133;
const R_EYE_OUT = 263, R_EYE_IN = 362;
const L_BROW = 65, R_BROW = 295, L_BROW_REF = 159, R_BROW_REF = 386;
const NOSE = 1;
const FACE_TOP = 10, FACE_BOTTOM = 152;

/**
 * 2-D distance. Deliberately NOT 3-D: MediaPipe's `z` is a rough relative depth
 * whose origin sits at the head centre, so including it added a systematic,
 * pose-dependent offset to gaze — a face looking straight at the camera never
 * measured as centred.
 */
const dist = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const mid = (a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark =>
  ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 } as NormalizedLandmark);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const to100 = (n: number) => Math.max(0, Math.min(100, n));

/** Frame-rate independent smoothing: the same tau behaves the same at any fps. */
function smooth(prev: number, next: number, dt: number, tau: number) {
  const a = 1 - Math.exp(-dt / tau);
  return prev + (next - prev) * a;
}

const CALIBRATION_MS = 1800;

// How far a signal has to move from the person's own baseline to score zero.
const GAZE_FULL_LOSS = 0.20;   // eye-widths of iris offset
const BROW_FULL_SWING = 0.18;  // ±18% change in brow-to-lid distance
const UNSTEADY = 0.35;         // face-heights per second of head travel
const GAZE_WANDER = 0.055;     // mean absolute gaze deviation
const HEAD_JITTER = 0.22;      // face-heights/s of speed variation

/**
 * Stateful scorer. One instance per question.
 *
 * Rewritten to fix four defects in the original:
 *
 * 1. **Smoothing froze.** State was rounded on every frame
 *    (`round(prev*0.85 + raw*0.15)`), so any step under 0.5 rounded straight
 *    back. Values could only move when the raw signal differed by 3.34 or more,
 *    which pinned every metric near its seed of 50. State is now kept as
 *    floating point and rounded only on output.
 *
 * 2. **Confidence double-counted.** `nervousness` was derived from head
 *    stability and eye contact and then folded back into confidence, which
 *    already weighted both. Expanded, the real weights were 0.40/0.33/0.20 with
 *    a constant +7 — not the 0.35/0.25/0.20/0.20 that was written. Nervousness
 *    is now built from *variability*, which is independent of the mean-based
 *    signals, so the stated weights are the actual weights.
 *
 * 3. **"Mouth tension" detected speech.** It was `mouthH/mouthW`, so an open
 *    mouth read as calm and a closed one as tense — in an app where the task is
 *    talking, it scored people as relaxed exactly while they spoke. Removed.
 *
 * 4. **Head stability measured frame rate.** Displacement was per *frame*, so
 *    the same physical motion scored 92 at 15fps and 99 at 120fps, and it
 *    wasn't normalised by face size, so leaning closer read as instability. Now
 *    face-heights per second.
 *
 * It also calibrates. Eye contact and brow raise are strongly anatomical —
 * fixed constants meant a naturally low-browed person was permanently
 * "unengaged". The first ~1.8s of a detected face establishes that person's
 * neutral pose, and everything afterwards scores deviation from it.
 */
export class FaceScorer {
  private prevNose: NormalizedLandmark | null = null;
  private prevT: number | null = null;

  // calibration
  private calStart: number | null = null;
  private calGaze: number[] = [];
  private calBrow: number[] = [];
  private baseGaze = 0;
  private baseBrow = 0;
  private calibrated = false;

  // smoothed raw signals
  private speedEMA = 0;        // face-heights / second
  private speedSlowEMA = 0;
  private jitterEMA = 0;
  private gazeEMA = 0;
  private gazeDevEMA = 0;

  // smoothed output, kept as floats
  private out = {
    confidence: 50, eyeContact: 50, nervousness: 30, engagement: 50, headStability: 70,
  };

  reset() {
    this.prevNose = null; this.prevT = null;
    this.calStart = null; this.calGaze = []; this.calBrow = [];
    this.calibrated = false;
    this.speedEMA = this.speedSlowEMA = this.jitterEMA = 0;
    this.gazeEMA = this.gazeDevEMA = 0;
    this.out = { confidence: 50, eyeContact: 50, nervousness: 30, engagement: 50, headStability: 70 };
  }

  /** @param nowMs monotonic timestamp for this frame (performance.now()). */
  update(lm: NormalizedLandmark[], nowMs: number): FaceMetrics {
    if (!lm || lm.length < 478) return this.snapshot();

    const faceH = dist(lm[FACE_TOP], lm[FACE_BOTTOM]) || 1e-4;

    // ---- raw geometry -----------------------------------------------------
    const lEyeW = dist(lm[L_EYE_OUT], lm[L_EYE_IN]) || 1e-4;
    const rEyeW = dist(lm[R_EYE_OUT], lm[R_EYE_IN]) || 1e-4;
    const lGaze = dist(lm[L_IRIS], mid(lm[L_EYE_OUT], lm[L_EYE_IN])) / lEyeW;
    const rGaze = dist(lm[R_IRIS], mid(lm[R_EYE_OUT], lm[R_EYE_IN])) / rEyeW;
    const gazeOff = (lGaze + rGaze) / 2;

    const browNorm =
      ((dist(lm[L_BROW], lm[L_BROW_REF]) + dist(lm[R_BROW], lm[R_BROW_REF])) / 2) / faceH;

    // Head travel, in face-heights per second, so it is independent of both
    // frame rate and how close the user sits to the camera.
    const dt = this.prevT === null ? 0 : Math.min(0.25, Math.max(1e-3, (nowMs - this.prevT) / 1000));
    let speed = 0;
    if (this.prevNose && dt > 0) speed = (dist(lm[NOSE], this.prevNose) / faceH) / dt;
    this.prevNose = lm[NOSE];
    this.prevT = nowMs;

    // ---- calibration ------------------------------------------------------
    if (this.calStart === null) this.calStart = nowMs;
    if (!this.calibrated) {
      this.calGaze.push(gazeOff);
      this.calBrow.push(browNorm);
      if (nowMs - this.calStart >= CALIBRATION_MS && this.calGaze.length >= 10) {
        // Median, not mean: a blink or a glance away during calibration would
        // otherwise skew the baseline for the whole question.
        this.baseGaze = median(this.calGaze);
        this.baseBrow = median(this.calBrow) || 1e-4;
        this.calibrated = true;
      }
      return this.snapshot();
    }

    if (dt <= 0) return this.snapshot();

    // ---- smoothed signals -------------------------------------------------
    this.speedEMA = smooth(this.speedEMA, speed, dt, 0.45);
    this.speedSlowEMA = smooth(this.speedSlowEMA, speed, dt, 2.0);
    this.jitterEMA = smooth(this.jitterEMA, Math.abs(speed - this.speedSlowEMA), dt, 1.2);
    this.gazeEMA = smooth(this.gazeEMA, gazeOff, dt, 1.5);
    this.gazeDevEMA = smooth(this.gazeDevEMA, Math.abs(gazeOff - this.gazeEMA), dt, 1.2);

    // ---- metrics ----------------------------------------------------------
    // Deviation from *this person's* centred gaze, in eye-widths.
    const gazeDrift = Math.max(0, this.gazeEMA - this.baseGaze);
    const eyeContact = to100(100 * (1 - clamp01(gazeDrift / GAZE_FULL_LOSS)));

    // Relative brow raise against their own neutral: 50 is their resting face.
    const browRel = (browNorm - this.baseBrow) / this.baseBrow;
    const engagement = to100(50 + (browRel / BROW_FULL_SWING) * 50);

    const headStability = to100(100 * (1 - clamp01(this.speedEMA / UNSTEADY)));

    // Nervousness reads *variability*, not a pose: darting eyes and twitchy
    // head movement. That keeps it independent of the mean-based metrics above,
    // so folding it into confidence is no longer double counting.
    const nervousness = to100(
      60 * clamp01(this.gazeDevEMA / GAZE_WANDER) +
      40 * clamp01(this.jitterEMA / HEAD_JITTER)
    );

    const confidence = to100(
      0.40 * eyeContact +
      0.30 * headStability +
      0.15 * engagement +
      0.15 * (100 - nervousness)
    );

    const raw = { confidence, eyeContact, nervousness, engagement, headStability };
    (Object.keys(raw) as (keyof typeof raw)[]).forEach((k) => {
      // Float state, rounded only for display — this is the freeze fix.
      this.out[k] = smooth(this.out[k], raw[k], dt, 0.6);
    });

    return this.snapshot();
  }

  private snapshot(): FaceMetrics {
    return {
      confidence: Math.round(this.out.confidence),
      eyeContact: Math.round(this.out.eyeContact),
      nervousness: Math.round(this.out.nervousness),
      engagement: Math.round(this.out.engagement),
      headStability: Math.round(this.out.headStability),
      calibrating: !this.calibrated,
    };
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
