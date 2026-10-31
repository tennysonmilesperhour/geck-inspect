// Finds camera GPS data in photo bytes, and removes it without re-encoding.
//
// Used by scripts/photo-gps-audit.mjs. No dependencies: it walks the file's
// own structure (JPEG segments, PNG chunks, WebP chunks) to the EXIF block,
// a small TIFF directory where cameras write the GPS position, and reads the
// GPS directory's tag list. It never decodes the picture.
//
// Removing GPS works in place and keeps the file the same length: every GPS
// entry and its value bytes are overwritten with zeros and the GPS directory
// is left empty. Nothing else moves, so the picture data, orientation, and
// every other tag are untouched. For PNG the chunk checksum is recomputed.
// GPS written as XMP text (some editing apps do this) is reported but not
// removed; those files need a person to look at them.

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

export const GPS_TAG_NAMES = {
  0: 'GPSVersionID',
  1: 'GPSLatitudeRef',
  2: 'GPSLatitude',
  3: 'GPSLongitudeRef',
  4: 'GPSLongitude',
  5: 'GPSAltitudeRef',
  6: 'GPSAltitude',
  7: 'GPSTimeStamp',
  18: 'GPSMapDatum',
  27: 'GPSProcessingMethod',
  29: 'GPSDateStamp',
};

const ascii = (s) => Buffer.from(s, 'latin1');
const EXIF_HEADER = ascii('Exif\0\0');

export function sniffFormat(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString('latin1', 0, 6))) return 'gif';
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    if (brand.startsWith('avi')) return 'avif';
    return 'heif';
  }
  if (buf.length >= 4 && (buf.toString('latin1', 0, 4) === 'II*\0' || buf.toString('latin1', 0, 4) === 'MM\0*')) return 'tiff';
  return 'unknown';
}

function isTiffHeader(buf, at) {
  if (at + 8 > buf.length) return false;
  const h = buf.toString('latin1', at, at + 4);
  return h === 'II*\0' || h === 'MM\0*';
}

// Every EXIF block in the file: [{ tiff: offset of the TIFF header, end, container }].
// `truncated` is true when the walk ran off the end of the bytes we have, so
// a later block may exist in the part not downloaded.
export function findExifBlocks(buf) {
  const format = sniffFormat(buf);
  const blocks = [];
  let truncated = false;

  if (format === 'jpeg') {
    let p = 2;
    for (;;) {
      if (p + 2 > buf.length) { truncated = true; break; }
      if (buf[p] !== 0xff) break; // not a marker: corrupt, stop quietly
      const marker = buf[p + 1];
      if (marker === 0xff) { p += 1; continue; } // fill byte
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) break; // end of image, or picture data starts
      if (p + 4 > buf.length) { truncated = true; break; }
      const len = buf.readUInt16BE(p + 2);
      const dataStart = p + 4;
      const dataEnd = p + 2 + len;
      if (marker === 0xe1 && dataStart + 6 <= buf.length && buf.subarray(dataStart, dataStart + 6).equals(EXIF_HEADER)) {
        blocks.push({ tiff: dataStart + 6, end: Math.min(dataEnd, buf.length), container: 'jpeg-app1' });
        if (dataEnd > buf.length) truncated = true;
      }
      p = dataEnd;
    }
  } else if (format === 'png') {
    let p = 8;
    for (;;) {
      if (p + 8 > buf.length) { truncated = true; break; } // IEND not reached
      const len = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      const dataStart = p + 8;
      const dataEnd = dataStart + len;
      if (type === 'eXIf') {
        const start = buf.subarray(dataStart, dataStart + 6).equals(EXIF_HEADER) ? dataStart + 6 : dataStart;
        blocks.push({ tiff: start, end: Math.min(dataEnd, buf.length), container: 'png-exif', chunk: p });
        if (dataEnd > buf.length) truncated = true;
      }
      if (type === 'IEND') break;
      p = dataEnd + 4;
    }
  } else if (format === 'webp') {
    let p = 12;
    for (;;) {
      if (p + 8 > buf.length) { if (p < buf.readUInt32LE(4) + 8) truncated = true; break; }
      const fourcc = buf.toString('latin1', p, p + 4);
      const len = buf.readUInt32LE(p + 4);
      const dataStart = p + 8;
      const dataEnd = dataStart + len;
      if (fourcc === 'EXIF') {
        const start = buf.subarray(dataStart, dataStart + 6).equals(EXIF_HEADER) ? dataStart + 6 : dataStart;
        blocks.push({ tiff: start, end: Math.min(dataEnd, buf.length), container: 'webp-exif' });
        if (dataEnd > buf.length) truncated = true;
      }
      p = dataEnd + (len % 2);
    }
  } else if (format === 'tiff') {
    blocks.push({ tiff: 0, end: buf.length, container: 'tiff' });
  } else {
    // HEIF, AVIF and anything else: find the "Exif\0\0" marker followed by a
    // TIFF header. HEIF stores EXIF as an item whose payload starts this way.
    let from = 0;
    for (;;) {
      const at = buf.indexOf(EXIF_HEADER, from);
      if (at < 0) break;
      if (isTiffHeader(buf, at + 6)) blocks.push({ tiff: at + 6, end: buf.length, container: `${format}-search` });
      from = at + 1;
    }
    // Without a parser for the box layout we cannot know whether more follows.
    truncated = format === 'heif' || format === 'avif' || format === 'unknown';
  }
  return { format, blocks, truncated };
}

