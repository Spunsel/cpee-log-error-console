import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'fallback', 'logs');
const UUID_MAPPING_PATH = path.join(__dirname, '..', '..', 'fallback', 'uuid-mapping.json');
const OUTPUT_METADATA_PATH = path.join(__dirname, 'instanceMetadata.json');
const OUTPUT_ERRORS_TEMPLATE_PATH = path.join(__dirname, 'errorCounts.json');

function countExpositionEventLines(logFilePath) {
    try {
        const content = fs.readFileSync(logFilePath, 'utf-8');
        const documents = content.split(/^---$/m).filter(doc => doc.trim().length > 0);
        
        let totalExpositionLines = 0;
        
        for (const doc of documents) {
            if (doc.includes('cpee:lifecycle:transition: description/exposition')) {
                const lines = doc.split('\n').filter(line => line.trim().length > 0);
                totalExpositionLines += lines.length;
            }
        }
        
        return totalExpositionLines;
    } catch (error) {
        console.error(`Error reading ${logFilePath}: ${error.message}`);
        return null;
    }
}

function findLogFile(uuid, logsDir) {
    const possibleNames = [
        `${uuid}.xes.yaml`,
        `${uuid}_v2.xes.yaml`
    ];
    
    for (const name of possibleNames) {
        const filePath = path.join(logsDir, name);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

function buildMetadata() {
    console.log('Building instance metadata...\n');
    
    if (!fs.existsSync(UUID_MAPPING_PATH)) {
        console.error(`UUID mapping not found: ${UUID_MAPPING_PATH}`);
        process.exit(1);
    }
    
    const uuidMapping = JSON.parse(fs.readFileSync(UUID_MAPPING_PATH, 'utf-8'));
    const instanceNumbers = Object.keys(uuidMapping).map(Number).sort((a, b) => a - b);
    
    console.log(`Found ${instanceNumbers.length} instances in uuid-mapping.json`);
    
    const metadata = {};
    const errorsTemplate = {};
    let successCount = 0;
    let missingCount = 0;
    let zeroExpositionCount = 0;
    
    for (const instanceNum of instanceNumbers) {
        const uuid = uuidMapping[instanceNum.toString()];
        const logFile = findLogFile(uuid, LOGS_DIR);
        
        if (logFile) {
            const expositionEventLineCount = countExpositionEventLines(logFile);
            metadata[instanceNum] = {
                uuid: uuid,
                expositionEventLineCount: expositionEventLineCount
            };
            successCount++;
            
            if (expositionEventLineCount === 0) {
                zeroExpositionCount++;
                console.warn(`  Warning: No exposition events found for instance ${instanceNum}`);
            }
        } else {
            metadata[instanceNum] = {
                uuid: uuid,
                expositionEventLineCount: null
            };
            missingCount++;
            console.warn(`  Warning: No log file found for instance ${instanceNum} (${uuid})`);
        }
        
        errorsTemplate[instanceNum] = {
            syntaxErrors: 0,
            conversionErrors: 0,
            structuralErrors: 0,
            warningCount: 0,
            errorCount: 0
        };
    }
    
    fs.writeFileSync(OUTPUT_METADATA_PATH, JSON.stringify(metadata, null, 2));
    console.log(`\nMetadata saved to: ${OUTPUT_METADATA_PATH}`);
    
    if (fs.existsSync(OUTPUT_ERRORS_TEMPLATE_PATH)) {
        const existingErrors = JSON.parse(fs.readFileSync(OUTPUT_ERRORS_TEMPLATE_PATH, 'utf-8'));
        let addedCount = 0;
        for (const [key, value] of Object.entries(errorsTemplate)) {
            if (!(key in existingErrors)) {
                existingErrors[key] = value;
                addedCount++;
            }
        }
        const sorted = Object.keys(existingErrors).sort((a, b) => Number(a) - Number(b));
        const merged = {};
        for (const k of sorted) merged[k] = existingErrors[k];
        fs.writeFileSync(OUTPUT_ERRORS_TEMPLATE_PATH, JSON.stringify(merged, null, 2));
        console.log(`Error counts updated: ${addedCount} new entries added (${sorted.length} total)`);
    } else {
        fs.writeFileSync(OUTPUT_ERRORS_TEMPLATE_PATH, JSON.stringify(errorsTemplate, null, 2));
        console.log(`Error counts template saved to: ${OUTPUT_ERRORS_TEMPLATE_PATH}`);
    }
    
    console.log(`\nSummary:`);
    console.log(`  - Total instances: ${instanceNumbers.length}`);
    console.log(`  - Logs found: ${successCount}`);
    console.log(`  - Logs missing: ${missingCount}`);
    console.log(`  - Instances with zero exposition events: ${zeroExpositionCount}`);
}

buildMetadata();
