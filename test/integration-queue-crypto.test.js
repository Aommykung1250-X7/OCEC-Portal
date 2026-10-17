import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptQueuedEmailText, decryptQueuedEmailText } from '../server/integrationQueue.js';

test('queued email content is encrypted, round trips Unicode, and rejects tampering', () => {
  const previous = process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY;
  process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  try {
    const message = 'แจ้งผลสอบ: Candidate A\n<a href="https://example.test">เปิดดู</a>';
    const first = encryptQueuedEmailText(message);
    const second = encryptQueuedEmailText(message);
    assert.notEqual(first, second, 'a fresh nonce should make ciphertext different');
    assert.doesNotMatch(first, /แจ้งผลสอบ|Candidate A/);
    assert.equal(decryptQueuedEmailText(first), message);
    const parts = first.split('.');
    parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`;
    assert.throws(() => decryptQueuedEmailText(parts.join('.')));
    assert.throws(() => decryptQueuedEmailText('invalid'));
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY;
    else process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY = previous;
  }
});

test('queued email encryption requires a 32-byte key', () => {
  const previous = process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY;
  process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
  try {
    assert.throws(() => encryptQueuedEmailText('secret'), /32-byte key/);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY;
    else process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY = previous;
  }
});
