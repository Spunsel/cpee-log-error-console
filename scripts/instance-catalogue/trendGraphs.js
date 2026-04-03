import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, 'instanceCatalogue.csv');
const GRAPHS_DIR = path.join(__dirname, 'graphs');
const OUTPUT_SVG_PATH = path.join(GRAPHS_DIR, 'errorTrends.svg');
const OUTPUT_SYNTAX_SVG_PATH = path.join(GRAPHS_DIR, 'errorTrends_syntax.svg');
const OUTPUT_CONVERSION_SVG_PATH = path.join(GRAPHS_DIR, 'errorTrends_conversion.svg');
const OUTPUT_STRUCTURAL_SVG_PATH = path.join(GRAPHS_DIR, 'errorTrends_structural.svg');

async function svgToPng(svgPath) {
    const pngPath = svgPath.replace(/\.svg$/, '.png');
    await sharp(svgPath, { density: 600 })
        .png()
        .toFile(pngPath);
    return pngPath;
}

const MA_WINDOW_SMALL = 10;
const MA_WINDOW_LARGE = 30;
const X_AXIS_TICK_INTERVAL = 20;
const Y_AXIS_LABEL = 'Errors per 100 exposition event lines';

function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, idx) => {
            const value = values[idx];
            if (value === '' || value === undefined) {
                row[header] = null;
            } else if (!isNaN(parseFloat(value))) {
                row[header] = parseFloat(value);
            } else {
                row[header] = value;
            }
        });
        data.push(row);
    }
    return data;
}

function calculateMovingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
        
        let sum = 0;
        let count = 0;
        for (let j = start; j < end; j++) {
            const val = data[j];
            if (val !== null && !isNaN(val) && isFinite(val)) {
                sum += val;
                count++;
            }
        }
        // Always produce a value - use 0 if no valid neighbors
        result.push(count > 0 ? sum / count : 0);
    }
    return result;
}

function generateXAxisLabels(data, margin, plotWidth, plotHeight, height) {
    const instanceNumbers = data.map(d => d.instanceNumber);
    const labels = [];
    const axisY = margin.top + plotHeight;
    
    const labelOffsetX = 8;
    const labelOffsetY = 32;

    for (let i = 0; i < data.length; i += X_AXIS_TICK_INTERVAL) {
        const x = margin.left + (i / (data.length - 1)) * plotWidth;
        const instanceNum = instanceNumbers[i];
        const tx = x + labelOffsetX;
        const ty = axisY + labelOffsetY;
        labels.push(`<line x1="${x}" y1="${axisY}" x2="${x}" y2="${axisY + 10}" stroke="#333" stroke-width="2"/>`);
        labels.push(`<text x="${tx}" y="${ty}" text-anchor="end" font-size="36" fill="#333" font-family="'Times New Roman', Times, serif" transform="rotate(-45, ${tx}, ${ty})">${instanceNum}</text>`);
    }
    
    const lastIdx = data.length - 1;
    const lastX = margin.left + plotWidth;
    const lastInstanceNum = instanceNumbers[lastIdx];
    if (lastIdx % X_AXIS_TICK_INTERVAL !== 0) {
        const tx = lastX + labelOffsetX;
        const ty = axisY + labelOffsetY;
        labels.push(`<line x1="${lastX}" y1="${axisY}" x2="${lastX}" y2="${axisY + 10}" stroke="#333" stroke-width="2"/>`);
        labels.push(`<text x="${tx}" y="${ty}" text-anchor="end" font-size="36" fill="#333" font-family="'Times New Roman', Times, serif" transform="rotate(-45, ${tx}, ${ty})">${lastInstanceNum}</text>`);
    }
    
    return labels.join('\n    ');
}

