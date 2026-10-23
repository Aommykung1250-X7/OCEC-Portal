import { getPool, transaction } from './db.js';
import { inflateSync } from 'node:zlib';

const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_POSTER_BYTES / 3) * 4;

const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_IMAGE_PIXELS = 40_000_000;
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function expectedPngInflatedBytes(width, height, bitDepth, colorType, interlace) {
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[colorType];
  const bytesPerPixel = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const passStarts = interlace ? [[0, 0], [4, 0], [0, 4], [2, 0], [0, 2], [1, 0], [0, 1]] : [[0, 0]];
  const passSteps = interlace ? [[8, 8], [8, 8], [4, 8], [4, 4], [2, 4], [2, 2], [1, 2]] : [[1, 1]];
  return passStarts.reduce((total, [startX, startY], index) => {
    const [stepX, stepY] = passSteps[index];
    const passWidth = width <= startX ? 0 : Math.ceil((width - startX) / stepX);
    const passHeight = height <= startY ? 0 : Math.ceil((height - startY) / stepY);
    return total + (passWidth && passHeight ? (Math.ceil((passWidth * channels * bitDepth) / 8) + 1) * passHeight : 0);
  }, 0);
}

function validatePng(bytes) {
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8;
  let header = null;
  let sawPalette = false;
  let sawData = false;
  let dataEnded = false;
  let sawEnd = false;
  const dataChunks = [];

  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > bytes.length) return false;
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString('ascii');
    const chunkData = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + chunkLength);
    if (pngCrc32(bytes.subarray(offset + 4, offset + 8 + chunkLength)) !== expectedCrc) return false;
    if (!header && type !== 'IHDR') return false;
    if (sawData && type !== 'IDAT' && type !== 'IEND') dataEnded = true;

    if (type === 'IHDR') {
      if (header || offset !== 8 || chunkLength !== 13) return false;
      const width = chunkData.readUInt32BE(0);
      const height = chunkData.readUInt32BE(4);
      const bitDepth = chunkData[8];
      const colorType = chunkData[9];
      const validDepths = ({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] })[colorType];
      if (!width || !height || width * height > MAX_IMAGE_PIXELS || !validDepths?.includes(bitDepth)
        || chunkData[10] !== 0 || chunkData[11] !== 0 || ![0, 1].includes(chunkData[12])) return false;
      header = { width, height, bitDepth, colorType, interlace: chunkData[12] };
    } else if (type === 'PLTE') {
      if (sawData || sawPalette || !chunkLength || chunkLength > 768 || chunkLength % 3 !== 0) return false;
      sawPalette = true;
    } else if (type === 'IDAT') {
      if (dataEnded) return false;
      sawData = true;
      dataChunks.push(chunkData);
    } else if (type === 'IEND') {
      if (chunkLength !== 0 || !sawData || chunkEnd !== bytes.length) return false;
      sawEnd = true;
      offset = chunkEnd;
      break;
    } else if (type[0] === type[0]?.toUpperCase()) {
      return false;
    }
    offset = chunkEnd;
  }

  if (!header || (header.colorType === 3 && !sawPalette) || !sawData || !sawEnd) return false;
  const expectedBytes = expectedPngInflatedBytes(header.width, header.height, header.bitDepth, header.colorType, header.interlace);
  try {
    const inflated = inflateSync(Buffer.concat(dataChunks), { maxOutputLength: expectedBytes });
    return inflated.length === expectedBytes;
  } catch {
    return false;
  }
}

function isJpegStartOfFrame(marker) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function validateJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let offset = 2;
  let hasFrame = false;
  let hasScan = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) return hasFrame && hasScan && offset === bytes.length;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) return false;
    if (marker === 0x00 || offset + 2 > bytes.length) return false;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return false;
    const dataStart = offset + 2;
    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 8) return false;
      const height = bytes.readUInt16BE(dataStart + 1);
      const width = bytes.readUInt16BE(dataStart + 3);
      if (!width || !height || width * height > MAX_IMAGE_PIXELS) return false;
      hasFrame = true;
    }
    offset += segmentLength;
    if (marker === 0xda) {
      hasScan = true;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        let markerOffset = offset;
        while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
        if (markerOffset >= bytes.length) return false;
        const nextMarker = bytes[markerOffset];
        if (nextMarker === 0x00 || (nextMarker >= 0xd0 && nextMarker <= 0xd7)) {
          offset = markerOffset + 1;
          continue;
        }
        offset = markerOffset - 1;
        break;
      }
    }
  }
  return false;
}

