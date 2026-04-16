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

            if (evt.event === 'session:start' && evt.data?.environment) {
                const ua = evt.data.environment.userAgent || '';
                browsers[parseBrowser(ua)] = (browsers[parseBrowser(ua)] || 0) + 1;
                oses[parseOS(ua)] = (oses[parseOS(ua)] || 0) + 1;
            }

            if (evt.event === 'session:end' && evt.data?.duration) {
                sessionDurations.set(batch.sessionId, evt.data.duration);
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

    return {
        uniqueUsers: fingerprints.size,
        totalSessions: sessions.size,
        totalEvents,
        avgSessionDurationMs: sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0,
        eventCounts,
        categoryCounts,
        dailyCounts,
        browsers,
        oses,
        storageSizeBytes: jsonlSize
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