function generateCombinedSVG(data, syntaxMA, conversionMA, structuralMA) {
    const width = 2400;
    const height = 1300;
    const margin = { top: 100, right: 340, bottom: 300, left: 220 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const allValues = [...syntaxMA, ...conversionMA, ...structuralMA]
        .filter(v => v !== null && !isNaN(v) && isFinite(v));
    const maxY = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 1;
    
    const xScale = (idx) => margin.left + (idx / (data.length - 1)) * plotWidth;
    const yScale = (val) => {
        if (val === null || isNaN(val) || !isFinite(val)) return null;
        return margin.top + plotHeight - (val / maxY) * plotHeight;
    };
    
    function createPath(values, color, strokeWidth, opacity = 1) {
        let d = '';
        let started = false;
        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            if (val !== null && !isNaN(val) && isFinite(val)) {
                const x = xScale(i);
                const y = yScale(val);
                if (y !== null) {
                    if (!started) {
                        d += `M ${x} ${y}`;
                        started = true;
                    } else {
                        d += ` L ${x} ${y}`;
                    }
                }
            }
        }
        if (!d) return '';
        return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
    }
    
    const gridLines = [];
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const y = margin.top + (i / yTicks) * plotHeight;
        const value = maxY > 0 ? (maxY * (yTicks - i) / yTicks).toFixed(2) : '0.00';
        gridLines.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1.5"/>`);
        gridLines.push(`<text x="${margin.left - 20}" y="${y + 10}" text-anchor="end" font-size="36" fill="#333" font-family="'Times New Roman', Times, serif">${value}</text>`);
    }
    
    const xAxisLabels = generateXAxisLabels(data, margin, plotWidth, plotHeight, height);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
        .title { font: bold 48px 'Times New Roman', Times, serif; }
        .axis-label { font: 40px 'Times New Roman', Times, serif; }
        .legend-text { font: 34px 'Times New Roman', Times, serif; }
    </style>
    
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="white"/>
    
    <!-- Title -->
    <text x="${width/2}" y="65" text-anchor="middle" class="title">Error Rate Trends (${MA_WINDOW_LARGE}-point Centered Moving Average)</text>
    
    <!-- Grid lines -->
    ${gridLines.join('\n    ')}
    
    <!-- Axes -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="2.5"/>
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="2.5"/>
    
    <!-- X-axis labels -->
    ${xAxisLabels}
    <text x="${(margin.left + width - margin.right) / 2}" y="${height - 80}" text-anchor="middle" class="axis-label">Instance Number</text>
    
    <!-- Y-axis label -->
    <text x="55" y="${(margin.top + margin.top + plotHeight) / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 55, ${(margin.top + margin.top + plotHeight) / 2})">${Y_AXIS_LABEL}</text>
    
    <!-- Data lines -->
    ${createPath(syntaxMA, '#E37222', 5)}
    ${createPath(conversionMA, '#64A0C8', 5)}
    ${createPath(structuralMA, '#A2AD00', 5)}
    
    <!-- Legend -->
    <g transform="translate(${width - margin.right + 25}, ${margin.top + 20})">
        <text x="0" y="-10" class="legend-text" font-weight="bold">Error Types</text>

        <line x1="0" y1="30" x2="50" y2="30" stroke="#E37222" stroke-width="5"/>
        <text x="65" y="40" class="legend-text">Syntax</text>
        
        <line x1="0" y1="85" x2="50" y2="85" stroke="#64A0C8" stroke-width="5"/>
        <text x="65" y="95" class="legend-text">Conversion</text>
        
        <line x1="0" y1="140" x2="50" y2="140" stroke="#A2AD00" stroke-width="5"/>
        <text x="65" y="150" class="legend-text">Structural</text>
    </g>
</svg>`;
}

function generateIndividualSVG(data, maSmall, maLarge, title, color) {
    const width = 2400;
    const height = 1100;
    const margin = { top: 100, right: 300, bottom: 300, left: 220 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    
    const allValues = [...maSmall, ...maLarge]
        .filter(v => v !== null && !isNaN(v) && isFinite(v));
    const maxY = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 1;
    
    const xScale = (idx) => margin.left + (idx / (data.length - 1)) * plotWidth;
    const yScale = (val) => {
        if (val === null || isNaN(val) || !isFinite(val)) return null;
        return margin.top + plotHeight - (val / maxY) * plotHeight;
    };
    
    function createPath(values, strokeColor, strokeWidth, opacity = 1) {
        let d = '';
        let started = false;
        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            if (val !== null && !isNaN(val) && isFinite(val)) {
                const x = xScale(i);
                const y = yScale(val);
                if (y !== null) {
                    if (!started) {
                        d += `M ${x} ${y}`;
                        started = true;
                    } else {
                        d += ` L ${x} ${y}`;
                    }
                }
            }
        }
        if (!d) return '';
        return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
    }
    
    const gridLines = [];
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const y = margin.top + (i / yTicks) * plotHeight;
        const value = maxY > 0 ? (maxY * (yTicks - i) / yTicks).toFixed(2) : '0.00';
        gridLines.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1.5"/>`);
        gridLines.push(`<text x="${margin.left - 20}" y="${y + 10}" text-anchor="end" font-size="36" fill="#333" font-family="'Times New Roman', Times, serif">${value}</text>`);
    }
    
    const xAxisLabels = generateXAxisLabels(data, margin, plotWidth, plotHeight, height);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
        .title { font: bold 48px 'Times New Roman', Times, serif; }
        .axis-label { font: 40px 'Times New Roman', Times, serif; }
        .legend-text { font: 34px 'Times New Roman', Times, serif; }
    </style>
    
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="white"/>
    
    <!-- Title -->
    <text x="${width/2}" y="65" text-anchor="middle" class="title">${title}</text>
    
    <!-- Grid lines -->
    ${gridLines.join('\n    ')}
    
    <!-- Axes -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="2.5"/>
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="2.5"/>
    
    <!-- X-axis labels -->
    ${xAxisLabels}
    <text x="${(margin.left + width - margin.right) / 2}" y="${height - 80}" text-anchor="middle" class="axis-label">Instance Number</text>
    
    <!-- Y-axis label -->
    <text x="55" y="${(margin.top + margin.top + plotHeight) / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 55, ${(margin.top + margin.top + plotHeight) / 2})">${Y_AXIS_LABEL}</text>
    
    <!-- Data lines -->
    ${createPath(maSmall, color, 3.5, 0.4)}
    ${createPath(maLarge, color, 6)}
    
    <!-- Legend -->
    <g transform="translate(${width - margin.right + 25}, ${margin.top + 20})">
        <text x="0" y="-10" class="legend-text" font-weight="bold">Moving Average</text>

        <line x1="0" y1="30" x2="50" y2="30" stroke="${color}" stroke-width="3.5" opacity="0.4"/>
        <text x="65" y="40" class="legend-text">${MA_WINDOW_SMALL}-pt</text>

        <line x1="0" y1="85" x2="50" y2="85" stroke="${color}" stroke-width="6"/>
        <text x="65" y="95" class="legend-text"><tspan font-weight="bold">${MA_WINDOW_LARGE}-pt</tspan></text>
    </g>
