/**
 * Appendix histograms — per-instance error count distributions
 *
 * Generates four bar charts (syntax, conversion, structural, total) showing
 * how many of the 600 CPEE instances fall into each error-count bin.
 * The zero bin is excluded from the chart; the count of error-free instances
 * is shown in the subtitle instead.
 *
 * Bins: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11–15, 16–20, 21–30, 31–40, >40
 *
 * Output (local + Thesis_Latex/img/appendix-histograms/):
 *   hist-syntax.png
 *   hist-conversion.png
 *   hist-structural.png
 *   hist-total.png
 *
 * Run:  node scripts/instance-catalogue/appendix-histograms/chart-histograms.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'errorCounts.json');
const OUT_DIR   = __dirname;
const THESIS_DIR = join(__dirname, '..', '..', '..', '..', 'Thesis_Latex', 'img', 'appendix-histograms');

// ── bins ──────────────────────────────────────────────────────────────────────
const BINS = [
  { label: '1',     test: (v) => v === 1  },
  { label: '2',     test: (v) => v === 2  },
  { label: '3',     test: (v) => v === 3  },
  { label: '4',     test: (v) => v === 4  },
  { label: '5',     test: (v) => v === 5  },
  { label: '6',     test: (v) => v === 6  },
  { label: '7',     test: (v) => v === 7  },
  { label: '8',     test: (v) => v === 8  },
  { label: '9',     test: (v) => v === 9  },
  { label: '10',    test: (v) => v === 10 },
  { label: '11–15', test: (v) => v >= 11 && v <= 15 },
  { label: '16–20', test: (v) => v >= 16 && v <= 20 },
  { label: '21–30', test: (v) => v >= 21 && v <= 30 },
  { label: '31–40', test: (v) => v >= 31 && v <= 40 },
  { label: '>40',   test: (v) => v > 40  },
];

// ── style ─────────────────────────────────────────────────────────────────────
const FONT  = "'Times New Roman', Times, serif";
const COLOR = '#0065BD';   // TUM blue
const SCALE = 3;           // render at 3× for crisp thesis inclusion

// ── chart config ──────────────────────────────────────────────────────────────
const CHARTS = [
  { key: 'syntaxErrors',      title: 'Syntax Error Count Distribution',     file: 'hist-syntax.png'     },
  { key: 'conversionErrors',  title: 'Conversion Error Count Distribution', file: 'hist-conversion.png' },
  { key: 'structuralErrors',  title: 'Structural Error Count Distribution', file: 'hist-structural.png' },
  { key: 'total',             title: 'Total Error Count Distribution',      file: 'hist-total.png'      },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function computeCounts(values) {
  return BINS.map((b) => values.filter(b.test).length);
}

function buildSvg(counts, title, n, zeroCount) {
  const W = 980;
  const H = 460;
  const ML = 68;   // left margin (y-axis labels)
  const MR = 24;
  const MT = 46;   // top margin (title only, no subtitle)
  const MB = 85;   // bottom margin (rotated x-axis tick labels)
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const maxCount = Math.max(...counts, 1);
  // round y-axis max up to a round number
  const yMax = Math.ceil(maxCount / 50) * 50 || 10;

  const yScale = (v) => MT + plotH - (v / yMax) * plotH;

  const barCount = BINS.length;
  const slotW    = plotW / barCount;
  const barW     = slotW * 0.65;

  const parts = [];

  // SVG root
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
    `width="${W * SCALE}" height="${H * SCALE}">`
  );

  // styles
  parts.push(`<style>`);
  parts.push(`  .title      { font: bold 21px ${FONT}; }`);
  parts.push(`  .axis-lbl   { font: 15px ${FONT}; fill: #333; }`);
  parts.push(`  .tick-lbl   { font: 13px ${FONT}; fill: #333; }`);
  parts.push(`  .bar-lbl    { font: 11px ${FONT}; fill: #444; }`);
  parts.push(`</style>`);

  // background
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);

  // title
  parts.push(
    `<text x="${W / 2}" y="34" text-anchor="middle" class="title">${title}</text>`
  );

  // y-axis gridlines + tick labels
  const yTicks = 6;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((yMax / yTicks) * i);
    const y   = yScale(val);
    parts.push(
      `<line x1="${ML}" y1="${y}" x2="${ML + plotW}" y2="${y}" ` +
      `stroke="#e0e0e0" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${ML - 8}" y="${y + 5}" text-anchor="end" class="tick-lbl">${val}</text>`
    );
  }

  // axes
  parts.push(
    `<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + plotH}" stroke="#333" stroke-width="2"/>`
  );
  parts.push(
    `<line x1="${ML}" y1="${MT + plotH}" x2="${ML + plotW}" y2="${MT + plotH}" ` +
    `stroke="#333" stroke-width="2"/>`
  );

  // bars
  for (let i = 0; i < barCount; i++) {
    const cx    = ML + slotW * i + slotW / 2;
    const bx    = cx - barW / 2;
    const count = counts[i];
    const barH  = (count / yMax) * plotH;
    const by    = MT + plotH - barH;

    // bar
    if (count > 0) {
      parts.push(
        `<rect x="${bx}" y="${by}" width="${barW}" height="${barH}" ` +
        `fill="${COLOR}" rx="2"/>`
      );
      // value label above bar
      parts.push(
        `<text x="${cx}" y="${by - 5}" text-anchor="middle" class="bar-lbl">${count}</text>`
      );
    } else {
      // zero — draw a thin baseline marker so the bin is visually present
      parts.push(
        `<rect x="${bx}" y="${MT + plotH - 2}" width="${barW}" height="2" ` +
        `fill="#ccc" rx="1"/>`
      );
    }

    // x-axis label — rotated 45° so the range labels fit
    const lx = cx;
    const ly = MT + plotH + 10;
    parts.push(
      `<text transform="rotate(-45, ${lx}, ${ly})" x="${lx}" y="${ly}" ` +
      `text-anchor="end" class="tick-lbl">${BINS[i].label}</text>`
    );
  }

  // y-axis label — centred in the gap between the left edge and the tick numbers
  // tick numbers (right-aligned at ML-8) are ~28px wide, starting at ~ML-36
  // so place label centre at ML-50 to sit just left of the numbers
  const axX = ML - 50;
  const axY = MT + plotH / 2;
  parts.push(
    `<text transform="rotate(-90, ${axX}, ${axY})" x="${axX}" y="${axY}" ` +
    `text-anchor="middle" class="axis-lbl">Number of instances</text>`
  );

  // x-axis label — just below the rotated tick labels
  // tick anchors are at MT+plotH+10; labels extend ~25px downward (45° diagonal)
  const xLblY = MT + plotH + 10 + 28 + 14;
  parts.push(
    `<text x="${ML + plotW / 2}" y="${xLblY}" text-anchor="middle" class="axis-lbl">` +
    `Errors per instance</text>`
  );

  parts.push('</svg>');
  return parts.join('\n');
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(THESIS_DIR, { recursive: true });

  const raw       = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const instances = Object.values(raw);
  const n         = instances.length;

  for (const chart of CHARTS) {
    const values =
      chart.key === 'total'
        ? instances.map((i) => i.syntaxErrors + i.conversionErrors + i.structuralErrors)
        : instances.map((i) => i[chart.key]);

    const zeroCount = values.filter((v) => v === 0).length;
    const counts    = computeCounts(values);
    const svg       = buildSvg(counts, chart.title, n, zeroCount);
    const buf    = Buffer.from(svg);

    const localPath  = join(OUT_DIR, chart.file);
    const thesisPath = join(THESIS_DIR, chart.file);

    await sharp(buf).png().toFile(localPath);
    await sharp(buf).png().toFile(thesisPath);
    console.log(`Wrote ${localPath}`);
    console.log(`Wrote ${thesisPath}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
