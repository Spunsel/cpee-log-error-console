/**
 * Chart 4 — Error Diagnosis: Log vs Console (Heatmap)
 *
 * Two side-by-side heatmaps (nature + cause). Axes use numeric codes (N1–N4,
 * C1–C4) with a shared legend below. A bold separator line divides the
 * "Unsure" row/column from the rest. N4/C4 highlighted in TUM Orange.
 *
 * Output: chart-error-heatmap.png
 *
 * Run:  node scripts/questionnaire-results/chart-error-heatmap.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, 'questionnaire-answers.json');
const OUT_PATH = join(__dirname, 'chart-error-heatmap.png');
const THESIS_IMG = join(__dirname, '..', '..', '..', 'Thesis_Latex', 'img', 'questionnaire-analysis', 'chart-error-heatmap.png');

const PROCS = [9779, 9784, 140971];
const SCALE = 3;
const FONT = "'Times New Roman', Times, serif";
const UNSURE_COLOR = '#E37222';

const NATURE_ITEMS = [
  { code: 'N1', label: 'Syntax Error' },
  { code: 'N2', label: 'Conversion Error' },
  { code: 'N3', label: 'Structural Error' },
  { code: 'N4', label: 'Unsure', unsure: true },
];
const CAUSE_ITEMS = [
  { code: 'C1', label: 'LLM-generated output' },
  { code: 'C2', label: 'CPEE-to-Mermaid conversion' },
  { code: 'C3', label: 'Mermaid-to-CPEE conversion' },
  { code: 'C4', label: 'Unsure', unsure: true },
];

function loadAnswered(data) {
  return data.questionnaires.filter((q) => {
    const a = q.answers;
    return PROCS.some(
      (p) =>
        a[`log-${p} What is the nature of the error?`] !== '' ||
        a[`console-${p} What is the nature of the error?`] !== '' ||
        a[`log-${p} What is the most likely cause for the error?`] !== '' ||
        a[`console-${p} What is the most likely cause for the error?`] !== '',
    );
  });
}

function normalizeMulti(raw) {
  if (!raw || raw === '') return [];
  return raw.split(/;\s*/).map((s) => s.trim()).filter(Boolean);
}

function buildMatrix(participants, logTemplate, consoleTemplate, labels) {
  const matrix = labels.map(() => labels.map(() => 0));
  for (const p of participants) {
    for (const proc of PROCS) {
      const logRaw = p.answers[logTemplate.replace('{p}', proc)];
      const consoleRaw = p.answers[consoleTemplate.replace('{p}', proc)];
      if (logRaw === '' && consoleRaw === '') continue;
      const logVals = normalizeMulti(logRaw);
      const consoleVals = normalizeMulti(consoleRaw);
      if (logVals.length === 0) logVals.push('Unsure');
      if (consoleVals.length === 0) consoleVals.push('Unsure');
      for (const lv of logVals) {
        for (const cv of consoleVals) {
          const ri = labels.indexOf(lv);
          const ci = labels.indexOf(cv);
          if (ri !== -1 && ci !== -1) matrix[ri][ci]++;
        }
      }
    }
  }
  return matrix;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cellColor(v, max) {
  if (v === 0) return '#f0f0f0';
  const t = max === 0 ? 0 : v / max;
  const r = Math.round(240 - t * (240 - 0));
  const g = Math.round(240 - t * (240 - 82));
  const b = Math.round(240 - t * (240 - 147));
  return `rgb(${r},${g},${b})`;
}

function drawHeatmap(parts, matrix, items, ox, oy, subtitle) {
  const CELL = 64;
  const CODE_W = 52;
  const n = items.length;
  const gridW = n * CELL;
  const gridH = n * CELL;
  const headerH = 66;
  const sepIdx = n - 1;

  parts.push(`<text x="${ox + CODE_W + gridW / 2}" y="${oy}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="bold">${esc(subtitle)}</text>`);
  parts.push(`<text x="${ox + CODE_W + gridW / 2}" y="${oy + headerH - 24}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#222">Console answer</text>`);

  for (let c = 0; c < n; c++) {
    const cx = ox + CODE_W + c * CELL + CELL / 2;
    const isUnsure = items[c].unsure;
    const fill = isUnsure ? UNSURE_COLOR : '#222';
    parts.push(`<text x="${cx}" y="${oy + headerH}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="bold" fill="${fill}">${items[c].code}</text>`);
  }

  const topY = oy + headerH + 8;

  parts.push(`<text transform="translate(${ox + 8}, ${topY + gridH / 2}) rotate(-90)" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#222">Log answer</text>`);

  for (let r = 0; r < n; r++) {
    const ry = topY + r * CELL + CELL / 2 + 5;
    const isUnsure = items[r].unsure;
    const fill = isUnsure ? UNSURE_COLOR : '#222';
    parts.push(`<text x="${ox + CODE_W - 8}" y="${ry}" text-anchor="end" font-family="${FONT}" font-size="15" font-weight="bold" fill="${fill}">${items[r].code}</text>`);
  }

  const maxVal = Math.max(1, ...matrix.flat());

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const rx = ox + CODE_W + c * CELL;
      const ryTop = topY + r * CELL;
      const v = matrix[r][c];
      parts.push(`<rect x="${rx}" y="${ryTop}" width="${CELL}" height="${CELL}" fill="${cellColor(v, maxVal)}" stroke="white" stroke-width="2.5" rx="4"/>`);
      if (v > 0) {
        const textFill = v / maxVal > 0.45 ? 'white' : '#333';
        parts.push(`<text x="${rx + CELL / 2}" y="${ryTop + CELL / 2 + 6}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="bold" fill="${textFill}">${v}</text>`);
      }
    }
  }

  const sepLineStyle = `stroke="#111" stroke-width="2.5"`;
  const hLineY = topY + sepIdx * CELL;
  parts.push(`<line x1="${ox + 20}" y1="${hLineY}" x2="${ox + CODE_W + gridW}" y2="${hLineY}" ${sepLineStyle}/>`);
  const vLineX = ox + CODE_W + sepIdx * CELL;
  parts.push(`<line x1="${vLineX}" y1="${oy + headerH - 14}" x2="${vLineX}" y2="${topY + gridH}" ${sepLineStyle}/>`);

  return { w: CODE_W + gridW, h: headerH + 8 + gridH };
}

