import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_PATH = path.join(__dirname, 'instanceMetadata.json');
const ERRORS_PATH = path.join(__dirname, 'errorCounts.json');
const OUTPUT_CSV_PATH = path.join(__dirname, 'instanceCatalogue.csv');

const NORMALIZATION_BASE = 100;

function calculateRate(count, expositionLineCount) {
    if (count === null || expositionLineCount === null || expositionLineCount === 0) {
        return null;
    }
    return (count / expositionLineCount) * NORMALIZATION_BASE;
}

function formatValue(value, decimals = 4) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'number' && !Number.isInteger(value)) {
        return value.toFixed(decimals);
    }
    return value.toString();
}

function getBaseInstanceNumber(instanceNum) {
    if (instanceNum >= 200000) {
        return instanceNum - 200000;
    }
    return instanceNum;
}

function buildCatalogue() {
    console.log('Building instance catalogue CSV...\n');
    
    if (!fs.existsSync(METADATA_PATH)) {
        console.error(`Metadata file not found: ${METADATA_PATH}`);
        console.error('Run catalogueBuilder.js first to generate metadata.');
        process.exit(1);
    }
    
    if (!fs.existsSync(ERRORS_PATH)) {
        console.error(`Error counts file not found: ${ERRORS_PATH}`);
        console.error('Run catalogueBuilder.js first to generate the template.');
        process.exit(1);
    }
    
    const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
    const errors = JSON.parse(fs.readFileSync(ERRORS_PATH, 'utf-8'));
    
    const instanceNumbers = Object.keys(metadata).map(Number).sort((a, b) => a - b);
    
    const headers = [
        'instanceNumber',
        'instanceUUID',
        'expositionEventLineCount',
        'syntaxErrors',
        'syntaxErrorRate',
        'conversionErrors',
        'conversionErrorRate',
        'structuralErrors',
        'structuralErrorRate',
        'totalErrors',
        'totalErrorRate',
        'warningCount',
        'errorCount'
    ];
    
    const rows = [headers.join(',')];
    
    let analyzedCount = 0;
    let pendingCount = 0;
    
    for (const instanceNum of instanceNumbers) {
        const meta = metadata[instanceNum];
        const baseInstanceNum = getBaseInstanceNumber(instanceNum);
        const err = errors[baseInstanceNum] || errors[instanceNum] || {};
        
        const expositionLineCount = meta.expositionEventLineCount;
        const syntaxErrors = err.syntaxErrors;
        const conversionErrors = err.conversionErrors;
        const structuralErrors = err.structuralErrors;
        const warningCount = err.warningCount;
        const errorCount = err.errorCount;
        
        let totalErrors = null;
        if (syntaxErrors !== null && conversionErrors !== null && structuralErrors !== null) {
            totalErrors = syntaxErrors + conversionErrors + structuralErrors;
            analyzedCount++;
        } else {
            pendingCount++;
        }
        
        const row = [
            instanceNum,
            meta.uuid,
            formatValue(expositionLineCount),
            formatValue(syntaxErrors),
            formatValue(calculateRate(syntaxErrors, expositionLineCount)),
            formatValue(conversionErrors),
            formatValue(calculateRate(conversionErrors, expositionLineCount)),
            formatValue(structuralErrors),
            formatValue(calculateRate(structuralErrors, expositionLineCount)),
            formatValue(totalErrors),
            formatValue(calculateRate(totalErrors, expositionLineCount)),
            formatValue(warningCount),
            formatValue(errorCount)
        ];
        
        rows.push(row.join(','));
    }
    
    fs.writeFileSync(OUTPUT_CSV_PATH, rows.join('\n'));
    
    console.log(`Catalogue saved to: ${OUTPUT_CSV_PATH}`);
    console.log(`\nSummary:`);
    console.log(`  - Total instances: ${instanceNumbers.length}`);
    console.log(`  - Analyzed (have error counts): ${analyzedCount}`);
    console.log(`  - Pending (no error counts yet): ${pendingCount}`);
    console.log(`\nNormalization: errors per ${NORMALIZATION_BASE} exposition lines`);
}

buildCatalogue();
