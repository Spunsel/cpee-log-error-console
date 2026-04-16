/**
 * TelemetryStore
 * Append-only JSONL storage. Every batch is written as a single line to
 * telemetry-data/telemetry.jsonl. One line = one JSON object (a batch with
 * sessionId, fingerprint, and an events array). This format is easy to
 * tail, grep, and parse with any language.
 *
 * The dashboard API helpers read the full file and aggregate in memory.
 * For a thesis-scale deployment (thousands of events, not millions) this
 * is more than fast enough.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'telemetry-data');
const JSONL_PATH = path.join(DATA_DIR, 'telemetry.jsonl');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readAllBatches() {
    if (!fs.existsSync(JSONL_PATH)) { return []; }
    const lines = fs.readFileSync(JSONL_PATH, 'utf-8').split('\n').filter(Boolean);
    const batches = [];
    for (const line of lines) {
        try { batches.push(JSON.parse(line)); } catch { /* skip malformed lines */ }
    }
    return batches;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function appendEvents(batch) {
    ensureDataDir();
    const line = JSON.stringify(batch) + '\n';
    fs.appendFileSync(JSONL_PATH, line, 'utf-8');
}

export function getAllEvents() {
    return readAllBatches();
}

export function getEventsForRange(startDate, endDate) {
    return readAllBatches().filter(batch => {
        const firstTs = batch.events?.[0]?.timestamp?.slice(0, 10);
        return firstTs && firstTs >= startDate && firstTs <= endDate;
    });
}

export function getSessions(startDate = null, endDate = null) {
    const batches = startDate && endDate
        ? getEventsForRange(startDate, endDate)
        : getAllEvents();

    const sessionMap = new Map();
    for (const batch of batches) {
        const sid = batch.sessionId;
        if (!sid) { continue; }
        if (!sessionMap.has(sid)) {
            sessionMap.set(sid, {
                sessionId: sid,
                fingerprint: batch.fingerprint,
                events: [],
                firstSeen: null,
                lastSeen: null,
                environment: null
            });
        }
        const session = sessionMap.get(sid);
        for (const evt of (batch.events || [])) {
            session.events.push(evt);
            const ts = evt.timestamp;
            if (!session.firstSeen || ts < session.firstSeen) { session.firstSeen = ts; }
            if (!session.lastSeen || ts > session.lastSeen) { session.lastSeen = ts; }
            if (evt.event === 'session:start' && evt.data?.environment) {
                session.environment = evt.data.environment;
            }
        }
    }

    return [...sessionMap.values()].map(s => ({
        sessionId: s.sessionId,
        fingerprint: s.fingerprint,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
        eventCount: s.events.length,
        durationMs: s.firstSeen && s.lastSeen
            ? new Date(s.lastSeen) - new Date(s.firstSeen)
            : 0,
        environment: s.environment
    }));
}

