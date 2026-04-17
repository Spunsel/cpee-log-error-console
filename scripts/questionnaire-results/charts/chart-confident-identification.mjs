/**
 * Chart 2 — Error Identification Confidence: Raw Log vs Debug Console
 *
 * Grouped stacked bar chart showing Yes / Unsure / No distribution for
 * "Were you able to confidently identify the error?" across scenarios,
 * comparing log-only vs console.
 *
 * Colors: Yes = TUM Gruen shade, No = muted red, Unsure = TUM Orange shade.
 *
 * Output: chart-confident-identification.png
 *
 * Run:  node scripts/questionnaire-results/chart-confident-identification.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '..', 'questionnaire-answers.json');
const OUT_PATH = join(__dirname, 'chart-confident-identification.png');
const THESIS_IMG = join(__dirname, '..', '..', '..', '..', 'Thesis_Latex', 'img', 'questionnaire-analysis', 'chart-confident-identification.png');

const PROCS = [9779, 9784, 140971];
const CATEGORIES = ['Yes', 'Unsure', 'No'];
const FONT = "'Times New Roman', Times, serif";
const SCALE = 3;

const CAT_COLORS = {
  Yes: '#B5C272',
  Unsure: '#72AADC',
  No: '#D4AD82',
};

function loadAnswered(data) {
  return data.questionnaires.filter((q) => {
    const a = q.answers;
    return PROCS.some(
      (p) =>
        a[`log-${p} Where you able to confidentally identify the error?`] !== '' ||
        a[`console-${p} Where you able to confidentally identify the error?`] !== '',
    );
  });
}

function countCategories(participants, keyTemplate) {
  const counts = { Yes: 0, Unsure: 0, No: 0 };
  let total = 0;
  for (const p of participants) {
    for (const proc of PROCS) {
      const val = p.answers[keyTemplate.replace('{p}', proc)];
      if (val === '') continue;
      total++;
      if (counts[val] !== undefined) counts[val]++;
    }
  }
  return { counts, total };
}

function buildSvg(logData, consoleData) {
  const W = 580;
  const H = 265;
  const ML = 70, MR = 120, MT = 15, MB = 50;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const maxVal = Math.max(logData.total, consoleData.total, 1);
  const yScale = (v) => MT + plotH - (v / maxVal) * plotH;

  const barW = plotW * 0.22;
  const centerLog = ML + plotW * 0.3;
  const centerConsole = ML + plotW * 0.7;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">`);
  parts.push(`<style>`);
  parts.push(`  .title { font: bold 20px ${FONT}; fill: #000; }`);
  parts.push(`  .axis-label { font: 14px ${FONT}; fill: #000; }`);
  parts.push(`  .tick-label { font: 13px ${FONT}; fill: #000; }`);
  parts.push(`  .legend-text { font: 13px ${FONT}; fill: #000; }`);
  parts.push(`  .bar-label { font: bold 14px ${FONT}; fill: #000; }`);
  parts.push(`</style>`);
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);

  const gridStep = Math.max(1, Math.ceil(maxVal / 5));
  for (let v = 0; v <= maxVal; v += gridStep) {
    const y = yScale(v);
    parts.push(`<line x1="${ML}" y1="${y}" x2="${ML + plotW}" y2="${y}" stroke="#e0e0e0" stroke-width="1.5"/>`);
    parts.push(`<text x="${ML - 12}" y="${y + 5}" text-anchor="end" class="tick-label">${v}</text>`);
  }

  parts.push(`<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + plotH}" stroke="#333" stroke-width="2.5"/>`);
  parts.push(`<line x1="${ML}" y1="${MT + plotH}" x2="${ML + plotW}" y2="${MT + plotH}" stroke="#333" stroke-width="2.5"/>`);

  function drawStack(cx, data) {
    let cumY = 0;
    for (const cat of CATEGORIES) {
      const h = data.total === 0 ? 0 : (data.counts[cat] / maxVal) * plotH;
      if (h === 0) continue;
      const y = yScale(cumY + data.counts[cat]);
      parts.push(`<rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${h}" fill="${CAT_COLORS[cat]}" rx="2"/>`);
      if (h > 16) {
        parts.push(`<text x="${cx}" y="${y + h / 2 + 5}" text-anchor="middle" class="bar-label">${data.counts[cat]}</text>`);
      }
      cumY += data.counts[cat];
    }
  }

  drawStack(centerLog, logData);
  drawStack(centerConsole, consoleData);

  parts.push(`<text x="${centerLog}" y="${H - MB + 22}" text-anchor="middle" class="axis-label">Raw Log File</text>`);
  parts.push(`<text x="${centerConsole}" y="${H - MB + 22}" text-anchor="middle" class="axis-label">Debug Console</text>`);
  parts.push(`<text x="${ML / 2}" y="${MT + plotH / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, ${ML / 2}, ${MT + plotH / 2})">Responses</text>`);

  const legX = ML + plotW + 18;
  const legStartY = MT + plotH / 2 - (CATEGORIES.length * 26) / 2;
  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const cat = CATEGORIES[ci];
    const ly = legStartY + ci * 26;
    parts.push(`<rect x="${legX}" y="${ly}" width="14" height="14" fill="${CAT_COLORS[cat]}" rx="3"/>`);
    parts.push(`<text x="${legX + 20}" y="${ly + 12}" class="legend-text">${cat}</text>`);
  }

  parts.push('</svg>');
  return parts.join('\n');
}

async function main() {
  const data = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const answered = loadAnswered(data);
  if (answered.length === 0) {
    console.error('No participants with identification answers found.');
    process.exit(1);
  }
  const logData = countCategories(answered, 'log-{p} Where you able to confidentally identify the error?');
  const consoleData = countCategories(answered, 'console-{p} Where you able to confidentally identify the error?');
  const svg = buildSvg(logData, consoleData);
  const buf = Buffer.from(svg);
  await sharp(buf).png().toFile(OUT_PATH);
  await sharp(buf).png().toFile(THESIS_IMG);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Wrote ${THESIS_IMG} (${answered.length} participants)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
