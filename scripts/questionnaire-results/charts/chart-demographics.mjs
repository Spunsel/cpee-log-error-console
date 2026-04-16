/**
 * Chart 3 — Participant Demographics Overview
 *
 * Horizontal bar chart showing the distribution of answers for each of the
 * six demographic / background questions (Q1–Q6).
 *
 * Style: matches TUM thesis errorTrends (Times New Roman, TUM palette).
 *
 * Output: chart-demographics.png (+ copy to Thesis_Latex/img/questionnaire-analysis/)
 *
 * Run:  node scripts/questionnaire-results/chart-demographics.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '..', 'questionnaire-answers.json');
const OUT_PATH = join(__dirname, 'chart-demographics.png');
const THESIS_IMG = join(__dirname, '..', '..', '..', '..', 'Thesis_Latex', 'img', 'questionnaire-analysis', 'chart-demographics.png');

const QUESTIONS = [
  { key: 'What best describes your current role?', short: 'Current Role' },
  { key: 'How familair are you with the CPEE process engine?', short: 'CPEE Familiarity' },
  { key: 'How familair are you with Mermaid Diagram Syntax?', short: 'Mermaid Familiarity' },
  { key: 'How familiar are you with process modelling (e.g. BPMN, Petri nets)?', short: 'Process Modelling' },
  { key: 'How often do you use LLM based tools (e.g. ChatGPT, Copilot)?', short: 'LLM Tool Usage' },
  { key: 'How experienced are you with debugging or reading structured logs (e.g. JSON, YAML, XML)?', short: 'Log/Debug Experience' },
];

const BLUE = '#72AADC';
const ORANGE = '#D4AD82';
const GREEN = '#B5C272';

const ANSWER_ORDER = {
  'What best describes your current role?': [
    { value: 'Bachelors student', color: BLUE },
    { value: 'PhD student', color: GREEN },
  ],
  'How familair are you with the CPEE process engine?': [
    { value: 'familiar', color: BLUE },
    { value: 'very familiar', color: GREEN },
  ],
  'How familair are you with Mermaid Diagram Syntax?': [
    { value: 'familiar', color: ORANGE },
    { value: 'somewhat familiar', color: BLUE },
    { value: 'very familiar', color: GREEN },
  ],
  'How familiar are you with process modelling (e.g. BPMN, Petri nets)?': [
    { value: 'familiar', color: BLUE },
    { value: 'very familiar', color: GREEN },
  ],
  'How often do you use LLM based tools (e.g. ChatGPT, Copilot)?': [
    { value: 'occasionally', color: ORANGE },
    { value: 'regularly', color: BLUE },
    { value: 'daily', color: GREEN },
  ],
  'How experienced are you with debugging or reading structured logs (e.g. JSON, YAML, XML)?': [
    { value: 'practical experience', color: BLUE },
    { value: 'extensive experience', color: GREEN },
  ],
};

const FONT = "'Times New Roman', Times, serif";
const SCALE = 3;

const PROCS = [9779, 9784, 140971];
const SCENARIO_KEYS = PROCS.flatMap((p) => [
  `log-${p} At witch pipeline stage does the error FIRST appear?`,
  `log-${p} What is the nature of the error?`,
  `console-${p} What is the nature of the error?`,
  `console-${p} Where you able to confidentally identify the error?`,
  `console-${p} How easy was using the raw log file? (++,+,0,-,--)`,
  `console-${p} How easy was using the CPEE LLM Debug Console? (++,+,0,-,--)`,
]);

function loadAnswered(data) {
  return data.questionnaires.filter((q) => {
    const hasDemographic = QUESTIONS.some((qn) => q.answers[qn.key] !== '');
    const hasScenario = SCENARIO_KEYS.some((k) => q.answers[k] !== '');
    return hasDemographic && hasScenario;
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSvg(participants) {
  const n = participants.length;
  const questionData = QUESTIONS.map((q) => {
    const freq = {};
    for (const p of participants) {
      const v = p.answers[q.key];
      if (v === '') continue;
      freq[v] = (freq[v] || 0) + 1;
    }
    const order = ANSWER_ORDER[q.key] || [];
    const sorted = order
      .filter((a) => freq[a.value])
      .map((a) => [a.value, freq[a.value], a.color]);
    return { short: q.short, sorted, total: sorted.reduce((s, e) => s + e[1], 0) };
  });

  const LABEL_W = 160;
  const ROW_H = 50;
  const BAR_AREA_W = 480;
  const ML = 15, MR = 25, MT = 55, MB = 30;
  const W = ML + LABEL_W + BAR_AREA_W + MR;
  const H = MT + ROW_H * questionData.length + MB;
  const maxCount = n;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}">`);
  parts.push(`<style>`);
  parts.push(`  .title { font: bold 20px ${FONT}; }`);
  parts.push(`  .row-label { font: 14px ${FONT}; fill: #333; }`);
  parts.push(`  .bar-text { font: bold 11px ${FONT}; fill: #222; }`);
  parts.push(`</style>`);
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`);
  parts.push(`<text x="${W / 2}" y="30" text-anchor="middle" class="title">Participant Background (n\u2009=\u2009${n})</text>`);

  for (let i = 0; i < questionData.length; i++) {
    const qd = questionData[i];
    const rowY = MT + ROW_H * i;
    const barY = rowY + 10;
    const barH = ROW_H - 20;

    parts.push(`<text x="${ML + LABEL_W - 10}" y="${rowY + ROW_H / 2 + 5}" text-anchor="end" class="row-label">${esc(qd.short)}</text>`);

    if (i % 2 === 0) {
      parts.push(`<rect x="${ML + LABEL_W}" y="${rowY}" width="${BAR_AREA_W}" height="${ROW_H}" fill="#f5f5f5"/>`);
    }

    let cx = ML + LABEL_W;
    for (let j = 0; j < qd.sorted.length; j++) {
      const [label, count, color] = qd.sorted[j];
      const segW = (count / maxCount) * BAR_AREA_W;
      parts.push(`<rect x="${cx}" y="${barY}" width="${segW}" height="${barH}" fill="${color}" rx="3"/>`);
      if (segW > 50) {
        const txt = `${label} (${count})`;
        const charW = 6.2;
        const availW = segW - 8;
        if (txt.length * charW <= availW) {
          parts.push(`<text x="${cx + segW / 2}" y="${barY + barH / 2 + 4}" text-anchor="middle" class="bar-text">${esc(txt)}</text>`);
        } else {
          const words = txt.split(' ');
          let line1 = words[0];
          let splitAt = 1;
          for (let w = 1; w < words.length; w++) {
            const candidate = line1 + ' ' + words[w];
            if (candidate.length * charW <= availW) {
              line1 = candidate;
              splitAt = w + 1;
            } else break;
          }
          const line2 = words.slice(splitAt).join(' ');
          const midX = cx + segW / 2;
          const midY = barY + barH / 2;
          if (line2) {
            parts.push(`<text x="${midX}" y="${midY - 2}" text-anchor="middle" class="bar-text">${esc(line1)}</text>`);
            parts.push(`<text x="${midX}" y="${midY + 12}" text-anchor="middle" class="bar-text">${esc(line2)}</text>`);
          } else {
            parts.push(`<text x="${midX}" y="${midY + 4}" text-anchor="middle" class="bar-text">${esc(line1)}</text>`);
          }
        }
      }
      cx += segW;
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

async function main() {
  const data = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const answered = loadAnswered(data);
  if (answered.length === 0) {
    console.error('No participants with demographic answers found.');
    process.exit(1);
  }
  const svg = buildSvg(answered);
  const buf = Buffer.from(svg);
  await sharp(buf).png().toFile(OUT_PATH);
  await sharp(buf).png().toFile(THESIS_IMG);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Wrote ${THESIS_IMG} (${answered.length} participants)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
