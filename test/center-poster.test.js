import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeCenterPosterUpload } from '../server/centerPoster.js';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const jpegSample = readFileSync(new URL('./fixtures/center-poster-sample.jpg', import.meta.url));
const pngSample = readFileSync(new URL('../public/paper-based-centers-poster.png', import.meta.url));

test('accepts structurally valid PNG and JPEG uploads and preserves their bytes', () => {
  for (const [mimeType, content] of [['image/png', pngSample], ['image/jpeg', jpegSample]]) {
    const decoded = decodeCenterPosterUpload({ mimeType, dataBase64: content.toString('base64') });
    assert.deepEqual(decoded, content);
  }
});

test('rejects files that contain only an image signature or container header', () => {
  for (const [mimeType, content] of [
    ['image/png', pngSignature],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['image/webp', Buffer.from('RIFF\x04\x00\x00\x00WEBPVP8 ', 'binary')],
  ]) {
    assert.throws(() => decodeCenterPosterUpload({ mimeType, dataBase64: content.toString('base64') }));
  }
});

test('rejects truncated real PNG and JPEG files', () => {
  for (const [mimeType, content] of [
    ['image/png', pngSample.subarray(0, pngSample.length - 8)],
    ['image/jpeg', jpegSample.subarray(0, jpegSample.length - 2)],
  ]) {
    assert.throws(() => decodeCenterPosterUpload({ mimeType, dataBase64: content.toString('base64') }));
  }
});

test('rejects an upload with an unsupported MIME type', () => {
  assert.throws(() => decodeCenterPosterUpload({
    mimeType: 'image/gif', dataBase64: pngSignature.toString('base64'),
  }));
});

test('rejects an upload when its signature does not match the declared MIME type', () => {
  assert.throws(() => decodeCenterPosterUpload({
    mimeType: 'image/jpeg', dataBase64: pngSignature.toString('base64'),
  }));
});

test('rejects malformed base64 and empty image data', () => {
  assert.throws(() => decodeCenterPosterUpload({ mimeType: 'image/png', dataBase64: '%%%not-base64%%%' }));
  assert.throws(() => decodeCenterPosterUpload({ mimeType: 'image/png', dataBase64: '' }));
});

test('accepts a complete poster within the 5 MiB limit', () => {
  const decoded = decodeCenterPosterUpload({ mimeType: 'image/png', dataBase64: pngSample.toString('base64') });
  assert.deepEqual(decoded, pngSample);
});

test('rejects a poster larger than the 5 MiB limit', () => {
  const content = Buffer.alloc((5 * 1024 * 1024) + 1);
  pngSignature.copy(content);
  assert.throws(() => decodeCenterPosterUpload({ mimeType: 'image/png', dataBase64: content.toString('base64') }));
});
