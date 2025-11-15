/**
 * Trace Calculation Instance Cases Test Suite
 * Tests real-world instance cases for both Mermaid and CPEE trace calculation
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
 * 1. Both calculate at least some traces
 * 2. For each Mermaid trace, there's a corresponding CPEE trace where all alt_ids are present
 * Note: With GTA implementation, exact trace counts may differ due to different loop detection mechanisms
 * @param {Array} mermaidTraces - Traces calculated from Mermaid
 * @param {Array} cpeeTraces - Traces calculated from CPEE
 * @param {string} testName - Name of the test for error messages
 * @param {boolean} requireExactMatch - If true, require exact same number of traces (default: false)
 */
function assertTracesMatch(mermaidTraces, cpeeTraces, testName, requireExactMatch = false) {
    // Both should calculate at least some traces
    assert.ok(
        mermaidTraces.length > 0,
        `${testName}: Mermaid should calculate at least one trace. Got: ${mermaidTraces.length}`
    );
    assert.ok(
        cpeeTraces.length > 0,
        `${testName}: CPEE should calculate at least one trace. Got: ${cpeeTraces.length}`
    );

    // If exact match required, check same number of traces
    if (requireExactMatch) {
        assert.strictEqual(
            mermaidTraces.length,
            cpeeTraces.length,
            `${testName}: Mermaid and CPEE should calculate the same number of traces. Mermaid: ${mermaidTraces.length}, CPEE: ${cpeeTraces.length}`
        );
    }

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

describe('Trace Calculation Instance Cases', () => {

    // ============================================================================
    // Instance Case: 1069-Step1
    // ============================================================================
    test('Instance Case: 1069-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Lab Material)
1:task:(Receive Lab Material) --> 2:task:(Check Sample)
2:task:(Check Sample) --> 3:exclusivegateway:{x}
3:exclusivegateway:{x} --> |Sample is unsuitable| 4:exclusivegateway:{x}
3:exclusivegateway:{x} --> |Sample is suitable| 5:task:(Perform Examination)
4:exclusivegateway:{x} --> 2:task:(Check Sample)
5:task:(Perform Examination) --> 6:task:(Create Report)
6:task:(Create Report) --> 7:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Lab Material</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <loop mode="pre_test" condition="true">
    <call id="a3" endpoint="" a:alt_id="2">
      <parameters>
        <label>Check Sample</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <loop mode="pre_test" condition="Sample is unsuitable" a:alt_id="3" language="text/javascript">
      <call id="a3" endpoint="" a:alt_id="2">
        <parameters>
          <label>Check Sample</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </loop>
    <call id="a9" endpoint="" a:alt_id="5">
      <parameters>
        <label>Perform Examination</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a13" endpoint="" a:alt_id="6">
      <parameters>
        <label>Create Report</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1069-Step1');
    });

    // ============================================================================
    // Instance Case: 1132-Step1
    // ============================================================================
    test('Instance Case: 1132-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Patient Arrives)
1:task:(Patient Arrives) --> 2:task:(Check for Cavities)
2:task:(Check for Cavities) --> 3:exclusivegateway:{x}
3:exclusivegateway:{x} --> |Cavity Found| 4:task:(Prepare Tooth)
3:exclusivegateway:{x} --> |No Cavity Found| 10:task:(Inform Patient)
4:task:(Prepare Tooth) --> 5:task:(Place Filling)
5:task:(Place Filling) --> 6:task:(Polish Filling)
6:task:(Polish Filling) --> 7:exclusivegateway:{x}
7:exclusivegateway:{x} --> |Filling Acceptable| 8:task:(Check Bite)
7:exclusivegateway:{x} --> |Filling Needs Adjustment| 4:task:(Prepare Tooth)
8:task:(Check Bite) --> 9:exclusivegateway:{x}
9:exclusivegateway:{x} --> |Bite Acceptable| 10:task:(Inform Patient)
9:exclusivegateway:{x} --> |Bite Needs Adjustment| 6:task:(Polish Filling)
10:task:(Inform Patient) --> 11:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Patient Arrives</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Check for Cavities</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="3">
    <alternative condition="Cavity Found" language="text/javascript">
      <loop mode="pre_test" condition="true">
        <call id="a7" endpoint="" a:alt_id="4">
          <parameters>
            <label>Prepare Tooth</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
        <call id="a11" endpoint="" a:alt_id="5">
          <parameters>
            <label>Place Filling</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
        <call id="a13" endpoint="" a:alt_id="6">
          <parameters>
            <label>Polish Filling</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
        <loop mode="pre_test" condition="Filling Needs Adjustment">
          <choose mode="exclusive" a:alt_id="7">
            <alternative condition="Filling Needs Adjustment" language="text/javascript">
              <call id="a7" endpoint="" a:alt_id="4">
                <parameters>
                  <label>Prepare Tooth</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
              <call id="a11" endpoint="" a:alt_id="5">
                <parameters>
                  <label>Place Filling</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
              <call id="a13" endpoint="" a:alt_id="6">
                <parameters>
                  <label>Polish Filling</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
            </alternative>
            <alternative condition="Filling Acceptable" language="text/javascript">
              <call id="a17" endpoint="" a:alt_id="8">
                <parameters>
                  <label>Check Bite</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
              <choose mode="exclusive" a:alt_id="9">
                <alternative condition="Bite Needs Adjustment" language="text/javascript">
                  <call id="a13" endpoint="" a:alt_id="6">
                    <parameters>
                      <label>Polish Filling</label>
                      <method/>
                      <type>:task</type>
                      <arguments/>
                    </parameters>
                  </call>
                </alternative>
                <alternative condition="Bite Acceptable" language="text/javascript">
                  <call id="a9" endpoint="" a:alt_id="10">
                    <parameters>
                      <label>Inform Patient</label>
                      <method/>
                      <type>:task</type>
                      <arguments/>
                    </parameters>
                  </call>
                  <escape a:alt_id="-1"/>
                </alternative>
              </choose>
            </alternative>
          </choose>
        </loop>
      </loop>
    </alternative>
    <alternative condition="No Cavity Found" language="text/javascript"/>
  </choose>
  <call id="a9" endpoint="" a:alt_id="10">
    <parameters>
      <label>Inform Patient</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1132-Step1');
    });

    // ============================================================================
    // Instance Case: 1258-Step2-Output
    // ============================================================================
    test('Instance Case: 1258-Step2-Output', () => {
        const mermaid = `flowchart LR
se:startevent:((startevent))-->a1:task:(Brainstorm Ideas)
a1:task:(Brainstorm Ideas)-->a3:task:(Develop Characters)
a3:task:(Develop Characters)-->a5:task:(Outline the Plot)
a5:task:(Outline the Plot)-->a7:task:(Write First Draft)
a7:task:(Write First Draft)-->gw1s:exclusivegateway:{x}
gw1s:exclusivegateway:{x}-->|"true"|a9:task:(Revise and Edit)
a9:task:(Revise and Edit)-->a11:task:(Get Feedback)
a11:task:(Get Feedback)-->gw2s:exclusivegateway:{x}
gw2s:exclusivegateway:{x}-->a15:task:(Finalize Manuscript)
a15:task:(Finalize Manuscript)-->ee:endevent:(((endevent)))
gw2s:exclusivegateway:{x}-->|"Not Satisfied"|a9:task:(Revise and Edit)
gw1s:exclusivegateway:{x}-->|"false"|ee:endevent:(((endevent)))
gw2s:exclusivegateway:{x}-->|"Satisfied"|ee:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="a1">
    <parameters>
      <label>Brainstorm Ideas</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="a3">
    <parameters>
      <label>Develop Characters</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a5" endpoint="" a:alt_id="a5">
    <parameters>
      <label>Outline the Plot</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a7" endpoint="" a:alt_id="a7">
    <parameters>
      <label>Write First Draft</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="gw1s">
    <alternative condition="true" language="text/javascript">
      <loop mode="pre_test" condition="true">
        <call id="a11" endpoint="" a:alt_id="a9">
          <parameters>
            <label>Revise and Edit</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
        <call id="a13" endpoint="" a:alt_id="a11">
          <parameters>
            <label>Get Feedback</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
        <loop mode="pre_test" condition="Not Satisfied">
          <choose mode="exclusive" a:alt_id="gw2s">
            <alternative condition="Not Satisfied" language="text/javascript">
              <call id="a11" endpoint="" a:alt_id="a9">
                <parameters>
                  <label>Revise and Edit</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
              <call id="a13" endpoint="" a:alt_id="a11">
                <parameters>
                  <label>Get Feedback</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
            </alternative>
            <alternative condition="">
              <escape a:alt_id="-1"/>
            </alternative>
            <alternative condition="">
              <call id="a17" endpoint="" a:alt_id="a15">
                <parameters>
                  <label>Finalize Manuscript</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
            </alternative>
            <alternative condition="Satisfied" language="text/javascript"/>
          </choose>
        </loop>
      </loop>
    </alternative>
    <alternative condition="false" language="text/javascript"/>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1258-Step2-Output');
    });

    // ============================================================================
    // Instance Case: 1314-Step1-Output
    // ============================================================================
    test('Instance Case: 1314-Step1-Output', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Customer Order)
1:task:(Receive Customer Order) --> 2:task:(Define Chainsaw Properties)
2:task:(Define Chainsaw Properties) --> 3:parallelgateway:{AND}
3:parallelgateway:{AND} --> 4:task:(Order Parts from Source A)
3:parallelgateway:{AND} --> 5:task:(Order Parts from Source B)
4:task:(Order Parts from Source A) --> 6:task:(Receive Parts A)
5:task:(Order Parts from Source B) --> 7:task:(Receive Parts B)
6:task:(Receive Parts A) --> 8:parallelgateway:{AND}
7:task:(Receive Parts B) --> 8:parallelgateway:{AND}
8:parallelgateway:{AND} --> 9:task:(Inspect Parts)
9:task:(Inspect Parts) --> 10:task:(Assemble Chainsaw)
10:task:(Assemble Chainsaw) --> 11:task:(Send Updates to Customer)
11:task:(Send Updates to Customer) --> 12:task:(Produce First Chainsaw)
12:task:(Produce First Chainsaw) --> 13:task:(Send First Chainsaw to Customer)
13:task:(Send First Chainsaw to Customer) --> 14:exclusivegateway:{x}
14:exclusivegateway:{x} --> |Customer Likes It| 15:task:(Produce Remaining Chainsaws)
14:exclusivegateway:{x} --> |Customer Doesn't Like It| 16:endevent:(((endevent)))
15:task:(Produce Remaining Chainsaws) --> 17:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Customer Order</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Define Chainsaw Properties</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Order Parts from Source A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a11" endpoint="" a:alt_id="6">
        <parameters>
          <label>Receive Parts A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Order Parts from Source B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a13" endpoint="" a:alt_id="7">
        <parameters>
          <label>Receive Parts B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="a19" endpoint="" a:alt_id="9">
    <parameters>
      <label>Inspect Parts</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a21" endpoint="" a:alt_id="10">
    <parameters>
      <label>Assemble Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a23" endpoint="" a:alt_id="11">
    <parameters>
      <label>Send Updates to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a25" endpoint="" a:alt_id="12">
    <parameters>
      <label>Produce First Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a27" endpoint="" a:alt_id="13">
    <parameters>
      <label>Send First Chainsaw to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="14">
    <alternative condition="Customer Likes It" language="text/javascript">
      <call id="a31" endpoint="" a:alt_id="15">
        <parameters>
          <label>Produce Remaining Chainsaws</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Customer Doesn't Like It" language="text/javascript"/>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1314-Step1-Output');
    });

    // ============================================================================
    // Instance Case: 1317-Step1
    // ============================================================================
    test('Instance Case: 1317-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Customer Order)
1:task:(Receive Customer Order) --> 2:task:(Define Chainsaw Properties)
2:task:(Define Chainsaw Properties) --> 3:parallelgateway:{AND}
3:parallelgateway:{AND} --> 4:task:(Order Guide Bar)
3:parallelgateway:{AND} --> 5:task:(Order Chain)
3:parallelgateway:{AND} --> 6:task:(Order Motor/Electric Components)
4:task:(Order Guide Bar) --> 7:parallelgateway:{AND}
5:task:(Order Chain) --> 7:parallelgateway:{AND}
6:task:(Order Motor/Electric Components) --> 7:parallelgateway:{AND}
7:parallelgateway:{AND} --> 8:task:(Inspect Parts)
8:task:(Inspect Parts) --> 9:task:(Assemble Chainsaw)
9:task:(Assemble Chainsaw) --> 10:task:(Send Updates to Customer)
10:task:(Send Updates to Customer) --> 11:task:(Produce First Chainsaw)
11:task:(Produce First Chainsaw) --> 12:task:(Send First Chainsaw to Customer)
12:task:(Send First Chainsaw to Customer) --> 13:exclusivegateway:{x}
13:exclusivegateway:{x} --> |Customer Likes It| 14:task:(Produce Remaining Chainsaws)
13:exclusivegateway:{x} --> |Customer Doesn't Like It| 15:task:(Adjust and Re-produce)
14:task:(Produce Remaining Chainsaws) --> 16:endevent:(((endevent)))
15:task:(Adjust and Re-produce) --> 16:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Customer Order</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Define Chainsaw Properties</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Order Guide Bar</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Order Chain</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a11" endpoint="" a:alt_id="6">
        <parameters>
          <label>Order Motor/Electric Components</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="a19" endpoint="" a:alt_id="8">
    <parameters>
      <label>Inspect Parts</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a21" endpoint="" a:alt_id="9">
    <parameters>
      <label>Assemble Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a23" endpoint="" a:alt_id="10">
    <parameters>
      <label>Send Updates to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a25" endpoint="" a:alt_id="11">
    <parameters>
      <label>Produce First Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a27" endpoint="" a:alt_id="12">
    <parameters>
      <label>Send First Chainsaw to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="13">
    <alternative condition="Customer Likes It" language="text/javascript">
      <call id="a31" endpoint="" a:alt_id="14">
        <parameters>
          <label>Produce Remaining Chainsaws</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Customer Doesn't Like It" language="text/javascript">
      <call id="a33" endpoint="" a:alt_id="15">
        <parameters>
          <label>Adjust and Re-produce</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1317-Step1');
    });

    // ============================================================================
    // Instance Case: 1388-Step2-Input
    // ============================================================================
    test('Instance Case: 1388-Step2-Input', () => {
        const mermaid = `flowchart LR
se:startevent:((startevent))-->a1:task:(Receive Customer Order)
a1:task:(Receive Customer Order)-->a3:task:(Define Chainsaw Properties)
a3:task:(Define Chainsaw Properties)-->gw1s:parallelgateway:{AND}
gw1s:parallelgateway:{AND}-->a7:task:(Order Parts from Source A)
a7:task:(Order Parts from Source A)-->gw1e:parallelgateway:{AND}
gw1s:parallelgateway:{AND}-->a9:task:(Order Parts from Source B)
a9:task:(Order Parts from Source B)-->gw1e:parallelgateway:{AND}
gw1e:parallelgateway:{AND}-->a15:task:(Inspect Parts)
a15:task:(Inspect Parts)-->a17:task:(Assemble Chainsaw)
a17:task:(Assemble Chainsaw)-->a19:task:(Send Updates to Customer)
a19:task:(Send Updates to Customer)-->a21:task:(Produce First Chainsaw)
a21:task:(Produce First Chainsaw)-->a23:task:(Send First Chainsaw to Customer)
a23:task:(Send First Chainsaw to Customer)-->gw2s:exclusivegateway:{x}
gw2s:exclusivegateway:{x}-->|"Customer Likes It"|a27:task:(Produce Remaining Chainsaws)
a27:task:(Produce Remaining Chainsaws)-->gw2e:exclusivegateway:{x}
gw2s:exclusivegateway:{x}-->|"Customer Doesn't Like It"|gw2e:exclusivegateway:{x}
gw2e:exclusivegateway:{x}-->ee:endevent:((endevent))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Customer Order</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Define Chainsaw Properties</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Order Parts from Source A</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Order Parts from Source B</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="a15" endpoint="" a:alt_id="7">
    <parameters>
      <label>Inspect Parts</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a17" endpoint="" a:alt_id="8">
    <parameters>
      <label>Assemble Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a19" endpoint="" a:alt_id="9">
    <parameters>
      <label>Send Updates to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a21" endpoint="" a:alt_id="10">
    <parameters>
      <label>Produce First Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a23" endpoint="" a:alt_id="11">
    <parameters>
      <label>Send First Chainsaw to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="12">
    <alternative condition="Customer Likes It" language="text/javascript">
      <call id="a27" endpoint="" a:alt_id="13">
        <parameters>
          <label>Produce Remaining Chainsaws</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Customer Doesn't Like It" language="text/javascript"/>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1388-Step2-Input');
    });

    // ============================================================================
    // Instance Case: 1393-Step1-Output
    // ============================================================================
    test('Instance Case: 1393-Step1-Output', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Order Details)
