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

    const sessionDurations = new Map();

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
    let verifySound = 0, verifyUnsound = 0, verifyBounded = 0, verifyUnbounded = 0;
    let compMatch = 0, compMismatch = 0;
    const viewportWidths = [];
    const referrers = {};
    const urlParams = {};
    const sessionFirstDay = new Map();

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
                // Track session per day (one entry per session)
                if (day !== 'unknown' && batch.sessionId && !sessionFirstDay.has(batch.sessionId)) {
                    sessionFirstDay.set(batch.sessionId, day);
                    sessionsPerDay[day] = (sessionsPerDay[day] || 0) + 1;
                }
            }

            if (evt.event === 'session:end' && evt.data?.duration) {
                sessionDurations.set(batch.sessionId, evt.data.duration);
                sessionDurationValues.push(evt.data.duration);
            }

            // Instance loads
            if (evt.event === 'instance:loaded' && evt.data?.uuid) {
                instanceLoads[evt.data.uuid] = (instanceLoads[evt.data.uuid] || 0) + 1;
            }

            // Verification stats
            if (evt.event === 'verification:complete' && evt.data) {
                if (evt.data.sound === true) { verifySound++; }
                if (evt.data.sound === false) { verifyUnsound++; }
                if (evt.data.bounded === true) { verifyBounded++; }
                if (evt.data.bounded === false) { verifyUnbounded++; }
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

    for (const dur of sessionDurations.values()) {
        totalDuration += dur;
        sessionCount++;
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
            sound: verifySound,
            unsound: verifyUnsound,
            bounded: verifyBounded,
            unbounded: verifyUnbounded,
            total: verifySound + verifyUnsound
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
