const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '../AVIATOR_BIBLE.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Column indices (0-based)
const COL = {
  name: 1, desc: 2, dealer: 3, msrp: 4,
  itemType: 7, collection: 8,
  channels: 24,
  p2: 25, p4: 26, p8: 27, p70v: 28,
  totalPower: 33,
  inputs: 34, outputs: 35,
  impedance: 39,
  taps: 42,
};

// ── helpers ──────────────────────────────────────────────────────────────────

function parseOhm(s) {
  if (!s) return undefined;
  s = String(s).toLowerCase().trim();
  // Pure 70V entries have no lo-Z ohm value
  if (/^70v/.test(s)) return undefined;
  const m = s.match(/(\d+(\.\d+)?)/);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  if (v >= 2 && v <= 32) return v;
  return undefined;
}

function parse70vTaps(s) {
  if (!s) return [];
  s = String(s);
  // Prefer the 70V section
  const m70 = s.match(/70V\s*[:/]?\s*([^;|]+)/i);
  const src = m70 ? m70[1] : s;
  const nums = src.match(/\d+(\.\d+)?/g);
  if (!nums) return [];
  return nums.map(Number).filter(n => n > 0);
}

function parseSingleTap(s) {
  if (!s) return [];
  const nums = String(s).match(/\d+(\.\d+)?/g);
  if (!nums) return [];
  return nums.map(Number).filter(n => n > 0);
}

// ── AMP PARSING ──────────────────────────────────────────────────────────────

function parseAmpChannels(row) {
  const name = String(row[COL.name]).trim();
  const channels = [];

  if (name.startsWith('ProA')) {
    const p70v = String(row[COL.p70v] || '');
    const p8   = String(row[COL.p8]   || '');
    const chanStr = String(row[COL.channels] || '');

    // lo-Z count
    const loZMatch = chanStr.match(/(\d+)\s*x\s*lo-?z/i);
    const loZCount = loZMatch ? parseInt(loZMatch[1]) : 2;

    // hi-Z count — use p70v column (e.g. "4 x 125 W"), more reliable than channels col
    const hiZMatch = p70v.match(/^(\d+)\s*x/i);
    const hiZCount = hiZMatch ? parseInt(hiZMatch[1]) : 1;

    // watts per lo-Z channel at 8Ω
    const p8WattsMatch = p8.match(/(\d+)\s*W/i);
    const loZWatts = p8WattsMatch ? parseInt(p8WattsMatch[1]) : undefined;

    // watts per hi-Z channel
    const hiZWattsMatch = p70v.match(/(\d+)\s*W/i);
    const hiZWatts = hiZWattsMatch ? parseInt(hiZWattsMatch[1]) : undefined;

    // min impedance: ProA1000/1200 have @2Ω column populated → 2Ω; others → 4Ω
    const has2OhmSpec = !!(row[COL.p2] && String(row[COL.p2]).trim());
    const minImpedance = has2OhmSpec ? 2 : 4;

    for (let i = 1; i <= loZCount; i++) {
      channels.push({ id: `loz${i}`, label: `Ch ${i} Lo-Z`, outputMode: 'lo-z', maxWatts: loZWatts, ratedImpedance: 8, minImpedance });
    }
    for (let i = 1; i <= hiZCount; i++) {
      channels.push({ id: `hiz${i}`, label: `Ch ${i} Hi-Z`, outputMode: 'hi-z', hiZWatts });
    }

  } else if (name.startsWith('SubA')) {
    // 1 lo-Z, min 2Ω — use @8Ω as rated watts
    const p8Str = String(row[COL.p8] || '');
    const p4Str = String(row[COL.p4] || '');
    const w8 = p8Str.match(/(\d+)\s*W/i);
    const w4 = p4Str.match(/(\d+)\s*W/i);
    const maxWatts = w8 ? parseInt(w8[1]) : (w4 ? parseInt(w4[1]) : undefined);
    channels.push({ id: 'loz1', label: 'Sub Lo-Z', outputMode: 'lo-z', maxWatts, ratedImpedance: w8 ? 8 : 4, minImpedance: 2 });

  } else if (name === 'DSP2-200') {
    for (let i = 1; i <= 2; i++) {
      channels.push({ id: `loz${i}`, label: `Ch ${i} Lo-Z`, outputMode: 'lo-z', maxWatts: 200, ratedImpedance: 4, minImpedance: 4 });
    }
  } else if (name === 'DSP3-150') {
    channels.push({ id: 'loz1', label: 'Ch L Lo-Z', outputMode: 'lo-z', maxWatts: 150, ratedImpedance: 4, minImpedance: 4 });
    channels.push({ id: 'loz2', label: 'Ch R Lo-Z', outputMode: 'lo-z', maxWatts: 150, ratedImpedance: 4, minImpedance: 4 });
    channels.push({ id: 'loz3', label: 'Sub Lo-Z',  outputMode: 'lo-z', maxWatts: 300, ratedImpedance: 4, minImpedance: 4 });
  } else if (name === 'DSP60.8') {
    for (let i = 1; i <= 8; i++) {
      channels.push({ id: `loz${i}`, label: `Ch ${i} Lo-Z`, outputMode: 'lo-z', maxWatts: 60, ratedImpedance: 4, minImpedance: 4 });
    }
    for (let i = 1; i <= 4; i++) {
      channels.push({ id: `hiz${i}`, label: `Ch ${i} Hi-Z`, outputMode: 'hi-z', hiZWatts: 125 });
    }
  }

  return channels;
}

