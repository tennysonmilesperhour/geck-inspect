// GPS detection and removal for scripts/photo-gps-audit.mjs. The fixtures are
// tiny real images written by Pillow with a camera-style EXIF block (make,
// orientation, and a GPS position that points nowhere in particular).
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { crc32, findExifBlocks, inspectImage, readGpsDirectory, sniffFormat, stripGps } from '../exif-gps.mjs';
import { auditObject, parseArgs, selectObjects, stripObject, summarize } from '../../photo-gps-audit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFile(path.join(here, 'fixtures', name));

// A big-endian ("MM") EXIF block with a GPS directory, wrapped in a JPEG.
function bigEndianJpeg() {
  const tiff = Buffer.alloc(80);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // IFD0 at 8
  tiff.writeUInt16BE(1, 8); // one entry
  tiff.writeUInt16BE(0x8825, 10); // GPS pointer
  tiff.writeUInt16BE(4, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt32BE(26, 18); // GPS IFD at 26
  tiff.writeUInt32BE(0, 22); // no next IFD
  tiff.writeUInt16BE(2, 26); // two GPS entries
  // GPSLatitude: RATIONAL x1, value at 56
  tiff.writeUInt16BE(2, 28); tiff.writeUInt16BE(5, 30); tiff.writeUInt32BE(1, 32); tiff.writeUInt32BE(56, 36);
  // GPSLongitude: RATIONAL x1, value at 64
  tiff.writeUInt16BE(4, 40); tiff.writeUInt16BE(5, 42); tiff.writeUInt32BE(1, 44); tiff.writeUInt32BE(64, 48);
  tiff.writeUInt32BE(0, 52);
  tiff.writeUInt32BE(12, 56); tiff.writeUInt32BE(1, 60);
  tiff.writeUInt32BE(34, 64); tiff.writeUInt32BE(1, 68);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, payload, Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9])]);
}

describe('sniffFormat', () => {
  it('names the formats members upload', async () => {
    expect(sniffFormat(await fixture('gps.jpg'))).toBe('jpeg');
    expect(sniffFormat(await fixture('gps.png'))).toBe('png');
    expect(sniffFormat(await fixture('gps.webp'))).toBe('webp');
    expect(sniffFormat(await fixture('plain.gif'))).toBe('gif');
    const heic = Buffer.alloc(16);
    heic.write('ftypheic', 4, 'latin1');
    expect(sniffFormat(heic)).toBe('heif');
    expect(sniffFormat(Buffer.from('hello'))).toBe('unknown');
  });
});

describe('inspectImage', () => {
  it.each(['gps.jpg', 'gps.png', 'gps.webp'])('finds the GPS position in %s', async (name) => {
    const r = inspectImage(await fixture(name));
    expect(r.exif).toBe(true);
    expect(r.gpsCoordinates).toBe(true);
    expect(r.hasGps).toBe(true);
    expect(r.gpsTags).toEqual(expect.arrayContaining(['GPSLatitude', 'GPSLongitude', 'GPSAltitude']));
  });

  it('reports EXIF without GPS, and no EXIF at all, as clean', async () => {
    expect(inspectImage(await fixture('nogps.jpg'))).toMatchObject({ exif: true, gpsDirectory: false, hasGps: false });
    expect(inspectImage(await fixture('plain.jpg'))).toMatchObject({ exif: false, hasGps: false });
    expect(inspectImage(await fixture('plain.gif'))).toMatchObject({ format: 'gif', hasGps: false });
  });

  it('reads big-endian EXIF', () => {
    expect(inspectImage(bigEndianJpeg())).toMatchObject({ format: 'jpeg', gpsCoordinates: true, gpsTags: ['GPSLatitude', 'GPSLongitude'] });
  });

  it('never returns the coordinates themselves', async () => {
    const text = JSON.stringify(inspectImage(await fixture('gps.jpg')));
    expect(text).not.toMatch(/40|111|46\.3/);
  });

  it('says when the bytes stop before the EXIF block ends', async () => {
    const buf = await fixture('gps.jpg');
    const r = inspectImage(buf.subarray(0, 40));
    expect(r.truncated).toBe(true);
    expect(r.hasGps).toBe(false);
  });

  it('flags GPS written as XMP text', () => {
    const xmp = Buffer.from('<x:xmpmeta><rdf:Description exif:GPSLatitude="40,26.7N"/></x:xmpmeta>', 'latin1');
    const app1 = Buffer.alloc(4);
    const payload = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), xmp]);
    app1.writeUInt16BE(0xffe1, 0);
    app1.writeUInt16BE(payload.length + 2, 2);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, payload, Buffer.from([0xff, 0xd9])]);
    expect(inspectImage(jpeg)).toMatchObject({ xmpGps: true, hasGps: true, gpsCoordinates: false });
    expect(stripGps(jpeg)).toMatchObject({ changed: false, reason: 'xmp_gps_needs_manual' });
  });

  it('finds EXIF in a HEIF file by its marker', () => {
    const jpeg = bigEndianJpeg();
    const { blocks } = findExifBlocks(jpeg);
    const tiff = jpeg.subarray(blocks[0].tiff, blocks[0].end);
    const head = Buffer.alloc(16);
    head.writeUInt32BE(16, 0);
    head.write('ftypheic', 4, 'latin1');
    const heic = Buffer.concat([head, Buffer.alloc(20), Buffer.from([0, 0, 0, 6]), Buffer.from('Exif\0\0', 'latin1'), tiff]);
    expect(inspectImage(heic)).toMatchObject({ format: 'heif', gpsCoordinates: true });
  });
});

