// Client to the local Whisper.cpp WebSocket server.
// Streams 16kHz PCM Float32 chunks; receives partial/final transcripts.

const WS_URL = process.env.NEXT_PUBLIC_STTS_URL ?? "ws://localhost:9090";

export type WhisperHandler = (text: string, isFinal: boolean) => void;

export class WhisperStream {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onResult: WhisperHandler;
  private url: string;

  constructor(onResult: WhisperHandler, url = WS_URL) {
    this.onResult = onResult;
    this.url = url;
  }

  async start(stream: MediaStream, config: { language: string }) {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";
    await new Promise<void>((res, rej) => {
      this.ws!.onopen = () => res();
      this.ws!.onerror = () => rej(new Error("Whisper WS failed"));
    });
  
    this.ws.send(
      JSON.stringify({
        type: "config",
        language: config.language,
      })
    );

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // if (msg.type === "transcript") this.onResult(msg.text,true);
        if (typeof msg.text === "string") this.onResult(msg.text, !!msg.final);
      } catch { /* ignore */ }
    };

    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);

    this.processor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);

      // send Float32 PCM
      this.ws.send(input.buffer.slice(0));
    };
  }

  connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  stop() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioCtx?.close();
    if (this.ws?.readyState === WebSocket.OPEN) 
      this.ws.send(JSON.stringify({ eof: true }));
    this.ws?.close();
    this.ws = null;
    this.processor = null;
    this.source = null;
    this.audioCtx = null;
  }
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);

  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return output.buffer;
}