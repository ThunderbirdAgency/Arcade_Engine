// Tiny MP4 prober (no ffprobe needed): reads the mvhd atom for duration and the first tkhd for size.
import fs from 'node:fs';

export function probeMp4(file) {
  const buf = fs.readFileSync(file);
  const out = { bytes: buf.length, duration: null, width: null, height: null, fastStart: null };
  let firstAtoms = [];
  const walk = (start, end, depth) => {
    let pos = start;
    while (pos + 8 <= end) {
      let size = buf.readUInt32BE(pos);
      const type = buf.toString('latin1', pos + 4, pos + 8);
      let header = 8;
      if (size === 1) { size = Number(buf.readBigUInt64BE(pos + 8)); header = 16; }
      if (size === 0) size = end - pos;
      if (size < header) break;
      if (depth === 0) firstAtoms.push(type);
      if (['moov', 'trak', 'mdia'].includes(type)) walk(pos + header, pos + size, depth + 1);
      if (type === 'mvhd') {
        const v = buf[pos + header];
        const ts = v === 1 ? buf.readUInt32BE(pos + header + 20) : buf.readUInt32BE(pos + header + 12);
        const dur = v === 1 ? Number(buf.readBigUInt64BE(pos + header + 24)) : buf.readUInt32BE(pos + header + 16);
        if (ts) out.duration = Math.round((dur / ts) * 1000) / 1000;
      }
      if (type === 'tkhd' && out.width == null) {
        const v = buf[pos + header];
        const off = pos + header + (v === 1 ? 88 : 76);
        const w = buf.readUInt32BE(off) / 65536, h = buf.readUInt32BE(off + 4) / 65536;
        if (w && h) { out.width = Math.round(w); out.height = Math.round(h); }
      }
      pos += size;
    }
  };
  walk(0, buf.length, 0);
  const moov = firstAtoms.indexOf('moov'), mdat = firstAtoms.indexOf('mdat');
  out.fastStart = moov >= 0 && (mdat < 0 || moov < mdat);
  return out;
}
