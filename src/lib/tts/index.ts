// TTS factory — resolves the configured provider and hands back an adapter.

import { presumedTTSProvider, resolveTTSProvider, type TTSProvider } from "../config";
import type { TTSAdapter } from "./types";
import { WebSpeechTTS } from "./webSpeech";
import { PiperTTS } from "./piper";

export type { TTSAdapter, TTSSpeakHandlers, TTSPlaybackInfo } from "./types";
export { WebSpeechTTS } from "./webSpeech";
export { PiperTTS } from "./piper";
export { VOICE_PREFERENCES } from "./webSpeech";

export function makeTTS(provider: TTSProvider): TTSAdapter {
  return provider === "piper" ? new PiperTTS() : new WebSpeechTTS();
}

/** Resolve the provider (probing the media server if configured "auto") and
 *  construct the matching adapter. */
export async function createTTS(): Promise<TTSAdapter> {
  return makeTTS(await resolveTTSProvider());
}

export { presumedTTSProvider };
