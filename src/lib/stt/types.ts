// Speech-to-text adapter contract.
//
// Two implementations sit behind this: the browser Web Speech API (online,
// nothing to install) and whisper.cpp streaming over the local media server
// WebSocket (offline). Transcription.tsx talks only to this interface, so the
// two never leak into the component.

import type { STTProvider } from "../config";

/** Called with each chunk of recognised speech. `isFinal` marks a committed
 *  segment; non-final text is a preview that will be superseded. */
export type STTHandler = (text: string, isFinal: boolean) => void;

export interface STTConfig {
  /** App language code ("en", "de", "fa", …). Each adapter maps it to
   *  whatever its engine expects — BCP-47 for Web Speech, ISO-639-1 for
   *  whisper.cpp — so callers never have to care which. */
  language: string;
}

export interface STTAdapter {
  readonly provider: STTProvider;

  /** True when start() needs a real MediaStream. Web Speech opens the mic
   *  itself and ignores the argument; whisper.cpp has to be fed audio. */
  readonly needsStream: boolean;

  /** Whether this engine can run here at all (browser support, in practice). */
  isSupported(): boolean;

  start(stream: MediaStream | null, config: STTConfig): Promise<void>;

  /** Stop recognising and release the engine. */
  stop(): void;

  /** Discard the in-flight utterance without ending the session. Meaningful
   *  only for engines that accumulate interim text (Web Speech); a no-op
   *  elsewhere. */
  reset(): void;

  /** True while actively recognising. */
  connected(): boolean;
}
