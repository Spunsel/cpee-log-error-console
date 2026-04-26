/**
 * Error Co-occurrence Matrix - Section 5.1 (Longitudinal Error Analysis).
 *
 * Computes the pairwise co-occurrence of the three collected error categories
 * across all CPEE instances:
 *
 *     Syntax  -  Conversion  -  Structural
 *
 * For each pair of categories (X, Y), an instance is treated as "having" that
 * category if it contains at least one error of that type (binary presence).
 * The cell value reported is the Phi coefficient (phi):
 *
 *     phi = (a*d - b*c) / sqrt((a+b)(c+d)(a+c)(b+d))
 *
 *     a = #instances with both X and Y
 *     b = #instances with X but not Y
 *     c = #instances with Y but not X
 *     d = #instances with neither
 *
 * Phi is the correlation coefficient applied to binary indicators. It ranges in
 * [-1, +1], with 0 = independence, +1 = perfect co-occurrence, -1 = perfect
 * mutual exclusion. It is the natural choice for this dataset because the
 * per-instance error counts are heavily zero-inflated (~80% of instances have
 * zero structural errors), so a rate-based correlation would be dominated by
 * the binary "is it zero or not" pattern anyway.
 *
 * Each cell additionally shows the raw co-occurrence count (#instances with
 * both categories) in smaller, lighter font, matching the counts already cited
 * in the prose of section 5.1.2.
 *
 * Outputs:
 *   - graphs/errorCooccurrenceMatrix.svg
 *   - graphs/errorCooccurrenceMatrix.png
 *   - Thesis_Latex/img/errorCooccurrenceMatrix.png
 *
 * Run:  node scripts/instance-catalogue/errorCooccurrenceMatrix.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ERRORS_PATH = path.join(__dirname, 'errorCounts.json');
const METADATA_PATH = path.join(__dirname, 'instanceMetadata.json');
const GRAPHS_DIR = path.join(__dirname, 'graphs');
const SVG_PATH = path.join(GRAPHS_DIR, 'errorCooccurrenceMatrix.svg');
const PNG_PATH = path.join(GRAPHS_DIR, 'errorCooccurrenceMatrix.png');
const THESIS_IMG = path.join(
    __dirname, '..', '..', '..', 'Thesis_Latex', 'img', 'errorCooccurrenceMatrix.png'
);

const FONT = "'Times New Roman', Times, serif";

const CATEGORIES = [
    { key: 'syntaxErrors',     label: 'Syntax' },
    { key: 'conversionErrors', label: 'Conversion' },
    { key: 'structuralErrors', label: 'Structural' },
];

function loadValidIds(errors, meta) {
    return Object.keys(errors).filter(id =>
        meta[id] && meta[id].expositionEventLineCount > 0
    );
}

function presenceSets(errors, ids) {
    return CATEGORIES.map(c => {
        const s = new Set();
        for (const id of ids) {
            if ((errors[id]?.[c.key] || 0) > 0) s.add(id);
        }
        return s;
    });
}

function phi(N, presX, presY) {
    const a = [...presX].filter(x => presY.has(x)).length;          // both
    const b = presX.size - a;                                       // X only
    const c = presY.size - a;                                       // Y only
    const d = N - a - b - c;                                        // neither
    const denom = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
    if (denom === 0) return { phi: NaN, a };
    return { phi: (a * d - b * c) / denom, a };
}

function buildMatrix(N, presence) {
    const k = CATEGORIES.length;
    const matrix = Array.from({ length: k }, () =>
        new Array(k).fill(null).map(() => ({ phi: NaN, a: 0 }))
    );
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
            if (i === j) {
                matrix[i][j] = { phi: 1.0, a: presence[i].size, diag: true };
            } else {
                matrix[i][j] = phi(N, presence[i], presence[j]);
            }
        }
    }
    return matrix;
}

function fmtPhi(v) {
    if (Number.isNaN(v)) return '-';
    return v.toFixed(2);
}

function buildSvg(matrix, presence, N) {
    const labels = CATEGORIES.map(c => c.label);
    const k = labels.length;

    // Layout
    const SCALE        = 3;
    const PAD_X        = 24;
    const PAD_TOP      = 56;
    const PAD_BOTTOM   = 28;
    const HEADER_LBL_H = 28;
    const ROW_H        = 60;        // taller row to fit phi + count
    const LABEL_COL_W  = 130;
    const CELL_W       = 110;
    const RULE_W       = 1.2;
    const HEAVY_W      = 1.8;

    const tableW = LABEL_COL_W + k * CELL_W;
    const tableH = HEADER_LBL_H + k * ROW_H;
    const totalW = PAD_X * 2 + tableW;
    const totalH = PAD_TOP + tableH + PAD_BOTTOM + 38;

    const x0 = PAD_X;
    const y0 = PAD_TOP;

    const parts = [];
    parts.push(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" ` +
        `width="${totalW * SCALE}" height="${totalH * SCALE}">`
    );
    parts.push(`<rect width="${totalW}" height="${totalH}" fill="white"/>`);

    parts.push(
        `<text x="${totalW / 2}" y="32" text-anchor="middle" ` +
        `font-family="${FONT}" font-size="20" font-weight="bold" fill="#111">` +
        `Error Co-occurrence Matrix (Phi coefficient \u03C6)</text>`
    );

    // Column headers
    for (let c = 0; c < k; c++) {
        const cx = x0 + LABEL_COL_W + c * CELL_W + CELL_W / 2;
        const cy = y0 + HEADER_LBL_H - 10;
        parts.push(
            `<text x="${cx}" y="${cy}" text-anchor="middle" ` +
            `font-family="${FONT}" font-size="15" font-weight="bold" fill="#111">${labels[c]}</text>`
        );
    }

    // Row labels and cell values
    for (let r = 0; r < k; r++) {
        const rowCenterY = y0 + HEADER_LBL_H + r * ROW_H + ROW_H / 2;

        parts.push(
            `<text x="${x0 + LABEL_COL_W - 12}" y="${rowCenterY + 5}" text-anchor="end" ` +
            `font-family="${FONT}" font-size="15" font-weight="bold" fill="#111">${labels[r]}</text>`
        );

        for (let c = 0; c < k; c++) {
            const cx = x0 + LABEL_COL_W + c * CELL_W + CELL_W / 2;
            const cell = matrix[r][c];

            if (cell.diag) {
                // Diagonal: just em-dash (self-co-occurrence is trivial).
                parts.push(
                    `<text x="${cx}" y="${rowCenterY + 6}" text-anchor="middle" ` +
                    `font-family="${FONT}" font-size="18" fill="#666">\u2014</text>`
                );
            } else {
                // Phi value (primary)
                parts.push(
                    `<text x="${cx}" y="${rowCenterY - 2}" text-anchor="middle" ` +
                    `font-family="${FONT}" font-size="17" font-weight="bold" fill="#111">` +
                    `\u03C6 = ${fmtPhi(cell.phi)}</text>`
                );
                // Co-occurrence count (secondary, lighter)
                parts.push(
                    `<text x="${cx}" y="${rowCenterY + 18}" text-anchor="middle" ` +
                    `font-family="${FONT}" font-size="12" font-style="italic" fill="#555">` +
                    `n = ${cell.a}</text>`
                );
            }
        }
    }

    // Frame and separators
    const xL = x0;
    const xR = x0 + tableW;
    const yT = y0;
    const yB = y0 + tableH;
    const yMidTop = y0 + HEADER_LBL_H;
    const xMidLeft = x0 + LABEL_COL_W;

    parts.push(`<rect x="${xL}" y="${yT}" width="${tableW}" height="${tableH}" fill="none" stroke="#111" stroke-width="${HEAVY_W}"/>`);
    parts.push(`<line x1="${xL}" y1="${yMidTop}" x2="${xR}" y2="${yMidTop}" stroke="#111" stroke-width="${HEAVY_W}"/>`);
    parts.push(`<line x1="${xMidLeft}" y1="${yT}" x2="${xMidLeft}" y2="${yB}" stroke="#111" stroke-width="${HEAVY_W}"/>`);

    for (let r = 1; r < k; r++) {
        const y = yMidTop + r * ROW_H;
        parts.push(`<line x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" stroke="#999" stroke-width="${RULE_W}"/>`);
    }
    for (let c = 1; c < k; c++) {
        const x = xMidLeft + c * CELL_W;
        parts.push(`<line x1="${x}" y1="${yT}" x2="${x}" y2="${yB}" stroke="#999" stroke-width="${RULE_W}"/>`);
    }

    // Footnote
    const baseRates = CATEGORIES
        .map((c, i) => `${c.label}: ${presence[i].size}`)
        .join(',  ');
    parts.push(
        `<text x="${totalW / 2}" y="${yB + 22}" text-anchor="middle" ` +
        `font-family="${FONT}" font-size="12" font-style="italic" fill="#444">` +
        `\u03C6 \u2208 [-1, +1] on binary error presence per instance; ` +
        `n = #instances containing both categories.</text>`
    );
    parts.push(
        `<text x="${totalW / 2}" y="${yB + 38}" text-anchor="middle" ` +
        `font-family="${FONT}" font-size="12" font-style="italic" fill="#444">` +
        `Total instances: N = ${N}.  Affected per category - ${baseRates}.</text>`
    );

    parts.push('</svg>');
    return parts.join('\n');
}

async function main() {
    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true });

    const errors = JSON.parse(fs.readFileSync(ERRORS_PATH, 'utf-8'));
    const meta   = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
    const validIds = loadValidIds(errors, meta);
    const N = validIds.length;
    if (N === 0) {
        console.error('No instances with valid metadata + error counts found.');
        process.exit(1);
    }

    const presence = presenceSets(errors, validIds);
    const matrix = buildMatrix(N, presence);

    // Console summary
    console.log(`Error Co-occurrence Analysis  (N = ${N} instances)\n`);

    console.log('Per-category presence (instances with >=1 error of that type):');
    CATEGORIES.forEach((c, i) => {
        const s = presence[i].size;
        console.log(`  ${c.label.padEnd(12)} ${s}  (${(s / N * 100).toFixed(1)}%)`);
    });

    console.log('\nPhi coefficient matrix:');
    const header = ''.padEnd(14) + CATEGORIES.map(c => c.label.padStart(12)).join('');
    console.log(header);
    for (let r = 0; r < CATEGORIES.length; r++) {
        const row = CATEGORIES[r].label.padEnd(14) +
            matrix[r].map(cell =>
                (cell.diag ? '   1.00' : fmtPhi(cell.phi)).padStart(12)
            ).join('');
        console.log(row);
    }

    console.log('\nRaw co-occurrence counts (a = both):');
    console.log(header);
    for (let r = 0; r < CATEGORIES.length; r++) {
        const row = CATEGORIES[r].label.padEnd(14) +
            matrix[r].map(cell => `${cell.a}`.padStart(12)).join('');
        console.log(row);
    }

    const allThree = [...presence[0]]
        .filter(x => presence[1].has(x) && presence[2].has(x)).length;
    console.log(`\nInstances with errors in all three categories: ${allThree}`);

    const svg = buildSvg(matrix, presence, N);
    fs.writeFileSync(SVG_PATH, svg);
    const buf = Buffer.from(svg);
    await sharp(buf).png().toFile(PNG_PATH);
    await sharp(buf).png().toFile(THESIS_IMG);

    console.log(`\nWrote ${SVG_PATH}`);
    console.log(`Wrote ${PNG_PATH}`);
    console.log(`Wrote ${THESIS_IMG}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
