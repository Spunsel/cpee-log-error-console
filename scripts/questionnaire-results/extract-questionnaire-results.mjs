/**
 * Reads CPEE XES YAML logs from ../questionnaire-logs and writes:
 *   - questionnaire-answers.json
 *   - questionnaire-answers.csv — fixed schema: participant, qid, source_file + 36 question columns (exact labels)
 *
 * Run:  node scripts/questionnaire-results/extract-questionnaire-results.mjs
 * Requires: npm install (devDependency `yaml`)
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, '..', 'questionnaire-logs');
const OUT_DIR = __dirname;

/** Parent Quest merges three subprocess blocks in Simple → Medium → Complex order (procnums from model). */
const PROC_ORDER = [9779, 9784, 140971];

/**
 * Linear index into `res` nested array (YAML order): log block 0–3, then a second `buttons_0`
 * (pipeline again in UI), then console nature/cause/identify at 5–7, then scale_0, scale_1, feedback_0.
 */
const SCENARIO_VALUE_SLOTS = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10];

function scenarioColumnHeaders(proc) {
  const p = String(proc);
  return [
    `log-${p} At witch pipeline stage does the error FIRST appear?`,
    `log-${p} What is the nature of the error?`,
    `log-${p} What is the most likely cause for the error?`,
    `log-${p} Where you able to confidentally identify the error?`,
    `console-${p} What is the nature of the error?`,
    `console-${p} What is the most likely cause for the error?`,
    `console-${p} Where you able to confidentally identify the error?`,
    `console-${p} How easy was using the raw log file? (++,+,0,-,--)`,
    `console-${p} How easy was using the CPEE LLM Debug Console? (++,+,0,-,--)`,
    `console-${p} Did you have any specific problems with one/or both of the approaches? (free text)`,
  ];
}

const DEMO_HEADERS = [
  'What best describes your current role?',
  'How familair are you with the CPEE process engine?',
  'How familair are you with Mermaid Diagram Syntax?',
  'How familiar are you with process modelling (e.g. BPMN, Petri nets)?',
  'How often do you use LLM based tools (e.g. ChatGPT, Copilot)?',
  'How experienced are you with debugging or reading structured logs (e.g. JSON, YAML, XML)?',
];

const CSV_QUESTION_COLUMNS = [...DEMO_HEADERS, ...PROC_ORDER.flatMap((p) => scenarioColumnHeaders(p))];

function resolveButtonValue(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const vals = Object.values(v);
    if (vals.length > 0 && vals.every((x) => typeof x === 'boolean')) {
      return Object.entries(v)
        .filter(([, x]) => x)
        .map(([k]) => k)
        .join('; ');
    }
  }
  if (v == null) return '';
  return String(v);
}

const QID_TO_PARTICIPANT = {
  '29a51f789bb263326327': 'Johannes Löbbecke',
  '29a51f789bb263326337': 'Marisol Barrientos',
  '29a51f789bb263326329': 'Nataliia Klievtsova',
  '29a51f789bb263326330': 'Jürgen Mangler',
  '29a51f789bb263326331': 'Dominik Voigt',
  '29a51f789bb263326332': 'Catherine Sai',
  '29a51f789bb263326333': 'Henryk Mustroph',
  '29a51f789bb263326334': 'Immanuel Scheibert',
  '29a51f789bb263326335': 'Ilya Marcel Azima',
  '29a51f789bb263326336': 'Mattias Ehrendorfer',
};

const PARTICIPANT_QIDS = new Set(Object.keys(QID_TO_PARTICIPANT));

function parseLogDocuments(content) {
  return parseAllDocuments(content).map((d) => d.toJSON()).filter(Boolean);
}

function findLargestResValue(docs) {
  let largestRes = null;
  let largestResSize = 0;
  for (const doc of docs) {
    const ev = doc?.event;
    if (!ev || ev['cpee:lifecycle:transition'] !== 'dataelements/change') continue;
    const data = ev.data;
    if (!Array.isArray(data)) continue;
    for (const item of data) {
      if (item?.name !== 'res') continue;
      const raw = JSON.stringify(item.value);
      if (raw.length > largestResSize) {
        largestResSize = raw.length;
        largestRes = item.value;
      }
    }
  }
  return largestRes;
}

