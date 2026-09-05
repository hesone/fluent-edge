// STT factory — resolves the configured provider and hands back an adapter.

import { presumedSTTProvider, resolveSTTProvider, type STTProvider } from "../config";
import type { STTAdapter, STTHandler } from "./types";
import { SpeechStream } from "./webSpeech";
import { WhisperStream } from "./whisper";

export type { STTAdapter, STTConfig, STTHandler } from "./types";
export { SpeechStream } from "./webSpeech";
export { WhisperStream } from "./whisper";

export function makeSTT(provider: STTProvider, onResult: STTHandler): STTAdapter {
  return provider === "whisper" ? new WhisperStream(onResult) : new SpeechStream(onResult);
}

/** Resolve the provider (probing the media server if configured "auto") and
 *  construct the matching adapter. */
export async function createSTT(onResult: STTHandler): Promise<STTAdapter> {
  return makeSTT(await resolveSTTProvider(), onResult);
}

/** Synchronous guess for first render, before any probe has resolved. */
export { presumedSTTProvider };
