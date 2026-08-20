import assert from 'node:assert/strict';
import test from 'node:test';

import { didJoinRecordedChannel } from '../src/utils/callRecording.js';

test('entrada nova na call gravada deve abrir um track', () => {
  assert.equal(didJoinRecordedChannel(null, 'voice-1', 'voice-1'), true);
});

test('troca de canal para a call gravada deve abrir um track', () => {
  assert.equal(didJoinRecordedChannel('voice-2', 'voice-1', 'voice-1'), true);
});

test('mute, unmute ou falar no mesmo canal não é entrada nova', () => {
  assert.equal(didJoinRecordedChannel('voice-1', 'voice-1', 'voice-1'), false);
});

test('sair da call ou ir para outro canal não abre track novo', () => {
  assert.equal(didJoinRecordedChannel('voice-1', null, 'voice-1'), false);
  assert.equal(didJoinRecordedChannel('voice-1', 'voice-2', 'voice-1'), false);
});

test('evento de outro canal é ignorado', () => {
  assert.equal(didJoinRecordedChannel(null, 'voice-9', 'voice-1'), false);
});
