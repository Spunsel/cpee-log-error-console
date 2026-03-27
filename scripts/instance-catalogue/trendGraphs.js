import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, 'instanceCatalogue.csv');
const OUTPUT_SVG_PATH = path.join(__dirname, 'errorTrends.svg');
const OUTPUT_SYNTAX_SVG_PATH = path.join(__dirname, 'errorTrends_syntax.svg');
const OUTPUT_CONVERSION_SVG_PATH = path.join(__dirname, 'errorTrends_conversion.svg');
const OUTPUT_STRUCTURAL_SVG_PATH = path.join(__dirname, 'errorTrends_structural.svg');

const MA_WINDOW_SMALL = 10;
const MA_WINDOW_LARGE = 30;
const X_AXIS_TICK_INTERVAL = 10;
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
    
    for (let i = 0; i < data.length; i += X_AXIS_TICK_INTERVAL) {
        const x = margin.left + (i / (data.length - 1)) * plotWidth;
        const instanceNum = instanceNumbers[i];
        labels.push(`<line x1="${x}" y1="${axisY}" x2="${x}" y2="${axisY + 5}" stroke="#333" stroke-width="1"/>`);
        labels.push(`<text x="${x}" y="${axisY + 12}" text-anchor="end" font-size="10" fill="#666" transform="rotate(-45, ${x}, ${axisY + 12})">${instanceNum}</text>`);
    }
    
    // Always include the last instance
    const lastIdx = data.length - 1;
    const lastX = margin.left + plotWidth;
    const lastInstanceNum = instanceNumbers[lastIdx];
    if (lastIdx % X_AXIS_TICK_INTERVAL !== 0) {
        labels.push(`<line x1="${lastX}" y1="${axisY}" x2="${lastX}" y2="${axisY + 5}" stroke="#333" stroke-width="1"/>`);
        labels.push(`<text x="${lastX}" y="${axisY + 12}" text-anchor="end" font-size="10" fill="#666" transform="rotate(-45, ${lastX}, ${axisY + 12})">${lastInstanceNum}</text>`);
    }
    
    return labels.join('\n    ');
}

function generateCombinedSVG(data, syntaxMA, conversionMA, structuralMA) {
    const width = 1200;
    const height = 550;
    const margin = { top: 40, right: 120, bottom: 100, left: 70 };
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
        gridLines.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`);
        gridLines.push(`<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#666">${value}</text>`);
    }
    
    const xAxisLabels = generateXAxisLabels(data, margin, plotWidth, plotHeight, height);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
        .title { font: bold 18px sans-serif; }
        .axis-label { font: 14px sans-serif; }
        .legend-text { font: 12px sans-serif; }
    </style>
    
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="white"/>
    
    <!-- Title -->
    <text x="${width/2}" y="25" text-anchor="middle" class="title">Error Rate Trends (${MA_WINDOW_LARGE}-point Centered Moving Average)</text>
    
    <!-- Grid lines -->
    ${gridLines.join('\n    ')}
    
    <!-- Axes -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="1"/>
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="1"/>
    
    <!-- X-axis labels -->
    ${xAxisLabels}
    <text x="${width/2}" y="${height - 10}" text-anchor="middle" class="axis-label">Instance Number</text>
    
    <!-- Y-axis label -->
    <text x="15" y="${(margin.top + plotHeight) / 2 + 20}" text-anchor="middle" class="axis-label" transform="rotate(-90, 15, ${(margin.top + plotHeight) / 2 + 20})">${Y_AXIS_LABEL}</text>
    
    <!-- Data lines -->
    ${createPath(syntaxMA, '#ff6384', 2.5)}
    ${createPath(conversionMA, '#36a2eb', 2.5)}
    ${createPath(structuralMA, '#ff9f40', 2.5)}
    
    <!-- Legend -->
    <g transform="translate(${width - margin.right + 10}, ${margin.top})">
        <!-- Legend Title -->
        <text x="0" y="-10" class="legend-text" font-weight="bold">Error Types</text>

        <line x1="0" y1="10" x2="25" y2="10" stroke="#ff6384" stroke-width="2.5"/>
        <text x="30" y="14" class="legend-text">Syntax</text>
        
        <line x1="0" y1="35" x2="25" y2="35" stroke="#36a2eb" stroke-width="2.5"/>
        <text x="30" y="39" class="legend-text">Conversion</text>
        
        <line x1="0" y1="60" x2="25" y2="60" stroke="#ff9f40" stroke-width="2.5"/>
        <text x="30" y="64" class="legend-text">Structural</text>
    </g>
