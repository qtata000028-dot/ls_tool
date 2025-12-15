// src/lib/realtimeAsrClient.ts
export type AsrMsg =
  | { type: "ready" }
  | { type: "started" }
  | { type: "partial"; text?: string }
  | { type: "final"; text?: string }
  | { type: "error"; message?: string; detail?: string }
  | { type: "nls_error"; status?: number; status_message?: string; raw?: any };

type OnMsg = (msg: AsrMsg) => void;

export class RealtimeAsrClient {
  private wsUrl: string;
  private ws?: WebSocket;
  private onMsg: OnMsg;

  private ac?: AudioContext;
  private stream?: MediaStream;
  private srcNode?: MediaStreamAudioSourceNode;
  private proc?: ScriptProcessorNode;

  private canSend = false;

  constructor(wsUrl: string, onMsg: OnMsg) {
    this.wsUrl = wsUrl;
    this.onMsg = onMsg;
  }

  get running() {
    return !!this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING);
  }

  async start() {
    this.stop();
    this.canSend = false;

    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as AsrMsg;
        if (msg.type === "started") this.canSend = true;
        this.onMsg(msg);
      } catch {}
    };
    this.ws.onerror = () => this.onMsg({ type: "error", message: "ws error" });
    this.ws.onclose = () => this.onMsg({ type: "error", message: "ws closed" });

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.srcNode = this.ac.createMediaStreamSource(this.stream);

    // ScriptProcessor 先用于快速跑通（后续可升级 AudioWorklet）
    this.proc = this.ac.createScriptProcessor(4096, 1, 1);
    this.srcNode.connect(this.proc);

    // 避免回放啸叫：接一个 0 增益输出
    const gain = this.ac.createGain();
    gain.gain.value = 0.0;
    this.proc.connect(gain);
    gain.connect(this.ac.destination);

    const downsampleTo16kInt16 = (float32: Float32Array, srcRate: number) => {
      const dstRate = 16000;
      const ratio = srcRate / dstRate;
      const newLen = Math.floor(float32.length / ratio);
      const out = new Int16Array(newLen);
      let pos = 0;
      for (let i = 0; i < newLen; i++) {
        const idx = Math.floor(pos);
        let s = float32[idx] ?? 0;
        s = Math.max(-1, Math.min(1, s));
        out[i] = (s * 0x7fff) | 0;
        pos += ratio;
      }
      return out;
    };

    this.proc.onaudioprocess = (ev) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (!this.canSend) return;

      const input = ev.inputBuffer.getChannelData(0);
      const pcm16 = downsampleTo16kInt16(input, this.ac!.sampleRate);
      this.ws.send(pcm16.buffer);
    };
  }

  stop() {
    this.canSend = false;

    try { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send("stop"); } catch {}
    try { this.ws?.close(); } catch {}
    this.ws = undefined;

    try { this.proc?.disconnect(); } catch {}
    this.proc = undefined;

    try { this.srcNode?.disconnect(); } catch {}
    this.srcNode = undefined;

    try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
    this.stream = undefined;

    try { this.ac?.close(); } catch {}
    this.ac = undefined;
  }
}