// ── SPEAKER PARSING ──────────────────────────────────────────────────────────

const SKIP_SPEAKERS = new Set(['AM6500', 'M3500', 'M5500OW', 'OSR65', 'OSR85', 'THTR67', 'MOS36SA250K', 'P80DT']);
const SKIP_SUBS     = new Set(['AMD10-SUB', 'Blends800Sub', 'SUBD10', 'SUBD8', 'BlendsCSUB10']);

function parseSpeakerEntry(row) {
  const tapStr = String(row[COL.taps] || '').trim();
  const impedance = parseOhm(row[COL.impedance]);
  const hasTaps = !!tapStr;

  let speakerType;
  if (!hasTaps) {
    speakerType = 'lo-z';
  } else if (hasTaps && impedance !== undefined) {
    speakerType = 'tappable';
  } else {
    speakerType = 'hi-z';
  }

  let tapOptions;
  if (hasTaps) {
    tapOptions = tapStr.includes(',') ? parse70vTaps(tapStr) : parseSingleTap(tapStr);
    if (tapOptions.length === 0) tapOptions = undefined;
  }

  return { speakerType, impedance, tapOptions };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

const amps = [];
const speakers = [];
const subs = [];

rows.slice(1).forEach(row => {
  if (!row[COL.name]) return;
  const name = String(row[COL.name]).trim();
  const type = String(row[COL.itemType] || '').trim();
  const collection = String(row[COL.collection] || '').trim();

  if (type === 'Amplifier') {
    const channels = parseAmpChannels(row);
    if (!channels.length) return;
    const loZ = channels.filter(c => c.outputMode === 'lo-z').length;
    const hiZ = channels.filter(c => c.outputMode === 'hi-z').length;
    const subtitleParts = [];
    if (loZ) subtitleParts.push(`${loZ}× Lo-Z`);
    if (hiZ) subtitleParts.push(`${hiZ}× Hi-Z`);
    amps.push({
      modelId: name,
      name,
      series: collection,
      subtitle: subtitleParts.join(' · '),
      dealer: row[COL.dealer] ? Number(row[COL.dealer]) : undefined,
      msrp:   row[COL.msrp]   ? Number(row[COL.msrp])   : undefined,
      channels,
    });

  } else if (type === 'Speaker') {
    const skip = SKIP_SPEAKERS.has(name);
    const { speakerType, impedance, tapOptions } = skip
      ? { speakerType: 'lo-z', impedance: undefined, tapOptions: undefined }
      : parseSpeakerEntry(row);
    speakers.push({
      modelId: name,
      name,
      collection,
      speakerType,
      ...(impedance !== undefined && { impedance }),
      ...(tapOptions            && { tapOptions }),
      ...(skip || (speakerType === 'lo-z' && impedance === undefined) ? { specsUnavailable: true } : {}),
    });

  } else if (type === 'Subwoofer') {
    const skip = SKIP_SUBS.has(name);
    const { speakerType, impedance, tapOptions } = skip
      ? { speakerType: 'lo-z', impedance: undefined, tapOptions: undefined }
      : parseSpeakerEntry(row);
    subs.push({
      modelId: name,
      name,
      collection,
      speakerType,
      ...(impedance !== undefined && { impedance }),
      ...(tapOptions            && { tapOptions }),
      ...(skip || (speakerType === 'lo-z' && impedance === undefined) ? { specsUnavailable: true } : {}),
    });
  }
});

// ── WRITE OUTPUT ─────────────────────────────────────────────────────────────

const out = `// AUTO-GENERATED by scripts/generate-catalog.cjs — do not hand-edit
// Source: AVIATOR_BIBLE.xlsx

export interface AmpChannel {
  id: string
  label: string
  outputMode: 'lo-z' | 'hi-z'
  maxWatts?: number        // W at ratedImpedance
  ratedImpedance?: number  // Ω
  minImpedance?: number    // Ω
  hiZWatts?: number        // 70V channel capacity (W)
}

export interface AmpModel {
  modelId: string
  name: string
  series: string
  subtitle: string
  dealer?: number
  msrp?: number
  channels: AmpChannel[]
}

export interface SpeakerModel {
  modelId: string
  name: string
  collection: string
  speakerType: 'lo-z' | 'hi-z' | 'tappable'
  impedance?: number      // Ω nominal
  tapOptions?: number[]   // 70V watt taps (descending)
  specsUnavailable?: boolean
}

export interface SourceModel {
  modelId: string
  name: string
  badge: string
  description: string
}

export const AMPS: AmpModel[] = ${JSON.stringify(amps, null, 2)};

export const SPEAKERS: SpeakerModel[] = ${JSON.stringify(speakers, null, 2)};

export const SUBS: SpeakerModel[] = ${JSON.stringify(subs, null, 2)};

export const MUSIC_SOURCE: SourceModel = {
  modelId: 'music-source',
  name: 'Music Source',
  badge: 'STREAM',
  description: 'Generic streaming source (WiiM, Bluesound, etc.)',
};
`;

const outPath = path.join(__dirname, '../src/data/catalog.ts');
fs.writeFileSync(outPath, out);
console.log(`Wrote ${amps.length} amps, ${speakers.length} speakers, ${subs.length} subs → ${outPath}`);
