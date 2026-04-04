import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ERRORS_PATH = path.join(__dirname, 'errorCounts.json');
const METADATA_PATH = path.join(__dirname, 'instanceMetadata.json');
const GRAPHS_DIR = path.join(__dirname, 'graphs');

async function svgToPng(svgPath) {
    const pngPath = svgPath.replace(/\.svg$/, '.png');
    await sharp(svgPath, { density: 600 }).png().toFile(pngPath);
    return pngPath;
}

function computeRates(errors, meta) {
    const rates = { syntax: [], conversion: [], structural: [] };
    const ids = Object.keys(errors);

    for (const id of ids) {
        const e = errors[id];
        const m = meta[id];
        if (!m || !m.expositionEventLineCount || m.expositionEventLineCount === 0) continue;
        const lines = m.expositionEventLineCount;
        rates.syntax.push((e.syntaxErrors / lines) * 100);
        rates.conversion.push((e.conversionErrors / lines) * 100);
        rates.structural.push((e.structuralErrors / lines) * 100);
    }
    return rates;
}

function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

function spearmanRank(x, y) {
    const n = x.length;
    if (n < 3) return { rho: NaN, n };

    function rank(arr) {
        const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
        const ranks = new Array(n);
        let i = 0;
        while (i < n) {
            let j = i;
            while (j < n - 1 && sorted[j + 1].v === sorted[j].v) j++;
            const avgRank = (i + j) / 2 + 1;
            for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
            i = j + 1;
        }
        return ranks;
    }

    const rx = rank(x);
    const ry = rank(y);
    let sumD2 = 0;
    for (let i = 0; i < n; i++) sumD2 += (rx[i] - ry[i]) ** 2;
    const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
    return { rho, n };
}

function generateHeatmapSVG(matrix, labels) {
    const width = 1200;
    const height = 1200;
    const margin = { top: 160, right: 200, bottom: 80, left: 280 };
    const cellSize = Math.min(
        (width - margin.left - margin.right) / labels.length,
        (height - margin.top - margin.bottom) / labels.length
    );
    const gridW = cellSize * labels.length;
    const gridH = cellSize * labels.length;

    function colorForValue(v) {
        if (isNaN(v)) return '#ccc';
        const t = (v + 1) / 2; // map [-1,1] to [0,1]
        const r = Math.round(t < 0.5 ? 65 + (255 - 65) * (1 - 2 * t) : 65);
        const g = Math.round(t < 0.5 ? 105 + (255 - 105) * (2 * t) : 105 + (255 - 105) * (2 * (1 - t)));
        const b = Math.round(t > 0.5 ? 189 + (255 - 189) * (2 * t - 1) : 189 + (255 - 189) * (2 * (0.5 - t)));
        if (v > 0.3) return `rgb(${Math.round(220 - 140 * ((v - 0.3) / 0.7))}, ${Math.round(60 + 60 * ((v - 0.3) / 0.7))}, ${Math.round(60 + 30 * ((v - 0.3) / 0.7))})`;
        if (v > 0) return `rgb(${Math.round(255 - 35 * (v / 0.3))}, ${Math.round(255 - 195 * (v / 0.3))}, ${Math.round(255 - 195 * (v / 0.3))})`;
        if (v > -0.3) return `rgb(${Math.round(255 + (220 - 255) * (-v / 0.3))}, ${Math.round(255 + (230 - 255) * (-v / 0.3))}, 255)`;
        return `rgb(${Math.round(60 + 160 * ((v + 1) / 0.7))}, ${Math.round(80 + 150 * ((v + 1) / 0.7))}, ${Math.round(180 + 75 * ((v + 1) / 0.7))})`;
    }

    let cells = '';
    for (let row = 0; row < labels.length; row++) {
        for (let col = 0; col < labels.length; col++) {
            const val = matrix[row][col];
            const x = margin.left + col * cellSize;
            const y = margin.top + row * cellSize;
            const color = row === col ? '#f0f0f0' : colorForValue(val);
            const textColor = (row === col || Math.abs(val) < 0.15) ? '#333' : (Math.abs(val) > 0.5 ? '#fff' : '#333');
            cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" stroke="#fff" stroke-width="2"/>`;
            cells += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 14}" text-anchor="middle" font-size="42" font-weight="bold" fill="${textColor}" font-family="'Times New Roman', Times, serif">${isNaN(val) ? '—' : val.toFixed(2)}</text>`;
        }
    }

    let rowLabels = '';
    let colLabels = '';
    for (let i = 0; i < labels.length; i++) {
        const yCenter = margin.top + i * cellSize + cellSize / 2 + 12;
        rowLabels += `<text x="${margin.left - 20}" y="${yCenter}" text-anchor="end" font-size="40" fill="#333" font-family="'Times New Roman', Times, serif">${labels[i]}</text>`;
        const xCenter = margin.left + i * cellSize + cellSize / 2;
        colLabels += `<text x="${xCenter}" y="${margin.top - 20}" text-anchor="middle" font-size="40" fill="#333" font-family="'Times New Roman', Times, serif">${labels[i]}</text>`;
    }

    const legendX = margin.left + gridW + 40;
    const legendY = margin.top;
    const legendH = gridH;
    const legendW = 30;
    const gradientStops = 20;
    let legendRects = '';
    let legendLabels = '';
    for (let i = 0; i < gradientStops; i++) {
        const v = 1 - (2 * i) / (gradientStops - 1);
        const sy = legendY + (i / gradientStops) * legendH;
        const sh = legendH / gradientStops + 1;
        legendRects += `<rect x="${legendX}" y="${sy}" width="${legendW}" height="${sh}" fill="${colorForValue(v)}" stroke="none"/>`;
    }
    for (const v of [1, 0.5, 0, -0.5, -1]) {
        const ly = legendY + ((1 - v) / 2) * legendH;
        legendLabels += `<text x="${legendX + legendW + 12}" y="${ly + 10}" font-size="32" fill="#333" font-family="'Times New Roman', Times, serif">${v.toFixed(1)}</text>`;
    }
    legendLabels += `<text x="${legendX + legendW / 2}" y="${legendY - 20}" text-anchor="middle" font-size="32" fill="#333" font-family="'Times New Roman', Times, serif">ρ</text>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
        .title { font: bold 44px 'Times New Roman', Times, serif; }
    </style>
    <rect width="${width}" height="${height}" fill="white"/>
    <text x="${(margin.left + margin.left + gridW) / 2}" y="60" text-anchor="middle" class="title">Error Rate Correlation (Spearman ρ)</text>
    ${cells}
    ${rowLabels}
    ${colLabels}
    ${legendRects}
    ${legendLabels}
</svg>`;
}

