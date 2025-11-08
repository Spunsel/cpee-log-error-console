# CPEE Trace Calculator - Edge Cases Documentation

This document comprehensively covers all possible edge cases for the `CPEETraceCalculator` when calculating execution traces from CPEE XML workflows.

## Table of Contents

1. [XML Parsing Edge Cases](#xml-parsing-edge-cases)
2. [Empty and Minimal Structures](#empty-and-minimal-structures)
3. [Loop Edge Cases](#loop-edge-cases)
4. [Parallel Gateway Edge Cases](#parallel-gateway-edge-cases)
5. [XOR Gateway (Choose/Alternative) Edge Cases](#xor-gateway-edge-cases)
6. [Escape Element Edge Cases](#escape-element-edge-cases)
7. [Nested Structure Edge Cases](#nested-structure-edge-cases)
8. [Task Extraction Edge Cases](#task-extraction-edge-cases)
9. [Condition Handling Edge Cases](#condition-handling-edge-cases)
10. [Trace Combination Edge Cases](#trace-combination-edge-cases)
11. [Duplicate Trace Filtering Edge Cases](#duplicate-trace-filtering-edge-cases)

---

## XML Parsing Edge Cases

### 1.1 Malformed XML
**Description:** XML with syntax errors, unclosed tags, or invalid structure.

**Edge Cases:**
- Unclosed tags: `<call id="1">` without closing tag
- Invalid nesting: `<call><description></call></description>`
- Missing root element
- Invalid XML characters in content
- XML with encoding issues

**Expected Behavior:**
- Parser should detect errors via `parsererror` element
- Return empty trace array `[]`
- Log warning to console

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    <!-- Missing closing tag -->
</description>
```

### 1.2 XML with Unescaped Characters
**Description:** XML containing unescaped `<`, `>`, `&` in attribute values.

**Edge Cases:**
- Comparison operators in condition attributes: `condition="x < 5"`
- HTML-like content in labels: `<label>Task <important></label>`
- Ampersands in text: `condition="x & y"`

**Expected Behavior:**
- `fixXMLIssues()` should escape characters properly
- `&lt;`, `&gt;`, `&amp;` should be converted
- Parsing should succeed after fixing

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <condition>value < 10</condition>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 1.3 Missing Description Element
**Description:** XML without a `<description>` root element.

**Edge Cases:**
- Empty XML string
- XML with only comments
- XML with root element other than `description`
- Multiple `description` elements

**Expected Behavior:**
- Should try to use `documentElement` as fallback
- If no valid root, return empty array `[]`
- Log warning to console

**Test Case:**
```xml
<workflow>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    </call>
</workflow>
```

### 1.4 Namespace Handling
**Description:** XML with namespaces, especially for `a:alt_id` attribute.

**Edge Cases:**
- `a:alt_id` without namespace declaration
- `alt_id` with explicit namespace: `xmlns:a="http://cpee.org/ns/annotation/1.0"`
- Multiple namespace declarations
- Default namespace declarations

**Expected Behavior:**
- Should handle both `a:alt_id` and namespaced `alt_id`
- Extract `alt_id` correctly regardless of namespace format
- Fallback to `null` if not found

**Test Case:**
```xml
<description xmlns:a="http://cpee.org/ns/annotation/1.0">
    <call id="1" a:alt_id="task1">
        <parameters><label>Task 1</label></parameters>
    </call>
</description>
```

---

## Empty and Minimal Structures

### 2.1 Empty Description
**Description:** Description element with no children.

**Edge Cases:**
- `<description></description>`
- `<description><!-- comment --></description>`
- Description with only whitespace

**Expected Behavior:**
- Should return array with single empty trace: `[[]]`
- After filtering, should return empty array `[]` (empty traces are filtered)

**Test Case:**
```xml
<description>
</description>
```

### 2.2 Empty Choose Element
**Description:** Choose element with no alternatives.

**Edge Cases:**
- `<choose></choose>`
- `<choose><!-- comment --></choose>`
- Choose with only condition elements (no alternatives)

**Expected Behavior:**
- Should return empty array `[]`
- No traces generated

**Test Case:**
```xml
<description>
    <choose>
    </choose>
</description>
```

### 2.3 Empty Alternative
**Description:** Alternative element with no children (except possibly conditions).

**Edge Cases:**
- `<alternative></alternative>`
- `<alternative><condition>true</condition></alternative>`
- Alternative with only whitespace/comments

**Expected Behavior:**
- Should return array with single empty trace: `[[]]`
- After filtering, should return empty array `[]`

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <condition>true</condition>
        </alternative>
    </choose>
</description>
```

### 2.4 Empty Parallel Element
**Description:** Parallel element with no parallel_branch children.

**Edge Cases:**
- `<parallel></parallel>`
- `<parallel><!-- comment --></parallel>`
- Parallel with only condition elements

**Expected Behavior:**
- Should return array with single empty trace: `[[]]`
- After filtering, should return empty array `[]`

**Test Case:**
```xml
<description>
    <parallel>
    </parallel>
</description>
```

### 2.5 Empty Parallel Branch
**Description:** Parallel branch with no children.

**Edge Cases:**
- `<parallel_branch></parallel_branch>`
- `<parallel_branch><condition>true</condition></parallel_branch>`
- Branch with only whitespace

**Expected Behavior:**
- Should return array with single empty trace: `[[]]`
- When interleaved with other branches, empty traces should be handled correctly

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </parallel_branch>
        <parallel_branch>
        </parallel_branch>
    </parallel>
</description>
```

### 2.6 Empty Loop
**Description:** Loop element with no body.

**Edge Cases:**
- `<loop></loop>`
- `<loop><condition>true</condition></loop>`
- Loop with only whitespace

**Expected Behavior:**
- Should generate traces for 0, 1, 2 iterations (if maxLoopIterations >= 2)
- 0 iterations: empty trace `[]`
- 1 iteration: empty trace `[]`
- 2 iterations: empty trace `[]`
- After filtering, all empty traces removed

**Test Case:**
```xml
<description>
    <loop>
        <condition>true</condition>
    </loop>
</description>
```

---

## Loop Edge Cases

### 3.1 Loop with 0 Iterations
**Description:** Loop that should be skipped (0 iterations).

**Edge Cases:**
- Loop as last element in description (directly connected to end)
- Loop as last element in alternative (before closing XOR)
- Loop with siblings (not last element)
- Loop nested inside another loop

**Expected Behavior:**
- 0 iterations allowed if loop has siblings OR is nested in another loop
- 0 iterations skipped if loop is directly connected to end or closing XOR
- Logic: `(!isLastElement || isInsideLoop) && !isBeforeClosingXor`

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    </call>
    <loop>
        <call id="2">
            <parameters><label>Task 2</label></parameters>
        </call>
    </loop>
    <!-- Loop has sibling, so 0 iterations allowed -->
</description>
```

### 3.2 Loop with Maximum Iterations
**Description:** Loop with maxLoopIterations limit.

**Edge Cases:**
- `maxLoopIterations = 0`: Only 0 iterations allowed
- `maxLoopIterations = 1`: 0 and 1 iterations allowed
- `maxLoopIterations = 2`: 0, 1, and 2 iterations allowed
- `maxLoopIterations > 2`: Still limited to 2 iterations (hardcoded limit)

**Expected Behavior:**
- Actual iterations generated: `min(maxLoopIterations, 2)`
- Always generates: 0 (if allowed), 1, and 2 (if maxIter >= 2)

**Test Case:**
```xml
<description>
    <loop>
        <call id="1">
            <parameters><label>Task 1</label></parameters>
        </call>
    </loop>
</description>
```

### 3.3 Nested Loops
**Description:** Loop inside another loop.

**Edge Cases:**
- Single level nesting: loop in loop
- Multiple levels: loop in loop in loop
- Nested loop with maxLoopIterations = 1
- Nested loop where inner loop is last element

**Expected Behavior:**
- Each loop independently generates 0, 1, 2 iterations
- Cartesian product of iterations: 3 × 3 = 9 traces (if both allow 0 iterations)
- Inner loop's `isInsideLoop` flag should be true, allowing 0 iterations

**Test Case:**
```xml
<description>
    <loop>
        <call id="1">
            <parameters><label>Task 1</label></parameters>
        </call>
        <loop>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </loop>
    </loop>
</description>
```

### 3.4 Loop with Parallel Inside
**Description:** Parallel gateway inside a loop.

**Edge Cases:**
- Loop containing parallel with 2 branches
- Loop containing parallel with 3+ branches
- Parallel branches with different lengths
- Parallel with nested structures

**Expected Behavior:**
- Loop iterations: 0, 1, 2
- Each iteration: all parallel branch permutations
- Result: Cartesian product of loop iterations × parallel permutations

**Test Case:**
```xml
<description>
    <loop>
        <parallel>
            <parallel_branch>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </parallel_branch>
            <parallel_branch>
                <call id="2">
                    <parameters><label>Task 2</label></parameters>
                </call>
            </parallel_branch>
        </parallel>
    </loop>
</description>
```

### 3.5 Loop with XOR Inside
**Description:** XOR gateway (choose) inside a loop.

**Edge Cases:**
- Loop containing choose with 2 alternatives
- Loop containing choose with 3+ alternatives
- Alternatives with different lengths
- Alternatives with escape elements

**Expected Behavior:**
- Loop iterations: 0, 1, 2
- Each iteration: union of all alternatives
- Result: Cartesian product of loop iterations × alternatives

**Test Case:**
```xml
<description>
    <loop>
        <choose>
            <alternative>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </alternative>
            <alternative>
                <call id="2">
                    <parameters><label>Task 2</label></parameters>
                </call>
            </alternative>
        </choose>
    </loop>
</description>
```

### 3.6 Loop as Last Element
**Description:** Loop that is the last element (directly connected to end).

**Edge Cases:**
- Loop as last element in description
- Loop as last element in alternative (before closing XOR)
- Loop with escape after it (should still be considered last)

**Expected Behavior:**
- 0 iterations should be skipped
- Only 1 and 2 iterations generated (if maxLoopIterations >= 1)

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    </call>
    <loop>
        <call id="2">
            <parameters><label>Task 2</label></parameters>
        </call>
    </loop>
    <!-- Loop is last, 0 iterations skipped -->
</description>
```

---

## Parallel Gateway Edge Cases

### 4.1 Single Parallel Branch
**Description:** Parallel element with only one branch.

**Edge Cases:**
- `<parallel><parallel_branch>...</parallel_branch></parallel>`
- Single branch with multiple tasks
- Single branch with nested structures

**Expected Behavior:**
- Should return traces from that single branch (no interleaving needed)
- Equivalent to sequential processing

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </parallel_branch>
    </parallel>
</description>
```

### 4.2 Two Parallel Branches
**Description:** Parallel with exactly two branches.

**Edge Cases:**
- Two branches with equal length
- Two branches with different lengths
- Two branches with nested structures
- Two branches where one is empty

**Expected Behavior:**
- Should generate 2 permutations: [A, B] and [B, A]
- Each permutation: Cartesian product of traces from each branch

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </parallel_branch>
        <parallel_branch>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </parallel_branch>
    </parallel>
</description>
```

### 4.3 Three or More Parallel Branches
**Description:** Parallel with 3+ branches.

**Edge Cases:**
- Three branches: 6 permutations (3!)
- Four branches: 24 permutations (4!)
- Five branches: 120 permutations (5!)
- Branches with varying lengths

**Expected Behavior:**
- Should generate all permutations: n! permutations for n branches
- Each permutation: Cartesian product of traces from each branch
- Performance consideration: factorial growth

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </parallel_branch>
        <parallel_branch>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </parallel_branch>
        <parallel_branch>
            <call id="3">
                <parameters><label>Task 3</label></parameters>
            </call>
        </parallel_branch>
    </parallel>
</description>
```

### 4.4 Nested Parallel Gateways
**Description:** Parallel gateway inside another parallel branch.

**Edge Cases:**
- Parallel in parallel (2 levels)
- Parallel in parallel in parallel (3 levels)
- Each level with multiple branches
- Mixed with other structures

**Expected Behavior:**
- Each level generates its own permutations
- Result: Cartesian product of all permutation levels
- Example: 2 branches × 2 branches = 4 outer permutations, each with 2 inner permutations = 8 total

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <parallel>
                <parallel_branch>
                    <call id="1">
                        <parameters><label>Task 1</label></parameters>
                    </call>
                </parallel_branch>
                <parallel_branch>
                    <call id="2">
                        <parameters><label>Task 2</label></parameters>
                    </call>
                </parallel_branch>
            </parallel>
        </parallel_branch>
        <parallel_branch>
            <call id="3">
                <parameters><label>Task 3</label></parameters>
            </call>
        </parallel_branch>
    </parallel>
</description>
```

### 4.5 Parallel with Empty Branches
**Description:** Parallel gateway with some empty branches.

**Edge Cases:**
- One empty branch, one with tasks
- Multiple empty branches
- All branches empty (should return empty trace)

**Expected Behavior:**
- Empty branch generates empty trace `[]`
- Interleaving should handle empty traces correctly
- Result should include traces where empty branch appears in all positions

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </parallel_branch>
        <parallel_branch>
            <!-- Empty branch -->
        </parallel_branch>
    </parallel>
</description>
```

### 4.6 Parallel with Loops in Branches
**Description:** Loop elements inside parallel branches.

**Edge Cases:**
- Each branch has a loop
- Some branches have loops, others don't
- Nested loops in branches
- Loops with different iteration counts

**Expected Behavior:**
- Each branch's loop generates its own iterations
- Interleaving combines all branch traces
- Result: permutations × loop iterations from each branch

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <loop>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </loop>
        </parallel_branch>
        <parallel_branch>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </parallel_branch>
    </parallel>
</description>
```

---

## XOR Gateway Edge Cases

### 5.1 Single Alternative
**Description:** Choose element with only one alternative.

**Edge Cases:**
- One alternative with tasks
- One alternative that is empty
- One alternative with nested structures

**Expected Behavior:**
- Should return traces from that single alternative
- Equivalent to sequential processing (no branching)

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 5.2 Two Alternatives
**Description:** Choose with exactly two alternatives.

**Edge Cases:**
- Two alternatives with equal length
- Two alternatives with different lengths
- One alternative empty, one with tasks
- Both alternatives empty

**Expected Behavior:**
- Should return union of traces from both alternatives
- All traces from alternative 1 + all traces from alternative 2

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
        <alternative>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 5.3 Three or More Alternatives
**Description:** Choose with 3+ alternatives.

**Edge Cases:**
- Three alternatives
- Many alternatives (10+)
- Alternatives with varying complexity
- Some alternatives empty

**Expected Behavior:**
- Should return union of all alternative traces
- All traces flattened into single array
- No interleaving (XOR is exclusive)

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
        <alternative>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </alternative>
        <alternative>
            <call id="3">
                <parameters><label>Task 3</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 5.4 Nested XOR Gateways
**Description:** Choose inside an alternative.

**Edge Cases:**
- XOR in XOR (2 levels)
- XOR in XOR in XOR (3 levels)
- Mixed with other structures

**Expected Behavior:**
- Each level generates its own alternatives
- Result: Cartesian product of alternatives at each level
- Example: 2 alternatives × 2 alternatives = 4 total traces

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <choose>
                <alternative>
                    <call id="1">
                        <parameters><label>Task 1</label></parameters>
                    </call>
                </alternative>
                <alternative>
                    <call id="2">
                        <parameters><label>Task 2</label></parameters>
                    </call>
                </alternative>
            </choose>
        </alternative>
        <alternative>
            <call id="3">
                <parameters><label>Task 3</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 5.5 Alternatives with Conditions
**Description:** Alternatives containing condition elements.

**Edge Cases:**
- Condition as first child
- Condition as last child
- Multiple conditions in one alternative
- Condition mixed with tasks

**Expected Behavior:**
- Conditions should be filtered out (not processed as tasks)
- Only non-condition children should be processed
- Conditions don't affect trace generation (purely informational)

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <condition>value > 10</condition>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
        <alternative>
            <condition>value <= 10</condition>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

---

## Escape Element Edge Cases

### 6.1 Escape as First Element
**Description:** Escape element as the first child in an alternative.

**Edge Cases:**
- `<alternative><escape/></alternative>`
- Escape with siblings after it (shouldn't happen, but handle gracefully)
- Escape in non-alternative context (should be ignored)

**Expected Behavior:**
- Should return single empty trace marked with `_terminatedByEscape = true`
- No further processing after escape
- Empty trace should be filtered out in final result

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <escape/>
        </alternative>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 6.2 Escape After Tasks
**Description:** Escape element after some tasks in an alternative.

**Edge Cases:**
- Tasks before escape, escape terminates
- Multiple tasks before escape
- Nested structures before escape

**Expected Behavior:**
- Should process tasks before escape
- Mark trace as `_terminatedByEscape = true`
- Stop processing after escape (no tasks after escape included)

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
            <escape/>
            <call id="3">
                <parameters><label>Task 3</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 6.3 Escape in Sequential Context
**Description:** Escape element in description or other sequential context (not in alternative).

**Edge Cases:**
- Escape in description root
- Escape in parallel_branch
- Escape in loop body

**Expected Behavior:**
- Escape should be ignored (only processed in alternative context)
- Should return empty trace `[]` for escape element itself
- Sequential combination should handle empty traces

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    </call>
    <escape/>
    <call id="2">
        <parameters><label>Task 2</label></parameters>
    </call>
</description>
```

### 6.4 Escape with Nested Structures
**Description:** Escape after nested structures (loops, parallel, choose).

**Edge Cases:**
- Escape after loop
- Escape after parallel gateway
- Escape after nested choose
- Escape inside nested structure (should be handled by parent)

**Expected Behavior:**
- Nested structures should be processed normally
- Escape should terminate trace after nested structures
- Mark trace as terminated

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <loop>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </loop>
            <escape/>
        </alternative>
    </choose>
</description>
```

### 6.5 Multiple Escapes
**Description:** Multiple escape elements in same alternative.

**Edge Cases:**
- Two escapes in sequence
- Escape, tasks, then another escape
- Escape in different positions

**Expected Behavior:**
- First escape should terminate processing
- Subsequent escapes should not be reached
- Only one termination point

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
            <escape/>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
            <escape/>
        </alternative>
    </choose>
</description>
```

---

## Nested Structure Edge Cases

### 7.1 Loop in Parallel Branch
**Description:** Loop element inside a parallel branch.

**Edge Cases:**
- Loop in one branch, tasks in others
- Loops in multiple branches
- Nested loops in branches

**Expected Behavior:**
- Loop generates 0, 1, 2 iterations
- Interleaving combines loop iterations with other branches
- Result: permutations × loop iterations

**Test Case:**
```xml
<description>
    <parallel>
        <parallel_branch>
            <loop>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </loop>
        </parallel_branch>
        <parallel_branch>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </parallel_branch>
    </parallel>
</description>
```

### 7.2 Parallel in Loop
**Description:** Parallel gateway inside a loop.

**Edge Cases:**
- Parallel with 2 branches in loop
- Parallel with 3+ branches in loop
- Each loop iteration: all parallel permutations

**Expected Behavior:**
- Loop iterations: 0, 1, 2
- Each iteration: all parallel branch permutations
- Result: loop iterations × parallel permutations

**Test Case:**
```xml
<description>
    <loop>
        <parallel>
            <parallel_branch>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </parallel_branch>
            <parallel_branch>
                <call id="2">
                    <parameters><label>Task 2</label></parameters>
                </call>
            </parallel_branch>
        </parallel>
    </loop>
</description>
```

### 7.3 XOR in Loop
**Description:** Choose (XOR) gateway inside a loop.

**Edge Cases:**
- Choose with 2 alternatives in loop
- Choose with 3+ alternatives in loop
- Each loop iteration: union of all alternatives

**Expected Behavior:**
- Loop iterations: 0, 1, 2
- Each iteration: union of alternative traces
- Result: loop iterations × alternatives

**Test Case:**
```xml
<description>
    <loop>
        <choose>
            <alternative>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </alternative>
            <alternative>
                <call id="2">
                    <parameters><label>Task 2</label></parameters>
                </call>
            </alternative>
        </choose>
    </loop>
</description>
```

### 7.4 Loop in XOR Alternative
**Description:** Loop element inside an XOR alternative.

**Edge Cases:**
- Loop in one alternative
- Loops in multiple alternatives
- Loop as only element in alternative

**Expected Behavior:**
- Loop generates 0, 1, 2 iterations (if allowed)
- Alternative generates union of loop iterations
- Combined with other alternatives via union

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <loop>
                <call id="1">
                    <parameters><label>Task 1</label></parameters>
                </call>
            </loop>
        </alternative>
        <alternative>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 7.5 Parallel in XOR Alternative
**Description:** Parallel gateway inside an XOR alternative.

**Edge Cases:**
- Parallel in one alternative
- Parallel in multiple alternatives
- Parallel with different branch counts in alternatives

**Expected Behavior:**
- Parallel generates all branch permutations
- Alternative generates union of parallel permutations
- Combined with other alternatives via union

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <parallel>
                <parallel_branch>
                    <call id="1">
                        <parameters><label>Task 1</label></parameters>
                    </call>
                </parallel_branch>
                <parallel_branch>
                    <call id="2">
                        <parameters><label>Task 2</label></parameters>
                    </call>
                </parallel_branch>
            </parallel>
        </alternative>
        <alternative>
            <call id="3">
                <parameters><label>Task 3</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 7.6 Deep Nesting (3+ Levels)
**Description:** Structures nested 3 or more levels deep.

**Edge Cases:**
- Loop in parallel in choose
- Parallel in loop in parallel
- Choose in loop in parallel in choose
- Very deep nesting (10+ levels)

**Expected Behavior:**
- Each level should be processed correctly
- Result: Cartesian product of all levels
- Performance consideration: exponential growth

**Test Case:**
```xml
<description>
    <loop>
        <parallel>
            <parallel_branch>
                <choose>
                    <alternative>
                        <call id="1">
                            <parameters><label>Task 1</label></parameters>
                        </call>
                    </alternative>
                </choose>
            </parallel_branch>
        </parallel>
    </loop>
</description>
```

---

## Task Extraction Edge Cases

### 8.1 Missing ID Attribute
**Description:** Call/manipulate/script element without `id` attribute.

**Edge Cases:**
- `<call><parameters><label>Task</label></parameters></call>` (no id)
- Empty id: `id=""`
- Whitespace-only id: `id="   "`

**Expected Behavior:**
- Should return `null` from `extractTask()`
- Trace should not include this task
- Empty trace segment should be filtered

**Test Case:**
```xml
<description>
    <call>
        <parameters><label>Task Without ID</label></parameters>
    </call>
</description>
```

### 8.2 Missing Label
**Description:** Task element without label parameter.

**Edge Cases:**
- No `<parameters>` element`
- No `<label>` inside parameters
- Empty label: `<label></label>`
- Whitespace-only label: `<label>   </label>`

**Expected Behavior:**
- Should extract task with empty string for `task` field
- Task object: `{id: "1", alt_id: null, task: ""}`
- Trace should still include task (with empty label)

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters></parameters>
    </call>
</description>
```

### 8.3 Label with Quotes
**Description:** Label text surrounded by quotes.

**Edge Cases:**
- Double quotes: `<label>"Task Name"</label>`
- Single quotes: `<label>'Task Name'</label>`
- Mixed quotes
- Quotes in middle of text

**Expected Behavior:**
- Should remove surrounding quotes (first and last character)
- Keep quotes in middle of text
- Result: `Task Name` (quotes removed)

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>"Task Name"</label></parameters>
    </call>
</description>
```

### 8.4 Label with XML Artifacts
**Description:** Label containing XML-like artifacts from parsing errors.

**Edge Cases:**
- `") & 9:task:("` patterns in label
- Multiple artifacts
- Artifacts mixed with real content

**Expected Behavior:**
- Should clean up artifacts: `replace(/"?\s*\)\s*&\s*\d+:task:\(\s*"?/g, ', ')`
- Remove remaining quotes around items
- Clean up double commas and extra spaces

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1") & 9:task:("Task 2</label></parameters>
    </call>
</description>
```

### 8.5 Missing Alt ID
**Description:** Task without `alt_id` attribute.

**Edge Cases:**
- No `a:alt_id` attribute
- No namespace declaration
- Empty alt_id: `a:alt_id=""`

**Expected Behavior:**
- Should set `alt_id` to `null`
- Task object: `{id: "1", alt_id: null, task: "Task 1"}`
- Trace should still work correctly

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    </call>
</description>
```

### 8.6 Multiple Task Types
**Description:** Different task element types (call, manipulate, script).

**Edge Cases:**
- Mix of call, manipulate, script
- All treated the same way
- Different extraction logic (currently same)

**Expected Behavior:**
- All types should be extracted identically
- Same task object structure: `{id, alt_id, task}`
- No distinction in trace calculation

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Call Task</label></parameters>
    </call>
    <manipulate id="2">
        <parameters><label>Manipulate Task</label></parameters>
    </manipulate>
    <script id="3">
        <parameters><label>Script Task</label></parameters>
    </script>
</description>
```

---

## Condition Handling Edge Cases

### 9.1 Condition Elements Ignored
**Description:** Condition elements should not be processed as tasks.

**Edge Cases:**
- Condition in alternative
- Condition in parallel_branch
- Condition in loop
- Multiple conditions

**Expected Behavior:**
- Conditions should be filtered out: `child.tagName.toLowerCase() !== 'condition'`
- Not included in trace calculation
- Purely informational (not executed)

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <condition>value > 10</condition>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 9.2 Condition with Operators
**Description:** Condition attributes with comparison operators.

**Edge Cases:**
- `condition="x < 5"`
- `condition="x > 5"`
- `condition="x <= 5"`
- `condition="x >= 5"`
- `condition="x == 5"`

**Expected Behavior:**
- `fixXMLIssues()` should escape operators in condition attributes
- `<` → `&lt;`, `>` → `&gt;`
- Should not affect trace calculation (conditions ignored)

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <condition>value < 10</condition>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

---

## Trace Combination Edge Cases

### 10.1 Empty Trace Sets
**Description:** Combining trace sets where some are empty.

**Edge Cases:**
- Empty set in `combineSequential`
- Empty set in `interleave`
- Empty set in `union`
- All sets empty

**Expected Behavior:**
- `combineSequential([])` → `[[]]` (single empty trace)
- `interleave([])` → `[[]]` (single empty trace)
- `union([])` → `[]` (empty array)
- Empty traces filtered in final result

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <!-- Empty alternative -->
        </alternative>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 10.2 Single Trace in Set
**Description:** Trace sets containing only one trace.

**Edge Cases:**
- Single trace in sequential combination
- Single trace in parallel interleaving
- Single trace in union

**Expected Behavior:**
- Should handle correctly (no special case needed)
- Result should be the single trace (or combined appropriately)

**Test Case:**
```xml
<description>
    <call id="1">
        <parameters><label>Task 1</label></parameters>
    </call>
</description>
```

### 10.3 Large Trace Sets
**Description:** Trace sets with many traces (performance edge case).

**Edge Cases:**
- 100+ traces from parallel branches
- 1000+ traces from nested structures
- Exponential growth scenarios

**Expected Behavior:**
- Should calculate correctly (may be slow)
- Memory considerations for large result sets
- Consider optimization for production use

**Test Case:**
```xml
<description>
    <parallel>
        <!-- 10 branches, each with 10 alternatives = 10! × 10^10 traces -->
    </parallel>
</description>
```

### 10.4 Terminated Traces (Escape)
**Description:** Traces terminated by escape should not be extended.

**Edge Cases:**
- Terminated trace in sequential combination
- Terminated trace in parallel interleaving
- Terminated trace in union

**Expected Behavior:**
- `_terminatedByEscape = true` flag should prevent further combination
- Terminated trace should be kept as-is
- Flag should propagate to combined traces

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
            <escape/>
        </alternative>
        <alternative>
            <call id="2">
                <parameters><label>Task 2</label></parameters>
            </call>
        </alternative>
    </choose>
    <call id="3">
        <parameters><label>Task 3</label></parameters>
    </call>
</description>
```

---

## Duplicate Trace Filtering Edge Cases

### 11.1 Identical Traces
**Description:** Multiple traces with identical task sequences.

**Edge Cases:**
- Same tasks in same order
- Generated from different paths (should be deduplicated)
- Empty traces (should be filtered)

**Expected Behavior:**
- `filterDuplicateTraces()` should remove duplicates
- Uses JSON.stringify for comparison
- Only unique traces returned

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
        </alternative>
    </choose>
</description>
```

### 11.2 Traces with Escape Flag
**Description:** Traces marked with `_terminatedByEscape` flag.

**Edge Cases:**
- Flag should not affect duplicate detection
- Clean trace (without flag) used for comparison
- Flag removed in final result

**Expected Behavior:**
- Comparison uses clean trace (flag ignored)
- Flag removed before returning: `trace.filter(task => !task.escape)`
- Final traces should not have flag

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <call id="1">
                <parameters><label>Task 1</label></parameters>
            </call>
            <escape/>
        </alternative>
    </choose>
</description>
```

### 11.3 Empty Trace Filtering
**Description:** Empty traces should be filtered out.

**Edge Cases:**
- Completely empty trace: `[]`
- Trace with only escape flag
- Trace with null/undefined tasks

**Expected Behavior:**
- Empty traces should be skipped: `if (cleanTrace.length === 0) continue`
- Not included in final result
- Final array should only contain non-empty traces

**Test Case:**
```xml
<description>
    <choose>
        <alternative>
            <escape/>
        </alternative>
    </choose>
</description>
```

### 11.4 Trace Type Determination
**Description:** Determining if trace is "loop" or "sequential".

**Edge Cases:**
- Trace with repeated node IDs (loop)
- Trace with unique node IDs (sequential)
- Trace with repeated alt_ids but different ids
- Trace with null ids

**Expected Behavior:**
- Check: `nodeIds.length > uniqueNodes.size`
- If true → "loop", else → "sequential"
- Uses `id` field for comparison (not `alt_id`)

**Test Case:**
```xml
<description>
    <loop>
        <call id="1">
            <parameters><label>Task 1</label></parameters>
        </call>
    </loop>
</description>
```

---

## Summary

This document covers all major edge cases for the CPEE Trace Calculator. Key areas to test:

1. **XML Parsing**: Malformed XML, namespaces, encoding issues
2. **Empty Structures**: All structure types with no content
3. **Loops**: 0/1/2 iterations, nesting, position in workflow
4. **Parallel**: Single/multiple branches, nesting, empty branches
5. **XOR**: Single/multiple alternatives, nesting, conditions
6. **Escape**: Position, nesting, multiple escapes
7. **Nesting**: All combinations of structures
8. **Tasks**: Missing attributes, label parsing, multiple types
9. **Conditions**: Ignored, operator handling
10. **Combination**: Empty sets, large sets, terminated traces
11. **Filtering**: Duplicates, empty traces, trace types

Each edge case should be tested to ensure robust trace calculation across all CPEE XML workflow scenarios.