function validateWebp(bytes) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) !== bytes.length - 8) return false;
  let offset = 12;
  let hasImageFrame = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return false;
    const type = bytes.toString('ascii', offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const nextOffset = dataEnd + (chunkLength % 2);
    if (dataEnd > bytes.length || nextOffset > bytes.length) return false;
    if (type === 'VP8 ') {
      if (chunkLength < 10 || (bytes[dataStart] & 1) !== 0
        || bytes[dataStart + 3] !== 0x9d || bytes[dataStart + 4] !== 0x01 || bytes[dataStart + 5] !== 0x2a) return false;
      const width = bytes.readUInt16LE(dataStart + 6) & 0x3fff;
      const height = bytes.readUInt16LE(dataStart + 8) & 0x3fff;
      if (!width || !height || width * height > MAX_IMAGE_PIXELS) return false;
      hasImageFrame = true;
    } else if (type === 'VP8L') {
      if (chunkLength < 5 || bytes[dataStart] !== 0x2f) return false;
      const dimensions = bytes.readUInt32LE(dataStart + 1);
      const width = (dimensions & 0x3fff) + 1;
      const height = ((dimensions >>> 14) & 0x3fff) + 1;
      if (width * height > MAX_IMAGE_PIXELS) return false;
      hasImageFrame = true;
    } else if (type === 'VP8X' && chunkLength < 10) {
      return false;
    }
    offset = nextOffset;
  }
  return offset === bytes.length && hasImageFrame;
}

const validators = {
  'image/png': validatePng,
  'image/jpeg': validateJpeg,
  'image/webp': validateWebp,
};

/** Validate an admin image upload's MIME type, container structure, and decoded dimensions. */
export function decodeCenterPosterUpload({ mimeType, dataBase64 } = {}) {
  if (!Object.hasOwn(validators, mimeType)) throw fail('Poster must be a PNG, JPEG, or WebP image');
  if (typeof dataBase64 !== 'string' || !dataBase64.length || dataBase64.length > MAX_BASE64_LENGTH) {
    throw fail('Poster image data is empty or exceeds 5 MB');
  }
  const paddingLength = dataBase64.endsWith('==') ? 2 : dataBase64.endsWith('=') ? 1 : 0;
  const contentLength = dataBase64.length - paddingLength;
  if (dataBase64.length % 4 !== 0) throw fail('Poster image data is not valid base64');
  for (let index = 0; index < contentLength; index += 1) {
    const character = dataBase64.charCodeAt(index);
    const isBase64Character = (character >= 65 && character <= 90)
      || (character >= 97 && character <= 122)
      || (character >= 48 && character <= 57)
      || character === 43 || character === 47;
    if (!isBase64Character) throw fail('Poster image data is not valid base64');
  }

  const bytes = Buffer.from(dataBase64, 'base64');
  if (!bytes.length) throw fail('Poster image data is empty');
  if (bytes.length > MAX_POSTER_BYTES) throw fail('Poster image exceeds 5 MB');
  if (bytes.toString('base64') !== dataBase64) throw fail('Poster image data is not canonical base64');
  if (!validators[mimeType](bytes)) throw fail('Poster image data is invalid or incomplete');
  return bytes;
}

const posterVersionSql = "to_char(updated_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS') AS version";

export async function getCenterPosterOverride() {
  const result = await getPool().query(`SELECT mime_type, content_bytes, ${posterVersionSql}
    FROM application_center_poster WHERE id=1`);
  const row = result.rows[0];
  return row ? { content: row.content_bytes, mimeType: row.mime_type, version: row.version } : null;
}

export async function saveCenterPoster({ mimeType, dataBase64 }, actorId) {
  const content = decodeCenterPosterUpload({ mimeType, dataBase64 });
  return transaction(async (client) => {
    const before = await client.query(`SELECT mime_type, octet_length(content_bytes) AS byte_length, ${posterVersionSql}
      FROM application_center_poster WHERE id=1`);
    const saved = await client.query(`INSERT INTO application_center_poster(id,mime_type,content_bytes,updated_by)
      VALUES(1,$1,$2,$3)
      ON CONFLICT(id) DO UPDATE SET mime_type=excluded.mime_type,content_bytes=excluded.content_bytes,
        updated_at=clock_timestamp(),updated_by=excluded.updated_by
      RETURNING ${posterVersionSql}`, [mimeType, content, actorId]);
    const prior = before.rows[0];
    const version = saved.rows[0].version;
    const afterData = { mimeType, byteLength: content.length, version };
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
      VALUES($1,'application_asset','center-poster','replace',$2::jsonb,$3::jsonb)`, [
      actorId,
      prior ? { mimeType: prior.mime_type, byteLength: Number(prior.byte_length), version: prior.version } : null,
      afterData,
    ]);
    return { version };
  });
}

export async function resetCenterPoster(actorId) {
  await transaction(async (client) => {
    const before = await client.query(`SELECT mime_type, octet_length(content_bytes) AS byte_length, ${posterVersionSql}
      FROM application_center_poster WHERE id=1`);
    await client.query('DELETE FROM application_center_poster WHERE id=1');
    const prior = before.rows[0];
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
      VALUES($1,'application_asset','center-poster','reset',$2::jsonb,NULL)`, [
      actorId,
      prior ? { mimeType: prior.mime_type, byteLength: Number(prior.byte_length), version: prior.version } : null,
    ]);
  });
}