describe('stripGps', () => {
  it.each(['gps.jpg', 'gps.png', 'gps.webp'])('removes GPS from %s in place and keeps everything else', async (name) => {
    const before = await fixture(name);
    const { buffer, changed } = stripGps(before);
    expect(changed).toBe(true);
    expect(buffer.length).toBe(before.length);
    const after = inspectImage(buffer);
    expect(after).toMatchObject({ exif: true, hasGps: false, gpsTags: [] });
    // The input is not modified.
    expect(inspectImage(before).hasGps).toBe(true);
    // Only bytes inside the EXIF block changed.
    const { blocks } = findExifBlocks(before);
    for (let i = 0; i < before.length; i += 1) {
      if (before[i] !== buffer[i]) {
        const inside = blocks.some((b) => i >= b.tiff && i < b.end) || (name === 'gps.png');
        expect(inside).toBe(true);
      }
    }
    // Orientation (tag 0x0112) is still in IFD0.
    const block = findExifBlocks(buffer).blocks[0];
    const le = buffer.toString('latin1', block.tiff, block.tiff + 2) === 'II';
    const u16 = (o) => (le ? buffer.readUInt16LE(block.tiff + o) : buffer.readUInt16BE(block.tiff + o));
    const u32 = (o) => (le ? buffer.readUInt32LE(block.tiff + o) : buffer.readUInt32BE(block.tiff + o));
    const ifd0 = u32(4);
    const tags = Array.from({ length: u16(ifd0) }, (_, i) => u16(ifd0 + 2 + i * 12));
    expect(tags).toContain(0x0112);
  });

  it('keeps the PNG chunk checksum valid', async () => {
    const { buffer } = stripGps(await fixture('gps.png'));
    const { blocks } = findExifBlocks(buffer);
    const at = blocks[0].chunk;
    const len = buffer.readUInt32BE(at);
    expect(buffer.readUInt32BE(at + 8 + len)).toBe(crc32(buffer.subarray(at + 4, at + 8 + len)));
  });

  it('strips big-endian EXIF and empties the GPS directory', () => {
    const { buffer, changed } = stripGps(bigEndianJpeg());
    expect(changed).toBe(true);
    const block = findExifBlocks(buffer).blocks[0];
    expect(readGpsDirectory(buffer, block).gps.entries).toEqual([]);
  });

  it('leaves clean and incomplete files alone', async () => {
    expect(stripGps(await fixture('nogps.jpg'))).toMatchObject({ changed: false, reason: 'no_gps' });
    const cut = (await fixture('gps.jpg')).subarray(0, 60);
    expect(stripGps(cut)).toMatchObject({ changed: false, reason: 'incomplete_file' });
  });
});

describe('photo-gps-audit', () => {
  it('parses options and refuses unsafe combinations', () => {
    expect(parseArgs([]).buckets).toEqual(['geck-inspect-media', 'promote-images']);
    expect(() => parseArgs(['--apply'])).toThrow(/--strip/);
    expect(() => parseArgs(['--strip'])).toThrow(/--backup-dir/);
    expect(parseArgs(['--strip', '--backup-dir', '/x']).apply).toBe(false);
  });

  it('skips thumbnails and objects after the cutoff', () => {
    const objs = [
      { bucket: 'b', name: 'u/1.jpg', createdAt: '2026-09-01' },
      { bucket: 'b', name: 'thumbs/u/1.jpg', createdAt: '2026-09-01' },
      { bucket: 'b', name: 'u/2.jpg', createdAt: '2026-10-20' },
    ];
    expect(selectObjects(objs, { includeThumbs: false, before: new Date('2026-10-01'), limit: Infinity }).map((o) => o.name)).toEqual(['u/1.jpg']);
  });

  it('reads the first part, then the whole file when the GPS could be later', async () => {
    const png = await fixture('gps.png');
    const calls = [];
    const fetchBytes = async (url, key, range) => {
      calls.push(range);
      // Pretend the server sent only 40 bytes for a ranged request.
      return range ? { buf: png.subarray(0, 40), complete: false } : { buf: png, complete: true };
    };
    const row = await auditObject({ bucket: 'b', name: 'a.png' }, { base: 'https://x', key: '', fetchBytes });
    expect(calls).toEqual([256 * 1024, null]);
    expect(row).toMatchObject({ hasGps: true, format: 'png' });
    expect(summarize([row, { error: 'HTTP 404' }])).toMatchObject({ scanned: 2, errors: 1, with_gps: 1 });
  });

  it('strip mode saves the original before writing anything and uploads only with apply', async () => {
    const jpg = await fixture('gps.jpg');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'gps-strip-'));
    const uploads = [];
    let stored = jpg;
    const fetchBytes = async () => ({ buf: stored, complete: true });
    const upload = async (base, key, obj, buffer) => { uploads.push(obj.name); stored = buffer; };
    const obj = { bucket: 'geck-inspect-media', name: 'u/a.jpg', ownerId: 'owner-1' };

    const local = await stripObject(obj, { base: 'https://x', key: 'k', backupDir: dir, apply: false, fetchBytes, upload });
    expect(local.status).toBe('stripped_locally');
    expect(uploads).toEqual([]);
    expect(await readFile(local.backup)).toEqual(jpg);
    expect(inspectImage(await readFile(local.stripped)).hasGps).toBe(false);

    const applied = await stripObject(obj, { base: 'https://x', key: 'k', backupDir: dir, apply: true, fetchBytes, upload });
    expect(applied.status).toBe('uploaded');
    expect(uploads).toEqual(['u/a.jpg']);
    // The backup still holds the untouched original.
    expect(await readFile(applied.backup)).toEqual(jpg);
    expect(await readdir(path.join(dir, 'originals', 'geck-inspect-media', 'u'))).toEqual(['a.jpg']);
  });
});
