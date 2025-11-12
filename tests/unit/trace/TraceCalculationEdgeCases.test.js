/**
 * Trace Calculation Edge Cases Test Suite
 * Tests edge cases for both Mermaid and CPEE trace calculation
 * 
 * Uses Node.js built-in test runner (Node 18+)
 */

// Import shared DOM test setup first to initialize window and DOMParser
import '../../setup.js';

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { MermaidTraceCalculator } from '../../../src/utils/trace/MermaidTraceCalculator.js';
import { CPEETraceCalculator } from '../../../src/utils/trace/CPEETraceCalculator.js';

/**
 * Helper function to compare traces from Mermaid and CPEE
 * Verifies that:
 * 1. Both calculate the same number of traces
 * 2. For each Mermaid trace, there's a corresponding CPEE trace where all alt_ids are present
 * @param {Array} mermaidTraces - Traces calculated from Mermaid
 * @param {Array} cpeeTraces - Traces calculated from CPEE
 * @param {string} testName - Name of the test for error messages
 */
function assertTracesMatch(mermaidTraces, cpeeTraces, testName) {
    // Check same number of traces
    assert.strictEqual(
        mermaidTraces.length,
        cpeeTraces.length,
        `${testName}: Mermaid and CPEE should calculate the same number of traces. Mermaid: ${mermaidTraces.length}, CPEE: ${cpeeTraces.length}`
    );

    // For each Mermaid trace, find a matching CPEE trace
    for (let i = 0; i < mermaidTraces.length; i++) {
        const mermaidTrace = mermaidTraces[i];
        
        // Extract all alt_ids from Mermaid trace (skip if alt_id is null/undefined)
        const mermaidAltIds = mermaidTrace.path
            .map(task => task.alt_id)
            .filter(altId => altId !== null && altId !== undefined);
        
        // If no alt_ids in Mermaid trace, skip comparison for this trace
        if (mermaidAltIds.length === 0) {
            continue;
        }

        // Find a CPEE trace that contains all these alt_ids
        const matchingCpeeTrace = cpeeTraces.find(cpeeTrace => {
            // Extract all identifiers from CPEE trace (both id and alt_id)
            const cpeeIdentifiers = new Set();
            cpeeTrace.path.forEach(task => {
                if (task.id) {
                    cpeeIdentifiers.add(task.id);
                }
                if (task.alt_id) {
                    cpeeIdentifiers.add(task.alt_id);
                }
            });
            
            // Check if all Mermaid alt_ids are present in CPEE identifiers
            return mermaidAltIds.every(altId => cpeeIdentifiers.has(altId));
        });

        assert.ok(
            matchingCpeeTrace !== undefined,
            `${testName}: Mermaid trace ${i + 1} (alt_ids: ${mermaidAltIds.join(', ')}) should have a matching CPEE trace with all these alt_ids present`
        );
    }
}

describe('Trace Calculation Edge Cases', () => {
    
    // ============================================================================
    // Edge Case 1: Self-looping task node
    // ============================================================================
    test('Edge Case 1: Self-looping task node', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Process)
t1:task:(Process) --> |retry| t1:task:(Process)
t1:task:(Process) --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Process</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <loop mode="pre_test" condition="retry" a:alt_id="loop1" language="text/javascript">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Process</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 2 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 2 });

        // assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assert.ok(mermaidTraces.some(trace => trace.type === 'loop'), 'Should contain a loop trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 1');
    });

    // ============================================================================
    // Edge Case 2: Empty parallel gateway (no branches)
    // ============================================================================
    test('Edge Case 2: Empty parallel gateway', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg">
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // Should handle gracefully - either empty traces or single trace with just start/end
        assert.ok(Array.isArray(mermaidTraces), 'Mermaid should return array');
        assert.ok(Array.isArray(cpeeTraces), 'CPEE should return array');
    });

    // ============================================================================
    // Edge Case 3: Nested loops with escape conditions
    // ============================================================================
    test('Edge Case 3: Nested loops with escape conditions', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Outer Task)
