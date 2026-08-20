import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expectedPcmBytes,
  PCM_FRAME_BYTES,
  PcmTrackWriter,
} from '../src/utils/pcmTimeline.js';

function collectWriter(now: { value: number }) {
  const chunks: Buffer[] = [];
  const writer = new PcmTrackWriter({
    startedAt: 0,
    write: (chunk) => {
      chunks.push(Buffer.from(chunk));
    },
    now: () => now.value,
  });
  return { chunks, writer };
}

function totalBytes(chunks: Buffer[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0);
}

test('expectedPcmBytes alinha a samples estéreo de 16 bits', () => {
  assert.equal(expectedPcmBytes(0), 0);
  assert.equal(expectedPcmBytes(20), PCM_FRAME_BYTES);
  assert.equal(expectedPcmBytes(1000) % 4, 0);
});

test('padToNow preenche silêncio quando ninguém fala', () => {
  const now = { value: 1000 };
  const { chunks, writer } = collectWriter(now);

  writer.padToNow(true);

  assert.equal(writer.bytesWritten, expectedPcmBytes(1000));
  assert.equal(totalBytes(chunks), expectedPcmBytes(1000));
  assert.ok(chunks.every((chunk) => chunk.every((byte) => byte === 0)));
});

test('não insere silêncio entre frames consecutivos de áudio', () => {
  const now = { value: 20 };
  const { chunks, writer } = collectWriter(now);
  const frame = Buffer.alloc(PCM_FRAME_BYTES, 7);

  writer.writeAudio(frame);
  now.value = 40;
  writer.writeAudio(frame);

  assert.equal(chunks.length, 2);
  assert.equal(writer.bytesWritten, PCM_FRAME_BYTES * 2);
  assert.ok(chunks.every((chunk) => chunk.equals(frame)));
});

test('depois de uma desconexão longa, continua no mesmo track com silêncio no meio', () => {
  const now = { value: 20 };
  const { chunks, writer } = collectWriter(now);
  const frame = Buffer.alloc(PCM_FRAME_BYTES, 9);

  writer.writeAudio(frame);
  now.value = 5020;
  writer.writeAudio(frame);

  assert.ok(writer.bytesWritten >= expectedPcmBytes(5020));
  assert.equal(chunks[0]?.equals(frame), true);
  assert.equal(chunks.at(-1)?.equals(frame), true);
  assert.ok(chunks.some((chunk) => chunk.every((byte) => byte === 0)));
});

test('quem entra depois começa com silêncio desde o início da sessão', () => {
  const now = { value: 3000 };
  const { chunks, writer } = collectWriter(now);
  const frame = Buffer.alloc(PCM_FRAME_BYTES, 3);

  writer.writeAudio(frame);

  assert.ok(chunks[0] && chunks[0].every((byte) => byte === 0));
  assert.ok(writer.bytesWritten >= expectedPcmBytes(3000));
  assert.equal(chunks.at(-1)?.equals(frame), true);
});

test('dois usuários parados no mesmo instante ficam com o mesmo tamanho', () => {
  const leftNow = { value: 20 };
  const rightNow = { value: 20 };
  const left = collectWriter(leftNow);
  const right = collectWriter(rightNow);
  const frame = Buffer.alloc(PCM_FRAME_BYTES, 4);

  left.writer.writeAudio(frame);
  rightNow.value = 4000;
  right.writer.padToNow(true);

  const endedAt = 8000;
  left.writer.padTo(endedAt, true);
  right.writer.padTo(endedAt, true);

  assert.equal(left.writer.bytesWritten, right.writer.bytesWritten);
  assert.equal(left.writer.bytesWritten, expectedPcmBytes(endedAt));
});

test('tick de ociosidade mantém o arquivo crescendo no relógio da sessão', () => {
  const now = { value: 20 };
  const { writer } = collectWriter(now);
  const frame = Buffer.alloc(PCM_FRAME_BYTES, 1);

  writer.writeAudio(frame);
  now.value = 220;
  writer.padToNow();

  assert.equal(writer.bytesWritten, expectedPcmBytes(220));
});