function reader(buf, tiff, end) {
  const le = buf.toString('latin1', tiff, tiff + 2) === 'II';
  const inRange = (off, n) => off >= 0 && tiff + off + n <= end;
  return {
    le,
    inRange,
    u16: (off) => (le ? buf.readUInt16LE(tiff + off) : buf.readUInt16BE(tiff + off)),
    u32: (off) => (le ? buf.readUInt32LE(tiff + off) : buf.readUInt32BE(tiff + off)),
  };
}

// Reads one EXIF block. Returns the GPS directory's location and entries.
export function readGpsDirectory(buf, block) {
  const { tiff, end } = block;
  if (!isTiffHeader(buf, tiff) || tiff + 8 > end) return { valid: false };
  const r = reader(buf, tiff, end);
  const ifd0 = r.u32(4);
  if (!r.inRange(ifd0, 2)) return { valid: true, truncated: true, gps: null };
  const n0 = r.u16(ifd0);
  let gpsOffset = null;
  for (let i = 0; i < n0; i += 1) {
    const e = ifd0 + 2 + i * 12;
    if (!r.inRange(e, 12)) return { valid: true, truncated: true, gps: null };
    if (r.u16(e) === 0x8825) gpsOffset = r.u32(e + 8);
  }
  if (gpsOffset === null) return { valid: true, truncated: false, gps: null };
  if (!r.inRange(gpsOffset, 2)) return { valid: true, truncated: true, gps: { offset: gpsOffset, entries: [] } };
  const count = r.u16(gpsOffset);
  const entries = [];
  let truncated = false;
  for (let i = 0; i < count; i += 1) {
    const e = gpsOffset + 2 + i * 12;
    if (!r.inRange(e, 12)) { truncated = true; break; }
    const tag = r.u16(e);
    const type = r.u16(e + 2);
    const n = r.u32(e + 4);
    const size = (TYPE_SIZES[type] || 1) * n;
    const valueAt = size > 4 ? r.u32(e + 8) : e + 8;
    const valueInRange = r.inRange(valueAt, size);
    let nonZero = false;
    if (valueInRange) {
      for (let k = 0; k < size; k += 1) if (buf[tiff + valueAt + k] !== 0) { nonZero = true; break; }
    } else {
      truncated = true;
    }
    entries.push({ tag, type, count: n, size, entryAt: e, valueAt, valueInRange, nonZero });
  }
  return { valid: true, truncated, gps: { offset: gpsOffset, count, entries } };
}