1:task:(Receive Order Details) --> 2:task:(Order Parts Online)
2:task:(Order Parts Online) --> 3:parallelgateway:{AND}
3:parallelgateway:{AND} --> 4:task:(Order Guide Bar)
3:parallelgateway:{AND} --> 5:task:(Order Chain)
3:parallelgateway:{AND} --> 6:task:(Order Motor/Electric Components)
4:task:(Order Guide Bar) --> 7:task:(Receive Guide Bar)
5:task:(Order Chain) --> 8:task:(Receive Chain)
6:task:(Order Motor/Electric Components) --> 9:task:(Receive Motor/Electric Components)
7:task:(Receive Guide Bar) --> 10:parallelgateway:{AND}
8:task:(Receive Chain) --> 10:parallelgateway:{AND}
9:task:(Receive Motor/Electric Components) --> 10:parallelgateway:{AND}
10:parallelgateway:{AND} --> 11:task:(Inspect Parts)
11:task:(Inspect Parts) --> 12:task:(Assemble Chainsaw)
12:task:(Assemble Chainsaw) --> 13:task:(Send Updates to Customer)
13:task:(Send Updates to Customer) --> 14:task:(Produce First Chainsaw)
14:task:(Produce First Chainsaw) --> 15:task:(Send First Chainsaw to Customer)
15:task:(Send First Chainsaw to Customer) --> 16:exclusivegateway:{x}
16:exclusivegateway:{x} --> |Customer Likes It| 17:task:(Produce Remaining Chainsaws)
16:exclusivegateway:{x} --> |Customer Doesn't Like It| 18:endevent:(((endevent)))
17:task:(Produce Remaining Chainsaws) --> 18:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Order Details</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Order Parts Online</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Order Guide Bar</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a13" endpoint="" a:alt_id="7">
        <parameters>
          <label>Receive Guide Bar</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Order Chain</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a15" endpoint="" a:alt_id="8">
        <parameters>
          <label>Receive Chain</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a11" endpoint="" a:alt_id="6">
        <parameters>
          <label>Order Motor/Electric Components</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a17" endpoint="" a:alt_id="9">
        <parameters>
          <label>Receive Motor/Electric Components</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="a25" endpoint="" a:alt_id="11">
    <parameters>
      <label>Inspect Parts</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a27" endpoint="" a:alt_id="12">
    <parameters>
      <label>Assemble Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a29" endpoint="" a:alt_id="13">
    <parameters>
      <label>Send Updates to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a31" endpoint="" a:alt_id="14">
    <parameters>
      <label>Produce First Chainsaw</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a33" endpoint="" a:alt_id="15">
    <parameters>
      <label>Send First Chainsaw to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="16">
    <alternative condition="Customer Likes It" language="text/javascript">
      <call id="a37" endpoint="" a:alt_id="17">
        <parameters>
          <label>Produce Remaining Chainsaws</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Customer Doesn't Like It" language="text/javascript"/>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1393-Step1-Output');
    });

    // ============================================================================
    // Instance Case: 1527-Step2-Input
    // ============================================================================
    test('Instance Case: 1527-Step2-Input', () => {
        const mermaid = `flowchart LR
se:startevent:((startevent))-->a1:task:(Receive Order)
a1:task:(Receive Order)-->gw1s:exclusivegateway:{x}
gw1s:exclusivegateway:{x}-->|"Order Amount > $100"|a5:task:(Approve Order)
a5:task:(Approve Order)-->a9:task:(Process Order)
a9:task:(Process Order)-->gw1e:exclusivegateway:{x}
gw1s:exclusivegateway:{x}-->|"Order Amount <= $100"|a7:task:(Process Order)
a7:task:(Process Order)-->gw1e:exclusivegateway:{x}
gw1e:exclusivegateway:{x}-->gw2s:exclusivegateway:{x}
gw2s:exclusivegateway:{x}-->|"Payment Received"|a15:task:(Ship Order)
a15:task:(Ship Order)-->gw2e:exclusivegateway:{x}
gw2s:exclusivegateway:{x}-->|"Payment Not Received"|a17:task:(Cancel Order)
a17:task:(Cancel Order)-->gw2e:exclusivegateway:{x}
gw2e:exclusivegateway:{x}-->ee:endevent:((endevent))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Order</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="2">
    <alternative condition="Order Amount &gt; $100" language="text/javascript">
      <call id="a5" endpoint="" a:alt_id="3">
        <parameters>
          <label>Approve Order</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Process Order</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Order Amount &lt;= $100" language="text/javascript">
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Process Order</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
  <choose mode="exclusive" a:alt_id="6">
    <alternative condition="Payment Received" language="text/javascript">
      <call id="a15" endpoint="" a:alt_id="7">
        <parameters>
          <label>Ship Order</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Payment Not Received" language="text/javascript">
      <call id="a17" endpoint="" a:alt_id="8">
        <parameters>
          <label>Cancel Order</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1527-Step2-Input');
    });
    
    // ============================================================================
    // Instance Case: 1528-Step1
    // ============================================================================
    test('Instance Case: 1528-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Properties)
1:task:(Receive Properties) --> 2:exclusivegateway:{x}
2:exclusivegateway:{x} --> |More than 5| 3:parallelgateway:{AND}
2:exclusivegateway:{x} --> |Less than 5| 1:task:(Receive Properties)
3:parallelgateway:{AND} --> 4:task:(Order Part 1 Online)
3:parallelgateway:{AND} --> 5:task:(Order Part 2 Online)
4:task:(Order Part 1 Online) --> 6:parallelgateway:{AND}
5:task:(Order Part 2 Online) --> 6:parallelgateway:{AND}
6:parallelgateway:{AND} --> 7:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="true">
    <call id="a1" endpoint="" a:alt_id="1">
      <parameters>
        <label>Receive Properties</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <loop mode="pre_test" condition="Less than 5" a:alt_id="2" language="text/javascript">
      <call id="a1" endpoint="" a:alt_id="1">
        <parameters>
          <label>Receive Properties</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </loop>
    <parallel wait="-1" cancel="last" a:alt_id="3">
      <parallel_branch>
        <call id="a9" endpoint="" a:alt_id="4">
          <parameters>
            <label>Order Part 1 Online</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </parallel_branch>
      <parallel_branch>
        <call id="a11" endpoint="" a:alt_id="5">
          <parameters>
            <label>Order Part 2 Online</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </parallel_branch>
    </parallel>
  </loop>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        // Instance case with nested loops and parallel gateways
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1528-Step1');
    });

    // ============================================================================
    // Instance Case: 1523-Step3-Output
    // ============================================================================
    test('Instance Case: 1523-Step3-Output', () => {
        const mermaid = `graph LR
0:startevent:((Start Event))
1:task:(Prepare Patient List)
2:task:(Review Patient History)
3:parallelgateway:{AND}
4:task:(Conduct Patient Examination)
5:task:(Update Medical Records)
6:parallelgateway:{AND}
7:exclusivegateway:{x}
8:task:(Prescribe Medication)
9:task:(Schedule Follow-up)
10:task:(Discharge Patient)
11:endevent:(((End Event)))
0:startevent:((Start Event)) --> 1:task:(Prepare Patient List)
1:task:(Prepare Patient List) --> 2:task:(Review Patient History)
2:task:(Review Patient History) --> 3:parallelgateway:{AND}
3:parallelgateway:{AND} --> 4:task:(Conduct Patient Examination)
3:parallelgateway:{AND} --> 5:task:(Update Medical Records)
4:task:(Conduct Patient Examination) --> 6:parallelgateway:{AND}
5:task:(Update Medical Records) --> 6:parallelgateway:{AND}
6:parallelgateway:{AND} --> 7:exclusivegateway:{x}
7:exclusivegateway:{x} --> |Medication Needed| 8:task:(Prescribe Medication)
7:exclusivegateway:{x} --> |Follow-up Required| 9:task:(Schedule Follow-up)
7:exclusivegateway:{x} --> |Ready for Discharge| 10:task:(Discharge Patient)
8:task:(Prescribe Medication) --> 11:endevent:(((End Event)))
9:task:(Schedule Follow-up) --> 11:endevent:(((End Event)))
10:task:(Discharge Patient) --> 11:endevent:(((End Event)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Prepare Patient List</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Review Patient History</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Conduct Patient Examination</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Update Medical Records</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <choose mode="exclusive" a:alt_id="7">
    <alternative condition="Medication Needed" language="text/javascript">
      <call id="a17" endpoint="" a:alt_id="8">
        <parameters>
          <label>Prescribe Medication</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Follow-up Required" language="text/javascript">
      <call id="a19" endpoint="" a:alt_id="9">
        <parameters>
          <label>Schedule Follow-up</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="Ready for Discharge" language="text/javascript">
      <call id="a21" endpoint="" a:alt_id="10">
        <parameters>
          <label>Discharge Patient</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1523-Step3-Output');
    });

    // ============================================================================
    // Instance Case: 1510-Step1
    // ============================================================================
    test('Instance Case: 1510-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Define Chess Goals)
1:task:(Define Chess Goals) --> 2:task:(Study Chess Principles)
2:task:(Study Chess Principles) --> 3:task:(Practice Regularly)
3:task:(Practice Regularly) --> 4:exclusivegateway:{x}
4:exclusivegateway:{x} --> |Yes| 5:task:(Analyze Games)
5:task:(Analyze Games) --> 6:task:(Learn from Mistakes)
6:task:(Learn from Mistakes) --> 7:exclusivegateway:{O}
4:exclusivegateway:{x} --> |No| 7:exclusivegateway:{O}
7:exclusivegateway:{O} --> 8:task:(Play More Games)
8:task:(Play More Games) --> 9:task:(Review Openings)
9:task:(Review Openings) --> 10:task:(Study Endgames)
10:task:(Study Endgames) --> 11:task:(Solve Puzzles)
11:task:(Solve Puzzles) --> 12:task:(Track Progress)
12:task:(Track Progress) --> 13:exclusivegateway:{x}
13:exclusivegateway:{x} --> |Satisfied| 14:endevent:(((endevent)))
13:exclusivegateway:{x} --> |Not Satisfied| 1:task:(Define Chess Goals)`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <loop mode="pre_test" condition="true">
    <call id="a1" endpoint="" a:alt_id="1">
      <parameters>
        <label>Define Chess Goals</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a3" endpoint="" a:alt_id="2">
      <parameters>
        <label>Study Chess Principles</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a5" endpoint="" a:alt_id="3">
      <parameters>
        <label>Practice Regularly</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <choose mode="exclusive" a:alt_id="4">
      <alternative condition="Yes" language="text/javascript">
        <call id="a9" endpoint="" a:alt_id="5">
          <parameters>
            <label>Analyze Games</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
        <call id="a11" endpoint="" a:alt_id="6">
          <parameters>
            <label>Learn from Mistakes</label>
            <method/>
            <type>:task</type>
            <arguments/>
          </parameters>
        </call>
      </alternative>
      <alternative condition="No" language="text/javascript"/>
    </choose>
    <call id="a17" endpoint="" a:alt_id="8">
      <parameters>
        <label>Play More Games</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a19" endpoint="" a:alt_id="9">
      <parameters>
        <label>Review Openings</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a21" endpoint="" a:alt_id="10">
      <parameters>
        <label>Study Endgames</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a23" endpoint="" a:alt_id="11">
      <parameters>
        <label>Solve Puzzles</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a25" endpoint="" a:alt_id="12">
      <parameters>
        <label>Track Progress</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <loop mode="pre_test" condition="true" a:alt_id="13" language="text/javascript">
      <call id="a1" endpoint="" a:alt_id="1">
        <parameters>
          <label>Define Chess Goals</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a3" endpoint="" a:alt_id="2">
        <parameters>
          <label>Study Chess Principles</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a5" endpoint="" a:alt_id="3">
        <parameters>
          <label>Practice Regularly</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <choose mode="exclusive" a:alt_id="4">
        <alternative condition="Yes" language="text/javascript">
          <call id="a9" endpoint="" a:alt_id="5">
            <parameters>
              <label>Analyze Games</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
          <call id="a11" endpoint="" a:alt_id="6">
            <parameters>
              <label>Learn from Mistakes</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </alternative>
        <alternative condition="No" language="text/javascript"/>
      </choose>
      <call id="a17" endpoint="" a:alt_id="8">
        <parameters>
          <label>Play More Games</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a19" endpoint="" a:alt_id="9">
        <parameters>
          <label>Review Openings</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a21" endpoint="" a:alt_id="10">
        <parameters>
          <label>Study Endgames</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a23" endpoint="" a:alt_id="11">
        <parameters>
          <label>Solve Puzzles</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a25" endpoint="" a:alt_id="12">
        <parameters>
          <label>Track Progress</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </loop>
  </loop>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1510-Step1');
    });

    // ============================================================================
    // Instance Case: 1606-Step1-Output
    // ============================================================================
    test('Instance Case: 1606-Step1-Output', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Specifications)
1:task:(Receive Specifications) --> 2:task:(Send Requirements to Teams)
2:task:(Send Requirements to Teams) --> 3:parallelgateway:{AND}
3:parallelgateway:{AND} --> 4:task:(Manufacture Parts)
3:parallelgateway:{AND} --> 5:task:(Manufacture Parts)
3:parallelgateway:{AND} --> 6:task:(Manufacture Parts)
4:task:(Manufacture Parts) --> 7:parallelgateway:{AND}
5:task:(Manufacture Parts) --> 7:parallelgateway:{AND}
6:task:(Manufacture Parts) --> 7:parallelgateway:{AND}
7:parallelgateway:{AND} --> 8:task:(Assemble Interior)
8:task:(Assemble Interior) --> 9:task:(Test Flight)
9:task:(Test Flight) --> 10:task:(Create Test Protocol)
10:task:(Create Test Protocol) --> 11:task:(Send Protocol to Customer)
11:task:(Send Protocol to Customer) --> 12:exclusivegateway:{x}
12:exclusivegateway:{x} --> |Confirmed| 14:task:(Deliver Plane)
12:exclusivegateway:{x} --> |Not Confirmed| 13:task:(Rework)
13:task:(Rework) --> 9:task:(Test Flight)
14:task:(Deliver Plane) --> 15:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Specifications</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Send Requirements to Teams</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Manufacture Parts</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Manufacture Parts</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a11" endpoint="" a:alt_id="6">
        <parameters>
          <label>Manufacture Parts</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="a19" endpoint="" a:alt_id="8">
    <parameters>
      <label>Assemble Interior</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <loop mode="pre_test" condition="true">
    <call id="a21" endpoint="" a:alt_id="9">
      <parameters>
        <label>Test Flight</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a23" endpoint="" a:alt_id="10">
      <parameters>
        <label>Create Test Protocol</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <call id="a25" endpoint="" a:alt_id="11">
      <parameters>
        <label>Send Protocol to Customer</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
    <loop mode="pre_test" condition="Not Confirmed" a:alt_id="12" language="text/javascript">
      <call id="a31" endpoint="" a:alt_id="13">
        <parameters>
          <label>Rework</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a21" endpoint="" a:alt_id="9">
        <parameters>
          <label>Test Flight</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a23" endpoint="" a:alt_id="10">
        <parameters>
          <label>Create Test Protocol</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a25" endpoint="" a:alt_id="11">
        <parameters>
          <label>Send Protocol to Customer</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </loop>
    <call id="a29" endpoint="" a:alt_id="14">
      <parameters>
        <label>Deliver Plane</label>
        <method/>
        <type>:task</type>
        <arguments/>
      </parameters>
    </call>
  </loop>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 1606-Step1-Output');
    });

    // ============================================================================
    // Instance Case: 4807-Step1
    // ============================================================================
    test('Instance Case: 4807-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Submit Expense Claim)
1:task:(Submit Expense Claim) --> 2:task:(Travel Admin Approval)
2:task:(Travel Admin Approval) --> 3:exclusivegateway:{x}
3:exclusivegateway:{x} --> |Approved| 4:task:(Forward to Budget Owner)
3:exclusivegateway:{x} --> |Rejected| 17:endevent:(((endevent)))
4:task:(Forward to Budget Owner) --> 5:task:(Forward to Supervisor)
5:task:(Forward to Supervisor) --> 6:exclusivegateway:{x}
6:exclusivegateway:{x} --> |Budget Owner and Supervisor are same| 8:exclusivegateway:{x}
6:exclusivegateway:{x} --> |Budget Owner and Supervisor are different| 7:task:(Director Approval)
7:task:(Director Approval) --> 8:exclusivegateway:{x}
8:exclusivegateway:{x} --> |Director Approval Needed| 9:task:(Director Approval)
8:exclusivegateway:{x} --> |Director Approval Not Needed| 10:exclusivegateway:{O}
9:task:(Director Approval) --> 10:exclusivegateway:{O}
10:exclusivegateway:{O} --> 11:exclusivegateway:{x}
11:exclusivegateway:{x} --> |Domestic Trip| 12:task:(Reimbursement Claim)
11:exclusivegateway:{x} --> |International Trip| 13:task:(File Travel Permit)
13:task:(File Travel Permit) --> 14:task:(Supervisor Permission)
14:task:(Supervisor Permission) --> 15:exclusivegateway:{x}
15:exclusivegateway:{x} --> |Permission Granted| 16:task:(Reimbursement Claim)
15:exclusivegateway:{x} --> |Permission Denied| 17:endevent:(((endevent)))
12:task:(Reimbursement Claim) --> 18:exclusivegateway:{O}
16:task:(Reimbursement Claim) --> 18:exclusivegateway:{O}
18:exclusivegateway:{O} --> 17:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Submit Expense Claim</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Travel Admin Approval</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="3">
    <alternative condition="Approved" language="text/javascript">
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Forward to Budget Owner</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <call id="a11" endpoint="" a:alt_id="5">
        <parameters>
          <label>Forward to Supervisor</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
      <choose mode="exclusive" a:alt_id="6">
        <alternative condition="Budget Owner and Supervisor are same" language="text/javascript"/>
        <alternative condition="Budget Owner and Supervisor are different" language="text/javascript">
          <call id="a17" endpoint="" a:alt_id="7">
            <parameters>
              <label>Director Approval</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </alternative>
      </choose>
      <choose mode="exclusive" a:alt_id="8">
        <alternative condition="Director Approval Needed" language="text/javascript">
          <call id="a21" endpoint="" a:alt_id="9">
            <parameters>
              <label>Director Approval</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </alternative>
        <alternative condition="Director Approval Not Needed" language="text/javascript"/>
      </choose>
      <choose mode="exclusive" a:alt_id="11">
        <alternative condition="Domestic Trip" language="text/javascript">
          <call id="a29" endpoint="" a:alt_id="12">
            <parameters>
              <label>Reimbursement Claim</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
        </alternative>
        <alternative condition="International Trip" language="text/javascript">
          <call id="a31" endpoint="" a:alt_id="13">
            <parameters>
              <label>File Travel Permit</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
          <call id="a33" endpoint="" a:alt_id="14">
            <parameters>
              <label>Supervisor Permission</label>
              <method/>
              <type>:task</type>
              <arguments/>
            </parameters>
          </call>
          <choose mode="exclusive" a:alt_id="15">
            <alternative condition="Permission Granted" language="text/javascript">
              <call id="a37" endpoint="" a:alt_id="16">
                <parameters>
                  <label>Reimbursement Claim</label>
                  <method/>
                  <type>:task</type>
                  <arguments/>
                </parameters>
              </call>
            </alternative>
            <alternative condition="Permission Denied" language="text/javascript"/>
          </choose>
        </alternative>
      </choose>
    </alternative>
    <alternative condition="Rejected" language="text/javascript"/>
  </choose>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 4807-Step1');
    });

    // ============================================================================
    // Instance Case: 4906-Step1
    // ============================================================================
    test('Instance Case: 4906-Step1', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Design Base Model)
1:task:(Design Base Model) --> 2:task:(Manufacture Base Model)
2:task:(Manufacture Base Model) --> 3:exclusivegateway:{x}
3:exclusivegateway:{x} -->|Choose Interior| 4:task:(Customize Interior)
3:exclusivegateway:{x} -->|No Customization| 6:exclusivegateway:{x}
4:task:(Customize Interior) --> 5:exclusivegateway:{x}
5:exclusivegateway:{x} --> 7:task:(Final Assembly)
6:exclusivegateway:{x} --> 7:task:(Final Assembly)
7:task:(Final Assembly) --> 8:task:(Quality Check)
8:task:(Quality Check) --> 9:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Design Base Model</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Manufacture Base Model</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <choose mode="exclusive" a:alt_id="3">
    <alternative condition="Choose Interior" language="text/javascript">
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Customize Interior</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </alternative>
    <alternative condition="No Customization" language="text/javascript"/>
  </choose>
  <call id="a13" endpoint="" a:alt_id="7">
    <parameters>
      <label>Final Assembly</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a17" endpoint="" a:alt_id="8">
    <parameters>
      <label>Quality Check</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 4906-Step1');
    });

    // ============================================================================
    // Instance Case: 5044
    // ============================================================================
    test('Instance Case: 5044', () => {
        const mermaid = `graph LR
0:startevent:((startevent)) --> 1:task:(Receive Specifications)
1:task:(Receive Specifications) --> 2:task:(Send Requirements to Teams)
2:task:(Send Requirements to Teams) --> 3:parallelgateway:{AND}
3:parallelgateway:{AND} --> 4:task:(Manufacture Vodka Bar)
3:parallelgateway:{AND} --> 5:task:(Manufacture Whiskey Bar)
3:parallelgateway:{AND} --> 6:task:(Manufacture Seats)
3:parallelgateway:{AND} --> 7:task:(Manufacture Toilet System)
4:task:(Manufacture Vodka Bar) --> 8:parallelgateway:{AND}
5:task:(Manufacture Whiskey Bar) --> 8:parallelgateway:{AND}
6:task:(Manufacture Seats) --> 8:parallelgateway:{AND}
7:task:(Manufacture Toilet System) --> 8:parallelgateway:{AND}
8:parallelgateway:{AND} --> 9:task:(Assemble Interior)
9:task:(Assemble Interior) --> 10:task:(Test Flight)
10:task:(Test Flight) --> 11:task:(Create Test Protocol)
11:task:(Create Test Protocol) --> 12:task:(Send Protocol to Customer)
12:task:(Send Protocol to Customer) --> 13:task:(Customer Confirmation)
13:task:(Customer Confirmation) --> 14:task:(Deliver Airplane)
14:task:(Deliver Airplane) --> 15:endevent:(((endevent)))`;

        const cpee = `<description xmlns="http://cpee.org/ns/description/1.0" xmlns:a="http://cpee.org/ns/annotation/1.0">
  <call id="a1" endpoint="" a:alt_id="1">
    <parameters>
      <label>Receive Specifications</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a3" endpoint="" a:alt_id="2">
    <parameters>
      <label>Send Requirements to Teams</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <parallel wait="-1" cancel="last" a:alt_id="3">
    <parallel_branch>
      <call id="a7" endpoint="" a:alt_id="4">
        <parameters>
          <label>Manufacture Vodka Bar</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a9" endpoint="" a:alt_id="5">
        <parameters>
          <label>Manufacture Whiskey Bar</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a11" endpoint="" a:alt_id="6">
        <parameters>
          <label>Manufacture Seats</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
    <parallel_branch>
      <call id="a13" endpoint="" a:alt_id="7">
        <parameters>
          <label>Manufacture Toilet System</label>
          <method/>
          <type>:task</type>
          <arguments/>
        </parameters>
      </call>
    </parallel_branch>
  </parallel>
  <call id="a23" endpoint="" a:alt_id="9">
    <parameters>
      <label>Assemble Interior</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a25" endpoint="" a:alt_id="10">
    <parameters>
      <label>Test Flight</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a27" endpoint="" a:alt_id="11">
    <parameters>
      <label>Create Test Protocol</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a29" endpoint="" a:alt_id="12">
    <parameters>
      <label>Send Protocol to Customer</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a31" endpoint="" a:alt_id="13">
    <parameters>
      <label>Customer Confirmation</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
  <call id="a33" endpoint="" a:alt_id="14">
    <parameters>
      <label>Deliver Airplane</label>
      <method/>
      <type>:task</type>
      <arguments/>
    </parameters>
  </call>
</description>`;

        const mermaidTraces = MermaidTraceCalculator.calculateAllTraces(mermaid, { maxLoopIterations: 1 });
        const cpeeTraces = CPEETraceCalculator.calculateAllTraces(cpee, { maxLoopIterations: 1 });

        assert.ok(mermaidTraces.length > 0, 'Mermaid should calculate at least one trace');
        assert.ok(cpeeTraces.length > 0, 'CPEE should calculate at least one trace');
        assertTracesMatch(mermaidTraces, cpeeTraces, 'Instance Case: 5044');
    });
});

