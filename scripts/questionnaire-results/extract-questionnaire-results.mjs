/**
 * Reads CPEE XES YAML logs from ../questionnaire-logs and writes:
 *   - questionnaire-answers.json — one entry per log file with labeled answers + raw keys
 *   - questionnaire-answers.csv — one row per log; columns = question texts (union across files)
 *
 * Run from repo root:
 *   node scripts/questionnaire-results/extract-questionnaire-results.mjs
 *
 * Requires: npm install (devDependency `yaml`)
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, '..', 'questionnaire-logs');
const OUT_DIR = __dirname;

function normalizeLabel(s) {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function mergeResValue(val) {
  if (val == null || (Array.isArray(val) && val.length === 0)) {
    return {};
  }
  if (!Array.isArray(val)) {
    return typeof val === 'object' ? { ...val } : {};
  }
  const out = {};
  for (const el of val) {
    if (el && typeof el === 'object' && Object.keys(el).length > 0) {
      Object.assign(out, el);
    }
  }
  return out;
}

function formatAnswerValue(v) {
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    const vals = Object.values(v);
    if (vals.length > 0 && vals.every((x) => typeof x === 'boolean')) {
      return Object.entries(v)
        .filter(([, x]) => x)
        .map(([k]) => k)
        .join('; ');
    }
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    return JSON.stringify(v);
  }
  return String(v);
}

function answerKeyToLabel(key, defaultsMerged) {
  if (key.startsWith('input_') && defaultsMerged[key] != null) {
    return normalizeLabel(String(defaultsMerged[key]));
  }
  const m = key.match(/^(select_|buttons_)(\d+)/);
  if (m) {
    const t = defaultsMerged[`text_${m[2]}`];
    if (t != null) {
      return normalizeLabel(String(t));
    }
  }
  const m2 = key.match(/^select_(\d+)_/);
  if (m2) {
    const t = defaultsMerged[`text_${m2[1]}`];
    if (t != null) {
      return normalizeLabel(String(t));
    }
  }
  return key;
}

function mapAnswersWithLabels(rawAnswers, defaultsMerged) {
  const labelToKeys = new Map();
  for (const k of Object.keys(rawAnswers)) {
    const label = answerKeyToLabel(k, defaultsMerged);
    if (!labelToKeys.has(label)) {
      labelToKeys.set(label, []);
    }
    labelToKeys.get(label).push(k);
  }
  const answers = {};
  const answersRaw = {};
  for (const [k, v] of Object.entries(rawAnswers)) {
    let label = answerKeyToLabel(k, defaultsMerged);
    const keys = labelToKeys.get(label) || [];
    if (keys.length > 1) {
      label = `${label} [${k}]`;
    }
    answers[label] = formatAnswerValue(v);
    answersRaw[k] = formatAnswerValue(v);
  }
  return { answers, answersRaw };
}

function parseLogDocuments(content) {
  const docs = parseAllDocuments(content);
  return docs.map((d) => d.toJSON()).filter(Boolean);
}

function extractFromDocuments(docs, sourceFile) {
  let cpeeInstance = null;
  let conceptInstance = null;

  const first = docs[0];
  const trace = first?.log?.trace;
  if (trace) {
    cpeeInstance = trace['cpee:instance'] ?? null;
    conceptInstance = trace['concept:name'] ?? null;
  }

  const defaultsMerged = {};
  /** Merged field keys from every non-empty `res` update, in log order (later keys overwrite). */
  const rawAnswers = {};
  let lastResTs = '';

  for (const doc of docs) {
    const ev = doc?.event;
    if (!ev) {
      continue;
    }

    const trans = ev['cpee:lifecycle:transition'];
    const data = ev.data;
    if (!Array.isArray(data)) {
      continue;
    }

    if (trans === 'activity/calling') {
      for (const item of data) {
        if (item?.name === 'default' && item.value && typeof item.value === 'object') {
          Object.assign(defaultsMerged, item.value);
        }
      }
    }

    if (trans === 'dataelements/change') {
      for (const item of data) {
        if (item?.name === 'res') {
          const ts = ev['time:timestamp'] ?? '';
          if (ts) {
            lastResTs = ts;
          }
          const chunk = mergeResValue(item.value);
          if (Object.keys(chunk).length > 0) {
            Object.assign(rawAnswers, chunk);
          }
        }
      }
    }
  }
  const { answers, answersRaw } = mapAnswersWithLabels(rawAnswers, defaultsMerged);

  return {
    sourceFile,
    cpeeInstance,
    conceptInstance,
    lastResTimestamp: lastResTs || null,
    answers,
    answersRaw,
  };
}

function escapeCsvCell(s) {
  const str = s == null ? '' : String(s);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const names = (await readdir(LOGS_DIR)).filter((f) => f.endsWith('.xes.yaml')).sort();
  if (names.length === 0) {
    console.error(`No .xes.yaml files in ${LOGS_DIR}`);
    process.exit(1);
  }

  const rows = [];
  for (const name of names) {
    const path = join(LOGS_DIR, name);
    const content = await readFile(path, 'utf8');
    try {
      const docs = parseLogDocuments(content);
      rows.push(extractFromDocuments(docs, name));
    } catch (e) {
      console.warn(`Skip ${name}: ${e.message}`);
    }
  }

  const questionColumns = new Set();
  for (const r of rows) {
    for (const q of Object.keys(r.answers)) {
      questionColumns.add(q);
    }
  }
  const sortedQuestions = [...questionColumns].sort((a, b) => a.localeCompare(b));

  const payload = {
    generatedAt: new Date().toISOString(),
    logsDirectory: LOGS_DIR,
    questionnaires: rows.map((r) => ({
      sourceFile: r.sourceFile,
      cpeeInstance: r.cpeeInstance,
      conceptInstance: r.conceptInstance,
      lastResTimestamp: r.lastResTimestamp,
      answers: r.answers,
      answersByFieldKey: r.answersRaw,
    })),
  };

  const jsonPath = join(OUT_DIR, 'questionnaire-answers.json');
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${jsonPath}`);

  const csvPath = join(OUT_DIR, 'questionnaire-answers.csv');
  const header = ['source_file', 'cpee_instance', 'concept_instance', 'last_res_timestamp', ...sortedQuestions];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    const base = [
      r.sourceFile,
      r.cpeeInstance ?? '',
      r.conceptInstance ?? '',
      r.lastResTimestamp ?? '',
    ];
    const cells = sortedQuestions.map((q) => r.answers[q] ?? '');
    lines.push([...base, ...cells].map(escapeCsvCell).join(','));
  }
  await writeFile(csvPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${csvPath} (${rows.length} rows, ${sortedQuestions.length} question columns)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
