/**
 * Telemetry Backend Server
 * Receives telemetry from the GitHub Pages deployment of CPEE Debug Console
 * and writes every batch to a local JSONL file on your machine.
 *
 * CORS is locked to the GitHub Pages origin so only your app can POST.
 * The analytics dashboard and API endpoints require an ANALYTICS_TOKEN.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    appendEvents,
    getAllEvents,
    getEventsForRange,
    getSessions,
    getStats
} from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const TOKEN = process.env.ANALYTICS_TOKEN || '';

const ALLOWED_ORIGINS = [
    'https://spunsel.github.io',
    'http://localhost:8000',
    'http://localhost:5173',
    'http://127.0.0.1:8000'
];

const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Analytics-Token']
}));

app.use(express.json({ limit: '1mb' }));

// ── Auth middleware (dashboard + API reads only) ─────────────────────────────

function requireToken(req, res, next) {
    if (!TOKEN) { return next(); }
    const provided = req.headers['x-analytics-token'] || req.query.token;
    if (provided === TOKEN) { return next(); }
    return res.status(401).json({ error: 'Unauthorized' });
}

// ── Telemetry ingest (open — client can't know the secret) ──────────────────

app.post('/api/telemetry', (req, res) => {
    try {
        const batch = req.body;
        if (!batch || !batch.events || !Array.isArray(batch.events)) {
            return res.status(400).json({ error: 'Invalid payload' });
        }
        appendEvents(batch);
        res.json({ ok: true, count: batch.events.length });
    } catch (err) {
        console.error('[Telemetry] Ingest error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Analytics API (token-protected) ─────────────────────────────────────────

app.get('/api/telemetry/stats', requireToken, (_req, res) => {
    try {
        res.json(getStats());
    } catch (err) {
        console.error('[Telemetry] Stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/telemetry/sessions', requireToken, (req, res) => {
    try {
        const { start, end } = req.query;
        res.json(getSessions(start || null, end || null));
    } catch (err) {
        console.error('[Telemetry] Sessions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/telemetry/events', requireToken, (req, res) => {
    try {
        const { start, end } = req.query;
        const batches = start && end
            ? getEventsForRange(start, end)
            : getAllEvents();

        const flat = [];
        for (const batch of batches) {
            for (const evt of (batch.events || [])) {
                flat.push({
                    ...evt,
                    sessionId: batch.sessionId,
                    fingerprint: batch.fingerprint
                });
            }
        }
        res.json(flat);
    } catch (err) {
        console.error('[Telemetry] Events error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Dashboard ───────────────────────────────────────────────────────────────

app.get('/analytics', requireToken, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

app.use('/public', express.static(path.join(__dirname, 'public')));

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Telemetry] Server listening on 0.0.0.0:${PORT}`);
    console.log(`[Telemetry] Accepting telemetry from: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`[Telemetry] Dashboard: http://localhost:${PORT}/analytics${TOKEN ? '?token=' + TOKEN : ''}`);
    console.log(`[Telemetry] Data file: telemetry-data/telemetry.jsonl`);
});
