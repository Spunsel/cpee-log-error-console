/**
 * Trace Calculation Instance Cases Test Suite
 * Tests real-world instance cases for both Mermaid and CPEE trace calculation
 * 
 * Uses Node.js built-in test runner (Node 18+)
 * 
 * Graph file naming format: <number>_<stepnumber>_<I/O>.<ext>
 * - graphs/mermaid/{number}_{step}_{I/O}.mermaid
 * - graphs/cpee/{number}_{step}_{I/O}.xml
 * 
 * Example: 5128_Step1_O.mermaid, 5128_Step1_O.xml
 */

// Import shared DOM test setup first to initialize window and DOMParser
import '../../setup.js';

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MermaidTraceCalculator } from '../../../src/utils/trace/MermaidTraceCalculator.js';
import { CPEETraceCalculator } from '../../../src/utils/trace/CPEETraceCalculator.js';
import { compareTraces } from '../../../src/utils/trace/TraceComparison.js';

// Get the directory of this test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths to graph directories
const GRAPHS_DIR = join(__dirname, 'graphs');
const MERMAID_DIR = join(GRAPHS_DIR, 'mermaid');
const CPEE_DIR = join(GRAPHS_DIR, 'cpee');

/**
 * Load all instance case names from the graphs/mermaid directory
 * File naming format: <number>_<stepnumber>_<I/O>.mermaid
 */
function getInstanceCases() {
    const mermaidFiles = readdirSync(MERMAID_DIR)
        .filter(file => file.endsWith('.mermaid'))
        .map(file => file.replace('.mermaid', ''));
    
    return mermaidFiles.sort();
}

function loadMermaidGraph(instanceName) {
    const filePath = join(MERMAID_DIR, `${instanceName}.mermaid`);
    return readFileSync(filePath, 'utf-8');
}

function loadCPEEGraph(instanceName) {
    const filePath = join(CPEE_DIR, `${instanceName}.xml`);
    return readFileSync(filePath, 'utf-8');
}

/**
 * Format instance name for display (e.g., "1069_Step1_O" -> "1069-Step1-Output")
 */
function formatInstanceName(instanceName) {
    return instanceName
        .replace(/_O$/, '-Output')
        .replace(/_I$/, '-Input')
        .replace(/_/g, '-');
}

/**
 * Test configuration
 */
const TEST_CONFIG = {
    maxLoopIterations: 1
};

describe('Trace Calculation Instance Cases', () => {
    // Get all instance cases
    const instanceCases = getInstanceCases();
    
    // Report the number of test cases found
    console.log(`Found ${instanceCases.length} instance cases to test`);

    // Run test for each instance case
    for (const instanceName of instanceCases) {
        const displayName = formatInstanceName(instanceName);
        
        test(`Instance Case: ${displayName}`, () => {
            // Load graphs from files
            const mermaidGraph = loadMermaidGraph(instanceName);
            const cpeeGraph = loadCPEEGraph(instanceName);

            // Calculate traces
            const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(
                mermaidGraph, 
                { maxLoopIterations: TEST_CONFIG.maxLoopIterations }
            );
            const cpeeTraces = CPEETraceCalculator.calculateAllTraces(
                cpeeGraph, 
                { maxLoopIterations: TEST_CONFIG.maxLoopIterations }
            );

            // Verify both calculators produced traces
            assert.ok(
                mermaidTraces.length > 0,
                `${displayName}: Mermaid should calculate at least one trace. Got: ${mermaidTraces.length}`
            );
            assert.ok(
                cpeeTraces.length > 0,
                `${displayName}: CPEE should calculate at least one trace. Got: ${cpeeTraces.length}`
            );

            // Compare traces using TraceComparison
            const comparisonResult = compareTraces(cpeeTraces, mermaidTraces);

            // Build detailed error message if comparison fails
            if (!comparisonResult.isMatch) {
                const errorDetails = [];
                errorDetails.push(`${displayName}: Trace comparison failed`);
                errorDetails.push(`  CPEE traces: ${comparisonResult.cpeeCount}`);
                errorDetails.push(`  Mermaid traces: ${comparisonResult.mermaidCount}`);
                errorDetails.push(`  Matched: ${comparisonResult.matchCount}/${comparisonResult.totalCount}`);
                
                if (comparisonResult.uniqueCPEETraces.length > 0) {
                    errorDetails.push(`  Unmatched CPEE traces: ${comparisonResult.uniqueCPEETraces.length}`);
                }
                
                if (comparisonResult.uniqueMermaidTraces.length > 0) {
                    errorDetails.push(`  Unmatched Mermaid traces: ${comparisonResult.uniqueMermaidTraces.length}`);
                }

                assert.fail(errorDetails.join('\n'));
            }

            // Additional assertion for explicit pass confirmation
            assert.strictEqual(
                comparisonResult.isMatch,
                true,
                `${displayName}: All traces should match between Mermaid and CPEE`
            );
        });
    }
});

/**
 * Utility test to verify all graph files are present and loadable
 */
describe('Graph Files Integrity', () => {
    test('All mermaid files have corresponding CPEE files', () => {
        const mermaidFiles = readdirSync(MERMAID_DIR)
            .filter(file => file.endsWith('.mermaid'))
            .map(file => file.replace('.mermaid', ''));
        
        const cpeeFiles = readdirSync(CPEE_DIR)
            .filter(file => file.endsWith('.xml'))
            .map(file => file.replace('.xml', ''));
        
        const missingCpee = mermaidFiles.filter(name => !cpeeFiles.includes(name));
        
        assert.strictEqual(
            missingCpee.length,
            0,
            `Missing CPEE files for: ${missingCpee.join(', ')}`
        );
    });

    test('All CPEE files have corresponding mermaid files', () => {
        const mermaidFiles = readdirSync(MERMAID_DIR)
            .filter(file => file.endsWith('.mermaid'))
            .map(file => file.replace('.mermaid', ''));
        
        const cpeeFiles = readdirSync(CPEE_DIR)
            .filter(file => file.endsWith('.xml'))
            .map(file => file.replace('.xml', ''));
        
        const missingMermaid = cpeeFiles.filter(name => !mermaidFiles.includes(name));
        
        assert.strictEqual(
            missingMermaid.length,
            0,
            `Missing Mermaid files for: ${missingMermaid.join(', ')}`
        );
    });

    test('All graph files are valid and loadable', () => {
        const instanceCases = getInstanceCases();
        
        for (const instanceName of instanceCases) {
            // Verify mermaid file loads
            const mermaidGraph = loadMermaidGraph(instanceName);
            assert.ok(
                mermaidGraph.length > 0,
                `Mermaid file for ${instanceName} should not be empty`
            );

            // Verify CPEE file loads
            const cpeeGraph = loadCPEEGraph(instanceName);
            assert.ok(
                cpeeGraph.length > 0,
                `CPEE file for ${instanceName} should not be empty`
            );

            // Verify CPEE is valid XML (starts with description element)
            assert.ok(
                cpeeGraph.includes('<description'),
                `CPEE file for ${instanceName} should contain valid XML with description element`
            );
        }
    });
});
