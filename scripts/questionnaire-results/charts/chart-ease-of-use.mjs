/**
 * Chart 1 — Perceived Ease of Use: Raw Log File vs CPEE LLM Debug Console
 *
 * Grouped dot-plot with mean bars per scenario (9779, 9784, 140971).
 *
 * Style: TUM palette, Times New Roman. All text scaled 50% larger than base.
 *
 * Output: chart-ease-of-use.png
 *
 * Run:  node scripts/questionnaire-results/chart-ease-of-use.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, 'questionnaire-answers.json');
const OUT_PATH = join(__dirname, 'chart-ease-of-use.png');
const THESIS_IMG = join(__dirname, '..', '..', '..', 'Thesis_Latex', 'img', 'questionnaire-analysis', 'chart-ease-of-use.png');

const PROCS = [9779, 9784, 140971];
const LIKERT_MIN = -2;
const LIKERT_MAX = 2;
const LIKERT_LABELS = { '-2': 'very difficult', '-1': 'difficult', '0': 'neutral', '1': 'easy', '2': 'very easy' };
const SCALE = 3;

const FONT = "'Times New Roman', Times, serif";
const COLOR_LOG = '#E37222';
const COLOR_CONSOLE = '#0065BD';

function loadAnswered(data) {
  return data.questionnaires.filter((q) => {
    const a = q.answers;
    return PROCS.some(
      (p) =>
        a[`console-${p} How easy was using the raw log file? (++,+,0,-,--)`] !== '' ||
        a[`console-${p} How easy was using the CPEE LLM Debug Console? (++,+,0,-,--)`] !== '',
    );
  });
}

function collectRatings(participants) {
  const result = [];
  for (const proc of PROCS) {
    const logKey = `console-${proc} How easy was using the raw log file? (++,+,0,-,--)`;
    const consoleKey = `console-${proc} How easy was using the CPEE LLM Debug Console? (++,+,0,-,--)`;
    const logVals = [];
    const consoleVals = [];
    for (const p of participants) {
      const lv = p.answers[logKey];
      const cv = p.answers[consoleKey];
      if (lv !== '') logVals.push(Number(lv));
      if (cv !== '') consoleVals.push(Number(cv));
    }
    const mean = (arr) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length);
    result.push({ proc, logVals, consoleVals, logMean: mean(logVals), consoleMean: mean(consoleVals) });
  }
  return result;
}

function buildSvg(ratings) {
  const W = 860;
  const H = 440;
  const ML = 150, MR = 40, MT = 55, MB = 90;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const groupCount = ratings.length;
  const groupW = plotW / groupCount;
  const barW = groupW * 0.22;
  const gap = groupW * 0.10;

  const yScale = (v) => MT + plotH - ((v - LIKERT_MIN) / (LIKERT_MAX - LIKERT_MIN)) * plotH;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">`);
  parts.push(`<style>`);
  parts.push(`  .title { font: bold 30px ${FONT}; }`);
  parts.push(`  .axis-label { font: 21px ${FONT}; fill: #333; }`);
  parts.push(`  .tick-label { font: 19px ${FONT}; fill: #333; }`);
  parts.push(`  .legend-text { font: 19px ${FONT}; fill: #333; }`);
  parts.push(`  .mean-label { font: bold 16px ${FONT}; }`);
  parts.push(`</style>`);
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);

  parts.push(`<text x="${W / 2}" y="34" text-anchor="middle" class="title">Perceived Ease of Use</text>`);

  for (let v = LIKERT_MIN; v <= LIKERT_MAX; v++) {
    const y = yScale(v);
    parts.push(`<line x1="${ML}" y1="${y}" x2="${ML + plotW}" y2="${y}" stroke="#e0e0e0" stroke-width="1.5"/>`);
    parts.push(`<text x="${ML - 12}" y="${y + 7}" text-anchor="end" class="tick-label">${LIKERT_LABELS[String(v)]}</text>`);
  }

  const zeroY = yScale(0);
  parts.push(`<line x1="${ML}" y1="${zeroY}" x2="${ML + plotW}" y2="${zeroY}" stroke="#333" stroke-width="1.5"/>`);
  parts.push(`<line x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + plotH}" stroke="#333" stroke-width="2.5"/>`);
  parts.push(`<line x1="${ML}" y1="${MT + plotH}" x2="${ML + plotW}" y2="${MT + plotH}" stroke="#333" stroke-width="2.5"/>`);

  for (let i = 0; i < ratings.length; i++) {
    const r = ratings[i];
    const cx = ML + groupW * i + groupW / 2;
    const logX = cx - gap / 2 - barW / 2;
    const consoleX = cx + gap / 2 + barW / 2;

    if (r.logMean !== null) {
      const my = yScale(r.logMean);
      const barTop = Math.min(my, zeroY);
      const barH = Math.abs(my - zeroY);
      parts.push(`<rect x="${logX - barW / 2}" y="${barTop}" width="${barW}" height="${barH}" fill="${COLOR_LOG}" opacity="0.35" rx="2"/>`);
      parts.push(`<line x1="${logX - barW / 2}" y1="${my}" x2="${logX + barW / 2}" y2="${my}" stroke="${COLOR_LOG}" stroke-width="2.5"/>`);
      parts.push(`<text x="${logX}" y="${my + (r.logMean >= 0 ? -10 : 22)}" text-anchor="middle" class="mean-label" fill="${COLOR_LOG}">${r.logMean.toFixed(1)}</text>`);
    }
    if (r.consoleMean !== null) {
      const my = yScale(r.consoleMean);
      const barTop = Math.min(my, zeroY);
      const barH = Math.abs(my - zeroY);
      parts.push(`<rect x="${consoleX - barW / 2}" y="${barTop}" width="${barW}" height="${barH}" fill="${COLOR_CONSOLE}" opacity="0.35" rx="2"/>`);
      parts.push(`<line x1="${consoleX - barW / 2}" y1="${my}" x2="${consoleX + barW / 2}" y2="${my}" stroke="${COLOR_CONSOLE}" stroke-width="2.5"/>`);
      parts.push(`<text x="${consoleX}" y="${my + (r.consoleMean >= 0 ? -10 : 22)}" text-anchor="middle" class="mean-label" fill="${COLOR_CONSOLE}">${r.consoleMean.toFixed(1)}</text>`);
    }

    const jitter = (idx, total) => (total <= 1 ? 0 : ((idx / (total - 1)) - 0.5) * barW * 0.6);
    for (let j = 0; j < r.logVals.length; j++) {
      const y = yScale(r.logVals[j]);
      parts.push(`<circle cx="${logX + jitter(j, r.logVals.length)}" cy="${y}" r="7" fill="${COLOR_LOG}" opacity="0.75"/>`);
    }
    for (let j = 0; j < r.consoleVals.length; j++) {
      const y = yScale(r.consoleVals[j]);
      parts.push(`<circle cx="${consoleX + jitter(j, r.consoleVals.length)}" cy="${y}" r="7" fill="${COLOR_CONSOLE}" opacity="0.75"/>`);
    }

    parts.push(`<text x="${cx}" y="${H - MB + 35}" text-anchor="middle" class="axis-label">Scenario ${r.proc}</text>`);
  }

  parts.push(`<text x="${ML / 2}" y="${MT + plotH / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, ${ML / 2}, ${MT + plotH / 2})">Rating</text>`);

  const legY = H - 18;
  const legX = W / 2 - 250;
  parts.push(`<line x1="${legX}" y1="${legY}" x2="${legX + 40}" y2="${legY}" stroke="${COLOR_LOG}" stroke-width="6"/>`);
  parts.push(`<text x="${legX + 50}" y="${legY + 6}" class="legend-text">Raw Log File (mean)</text>`);
  parts.push(`<line x1="${legX + 290}" y1="${legY}" x2="${legX + 330}" y2="${legY}" stroke="${COLOR_CONSOLE}" stroke-width="6"/>`);
  parts.push(`<text x="${legX + 340}" y="${legY + 6}" class="legend-text">Debug Console (mean)</text>`);

  parts.push('</svg>');
  return parts.join('\n');
}

async function main() {
  const data = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const answered = loadAnswered(data);
  if (answered.length === 0) {
    console.error('No participants with ease-of-use ratings found.');
    process.exit(1);
  }
  const ratings = collectRatings(answered);
  const svg = buildSvg(ratings);
  const buf = Buffer.from(svg);
  await sharp(buf).png().toFile(OUT_PATH);
  await sharp(buf).png().toFile(THESIS_IMG);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Wrote ${THESIS_IMG} (${answered.length} participants)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
