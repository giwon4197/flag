import test from 'node:test';
import assert from 'node:assert/strict';
import {openCamera} from './camera.js';

test('camera retries without capture preferences when a USB camera cannot open', async () => {
  for (const name of ['NotReadableError', 'OverconstrainedError']) {
    const calls = [];
    const stream = {};
    const result = await openCamera({async getUserMedia(options) {
      calls.push(options);
      if (calls.length === 1) throw Object.assign(new Error('Cannot start video'), {name});
      return stream;
    }});
    assert.equal(result, stream);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], {video: true, audio: false});
  }
});

test('camera does not retry permission denial or missing hardware', async () => {
  for (const name of ['NotAllowedError', 'NotFoundError']) {
    let calls = 0;
    await assert.rejects(openCamera({async getUserMedia() {
      calls++;
      throw Object.assign(new Error(name), {name});
    }}), {name});
    assert.equal(calls, 1);
  }
});