</svg>`;
}

function generateIndividualSVG(data, maSmall, maLarge, title, color) {
    const width = 1200;
    const height = 450;
    const margin = { top: 40, right: 100, bottom: 100, left: 70 };
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
        gridLines.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`);
        gridLines.push(`<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#666">${value}</text>`);
    }
    
    const xAxisLabels = generateXAxisLabels(data, margin, plotWidth, plotHeight, height);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
        .title { font: bold 18px sans-serif; }
        .axis-label { font: 14px sans-serif; }
        .legend-text { font: 12px sans-serif; }
    </style>
    
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="white"/>
    
    <!-- Title -->
    <text x="${width/2}" y="25" text-anchor="middle" class="title">${title}</text>
    
    <!-- Grid lines -->
    ${gridLines.join('\n    ')}
    
    <!-- Axes -->
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="1"/>
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#333" stroke-width="1"/>
    
    <!-- X-axis labels -->
    ${xAxisLabels}
    <text x="${width/2}" y="${height - 10}" text-anchor="middle" class="axis-label">Instance Number</text>
    
    <!-- Y-axis label -->
    <text x="15" y="${(margin.top + plotHeight) / 2 + 20}" text-anchor="middle" class="axis-label" transform="rotate(-90, 15, ${(margin.top + plotHeight) / 2 + 20})">${Y_AXIS_LABEL}</text>
    
    <!-- Data lines -->
    ${createPath(maSmall, color, 1.5, 0.4)}
    ${createPath(maLarge, color, 3)}
    
    <!-- Legend -->
    <g transform="translate(${width - margin.right + 10}, ${margin.top})">
        <!-- Legend Title -->
        <text x="0" y="-10" class="legend-text" font-weight="bold">Moving Average</text>

        <!-- 10-pt (thin line) -->
        <line x1="0" y1="10" x2="25" y2="10" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
        <text x="30" y="14" class="legend-text">${MA_WINDOW_SMALL}-pt</text>

        <!-- 30-pt (bold line) -->
        <line x1="0" y1="35" x2="25" y2="35" stroke="${color}" stroke-width="3"/>
        <text x="30" y="39" class="legend-text"><tspan font-weight="bold">${MA_WINDOW_LARGE}-pt</tspan></text>
    </g>
</svg>`;
}

function calculateAverage(arr) {
    const valid = arr.filter(v => v !== null && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function main() {
    console.log('Generating error trend graphs...\n');
    
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
    
    console.log('Generating combined SVG (30-point MA)...');
    const combinedSvg = generateCombinedSVG(data, syntaxMA30, conversionMA30, structuralMA30);
    fs.writeFileSync(OUTPUT_SVG_PATH, combinedSvg);
    console.log(`  Saved: ${OUTPUT_SVG_PATH}`);
    
    console.log('Generating individual SVGs...');
    
    const syntaxSvg = generateIndividualSVG(data, syntaxMA10, syntaxMA30, 'Syntax Error Rate Trend', '#ff6384');
    fs.writeFileSync(OUTPUT_SYNTAX_SVG_PATH, syntaxSvg);
    console.log(`  Saved: ${OUTPUT_SYNTAX_SVG_PATH}`);
    
    const conversionSvg = generateIndividualSVG(data, conversionMA10, conversionMA30, 'Conversion Error Rate Trend', '#36a2eb');
    fs.writeFileSync(OUTPUT_CONVERSION_SVG_PATH, conversionSvg);
    console.log(`  Saved: ${OUTPUT_CONVERSION_SVG_PATH}`);
    
    const structuralSvg = generateIndividualSVG(data, structuralMA10, structuralMA30, 'Structural Error Rate Trend', '#ff9f40');
    fs.writeFileSync(OUTPUT_STRUCTURAL_SVG_PATH, structuralSvg);
    console.log(`  Saved: ${OUTPUT_STRUCTURAL_SVG_PATH}`);
    
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