async function main() {
    console.log('Error Co-occurrence and Correlation Analysis\n');

    if (!fs.existsSync(GRAPHS_DIR)) fs.mkdirSync(GRAPHS_DIR, { recursive: true });

    const errors = JSON.parse(fs.readFileSync(ERRORS_PATH, 'utf-8'));
    const meta = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
    const rates = computeRates(errors, meta);
    const n = rates.syntax.length;

    console.log(`Instances with valid data: ${n}\n`);

    // --- Descriptive ---
    const categories = ['syntax', 'conversion', 'structural'];
    console.log('=== Per-Category Descriptive Statistics (rates per 100 lines) ===');
    for (const cat of categories) {
        const r = rates[cat];
        const nonzero = r.filter(v => v > 0).length;
        console.log(`  ${cat.padEnd(12)} mean=${mean(r).toFixed(4)}  sd=${stddev(r).toFixed(4)}  nonzero=${nonzero} (${(nonzero / n * 100).toFixed(1)}%)  max=${Math.max(...r).toFixed(4)}`);
    }

    // --- Co-occurrence counts ---
    console.log('\n=== Co-occurrence (instance has ≥1 error in both categories) ===');
    const ids = Object.keys(errors);
    const validIds = ids.filter(id => meta[id] && meta[id].expositionEventLineCount > 0);

    const hasSyntax = new Set(), hasConversion = new Set(), hasStructural = new Set();
    for (const id of validIds) {
        if (errors[id].syntaxErrors > 0) hasSyntax.add(id);
        if (errors[id].conversionErrors > 0) hasConversion.add(id);
        if (errors[id].structuralErrors > 0) hasStructural.add(id);
    }

    const intersect = (a, b) => [...a].filter(x => b.has(x)).length;
    const pairs = [
        ['Syntax ∩ Conversion', intersect(hasSyntax, hasConversion)],
        ['Syntax ∩ Structural', intersect(hasSyntax, hasStructural)],
        ['Conversion ∩ Structural', intersect(hasConversion, hasStructural)],
        ['All three', [...hasSyntax].filter(x => hasConversion.has(x) && hasStructural.has(x)).length],
    ];
    for (const [label, count] of pairs) {
        console.log(`  ${label.padEnd(28)} ${count} instances (${(count / n * 100).toFixed(1)}%)`);
    }

    // --- Spearman correlation matrix ---
    console.log('\n=== Spearman Rank Correlation Matrix ===');
    const labels = ['Syntax', 'Conversion', 'Structural'];
    const data = [rates.syntax, rates.conversion, rates.structural];
    const matrix = [];

    for (let i = 0; i < 3; i++) {
        const row = [];
        for (let j = 0; j < 3; j++) {
            if (i === j) {
                row.push(1.0);
            } else {
                const { rho } = spearmanRank(data[i], data[j]);
                row.push(rho);
            }
        }
        matrix.push(row);
    }

    const header = ''.padEnd(14) + labels.map(l => l.padStart(14)).join('');
    console.log(header);
    for (let i = 0; i < 3; i++) {
        const rowStr = labels[i].padEnd(14) + matrix[i].map(v => v.toFixed(4).padStart(14)).join('');
        console.log(rowStr);
    }

    // --- Conditional error rates ---
    console.log('\n=== Conditional Analysis ===');
    console.log('  Mean total error rate for instances WITH vs WITHOUT each error type:\n');

    for (const cat of categories) {
        const withErr = [], withoutErr = [];
        for (let i = 0; i < n; i++) {
            const total = rates.syntax[i] + rates.conversion[i] + rates.structural[i];
            const otherTotal = total - rates[cat][i];
            if (rates[cat][i] > 0) {
                withErr.push(otherTotal);
            } else {
                withoutErr.push(otherTotal);
            }
        }
        console.log(`  Instances with ${cat} errors (n=${withErr.length}):    mean other error rate = ${mean(withErr).toFixed(4)}`);
        console.log(`  Instances without ${cat} errors (n=${withoutErr.length}): mean other error rate = ${mean(withoutErr).toFixed(4)}`);
        console.log();
    }

    // --- Generate heatmap ---
    console.log('Generating correlation heatmap...');
    const svgPath = path.join(GRAPHS_DIR, 'errorCorrelation.svg');
    const svg = generateHeatmapSVG(matrix, labels);
    fs.writeFileSync(svgPath, svg);
    console.log(`  Saved: ${svgPath}`);

    const pngPath = await svgToPng(svgPath);
    console.log(`  Saved: ${pngPath}`);

    console.log('\nDone!');
}

main();