export function getStats() {
    const batches = getAllEvents();

    const fingerprints = new Set();
    const sessions = new Set();
    const eventCounts = {};
    const categoryCounts = {};
    const dailyCounts = {};
    const browsers = {};
    const oses = {};
    let totalEvents = 0;
    let totalDuration = 0;
    let sessionCount = 0;

    const sessionDurations = new Map();       // from session:end events
    const sessionTimestamps = new Map();      // fallback: track first/last ts per session

    // Derived metric accumulators
    const stepDurations = [];
    const instanceLoadTimes = [];
    const featureUsageTotals = {
        usedTracePlayback: 0,
        usedReconciliation: 0,
        usedDarkMode: 0,
        usedViewModeToggle: 0,
        usedKeyboardNav: 0,
        usedScaleChange: 0,
        usedStepDropdown: 0
    };
    let featureUsageSessions = 0;
    const timeToFirstInteractions = [];

    // Rich aggregations for dashboard
    const sessionsPerDay = {};
    const hourlyActivity = new Array(24).fill(0);
    const instanceLoads = {};
    const sessionDurationValues = [];
    const verificationCounts = { sound: 0, unsound: 0, bounded: 0, unbounded: 0 };
    let compMatch = 0, compMismatch = 0;
    const viewportWidths = [];
    const referrers = {};
    const urlParams = {};

    for (const batch of batches) {
        if (batch.fingerprint) { fingerprints.add(batch.fingerprint); }
        if (batch.sessionId) { sessions.add(batch.sessionId); }

        for (const evt of (batch.events || [])) {
            totalEvents++;

            const name = evt.event || 'unknown';
            eventCounts[name] = (eventCounts[name] || 0) + 1;

            const cat = evt.category || 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

            const day = evt.timestamp?.slice(0, 10) || 'unknown';
            dailyCounts[day] = (dailyCounts[day] || 0) + 1;

            // Track first/last timestamp per session for fallback duration
            if (batch.sessionId && evt.timestamp) {
                if (!sessionTimestamps.has(batch.sessionId)) {
                    sessionTimestamps.set(batch.sessionId, { first: evt.timestamp, last: evt.timestamp });
                } else {
                    const st = sessionTimestamps.get(batch.sessionId);
                    if (evt.timestamp < st.first) { st.first = evt.timestamp; }
                    if (evt.timestamp > st.last) { st.last = evt.timestamp; }
                }
            }

            // Hourly activity
            if (evt.timestamp) {
                try {
                    const hour = new Date(evt.timestamp).getHours();
                    hourlyActivity[hour]++;
                } catch { /* ignore */ }
            }

            if (evt.event === 'session:start') {
                if (evt.data?.environment) {
                    const ua = evt.data.environment.userAgent || '';
                    browsers[parseBrowser(ua)] = (browsers[parseBrowser(ua)] || 0) + 1;
                    oses[parseOS(ua)] = (oses[parseOS(ua)] || 0) + 1;
                    if (evt.data.environment.viewportWidth) {
                        viewportWidths.push(evt.data.environment.viewportWidth);
                    }
                }
                if (evt.data?.environment?.referrer) {
                    const ref = evt.data.environment.referrer;
                    referrers[ref] = (referrers[ref] || 0) + 1;
                }
                if (evt.data?.urlParams) {
                    for (const [k, v] of Object.entries(evt.data.urlParams)) {
                        if (!urlParams[k]) { urlParams[k] = {}; }
                        urlParams[k][v] = (urlParams[k][v] || 0) + 1;
                    }
                }
            }

            if (evt.event === 'session:end' && evt.data?.duration) {
                sessionDurations.set(batch.sessionId, evt.data.duration);
            }

            // Instance loads
            if (evt.event === 'instance:loaded' && evt.data?.uuid) {
                instanceLoads[evt.data.uuid] = (instanceLoads[evt.data.uuid] || 0) + 1;
            }

            // Verification stats (structured client payloads + legacy JSON / string forms)
            if (evt.event === 'verification:complete' && evt.data) {
                applyVerificationRow(evt.data, verificationCounts);
            }

            // Comparison stats
            if (evt.event === 'traceComparison:match') { compMatch++; }
            if (evt.event === 'traceComparison:mismatch') { compMismatch++; }

            // Derived metric events
            if (evt.event === 'metric:timeOnStep' && typeof evt.data?.durationMs === 'number') {
                stepDurations.push(evt.data.durationMs);
            }
            if (evt.event === 'metric:instanceLoadTime' && typeof evt.data?.loadMs === 'number') {
                instanceLoadTimes.push(evt.data.loadMs);
            }
            if (evt.event === 'metric:timeToFirstInteraction' && typeof evt.data?.delayMs === 'number') {
                timeToFirstInteractions.push(evt.data.delayMs);
            }
            if (evt.event === 'metric:featureUsage' && evt.data) {
                featureUsageSessions++;
                for (const key of Object.keys(featureUsageTotals)) {
                    if (evt.data[key]) { featureUsageTotals[key]++; }
                }
            }
        }
    }

    // Older deployed clients omit metric:* — infer performance from raw event ordering
    if (stepDurations.length === 0 || instanceLoadTimes.length === 0 || timeToFirstInteractions.length === 0) {
        const inferred = inferLegacyPerformanceMetrics(batches);
        if (stepDurations.length === 0 && inferred.stepDurations.length > 0) {
            stepDurations.push(...inferred.stepDurations);
        }
        if (instanceLoadTimes.length === 0 && inferred.instanceLoadTimes.length > 0) {
            instanceLoadTimes.push(...inferred.instanceLoadTimes);
        }
        if (timeToFirstInteractions.length === 0 && inferred.timeToFirstInteractions.length > 0) {
            timeToFirstInteractions.push(...inferred.timeToFirstInteractions);
        }
    }

    if (featureUsageSessions === 0) {
        const inferredFu = inferLegacyFeatureUsage(batches);
        if (inferredFu.sessionsWithData > 0) {
            featureUsageSessions = inferredFu.sessionsWithData;
            for (const k of Object.keys(featureUsageTotals)) {
                featureUsageTotals[k] = inferredFu.totals[k] || 0;
            }
        }
    }

    // Sessions per day: count each session once based on its first event timestamp
    for (const [_sid, st] of sessionTimestamps) {
        const d = st.first?.slice(0, 10);
        if (d && d !== 'unknown') {
            sessionsPerDay[d] = (sessionsPerDay[d] || 0) + 1;
        }
    }

    // Compute session durations: prefer session:end data, fall back to timestamp range
    const finalSessionDurations = new Map();
    for (const sid of sessions) {
        if (sessionDurations.has(sid)) {
            finalSessionDurations.set(sid, sessionDurations.get(sid));
        } else if (sessionTimestamps.has(sid)) {
            const st = sessionTimestamps.get(sid);
            const dur = new Date(st.last) - new Date(st.first);
            if (dur > 0) { finalSessionDurations.set(sid, dur); }
        }
    }
    for (const dur of finalSessionDurations.values()) {
        totalDuration += dur;
        sessionCount++;
        sessionDurationValues.push(dur);
    }

    const jsonlSize = fs.existsSync(JSONL_PATH)
        ? fs.statSync(JSONL_PATH).size
        : 0;

    const avg = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const median = (arr) => {
        if (arr.length === 0) { return 0; }
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };

    // Duration distribution buckets (in seconds)
    const durationBuckets = { '<10s': 0, '10-30s': 0, '30s-1m': 0, '1-3m': 0, '3-5m': 0, '5-10m': 0, '>10m': 0 };
    for (const d of sessionDurationValues) {
        const s = d / 1000;
        if (s < 10) { durationBuckets['<10s']++; }
        else if (s < 30) { durationBuckets['10-30s']++; }
        else if (s < 60) { durationBuckets['30s-1m']++; }
        else if (s < 180) { durationBuckets['1-3m']++; }
        else if (s < 300) { durationBuckets['3-5m']++; }
        else if (s < 600) { durationBuckets['5-10m']++; }
        else { durationBuckets['>10m']++; }
    }

    // Viewport categories
    const viewportCategories = { 'Mobile (<768)': 0, 'Tablet (768-1024)': 0, 'Desktop (1024-1440)': 0, 'Wide (>1440)': 0 };
    for (const w of viewportWidths) {
        if (w < 768) { viewportCategories['Mobile (<768)']++; }
        else if (w < 1024) { viewportCategories['Tablet (768-1024)']++; }
        else if (w <= 1440) { viewportCategories['Desktop (1024-1440)']++; }
        else { viewportCategories['Wide (>1440)']++; }
    }

    // Top instances
    const topInstances = Object.entries(instanceLoads)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([uuid, count]) => ({ uuid, count }));

    return {
        uniqueUsers: fingerprints.size,
        totalSessions: sessions.size,
        totalEvents,
        avgSessionDurationMs: sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0,
        eventCounts,
        categoryCounts,
        dailyCounts,
        sessionsPerDay,
        browsers,
        oses,
        storageSizeBytes: jsonlSize,
        hourlyActivity,
        topInstances,
        durationDistribution: durationBuckets,
        viewportCategories,
        referrers,
        urlParams,

        verification: {
            sound: verificationCounts.sound,
            unsound: verificationCounts.unsound,
            bounded: verificationCounts.bounded,
            unbounded: verificationCounts.unbounded,
            total: verificationCounts.sound + verificationCounts.unsound
        },
        comparison: {
            match: compMatch,
            mismatch: compMismatch,
            total: compMatch + compMismatch,
            matchRate: (compMatch + compMismatch) > 0
                ? Math.round((compMatch / (compMatch + compMismatch)) * 100)
                : 0
        },

        stepDuration: {
            count: stepDurations.length,
            avgMs: avg(stepDurations),
            medianMs: median(stepDurations)
        },
        instanceLoadPerf: {
            count: instanceLoadTimes.length,
            avgMs: avg(instanceLoadTimes),
            medianMs: median(instanceLoadTimes),
            maxMs: instanceLoadTimes.length > 0 ? Math.max(...instanceLoadTimes) : 0
        },
        timeToFirstInteraction: {
            count: timeToFirstInteractions.length,
            avgMs: avg(timeToFirstInteractions),
            medianMs: median(timeToFirstInteractions)
        },
        featureUsage: {
            sessionsWithData: featureUsageSessions,
            features: Object.fromEntries(
                Object.entries(featureUsageTotals).map(([k, v]) => [
                    k,
                    { count: v, pct: featureUsageSessions > 0 ? Math.round((v / featureUsageSessions) * 100) : 0 }
                ])
            )
        }
    };
}