function drawLegend(parts, items, ox, oy, heading) {
  parts.push(`<text x="${ox}" y="${oy}" font-family="${FONT}" font-size="15" font-weight="bold" fill="#222">${esc(heading)}</text>`);
  for (let i = 0; i < items.length; i++) {
    const ly = oy + 24 + i * 22;
    const isUnsure = items[i].unsure;
    const codeFill = isUnsure ? UNSURE_COLOR : '#222';
    const labelAttr = isUnsure
      ? `font-weight="bold" fill="${UNSURE_COLOR}"`
      : `fill="#222"`;
    parts.push(`<text x="${ox}" y="${ly}" font-family="${FONT}" font-size="14"><tspan font-weight="bold" fill="${codeFill}">${items[i].code}</tspan>  <tspan ${labelAttr}>${esc(items[i].label)}</tspan></text>`);
  }
  return 24 + items.length * 22;
}

function buildSvg(natureMatrix, causeMatrix) {
  const GAP = 60;
  const ML = 30, MR = 30, MT = 52, MB = 12;
  const LEGEND_TOP = 20;

  const tmpParts = [];
  const s1 = drawHeatmap(tmpParts, natureMatrix, NATURE_ITEMS, 0, 0, '');
  const s2 = drawHeatmap(tmpParts, causeMatrix, CAUSE_ITEMS, 0, 0, '');

  const heatmapsW = s1.w + GAP + s2.w;
  const totalW = ML + heatmapsW + MR;
  const heatmapH = Math.max(s1.h, s2.h);

  const legendY = MT + heatmapH + LEGEND_TOP;
  const legendH = 24 + Math.max(NATURE_ITEMS.length, CAUSE_ITEMS.length) * 22 + 12;
  const totalH = legendY + legendH + MB;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW * SCALE}" height="${totalH * SCALE}">`);
  parts.push(`<style>`);
  parts.push(`  .title { font: bold 19px ${FONT}; fill: #111; }`);
  parts.push(`</style>`);
  parts.push(`<rect width="${totalW}" height="${totalH}" fill="white"/>`);
  parts.push(`<text x="${totalW / 2}" y="26" text-anchor="middle" class="title">Error Diagnosis: Log vs Console</text>`);

  drawHeatmap(parts, natureMatrix, NATURE_ITEMS, ML, MT, 'Error Nature');
  drawHeatmap(parts, causeMatrix, CAUSE_ITEMS, ML + s1.w + GAP, MT, 'Error Cause');

  const legCol1X = ML + 10;
  const legCol2X = ML + s1.w + GAP + 10;

  parts.push(`<line x1="${ML}" y1="${legendY - 6}" x2="${totalW - MR}" y2="${legendY - 6}" stroke="#ccc" stroke-width="1"/>`);

  drawLegend(parts, NATURE_ITEMS, legCol1X, legendY + 8, 'Nature codes');
  drawLegend(parts, CAUSE_ITEMS, legCol2X, legendY + 8, 'Cause codes');

  parts.push('</svg>');
  return parts.join('\n');
}

async function main() {
  const data = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const answered = loadAnswered(data);
  if (answered.length === 0) {
    console.error('No participants with error nature/cause answers found.');
    process.exit(1);
  }

  const natureLabels = NATURE_ITEMS.map((i) => i.label);
  const causeLabels = CAUSE_ITEMS.map((i) => i.label);

  const natureMatrix = buildMatrix(
    answered,
    'log-{p} What is the nature of the error?',
    'console-{p} What is the nature of the error?',
    natureLabels,
  );
  const causeMatrix = buildMatrix(
    answered,
    'log-{p} What is the most likely cause for the error?',
    'console-{p} What is the most likely cause for the error?',
    causeLabels,
  );

  const svg = buildSvg(natureMatrix, causeMatrix);
  const buf = Buffer.from(svg);
  await sharp(buf).png().toFile(OUT_PATH);
  await sharp(buf).png().toFile(THESIS_IMG);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Wrote ${THESIS_IMG} (${answered.length} participants)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