function extractSubProcnum(docs) {
  for (const doc of docs) {
    const ev = doc?.event;
    if (!ev || !Array.isArray(ev.data)) continue;
    for (const item of ev.data) {
      if (item?.name === 'd' && item.value && typeof item.value === 'object') {
        const n = item.value.procnum;
        if (n != null) return Number(n);
      }
    }
  }
  return null;
}

function isDemographicsObject(el) {
  return el && typeof el === 'object' && !Array.isArray(el) && ('select_0' in el || 'select_1' in el);
}

function fillDemographics(out, o) {
  const keys = ['select_0', 'select_1', 'select_2', 'select_2_2', 'select_3', 'select_4'];
  for (let i = 0; i < 6; i++) {
    const v = o[keys[i]];
    const s = resolveButtonValue(v);
    if (s !== '' && s !== '{}') out[DEMO_HEADERS[i]] = s;
  }
}

/** Flatten one scenario nested array in document order (YAML key order per object). */
function linearizeScenarioValues(nestedArray) {
  if (!Array.isArray(nestedArray)) return [];
  const vals = [];
  for (const el of nestedArray) {
    if (!el || typeof el !== 'object') continue;
    for (const [, v] of Object.entries(el)) {
      vals.push(resolveButtonValue(v));
    }
  }
  return vals;
}

function fillScenarioColumns(out, nestedArray, procnum) {
  const vals = linearizeScenarioValues(nestedArray);
  const headers = scenarioColumnHeaders(procnum);
  for (let i = 0; i < headers.length; i++) {
    const slot = SCENARIO_VALUE_SLOTS[i];
    const cell = slot != null && slot < vals.length ? vals[slot] : '';
    out[headers[i]] = cell == null ? '' : String(cell);
  }
}

function buildStructuredAnswers(docs, largestRes, traceName) {
  const out = {};
  for (const c of CSV_QUESTION_COLUMNS) out[c] = '';

  if (!largestRes) return out;

  if (traceName === 'Quest' && Array.isArray(largestRes)) {
    let procIdx = 0;
    for (const el of largestRes) {
      if (isDemographicsObject(el)) {
        fillDemographics(out, el);
      } else if (Array.isArray(el)) {
        const proc = PROC_ORDER[procIdx];
        if (proc != null) {
          fillScenarioColumns(out, el, proc);
          procIdx += 1;
        }
      }
    }
    return out;
  }

  if (traceName === 'QuestSub' && Array.isArray(largestRes)) {
    const proc = extractSubProcnum(docs);
    if (proc != null) {
      fillScenarioColumns(out, largestRes, proc);
    }
    return out;
  }

  if (Array.isArray(largestRes) && largestRes.length > 0) {
    const proc = extractSubProcnum(docs) ?? PROC_ORDER[0];
    fillScenarioColumns(out, largestRes, proc);
  }

  return out;
}

function rowHasAnyAnswer(answers) {
  return CSV_QUESTION_COLUMNS.some((c) => String(answers[c] ?? '').trim() !== '');
}

function extractFromDocuments(docs, sourceFile) {
  let cpeeInstance = null;
  let conceptInstance = null;
  const first = docs[0];
  const trace = first?.log?.trace;
  const traceName = trace?.['cpee:name'] ?? '';
  if (trace) {
    cpeeInstance = trace['cpee:instance'] ?? null;
    conceptInstance = trace['concept:name'] ?? null;
  }

  let qid = null;
  let lastResTs = '';
  for (const doc of docs) {
    const ev = doc?.event;
    if (!ev || !Array.isArray(ev.data)) continue;
    for (const item of ev.data) {
      if (item?.name === 'qid' && item.value) {
        qid = String(item.value);
      }
      if (item?.name === 'res' && ev['time:timestamp']) {
        lastResTs = ev['time:timestamp'];
      }
    }
  }

  const largestRes = findLargestResValue(docs);
  const answers = buildStructuredAnswers(docs, largestRes, traceName);

  return {
    sourceFile,
    cpeeInstance,
    conceptInstance,
    qid,
    lastResTimestamp: lastResTs || null,
    answers,
  };
}