export function hasXmpGps(buf) {
  // XMP is plain text inside the file; GPS appears as exif:GPSLatitude etc.
  const text = buf.toString('latin1');
  return /exif:GPS(Latitude|Longitude)\b/.test(text);
}

// The one call the audit uses. Reports only which GPS tags exist, never
// their values, so a report can be shared without revealing where anyone lives.
export function inspectImage(buf) {
  const { format, blocks, truncated: walkTruncated } = findExifBlocks(buf);
  let truncated = walkTruncated;
  const tags = new Set();
  let gpsDirectory = false;
  let coordinates = false;
  for (const block of blocks) {
    const res = readGpsDirectory(buf, block);
    if (res.truncated) truncated = true;
    if (!res.gps) continue;
    gpsDirectory = true;
    const present = new Set();
    for (const e of res.gps.entries) {
      tags.add(GPS_TAG_NAMES[e.tag] || `GPSTag${e.tag}`);
      if (e.nonZero) present.add(e.tag);
    }
    if (present.has(2) && present.has(4)) coordinates = true;
  }
  const xmpGps = hasXmpGps(buf);
  return {
    format,
    exif: blocks.length > 0,
    gpsDirectory,
    gpsCoordinates: coordinates,
    gpsTags: [...tags].sort(),
    xmpGps,
    // GPS that would reveal a place: real coordinates in EXIF, or XMP GPS.
    hasGps: coordinates || xmpGps,
    truncated,
  };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Returns { buffer, changed, reason }. Never changes the input buffer.
// Refuses (changed false, with a reason) when the file is incomplete or the
// GPS is in XMP, so the caller leaves that photo alone.
export function stripGps(input) {
  const buf = Buffer.from(input);
  const { blocks, truncated } = findExifBlocks(buf);
  if (truncated && sniffFormat(buf) !== 'heif' && sniffFormat(buf) !== 'avif' && sniffFormat(buf) !== 'unknown') {
    return { buffer: input, changed: false, reason: 'incomplete_file' };
  }
  if (hasXmpGps(buf)) return { buffer: input, changed: false, reason: 'xmp_gps_needs_manual' };
  let changed = false;
  for (const block of blocks) {
    const res = readGpsDirectory(buf, block);
    if (!res.gps || res.gps.entries.length === 0) continue;
    if (res.truncated) return { buffer: input, changed: false, reason: 'incomplete_exif' };
    const r = reader(buf, block.tiff, block.end);
    for (const e of res.gps.entries) {
      if (e.size > 4 && e.valueInRange) buf.fill(0, block.tiff + e.valueAt, block.tiff + e.valueAt + e.size);
    }
    const first = res.gps.entries[0].entryAt;
    buf.fill(0, block.tiff + first, block.tiff + first + 12 * res.gps.entries.length);
    // An empty directory: count 0, and the next-directory pointer that now
    // sits right after the count is zero (the bytes were just cleared).
    if (r.le) buf.writeUInt16LE(0, block.tiff + res.gps.offset);
    else buf.writeUInt16BE(0, block.tiff + res.gps.offset);
    changed = true;
    if (block.container === 'png-exif') {
      const len = buf.readUInt32BE(block.chunk);
      const crc = crc32(buf.subarray(block.chunk + 4, block.chunk + 8 + len));
      buf.writeUInt32BE(crc, block.chunk + 8 + len);
    }
  }
  if (!changed) return { buffer: input, changed: false, reason: 'no_gps' };
  const after = inspectImage(buf);
  if (after.hasGps || after.gpsTags.length > 0 || buf.length !== input.length) {
    return { buffer: input, changed: false, reason: 'strip_verification_failed' };
  }
  return { buffer: buf, changed: true, reason: 'stripped' };
}
