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

describe('Trace Calculation Edge Cases', () => {
    
    // Edge Case 1: Self-looping task node
    test('Edge Case 1: Self-looping task node', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> t1:task:(Process)
t1:task:(Process) --> |retry| t1:task:(Process)
t1:task:(Process) --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
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
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 2 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 2 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assert.ok(mermaidTraces.some(trace => trace.type === 'loop'), 'Should contain a loop trace');
    });

    // Edge Case 2: Empty parallel gateway (no branches)
    test('Edge Case 2: Empty parallel gateway', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <parallel wait="-1" cancel="last" a:alt_id="pg">
  </parallel>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // Should handle gracefully - either empty traces or single trace with just start/end
        assert.ok(Array.isArray(mermaidTraces), 'Mermaid should return array');
        assert.ok(Array.isArray(cpeeTraces), 'CPEE should return array');
    });

    // Edge Case 3: Nested loops with escape conditions
    test('Edge Case 3: Nested loops with escape conditions', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> t1:task:(Outer Task)
t1:task:(Outer Task) --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> |loop| t1:task:(Outer Task)
gw1:exclusivegateway:{x} --> |continue| t2:task:(Inner Task)
t2:task:(Inner Task) --> gw2:exclusivegateway:{x}
gw2:exclusivegateway:{x} --> |loop| t2:task:(Inner Task)
gw2:exclusivegateway:{x} --> |exit| ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="true" a:alt_id="outer">
    <call id="t1" endpoint="" a:alt_id="t1">
      <parameters>
        <label>Outer Task</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <loop mode="pre_test" condition="continue" a:alt_id="inner" language="text/javascript">
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Inner Task</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </loop>
  </loop>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 2 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 2 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle nested loops');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle nested loops');
    });

    // Edge Case 4: Task with escaped quotes in label
    test('Edge Case 4: Task with escaped quotes in label', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> t1:task:("Task with \\"quotes\\"")
t1:task:("Task with \\"quotes\\"") --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task with "quotes"</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle escaped quotes');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle quotes in labels');
        assert.ok(mermaidTraces.some(trace => 
            trace.path.some(task => task.task === 'Task with "quotes"')
        ), 'Should preserve quotes in task label');
    });

    // Edge Case 5: Multiple start events (disconnected components)
    test('Edge Case 5: Multiple start events', () => {
        const mermaid = `graph LR
se1:startevent:((start1)) --> t1:task:(Task 1)
t1:task:(Task 1) --> ee1:endevent:((end1))
se2:startevent:((start2)) --> t2:task:(Task 2)
t2:task:(Task 2) --> ee2:endevent:((end2))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
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
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length >= 2, 'Mermaid should calculate traces for each start event');
        assert.ok(cpeeTraces.length >= 1, 'CPEE should calculate at least one trace');
    });

    // Edge Case 6: Complex parallel merge with different path lengths
    test('Edge Case 6: Complex parallel merge with different path lengths', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> pg1:parallelgateway:{AND}
pg1:parallelgateway:{AND} --> t1:task:(Quick Task)
pg1:parallelgateway:{AND} --> t2:task:(Task A)
t2:task:(Task A) --> t3:task:(Task B)
t1:task:(Quick Task) --> pg2:parallelgateway:{AND}
t3:task:(Task B) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
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
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle parallel paths with different lengths');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle parallel paths with different lengths');
    });

    // Edge Case 7: Exclusive gateway with all conditions false (dead end)
    test('Edge Case 7: Exclusive gateway with all conditions false', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> t1:task:(Task)
t1:task:(Task) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |"false"| t2:task:(Never Reached)
gw:exclusivegateway:{x} --> |"false"| t3:task:(Also Never)
gw:exclusivegateway:{x} --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
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
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        // Should still calculate traces, potentially including the default path
        assert.ok(Array.isArray(mermaidTraces), 'Mermaid should return array even with dead ends');
        assert.ok(Array.isArray(cpeeTraces), 'CPEE should return array even with dead ends');
    });

    // Edge Case 8: Task with parentheses in label (already quoted)
    test('Edge Case 8: Task with parentheses in label', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> t1:task:("Task (with parentheses)")
t1:task:("Task (with parentheses)") --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Task (with parentheses)</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle parentheses in quoted labels');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle parentheses in labels');
        assert.ok(mermaidTraces[0].path[0].task.includes('('), 'Should preserve parentheses in task label');
    });

    // Edge Case 9: Deeply nested structure (5+ levels)
    test('Edge Case 9: Deeply nested structure', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> t1:task:(Level 1)
t1:task:(Level 1) --> pg1:parallelgateway:{AND}
pg1:parallelgateway:{AND} --> t2:task:(Level 2)
t2:task:(Level 2) --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> t3:task:(Level 3)
t3:task:(Level 3) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> t4:task:(Level 4)
t4:task:(Level 4) --> t5:task:(Level 5)
t5:task:(Level 5) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> gw1:exclusivegateway:{x}
gw1:exclusivegateway:{x} --> pg1:parallelgateway:{AND}
pg1:parallelgateway:{AND} --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="t1" endpoint="" a:alt_id="t1">
    <parameters>
      <label>Level 1</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="pg1">
    <parallel_branch>
      <call id="t2" endpoint="" a:alt_id="t2">
        <parameters>
          <label>Level 2</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <choose mode="exclusive" a:alt_id="gw1">
        <alternative condition="true" language="text/javascript">
          <call id="t3" endpoint="" a:alt_id="t3">
            <parameters>
              <label>Level 3</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
          <parallel wait="-1" cancel="last" a:alt_id="pg2">
            <parallel_branch>
              <call id="t4" endpoint="" a:alt_id="t4">
                <parameters>
                  <label>Level 4</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
              <call id="t5" endpoint="" a:alt_id="t5">
                <parameters>
                  <label>Level 5</label>
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
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle deep nesting');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle deep nesting');
    });

    // Edge Case 10: Mixed gateway types in sequence
    test('Edge Case 10: Mixed gateway types in sequence', () => {
        const mermaid = `graph LR
se:startevent:((start)) --> pg:parallelgateway:{AND}
pg:parallelgateway:{AND} --> t1:task:(Task 1)
pg:parallelgateway:{AND} --> t2:task:(Task 2)
t1:task:(Task 1) --> gw:exclusivegateway:{x}
t2:task:(Task 2) --> gw:exclusivegateway:{x}
gw:exclusivegateway:{x} --> |"path1"| t3:task:(Path 1)
gw:exclusivegateway:{x} --> |"path2"| t4:task:(Path 2)
t3:task:(Path 1) --> pg2:parallelgateway:{AND}
t4:task:(Path 2) --> pg2:parallelgateway:{AND}
pg2:parallelgateway:{AND} --> ee:endevent:((end))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
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
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid);
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee);

        assert.ok(mermaidTraces.length > 0, 'Mermaid should handle mixed gateway types');
        assert.ok(cpeeTraces.length > 0, 'CPEE should handle mixed gateway types');
        // Should have multiple traces due to parallel and exclusive combinations
        assert.ok(mermaidTraces.length >= 2, 'Should generate multiple traces from mixed gateways');
    });
});