/**
 * Pull sound/bounded booleans from telemetry payloads produced by different client versions.
 */
function applyVerificationRow(data, out) {
    const { sound, bounded } = extractSoundBounded(data);
    if (sound === true) { out.sound++; }
    if (sound === false) { out.unsound++; }
    if (bounded === true) { out.bounded++; }
    if (bounded === false) { out.unbounded++; }
}

function extractSoundBounded(data) {
    if (!data || typeof data !== 'object') { return { sound: null, bounded: null }; }
    if (typeof data.sound === 'boolean' || typeof data.bounded === 'boolean') {
        return {
            sound: typeof data.sound === 'boolean' ? data.sound : null,
            bounded: typeof data.bounded === 'boolean' ? data.bounded : null
        };
    }
    const vr = data.verificationResult;
    if (vr && typeof vr === 'object') {
        return {
            sound: typeof vr.sound === 'boolean' ? vr.sound : null,
            bounded: typeof vr.bounded === 'boolean' ? vr.bounded : null
        };
    }
    if (typeof vr === 'string') {
        const s = vr.trim();
        if (s.length === 0 || s.startsWith('[truncated')) {
            return { sound: null, bounded: null };
        }
        try {
            const parsed = JSON.parse(s);
            const r = parsed?.verificationResult ?? parsed;
            if (r && typeof r === 'object') {
                return {
                    sound: typeof r.sound === 'boolean' ? r.sound : null,
                    bounded: typeof r.bounded === 'boolean' ? r.bounded : null
                };
            }
        } catch { /* fall through to regex */ }
        const soundM = s.match(/"sound"\s*:\s*(true|false)/i);
        const boundedM = s.match(/"bounded"\s*:\s*(true|false)/i);
        return {
            sound: soundM ? soundM[1].toLowerCase() === 'true' : null,
            bounded: boundedM ? boundedM[1].toLowerCase() === 'true' : null
        };
    }
    return { sound: null, bounded: null };
}

