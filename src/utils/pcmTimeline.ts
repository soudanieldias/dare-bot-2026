export const PCM_SAMPLE_RATE = 48_000;
export const PCM_CHANNELS = 2;
export const PCM_BYTES_PER_SAMPLE = 2;
export const PCM_BYTES_PER_MS =
  (PCM_SAMPLE_RATE * PCM_CHANNELS * PCM_BYTES_PER_SAMPLE) / 1000;
export const PCM_FRAME_MS = 20;
export const PCM_FRAME_BYTES = PCM_BYTES_PER_MS * PCM_FRAME_MS;
export const PCM_SILENCE_GAP_FRAMES = 2;
export const PCM_SILENCE_CHUNK_BYTES = PCM_BYTES_PER_MS * 1000;

const SAMPLE_ALIGN = PCM_CHANNELS * PCM_BYTES_PER_SAMPLE;

export function expectedPcmBytes(elapsedMs: number): number {
  const raw = Math.floor(Math.max(0, elapsedMs) * PCM_BYTES_PER_MS);
  return raw - (raw % SAMPLE_ALIGN);
}

export function createSilenceBuffer(byteCount: number): Buffer {
  return Buffer.alloc(Math.max(0, byteCount));
}

export interface PcmTrackWriterOptions {
  startedAt: number;
  write: (chunk: Buffer) => void;
  now?: () => number;
}

export class PcmTrackWriter {
  bytesWritten = 0;

  private readonly startedAt: number;
  private readonly writeChunk: (chunk: Buffer) => void;
  private readonly now: () => number;

  constructor(options: PcmTrackWriterOptions) {
    this.startedAt = options.startedAt;
    this.writeChunk = options.write;
    this.now = options.now ?? Date.now;
  }

  padToNow(force = false): void {
    this.padTo(this.now(), force);
  }

  padTo(timestamp: number, force = false): void {
    const gap = expectedPcmBytes(timestamp - this.startedAt) - this.bytesWritten;
    if (gap <= 0) return;
    if (!force && gap < PCM_FRAME_BYTES * PCM_SILENCE_GAP_FRAMES) return;
    this.writeSilence(gap);
  }

  writeAudio(chunk: Buffer): void {
    this.padToNow();
    if (chunk.length === 0) return;
    this.writeChunk(chunk);
    this.bytesWritten += chunk.length;
  }

  private writeSilence(byteCount: number): void {
    let remaining = byteCount;
    while (remaining > 0) {
      const size = Math.min(remaining, PCM_SILENCE_CHUNK_BYTES);
      this.writeChunk(createSilenceBuffer(size));
      this.bytesWritten += size;
      remaining -= size;
    }
  }
}
