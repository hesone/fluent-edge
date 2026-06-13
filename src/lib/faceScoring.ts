// MediaPipe FaceMesh landmark indices we use
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface FaceMetrics {
  confidence: number;   // 0-100 overall
  eyeContact: number;   // 0-100
  nervousness: number;  // 0-100 (higher = more nervous)
  engagement: number;   // 0-100
  headStability: number;
}

// landmark indices (FaceMesh 468)
const L_IRIS = 468, R_IRIS = 473;
const L_EYE_OUT = 33, L_EYE_IN = 133;
const R_EYE_OUT = 263, R_EYE_IN = 362;
const L_BROW = 65, R_BROW = 295, L_BROW_REF = 159, R_BROW_REF = 386;
const MOUTH_L = 61, MOUTH_R = 291, MOUTH_T = 13, MOUTH_B = 14;
const NOSE = 1;

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

// Smoothing state lives in this stateful scorer
export class FaceScorer {
  private prevNose: NormalizedLandmark | null = null;
  private headMoveEMA = 0;
  private metricsEMA: FaceMetrics = {
    confidence: 50, eyeContact: 50, nervousness: 30, engagement: 50, headStability: 70,
  };

  update(lm: NormalizedLandmark[]): FaceMetrics {
    if (!lm || lm.length < 478) return this.metricsEMA;

    // --- Eye contact: iris centered between eye corners ---
    const lIris = lm[L_IRIS], rIris = lm[R_IRIS];
    const lEyeMid = mid(lm[L_EYE_OUT], lm[L_EYE_IN]);
    const rEyeMid = mid(lm[R_EYE_OUT], lm[R_EYE_IN]);
    const lEyeW = dist(lm[L_EYE_OUT], lm[L_EYE_IN]) || 1e-4;
    const rEyeW = dist(lm[R_EYE_OUT], lm[R_EYE_IN]) || 1e-4;
    const lGaze = dist(lIris, lEyeMid) / lEyeW;
    const rGaze = dist(rIris, rEyeMid) / rEyeW;
    const gazeOff = (lGaze + rGaze) / 2; // ~0 centered
    const eyeContact = clamp(100 - gazeOff * 350);

    // --- Eyebrow raise (engagement) ---
    const browRaiseL = dist(lm[L_BROW], lm[L_BROW_REF]);
    const browRaiseR = dist(lm[R_BROW], lm[R_BROW_REF]);
    const faceH = dist(lm[10], lm[152]) || 1e-4;
    const browNorm = ((browRaiseL + browRaiseR) / 2) / faceH;
    const engagement = clamp(40 + (browNorm - 0.06) * 900);

    // --- Mouth tension (nervousness signal) ---
    const mouthW = dist(lm[MOUTH_L], lm[MOUTH_R]);
    const mouthH = dist(lm[MOUTH_T], lm[MOUTH_B]);
    const tension = mouthH / (mouthW || 1e-4); // tight lips -> low
    const mouthTension = clamp(100 - tension * 600);

    // --- Head stability ---
    const nose = lm[NOSE];
    let headMove = 0;
    if (this.prevNose) headMove = dist(nose, this.prevNose);
    this.prevNose = nose;
    this.headMoveEMA = this.headMoveEMA * 0.8 + headMove * 0.2;
    const headStability = clamp(100 - this.headMoveEMA * 4000);

    // --- Nervousness: blends instability + mouth tension - eyeContact ---
    const nervousness = clamp(
      0.4 * (100 - headStability) + 0.35 * mouthTension + 0.25 * (100 - eyeContact)
    );

    // --- Overall confidence ---
    const confidence = clamp(
      0.35 * eyeContact + 0.25 * headStability + 0.2 * engagement + 0.2 * (100 - nervousness)
    );

    const raw: FaceMetrics = { confidence, eyeContact, nervousness, engagement, headStability };
    // EMA smoothing for stable gauge
    (Object.keys(raw) as (keyof FaceMetrics)[]).forEach((k) => {
      this.metricsEMA[k] = Math.round(this.metricsEMA[k] * 0.85 + raw[k] * 0.15);
    });
    return { ...this.metricsEMA };
  }
}

const mid = (a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark =>
  ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 } as NormalizedLandmark);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));