</svg>`;
}

function calculateAverage(arr) {
    const valid = arr.filter(v => v !== null && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

async function main() {
    console.log('Generating error trend graphs...\n');
    
    if (!fs.existsSync(GRAPHS_DIR)) {
        fs.mkdirSync(GRAPHS_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV file not found: ${CSV_PATH}`);
        console.error('Run buildCatalogue.js first.');
        process.exit(1);
    }
    
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const data = parseCSV(csvContent);
    
    console.log(`Loaded ${data.length} instances from CSV`);
    
    const safeNumber = (val) => {
        if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return 0;
        return val;
    };
    
    const syntaxRates = data.map(d => safeNumber(d.syntaxErrorRate));
    const conversionRates = data.map(d => safeNumber(d.conversionErrorRate));
    const structuralRates = data.map(d => safeNumber(d.structuralErrorRate));
    
    console.log(`Calculating ${MA_WINDOW_SMALL}-point and ${MA_WINDOW_LARGE}-point moving averages...`);
    
    const syntaxMA10 = calculateMovingAverage(syntaxRates, MA_WINDOW_SMALL);
    const conversionMA10 = calculateMovingAverage(conversionRates, MA_WINDOW_SMALL);
    const structuralMA10 = calculateMovingAverage(structuralRates, MA_WINDOW_SMALL);
    
    const syntaxMA30 = calculateMovingAverage(syntaxRates, MA_WINDOW_LARGE);
    const conversionMA30 = calculateMovingAverage(conversionRates, MA_WINDOW_LARGE);
    const structuralMA30 = calculateMovingAverage(structuralRates, MA_WINDOW_LARGE);
    
    const svgPaths = [];

    console.log('Generating combined SVG (30-point MA)...');
    const combinedSvg = generateCombinedSVG(data, syntaxMA30, conversionMA30, structuralMA30);
    fs.writeFileSync(OUTPUT_SVG_PATH, combinedSvg);
    svgPaths.push(OUTPUT_SVG_PATH);
    console.log(`  Saved: ${OUTPUT_SVG_PATH}`);
    
    console.log('Generating individual SVGs...');
    
    const syntaxSvg = generateIndividualSVG(data, syntaxMA10, syntaxMA30, 'Syntax Error Rate Trend', '#E37222');
    fs.writeFileSync(OUTPUT_SYNTAX_SVG_PATH, syntaxSvg);
    svgPaths.push(OUTPUT_SYNTAX_SVG_PATH);
    console.log(`  Saved: ${OUTPUT_SYNTAX_SVG_PATH}`);
    
    const conversionSvg = generateIndividualSVG(data, conversionMA10, conversionMA30, 'Conversion Error Rate Trend', '#64A0C8');
    fs.writeFileSync(OUTPUT_CONVERSION_SVG_PATH, conversionSvg);
    svgPaths.push(OUTPUT_CONVERSION_SVG_PATH);
    console.log(`  Saved: ${OUTPUT_CONVERSION_SVG_PATH}`);
    
    const structuralSvg = generateIndividualSVG(data, structuralMA10, structuralMA30, 'Structural Error Rate Trend', '#A2AD00');
    fs.writeFileSync(OUTPUT_STRUCTURAL_SVG_PATH, structuralSvg);
    svgPaths.push(OUTPUT_STRUCTURAL_SVG_PATH);
    console.log(`  Saved: ${OUTPUT_STRUCTURAL_SVG_PATH}`);

    console.log('\nConverting SVGs to PNG (300 DPI)...');
    for (const svgPath of svgPaths) {
        const pngPath = await svgToPng(svgPath);
        console.log(`  Saved: ${pngPath}`);
    }
    
    const safeMax = (arr) => {
        const valid = arr.filter(v => v !== null && !isNaN(v) && isFinite(v));
        return valid.length > 0 ? Math.max(...valid) : 0;
    };
    
    console.log('\nStatistics:');
    console.log(`  Syntax Error Rate:     avg=${calculateAverage(syntaxRates).toFixed(4)}, max=${safeMax(syntaxRates).toFixed(4)}`);
    console.log(`  Conversion Error Rate: avg=${calculateAverage(conversionRates).toFixed(4)}, max=${safeMax(conversionRates).toFixed(4)}`);
    console.log(`  Structural Error Rate: avg=${calculateAverage(structuralRates).toFixed(4)}, max=${safeMax(structuralRates).toFixed(4)}`);
    
    console.log('\nDone!');
}

main();
