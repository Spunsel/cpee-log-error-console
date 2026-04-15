/**
 * Chart 4 — Error Nature / Cause Agreement Heatmap: Log vs Console
 *
 * Two side-by-side heatmaps (nature + cause) where rows = log-only answer,
 * columns = console answer, cell intensity = count of participants.
 *
 * Style: matches TUM thesis errorTrends (Times New Roman, TUM palette).
 * Heat ramp uses TUM Blau.
 *
 * Output: chart-error-heatmap.png (+ copy to Thesis_Latex/img/questionnaire-analysis/)
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

const NATURE_LABELS = ['Syntax Error', 'Conversion Error', 'Structural Error', 'Unsure'];
const CAUSE_LABELS = [
  'LLM-generated output',
  'CPEE-to-Mermaid conversion',
  'Mermaid-to-CPEE conversion',
  'Unsure',
];

const FONT = "'Times New Roman', Times, serif";

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

function buildMatrix(participants, logTemplate, consoleTemplate, rowLabels, colLabels) {
  const matrix = rowLabels.map(() => colLabels.map(() => 0));
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
          const ri = rowLabels.indexOf(lv);
          const ci = colLabels.indexOf(cv);
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

function drawHeatmap(parts, matrix, rowLabels, colLabels, ox, oy, title) {
  const CELL = 72;
  const LABEL_W = 180;
  const LABEL_H = 38;
  const gridW = colLabels.length * CELL;
  const gridH = rowLabels.length * CELL;
  const maxVal = Math.max(1, ...matrix.flat());

  parts.push(`<text x="${ox + LABEL_W + gridW / 2}" y="${oy}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="bold">${esc(title)}</text>`);
  parts.push(`<text x="${ox + LABEL_W + gridW / 2}" y="${oy + 20}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#555">Console answer \u2192</text>`);

  for (let c = 0; c < colLabels.length; c++) {
    const cx = ox + LABEL_W + c * CELL + CELL / 2;
    const cy = oy + LABEL_H;
    const words = colLabels[c].split(/[-\s]/);
    for (let w = 0; w < words.length; w++) {
      parts.push(`<text x="${cx}" y="${cy + w * 13}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#333">${esc(words[w])}</text>`);
    }
  }

  const colLabelMaxLines = Math.max(...colLabels.map((l) => l.split(/[-\s]/).length));
  const headerH = LABEL_H + colLabelMaxLines * 13 + 6;

  parts.push(`<text transform="translate(${ox + LABEL_W - 10}, ${oy + headerH + gridH / 2}) rotate(-90)" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#555">\u2190 Log answer</text>`);

  for (let r = 0; r < rowLabels.length; r++) {
    const ry = oy + headerH + r * CELL + CELL / 2 + 4;
    parts.push(`<text x="${ox + LABEL_W - 16}" y="${ry}" text-anchor="end" font-family="${FONT}" font-size="12" fill="#333">${esc(rowLabels[r])}</text>`);
    for (let c = 0; c < colLabels.length; c++) {
      const rx = ox + LABEL_W + c * CELL;
      const ryTop = oy + headerH + r * CELL;
      const v = matrix[r][c];
      parts.push(`<rect x="${rx}" y="${ryTop}" width="${CELL}" height="${CELL}" fill="${cellColor(v, maxVal)}" stroke="white" stroke-width="2.5" rx="4"/>`);
      if (v > 0) {
        const textFill = v / maxVal > 0.45 ? 'white' : '#333';
        parts.push(`<text x="${rx + CELL / 2}" y="${ryTop + CELL / 2 + 6}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="bold" fill="${textFill}">${v}</text>`);
      }
    }
  }

  return { w: LABEL_W + gridW, h: headerH + gridH };
}

function buildSvg(natureMatrix, causeMatrix, n) {
  const GAP = 55;
  const ML = 25, MR = 25, MT = 60, MB = 35;

  const tmpParts = [];
  const s1 = drawHeatmap(tmpParts, natureMatrix, NATURE_LABELS, NATURE_LABELS, 0, 0, '');
  const s2 = drawHeatmap(tmpParts, causeMatrix, CAUSE_LABELS, CAUSE_LABELS, 0, 0, '');
  const totalW = ML + s1.w + GAP + s2.w + MR;
  const totalH = MT + Math.max(s1.h, s2.h) + MB;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW * SCALE}" height="${totalH * SCALE}">`);
  parts.push(`<style>`);
  parts.push(`  .title { font: bold 20px ${FONT}; }`);
  parts.push(`  .subtitle { font: 14px ${FONT}; fill: #555; }`);
  parts.push(`</style>`);
  parts.push(`<rect width="${totalW}" height="${totalH}" fill="white"/>`);
  parts.push(`<text x="${totalW / 2}" y="28" text-anchor="middle" class="title">Error Diagnosis Agreement: Raw Log vs Debug Console</text>`);
  parts.push(`<text x="${totalW / 2}" y="48" text-anchor="middle" class="subtitle">(all scenarios aggregated, n\u2009=\u2009${n})</text>`);

  drawHeatmap(parts, natureMatrix, NATURE_LABELS, NATURE_LABELS, ML, MT, 'Error Nature');
  drawHeatmap(parts, causeMatrix, CAUSE_LABELS, CAUSE_LABELS, ML + s1.w + GAP, MT, 'Error Cause');

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

  const natureMatrix = buildMatrix(
    answered,
    'log-{p} What is the nature of the error?',
    'console-{p} What is the nature of the error?',
    NATURE_LABELS,
    NATURE_LABELS,
  );
  const causeMatrix = buildMatrix(
    answered,
    'log-{p} What is the most likely cause for the error?',
    'console-{p} What is the most likely cause for the error?',
    CAUSE_LABELS,
    CAUSE_LABELS,
  );

  const svg = buildSvg(natureMatrix, causeMatrix, answered.length);
  const buf = Buffer.from(svg);
  await sharp(buf).png().toFile(OUT_PATH);
  await sharp(buf).png().toFile(THESIS_IMG);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Wrote ${THESIS_IMG} (${answered.length} participants)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
