import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectJukeboxAudioFiles, MusicModule } from '../src/modules/MusicModule.js';

test('collectJukeboxAudioFiles returns only supported audio files', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'jukebox-test-'));

  try {
    await writeFile(path.join(tempDir, 'one.mp3'), 'audio');
    await writeFile(path.join(tempDir, 'two.wav'), 'audio');
    await writeFile(path.join(tempDir, 'three.txt'), 'not audio');
    await writeFile(path.join(tempDir, 'four.m4a'), 'audio');

    const files = await collectJukeboxAudioFiles(tempDir);
    const names = files.map((file) => path.basename(file)).sort();

    assert.deepEqual(names, ['four.m4a', 'one.mp3', 'two.wav']);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('pause and resume delegate to audio manager', () => {
  const audioManager = {
    pause: () => true,
    resume: () => true,
  };

  const client = {
    audioManager,
    musicModule: null,
  } as any;

  const module = new MusicModule(client);

  assert.equal(module.pause('guild-1'), true);
  assert.equal(module.resume('guild-1'), true);
});