function dedupeToLatestLogPerParticipant(rows) {
  const best = new Map();
  for (const r of rows) {
    const key =
      r.qid && PARTICIPANT_QIDS.has(r.qid) ? `qid:${r.qid}` : `file:${r.sourceFile}`;
    const prev = best.get(key);
    if (
      !prev ||
      String(r.lastResTimestamp ?? '').localeCompare(String(prev.lastResTimestamp ?? '')) > 0
    ) {
      best.set(key, r);
    }
  }
  return [...best.values()].sort((a, b) =>
    String(a.lastResTimestamp ?? '').localeCompare(String(b.lastResTimestamp ?? '')),
  );
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

  const allRows = [];
  for (const name of names) {
    const path = join(LOGS_DIR, name);
    const content = await readFile(path, 'utf8');
    try {
      const docs = parseLogDocuments(content);
      allRows.push(extractFromDocuments(docs, name));
    } catch (e) {
      console.warn(`Skip ${name}: ${e.message}`);
    }
  }

  const rowsWithAnswers = allRows.filter((r) => rowHasAnyAnswer(r.answers));
  const rows = dedupeToLatestLogPerParticipant(rowsWithAnswers);
  console.log(
    `${allRows.length} logs parsed, ${rowsWithAnswers.length} with answers → ${rows.length} row(s)`,
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    logsDirectory: LOGS_DIR,
    questionColumns: CSV_QUESTION_COLUMNS,
    totalLogs: allRows.length,
    answeredLogFiles: rowsWithAnswers.length,
    tableRows: rows.length,
    questionnaires: rows.map((r) => ({
      sourceFile: r.sourceFile,
      qid: r.qid,
      participant: r.qid ? (QID_TO_PARTICIPANT[r.qid] ?? null) : null,
      cpeeInstance: r.cpeeInstance,
      conceptInstance: r.conceptInstance,
      lastResTimestamp: r.lastResTimestamp,
      answers: r.answers,
    })),
  };
  const jsonPath = join(OUT_DIR, 'questionnaire-answers.json');
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${jsonPath}`);

  const csvPath = join(OUT_DIR, 'questionnaire-answers.csv');
  for (const name of await readdir(OUT_DIR)) {
    if (name === 'questionnaire-answers-export.csv' || name.startsWith('questionnaire-answers-export-')) {
      await unlink(join(OUT_DIR, name));
    }
    if (/^questionnaire-answers\.\d+\.tmp\.csv$/.test(name)) {
      await unlink(join(OUT_DIR, name));
    }
  }
  const header = ['participant', 'qid', 'source_file', ...CSV_QUESTION_COLUMNS];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    const participant = r.qid ? (QID_TO_PARTICIPANT[r.qid] ?? '') : '';
    const cells = [participant, r.qid ?? '', r.sourceFile, ...CSV_QUESTION_COLUMNS.map((q) => r.answers[q] ?? '')];
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  const csvText = lines.join('\n');
  const csvTmpPath = join(OUT_DIR, 'questionnaire-answers.tmp.csv');
  await writeFile(csvTmpPath, csvText, 'utf8');
  try {
    await writeFile(csvPath, csvText, 'utf8');
    await unlink(csvTmpPath);
    console.log(`Wrote ${csvPath} (${rows.length} rows, ${CSV_QUESTION_COLUMNS.length} question columns)`);
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      console.warn(
        `Could not overwrite ${csvPath} (file in use, e.g. Excel). Same content was written to ${csvTmpPath}. Close the app using the CSV and re-run, or copy/rename the .tmp file.`,
      );
    } else {
      throw e;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