function collectOrderedEventItems(batches) {
    const items = [];
    for (const batch of batches) {
        const sid = batch.sessionId || '';
        for (const evt of (batch.events || [])) {
            items.push({ sid, evt });
        }
    }
    items.sort((a, b) => {
        const ta = a.evt.timestamp || '';
        const tb = b.evt.timestamp || '';
        return ta.localeCompare(tb);
    });
    return items;
}

/**
 * Reconstruct performance metrics when the client never emitted metric:* events.
 */
function inferLegacyPerformanceMetrics(batches) {
    const stepDurations = [];
    const instanceLoadTimes = [];
    const timeToFirstInteractions = [];

    const items = collectOrderedEventItems(batches);
    const sessionStartTs = new Map();
    for (const { sid, evt } of items) {
        if (sid && evt.event === 'session:start' && evt.timestamp) {
            sessionStartTs.set(sid, evt.timestamp);
        }
    }

    const perSession = new Map();
    function st(sid) {
        if (!perSession.has(sid)) {
            perSession.set(sid, {
                ttfiDone: false,
                lastStepTs: null,
                pendingLoads: new Map()
            });
        }
        return perSession.get(sid);
    }

    for (const { sid, evt } of items) {
        if (!sid) { continue; }
        const s = st(sid);
        const name = evt.event || '';
        const ts = evt.timestamp ? new Date(evt.timestamp).getTime() : NaN;
        const validTs = Number.isFinite(ts);

        if (!s.ttfiDone && name && !name.startsWith('session:')) {
            let delay = null;
            if (typeof evt.elapsedMs === 'number' && evt.elapsedMs >= 0) {
                delay = evt.elapsedMs;
            } else if (validTs) {
                const startIso = sessionStartTs.get(sid);
                if (startIso) {
                    const t0 = new Date(startIso).getTime();
                    if (Number.isFinite(t0)) { delay = ts - t0; }
                }
            }
            if (delay !== null && delay >= 0) {
                timeToFirstInteractions.push(delay);
                s.ttfiDone = true;
            }
        }

        if (name === 'instanceLoader:loadInstance' && evt.data?.uuid && validTs) {
            s.pendingLoads.set(evt.data.uuid, ts);
        }
        if (name === 'instance:loaded' && evt.data?.uuid && validTs) {
            const t0 = s.pendingLoads.get(evt.data.uuid);
            if (t0 !== undefined) {
                s.pendingLoads.delete(evt.data.uuid);
                const d = ts - t0;
                if (d >= 0) { instanceLoadTimes.push(d); }
            }
        }
        if (name === 'instance:loadFailed' && evt.data?.uuid) {
            s.pendingLoads.delete(evt.data.uuid);
        }

        if (name === 'step:displayed' && validTs) {
            if (s.lastStepTs !== null) {
                const d = ts - s.lastStepTs;
                if (d > 0) { stepDurations.push(d); }
            }
            s.lastStepTs = ts;
        } else if (name === 'sidebar:instanceSelected' && validTs) {
            if (s.lastStepTs !== null) {
                const d = ts - s.lastStepTs;
                if (d > 0) { stepDurations.push(d); }
                s.lastStepTs = null;
            }
        }
    }

    return { stepDurations, instanceLoadTimes, timeToFirstInteractions };
}