t1:task:(Outer Task) --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> |loop| t1:task:(Outer Task)
gw1:exclusivegateway:{x} --> |continue| t2:task:(Inner Task)
t2:task:(Inner Task) --> gw2:exclusivegateway:{x}
gw2:exclusivegateway:{x} --> |loop| t2:task:(Inner Task)
gw2:exclusivegateway:{x} --> |exit| ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="loop" a:alt_id="outer" language="text/javascript">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Outer Task</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
  <loop mode="pre_test" condition="loop" a:alt_id="inner" language="text/javascript">
    <call id="t2" endpoint="" a:alt_id="t2">
      <parameters>
        <label>Inner Task</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 2 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 2 });

        // assert.ok(mermaidTraces.length > 0, 'Mermaid should handle nested loops');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle nested loops');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 3');
    });

    // ============================================================================
    // Edge Case 4: Task with escaped quotes in label
    // ============================================================================
    test('Edge Case 4: Task with escaped quotes in label', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:("Task with \\"quotes\\"")
t1:task:("Task with \\"quotes\\"") --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task with "quotes"</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // assert.ok(mermaidTraces.length > 0, 'Mermaid should handle escaped quotes');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle quotes in labels');
        assert.ok(mermaidTraces.some(trace => 
            trace.path.some(task => task.task === 'Task with "quotes"')
        ), 'Should preserve quotes in task label');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 4');
    });

    // ============================================================================
    // Edge Case 5: Multiple start events (disconnected components)
    // ============================================================================
    test('Edge Case 5: Multiple start events', () => {
        const mermaid = `
graph LR
se1:startevent:((start1)) --> t1:task:(Task 1)
t1:task:(Task 1) --> ee1:endevent:((end1))
se2:startevent:((start2)) --> t2:task:(Task 2)
t2:task:(Task 2) --> ee2:endevent:((end2))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task 1</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="t2" endpoint="" a:alt_id="t2">
    <parameters>
      <label>Task 2</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length >= 2, 'Mermaid should calculate traces for each start event');
        assert.ok(cpeeTraces.length >= 1, 'CPEE should calculate at least one trace');
        // Note: Edge Case 5 has different behavior (Mermaid finds multiple disconnected components, CPEE finds sequential)
        // So we skip trace matching for this case
    });

    // ============================================================================
    // Edge Case 6: Complex parallel merge with different path lengths
    // ============================================================================
    test('Edge Case 6: Complex parallel merge with different path lengths', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg1:parallelgateway:{AND}
pg1:parallelgateway:{AND} --> t1:task:(Quick Task)
pg1:parallelgateway:{AND} --> t2:task:(Task A)
t2:task:(Task A) --> t3:task:(Task B)
t1:task:(Quick Task) --> pg2:parallelgateway:{AND}
t3:task:(Task B) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg1">
    <parallel_branch>
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Quick Task</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // assert.ok(mermaidTraces.length > 0, 'Mermaid should handle parallel paths with different lengths');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle parallel paths with different lengths');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 6');
    });

    // ============================================================================
    // Edge Case 7: Exclusive gateway with all conditions false (dead end)
    // ============================================================================
    test('Edge Case 7: Exclusive gateway with all conditions false', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Task)
t1:task:(Task) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |"false"| t2:task:(Never Reached)
gw:exclusivegateway:{x} --> |"false"| t3:task:(Also Never)
gw:exclusivegateway:{x} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="gw">
    <alternative condition="false" language="text/javascript">
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Never Reached</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="false" language="text/javascript">
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Also Never</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // Should still calculate traces, potentially including the default path
        assert.ok(Array.isArray(mermaidTraces), 'Mermaid should return array even with dead ends');
        assert.ok(Array.isArray(cpeeTraces), 'CPEE should return array even with dead ends');
    });

    // ============================================================================
    // Edge Case 8: Task with parentheses in label (already quoted)
    // ============================================================================
    test('Edge Case 8: Task with parentheses in label', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:("Task (with parentheses)")
t1:task:("Task (with parentheses)") --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task (with parentheses)</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // assert.ok(mermaidTraces.length > 0, 'Mermaid should handle parentheses in quoted labels');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle parentheses in labels');
        assert.ok(mermaidTraces[0].path[0].task.includes('('), 'Should preserve parentheses in task label');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 8');
    });

    // ============================================================================
    // Edge Case 9: Deeply nested structure - Parallel with XOR containing nested Parallel
    // ============================================================================
    test('Edge Case 9: Parallel with XOR containing nested Parallel', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg1:parallelgateway:{AND}
pg1:parallelgateway:{AND} --> t1:task:(Task 1)
pg1:parallelgateway:{AND} --> gw1:exclusivegateway:{x}
t1:task:(Task 1) --> pg1_merge:parallelgateway:{AND}
gw1:exclusivegateway:{x} --> |"path1"| t2:task:(Task 2)
gw1:exclusivegateway:{x} --> |"path2"| pg2:parallelgateway:{AND}
t2:task:(Task 2) --> gw1_merge:exclusivegateway:{x}
pg2:parallelgateway:{AND} --> t3:task:(Task 3)
pg2:parallelgateway:{AND} --> t4:task:(Task 4)
t3:task:(Task 3) --> pg2_merge:parallelgateway:{AND}
t4:task:(Task 4) --> pg2_merge:parallelgateway:{AND}
pg2_merge:parallelgateway:{AND} --> gw1_merge:exclusivegateway:{x}
gw1_merge:exclusivegateway:{x} --> pg1_merge:parallelgateway:{AND}
pg1_merge:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg1">
    <parallel_branch>
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Task 1</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <choose mode="exclusive" a:alt_id="gw1">
        <alternative condition="path1" language="text/javascript">
          <call id="t2" endpoint="" a:alt_id="t2">
            <parameters>
              <label>Task 2</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </alternative>
        <alternative condition="path2" language="text/javascript">
          <parallel wait="-1" cancel="last" a:alt_id="pg2">
            <parallel_branch>
              <call id="t3" endpoint="" a:alt_id="t3">
                <parameters>
                  <label>Task 3</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
            </parallel_branch>
            <parallel_branch>
              <call id="t4" endpoint="" a:alt_id="t4">
                <parameters>
                  <label>Task 4</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
            </parallel_branch>
          </parallel>
        </alternative>
      </choose>
    </parallel_branch>
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle deeply nested structure');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle deeply nested structure');
        // Should have multiple traces due to XOR and parallel combinations
        assert.ok(mermaidTraces.length >= 2, 'Should generate multiple traces from nested gateways');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 9');
    });

    // ============================================================================
    // Edge Case 10: Mixed gateway types in sequence
    // ============================================================================
    test('Edge Case 10: Mixed gateway types in sequence', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> t1:task:(Task 1)
pg:parallelgateway:{AND} --> t2:task:(Task 2)
t1:task:(Task 1) --> gw:exclusivegateway:{x}
t2:task:(Task 2) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |"path1"| t3:task:(Path 1)
gw:exclusivegateway:{x} --> |"path2"| t4:task:(Path 2)
t3:task:(Path 1) --> pg2:parallelgateway:{AND}
t4:task:(Path 2) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg">
    <parallel_branch>
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Task 1</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task 2</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <choose mode="exclusive" a:alt_id="gw">
    <alternative condition="path1" language="text/javascript">
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Path 1</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="path2" language="text/javascript">
      <call id="t4" endpoint="" a:alt_id="t4">
        <parameters>
          <label>Path 2</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
  <parallel wait="-1" cancel="last" a:alt_id="pg2">
    <parallel_branch>
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Path 1</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="t4" endpoint="" a:alt_id="t4">
        <parameters>
          <label>Path 2</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // assert.ok(mermaidTraces.length > 0, 'Mermaid should handle mixed gateway types');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle mixed gateway types');
        // Should have multiple traces due to parallel and exclusive combinations
        assert.ok(mermaidTraces.length >= 2, 'Should generate multiple traces from mixed gateways');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 10');
    });

    // ============================================================================
    // Edge Case 11: Pre-test loop at end (0-iteration path included)
    // ============================================================================
    test('Edge Case 11: Pre-test loop at end', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Task A)
t1:task:(Task A) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |loop| t1:task:(Task A)
gw:exclusivegateway:{x} --> t2:task:(Task B)
t2:task:(Task B) --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task A</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
    <call id="t2" endpoint="" a:alt_id="t2">
      <parameters>
        <label>Task B</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle pre-test loop at end');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 11');
    });

    // ============================================================================
    // Edge Case 12: Post-test loop (minimum one iteration)
    // ============================================================================
    test('Edge Case 12: Post-test loop minimum one iteration', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Task A)
t1:task:(Task A) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |loop| t1:task:(Task A)
gw:exclusivegateway:{x} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="post_test" condition="loop" a:alt_id="loop1" language="text/javascript">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Task A</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 2 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 2 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle post-test loop');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 12');
    });

    // ============================================================================
    // Edge Case 13: Nested pre-test loops
    // ============================================================================
    test('Edge Case 13: Nested pre-test loops', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t0:task:(Task B)
t0:task:(Task B) --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> |outer| t0:task:(Task B)
gw1:exclusivegateway:{x} --> t1:task:(Task A)
t1:task:(Task A) --> gw2:exclusivegateway:{x}
gw2:exclusivegateway:{x} --> |inner| t1:task:(Task A)
gw2:exclusivegateway:{x} --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t0" endpoint="" a:alt_id="t0">
    <parameters>
      <label>Task B</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <loop mode="pre_test" condition="outer" a:alt_id="outer" language="text/javascript">
    <loop mode="pre_test" condition="inner" a:alt_id="inner" language="text/javascript">
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Task A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </loop>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle nested pre-test loops');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 13');
    });

    // ============================================================================
    // Edge Case 14: Loop followed by additional task
    // ============================================================================
    test('Edge Case 14: Loop followed by additional task', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Task A)
t1:task:(Task A) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |loop| t1:task:(Task A)
gw:exclusivegateway:{x} --> t2:task:(Task B)
t2:task:(Task B) --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Task A</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
  <call id="t2" endpoint="" a:alt_id="t2">
    <parameters>
      <label>Task B</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle loop followed by additional task');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 14');
    });

    // ============================================================================
    // Edge Case 15: Loop body with multiple tasks
    // ============================================================================
    test('Edge Case 15: Loop body with multiple tasks', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Task A)
t1:task:(Task A) --> t2:task:(Task C)
t2:task:(Task C) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |loop| t1:task:(Task A)
gw:exclusivegateway:{x} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Task A</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="t2" endpoint="" a:alt_id="t2">
      <parameters>
        <label>Task C</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle loop body with multiple tasks');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 15');
    });

    // ============================================================================
    // Edge Case 16: Loop within parallel branch
    // ============================================================================
    test('Edge Case 16: Loop within parallel branch', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> t1:task:(Task A)
pg:parallelgateway:{AND} --> t2:task:(Task B)
t1:task:(Task A) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |loop| t1:task:(Task A)
gw:exclusivegateway:{x} --> pg2:parallelgateway:{AND}
t2:task:(Task B) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg1">
    <parallel_branch>
      <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
        <call id="t1" endpoint="" a:alt_id="t1">
          <parameters>
            <label>Task A</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </loop>
    </parallel_branch>
    <parallel_branch>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle loop within parallel branch');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 16');
    });

    // ============================================================================
    // Edge Case 17: Escape at start of alternative
    // ============================================================================
    test('Edge Case 17: Escape at start of alternative', () => {
        // Note: Mermaid doesn't have escape semantics, so this is CPEE-only
        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <choose mode="exclusive" a:alt_id="gw1">
    <alternative condition="path1" language="text/javascript">
      <escape/>
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Task A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="path2" language="text/javascript">
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>
        `.trim();

        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle escape at start of alternative');
        
        // Should have only [B] (escape terminates path1 immediately)
        const traceB = cpeeTraces.find(t => t.path.length === 1 && t.path[0].alt_id === 't2');
        assert.ok(traceB, 'Should have trace [B] from path2');
        
        // Path1 with escape should not produce trace with t1
        const traceWithT1 = cpeeTraces.find(t => t.path.some(task => task.alt_id === 't1'));
        assert.ok(!traceWithT1, 'Should not have trace containing t1 (terminated by escape)');
    });

    // ============================================================================
    // Edge Case 18: Escape after tasks in alternative
    // ============================================================================
    test('Edge Case 18: Escape after tasks in alternative', () => {
        // Note: Mermaid doesn't have escape semantics, so this is CPEE-only
        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <choose mode="exclusive" a:alt_id="gw1">
    <alternative condition="path1" language="text/javascript">
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Task A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <escape/>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="path2" language="text/javascript">
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Task C</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>
        `.trim();

        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle escape after tasks in alternative');
        
        // Should have: [A] (from path1, terminated before B) and [C] (from path2)
        const traceA = cpeeTraces.find(t => t.path.length === 1 && t.path[0].alt_id === 't1');
        const traceC = cpeeTraces.find(t => t.path.length === 1 && t.path[0].alt_id === 't3');
        
        assert.ok(traceA, 'Should have trace [A] (terminated before B)');
        assert.ok(traceC, 'Should have trace [C]');
        
        // Should not have trace with both A and B
        const traceAB = cpeeTraces.find(t => t.path.length === 2 && t.path[0].alt_id === 't1' && t.path[1].alt_id === 't2');
        assert.ok(!traceAB, 'Should not have trace [A, B] (B excluded by escape)');
    });

    // ============================================================================
    // Edge Case 19: Loop directly before escape
    // ============================================================================
    test('Edge Case 19: Loop directly before escape', () => {
        // Note: Mermaid doesn't have escape semantics, so this is CPEE-only
        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <choose mode="exclusive" a:alt_id="gw1">
    <alternative condition="path1" language="text/javascript">
      <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
        <call id="t1" endpoint="" a:alt_id="t1">
          <parameters>
            <label>Task A</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </loop>
      <escape/>
    </alternative>
  </choose>
</description>
        `.trim();

        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle loop directly before escape');
        
        // Should have: [] (0-iter then escape) and [A] (1-iter then escape)
        // Empty trace may be filtered
        const traceA = cpeeTraces.find(t => t.path.length === 1 && t.path[0].alt_id === 't1');
        assert.ok(traceA, 'Should have trace [A] (1-iteration then escape)');
    });

    // ============================================================================
    // Edge Case 20: Choose nested in loop body
    // ============================================================================
    test('Edge Case 20: Choose nested in loop body', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> |loop| gw2:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> ee:endevent:((end))
gw2:exclusivegateway:{x} --> |path1| t1:task:(Task A)
gw2:exclusivegateway:{x} --> |path2| t2:task:(Task B)
t1:task:(Task A) --> gw1:exclusivegateway:{x}
t2:task:(Task B) --> gw1:exclusivegateway:{x}
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
    <choose mode="exclusive" a:alt_id="gw1">
      <alternative condition="path1" language="text/javascript">
        <call id="t1" endpoint="" a:alt_id="t1">
          <parameters>
            <label>Task A</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </alternative>
      <alternative condition="path2" language="text/javascript">
        <call id="t2" endpoint="" a:alt_id="t2">
          <parameters>
            <label>Task B</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </alternative>
    </choose>
  </loop>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle choose nested in loop body');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 20');
    });

    // ============================================================================
    // Edge Case 21: Two-branch parallel with multi-task branches
    // ============================================================================
    test('Edge Case 21: Two-branch parallel with multi-task branches', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> t1:task:(Task A)
pg:parallelgateway:{AND} --> t3:task:(Task B)
t1:task:(Task A) --> t2:task:(Task C)
t2:task:(Task C) --> pg2:parallelgateway:{AND}
t3:task:(Task B) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg1">
    <parallel_branch>
      <call id="t1" endpoint="" a:alt_id="t1">
        <parameters>
          <label>Task A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task C</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle two-branch parallel with multi-task branches');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 21');
    });

    // ============================================================================
    // Edge Case 22: Parallel with empty branch
    // ============================================================================
    test('Edge Case 22: Parallel with empty branch', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> gw:exclusivegateway:{x}
pg:parallelgateway:{AND} --> t2:task:(Task B)
gw:exclusivegateway:{x} --> |false| gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> pg2:parallelgateway:{AND}
t2:task:(Task B) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg1">
    <parallel_branch>
      <loop mode="pre_test" condition="false" a:alt_id="loop1" language="text/javascript">
        <call id="t1" endpoint="" a:alt_id="t1">
          <parameters>
            <label>Task A</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </loop>
    </parallel_branch>
    <parallel_branch>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle parallel with empty branch');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 22');
    });

    // ============================================================================
    // Edge Case 23: Parallel nested in alternative
    // ============================================================================
    test('Edge Case 23: Parallel nested in alternative', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |path1| pg:parallelgateway:{AND}
gw:exclusivegateway:{x} --> |path2| t3:task:(Task C)
pg:parallelgateway:{AND} --> t1:task:(Task A)
pg:parallelgateway:{AND} --> t2:task:(Task B)
t1:task:(Task A) --> pg2:parallelgateway:{AND}
t2:task:(Task B) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> gw2:exclusivegateway:{x}
t3:task:(Task C) --> gw2:exclusivegateway:{x}
gw2:exclusivegateway:{x} --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <choose mode="exclusive" a:alt_id="gw1">
    <alternative condition="path1" language="text/javascript">
      <parallel wait="-1" cancel="last" a:alt_id="pg1">
        <parallel_branch>
          <call id="t1" endpoint="" a:alt_id="t1">
            <parameters>
              <label>Task A</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </parallel_branch>
        <parallel_branch>
          <call id="t2" endpoint="" a:alt_id="t2">
            <parameters>
              <label>Task B</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </parallel_branch>
      </parallel>
    </alternative>
    <alternative condition="path2" language="text/javascript">
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Task C</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle parallel nested in alternative');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 23');
    });

    // ============================================================================
    // Edge Case 24: Sequence with escape stopping subsequent tasks
    // ============================================================================
    test('Edge Case 24: Sequence with escape stopping subsequent tasks', () => {
        // Note: Mermaid doesn't have escape semantics, so this is CPEE-only
        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task A</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="gw1">
    <alternative condition="path1" language="text/javascript">
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <escape/>
    </alternative>
    <alternative condition="path2" language="text/javascript">
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Task C</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
  <call id="t4" endpoint="" a:alt_id="t4">
    <parameters>
      <label>Task D</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>
        `.trim();

        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle sequence with escape stopping subsequent tasks');
        
        // Should have: [A, B] (path1 with escape stops before D) and [A, C, D] (path2)
        const traceAB = cpeeTraces.find(t => 
            t.path.length === 2 && 
            t.path[0].alt_id === 't1' && 
            t.path[1].alt_id === 't2'
        );
        const traceACD = cpeeTraces.find(t => 
            t.path.length === 3 && 
            t.path[0].alt_id === 't1' && 
            t.path[1].alt_id === 't3' && 
            t.path[2].alt_id === 't4'
        );
        
        assert.ok(traceAB, 'Should have trace [A, B] (escape stops before D)');
        assert.ok(traceACD, 'Should have trace [A, C, D]');
        
        // Should not have [A, B, D]
        const traceABD = cpeeTraces.find(t => 
            t.path.length === 3 && 
            t.path[0].alt_id === 't1' && 
            t.path[1].alt_id === 't2' && 
            t.path[2].alt_id === 't4'
        );
        assert.ok(!traceABD, 'Should not have trace [A, B, D] (escape prevents D)');
    });

    // ============================================================================
    // Edge Case 25: Choose after loop producing empty and non-empty paths
    // ============================================================================
    test('Edge Case 25: Choose after loop producing empty and non-empty paths', () => {
        const mermaid = `
graph LR
se:startevent:((start)) --> t1:task:(Task A)
t1:task:(Task A) --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> |loop| t1:task:(Task A)
gw1:exclusivegateway:{x} --> gw2:exclusivegateway:{x}
gw2:exclusivegateway:{x} --> |path1| t2:task:(Task B)
gw2:exclusivegateway:{x} --> |path2| t3:task:(Task C)
t2:task:(Task B) --> ee:endevent:((end))
t3:task:(Task C) --> ee:endevent:((end))
        `.trim();

        const cpee = `
<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="loop" a:alt_id="loop1" language="text/javascript">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Task A</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
  <choose mode="exclusive" a:alt_id="gw1">
    <alternative condition="path1" language="text/javascript">
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Task B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="path2" language="text/javascript">
      <call id="t3" endpoint="" a:alt_id="t3">
        <parameters>
          <label>Task C</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>
        `.trim();

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(cpeeTraces.length > 0, 'CPEE should handle choose after loop producing empty and non-empty paths');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Edge Case 25');
    });
});