function inferLegacyFeatureUsage(batches) {
    const keys = [
        'usedTracePlayback',
        'usedReconciliation',
        'usedDarkMode',
        'usedViewModeToggle',
        'usedKeyboardNav',
        'usedScaleChange',
        'usedStepDropdown'
    ];
    const perSid = new Map();
    function flags(sid) {
        if (!sid) { return null; }
        if (!perSid.has(sid)) {
            const o = {};
            for (const k of keys) { o[k] = false; }
            perSid.set(sid, o);
        }
        return perSid.get(sid);
    }

    for (const batch of batches) {
        const sid = batch.sessionId;
        for (const evt of (batch.events || [])) {
            const f = flags(sid);
            if (!f) { continue; }
            const n = evt.event || '';
            if (n.startsWith('trace:playback:')) { f.usedTracePlayback = true; }
            if (n.startsWith('traceReconciliation:')) { f.usedReconciliation = true; }
            if (n === 'darkMode:toggled') { f.usedDarkMode = true; }
            if (n === 'viewModeToggle:modeChanged') { f.usedViewModeToggle = true; }
            if (n === 'keyboard:arrowLeft' || n === 'keyboard:arrowRight') { f.usedKeyboardNav = true; }
            if (n === 'scaleDisplay:scaleChanged') { f.usedScaleChange = true; }
            if (n === 'stepDropdown:stepSelected') { f.usedStepDropdown = true; }
        }
    }

    const totals = {};
    for (const k of keys) { totals[k] = 0; }
    let sessionsWithData = 0;
    for (const f of perSid.values()) {
        const any = keys.some((k) => f[k]);
        if (!any) { continue; }
        sessionsWithData++;
        for (const k of keys) {
            if (f[k]) { totals[k]++; }
        }
    }
    return { sessionsWithData, totals };
}

function parseBrowser(ua) {
    if (ua.includes('Firefox/')) { return 'Firefox'; }
    if (ua.includes('Edg/')) { return 'Edge'; }
    if (ua.includes('Chrome/')) { return 'Chrome'; }
    if (ua.includes('Safari/')) { return 'Safari'; }
    if (ua.includes('Opera/') || ua.includes('OPR/')) { return 'Opera'; }
    return 'Other';
}

function parseOS(ua) {
    if (ua.includes('Windows')) { return 'Windows'; }
    if (ua.includes('Mac OS')) { return 'macOS'; }
    if (ua.includes('Linux')) { return 'Linux'; }
    if (ua.includes('Android')) { return 'Android'; }
    if (ua.includes('iPhone') || ua.includes('iPad')) { return 'iOS'; }
    return 'Other';
}
