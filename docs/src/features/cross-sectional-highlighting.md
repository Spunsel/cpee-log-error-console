# Cross-Sectional Syntax Highlighting System - Complete Analysis

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Task Matching Logic](#task-matching-logic)
6. [Highlighting Process](#highlighting-process)
7. [ID Format Handling](#id-format-handling)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The cross-sectional syntax highlighting system enables users to click on a task in any of the four workflow representations (input CPEE, input intermediate, output intermediate, output CPEE) and see the equivalent task highlighted in all other representations. This provides a powerful debugging tool for understanding how tasks map across different formats during the LLM transformation process.

### Key Features

- **Cross-format highlighting**: Click a task in any format, see it highlighted everywhere
- **Bidirectional mapping**: Mappings work in both directions automatically
- **Smart ID matching**: Handles different ID schemes (id, alt_id) across formats
- **Visual mode only**: Highlights only appear in visual mode, not raw mode
- **Transitive mappings**: Automatically creates indirect mappings through intermediate formats

---

## Architecture Overview

The system consists of several interconnected components:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interaction                          │
│              (Click on task in SVG graph)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              HighlightCoordinator                            │
│  - Detects clicks on SVG elements                            │
│  - Extracts task IDs from clicked elements                  │
│  - Coordinates highlighting across sections                  │
│  - Manages highlight state                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              TaskMapper (via TaskMapping)                    │
│  - Finds equivalent tasks in other formats                   │
│  - Uses mapping built during step loading                   │
│  - Returns array of equivalent tasks                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              HighlightCoordinator                            │
│  - Finds SVG elements for each equivalent task               │
│  - Calls HighlightingService for each section                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              HighlightingService                             │
│  - Applies CSS classes/styles to SVG elements                │
│  - Different styles for CPEE vs Mermaid                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. TaskIdentifier

**Location**: `src/models/TaskIdentifier.js`

**Purpose**: Standardized representation of a task across different formats.

**Structure**:
```javascript
{
  id: string,              // Primary identifier (e.g., "a1", "a9")
  altId: string | null,    // Alternative ID from CPEE XML (e.g., "1", "5")
  label: string,           // Human-readable name (e.g., "Inspect Parts")
  type: string,            // Task type ("call", "task", "decision", etc.)
  sourceFormat: string,    // "cpee" or "mermaid"
  metadata: object,        // Format-specific metadata
  position: number,        // Position in workflow (0-based)
  svgElement: Element      // Reference to DOM element (optional)
}
```

**Key Properties**:
- **id**: The primary identifier. For CPEE, this is the `id` attribute. For Mermaid, this is extracted from the node ID (e.g., "a1" from "flowchart-a1:task:-5").
- **altId**: Only present in CPEE tasks. Extracted from the `a:alt_id` attribute in CPEE XML. This is crucial for mapping between formats.
- **label**: The human-readable task name, useful for debugging but not used for matching.

**Example**:
```javascript
// From CPEE XML: <call id="a9" a:alt_id="5">...</call>
new TaskIdentifier(
  "a9",                    // id
  "Inspect Parts",         // label
  "call",                  // type
  "cpee",                  // sourceFormat
  {},                      // metadata
  3,                       // position
  "5"                      // altId
)

// From Mermaid: a9:task:(Inspect Parts)
new TaskIdentifier(
  "a9",                    // id (extracted from "a9:task:")
  "Inspect Parts",         // label
  "task",                  // type
  "mermaid",               // sourceFormat
  { fullId: "flowchart-a9:task:-5" }, // metadata
  3                        // position
)
```

---

### 2. TaskMapper

**Location**: `src/utils/mapping/TaskMapper.js`

**Purpose**: Builds mappings between tasks across all four formats using intelligent matching logic.

**Key Methods**:
- `buildMapping()`: Main entry point - builds mappings across all formats
- `mapBetweenFormats()`: Maps tasks between two specific formats
- `findMatch()`: Finds a matching task using ID-based logic
- `calculateTextSimilarity()`: Calculates text similarity using Levenshtein distance
- `findBestTextMatch()`: Finds best text match when ID matching fails

**Process**:
1. Takes arrays of TaskIdentifier objects from all four formats
2. Maps between all format pairs (12 pairs total: 4×4 - 4 self pairs)
3. Uses intelligent matching logic:
   - **ID-based matching**: Primary strategy using `id` and `alt_id` fields
   - **Text validation**: Validates ID matches using text similarity (threshold: 0.7)
   - **Text-based fallback**: Uses text matching when ID matching fails or produces incorrect results
4. Creates transitive mappings to fill gaps
5. Returns a `TaskMapping` object

**Text-Based Matching**:
- **Similarity Calculation**: Uses normalized Levenshtein distance (edit distance)
- **Threshold**: 0.7 (configurable via `TEXT_SIMILARITY_THRESHOLD`)
- **Validation**: After ID match found, validates with text similarity
- **Fallback**: If ID match fails or text similarity < 0.7, searches all target tasks for best text match
- **Purpose**: Handles graph errors where IDs are incorrectly assigned to tasks

**Format Pairs**:
- input-cpee ↔ input-intermediate
- input-cpee ↔ output-intermediate
- input-cpee ↔ output-cpee
- input-intermediate ↔ output-intermediate
- input-intermediate ↔ output-cpee
- output-intermediate ↔ output-cpee

**Bidirectional Nature**: Mappings are automatically bidirectional. When `A → B` is mapped, `B → A` is also created.

---

### 3. TaskMapping (Internal Class)

**Location**: `src/utils/mapping/TaskMapper.js` (internal class)

**Purpose**: Data structure that stores all mappings.

**Data Structure**:
```javascript
{
  mappings: Map {
    'sourceFormat' → Map {
      'sourceTaskId' → Map {
        'targetFormat' → [
          { targetTask: TaskIdentifier, isTransitive: boolean },
          ...
        ]
      }
    }
  },
  tasks: Map {
    'format' → Map {
      'taskId' → TaskIdentifier
    }
  }
}
```

**Key Methods**:
- `addMapping()`: Creates bidirectional mapping between two tasks
- `findEquivalentTasks()`: Finds all tasks equivalent to a given task
- `getTask()`: Retrieves a TaskIdentifier by ID and format
- `getMappings()`: Gets mappings from source to target format

**Example Query**:
```javascript
// Find all tasks equivalent to "a9" in "input-cpee"
const equivalents = taskMapping.findEquivalentTasks("a9", "input-cpee");
// Returns: {
//   'input-intermediate': [{ task: TaskIdentifier(...) }],
//   'output-intermediate': [{ task: TaskIdentifier(...) }],
//   'output-cpee': [{ task: TaskIdentifier(...) }]
// }
```

---

### 4. HighlightCoordinator

**Location**: `src/components/coordinators/HighlightCoordinator.js`

**Purpose**: Coordinates the entire highlighting process.

**Responsibilities**:
1. **Click Detection**: Attaches click handlers to SVG elements
2. **ID Extraction**: Extracts task IDs from clicked elements
3. **Mapping Lookup**: Uses TaskMapping to find equivalent tasks
4. **Element Finding**: Locates SVG elements for equivalent tasks
5. **Highlight Application**: Delegates to HighlightingService
6. **State Management**: Tracks active highlights

**Key Methods**:

#### `attachCPEEClickHandlers(svgElement, sectionId)`
- Attaches click listener to CPEE SVG
- Extracts `element-id` attribute from clicked task
- Calls `onTaskClicked()` with the task ID

#### `attachMermaidClickHandlers(svgElement, sectionId)`
- Attaches click listener to Mermaid SVG
- Extracts `id` attribute from clicked node (full ID like "flowchart-a9:task:-5")
- Calls `onTaskClicked()` with the full node ID

#### `onTaskClicked(taskId, sourceFormat, sectionId)`
- Main entry point for task clicks
- Extracts base ID from full Mermaid IDs
- Looks up equivalent tasks using TaskMapping
- Highlights equivalent tasks in all sections

#### `findTaskInSVG(container, taskId)`
- Finds SVG DOM element for a given task ID
- Handles multiple ID formats (full IDs, base IDs, patterns)
- Tries multiple matching strategies:
  1. Exact ID match
  2. Pattern matching for Mermaid IDs
  3. Base ID extraction and matching
  4. CSS selector fallback

**Section Tracking**:
```javascript
this.sections = {
  'input-cpee': HTMLElement,        // SVG container
  'input-intermediate': HTMLElement,
  'output-intermediate': HTMLElement,
  'output-cpee': HTMLElement
};
```

---

### 5. HighlightingService

**Location**: `src/services/HighlightingService.js` (referenced, not detailed here)

**Purpose**: Applies visual highlighting to SVG elements.

**Methods**:
- `highlightCPEETask(element, isActive)`: Applies highlighting to CPEE task elements
- `highlightMermaidNode(element, isActive)`: Applies highlighting to Mermaid nodes
- `clearAllHighlights()`: Removes all highlights

**Visual Styles**:
- **Active task** (clicked): Stronger highlight (e.g., brighter color, thicker border)
- **Related tasks** (equivalent): Softer highlight (e.g., lighter color, thinner border)

---

## Data Flow

### Phase 1: Step Loading and Mapping Creation

```
1. LogService fetches step data
   ↓
2. Extracts raw content (CPEE XML, Mermaid syntax)
   ↓
3. CPEETaskExtractor.extract() → TaskIdentifier[] (input CPEE)
4. CPEETaskExtractor.extract() → TaskIdentifier[] (output CPEE)
5. MermaidTaskExtractor.extract() → TaskIdentifier[] (input intermediate)
6. MermaidTaskExtractor.extract() → TaskIdentifier[] (output intermediate)
   ↓
7. TaskMapper.buildMapping(inputCpee, inputMermaid, outputMermaid, outputCpee)
   ↓
8. TaskMapping object created with all bidirectional mappings
   ↓
9. Stored in CPEEStep.taskMapping
```

### Phase 2: Step Display and Registration

```
1. StepViewer.displayStep() called
   ↓
2. ContentVisualizationCoordinator renders SVGs
   ↓
3. When SVG ready:
   - HighlightCoordinator.registerSection(sectionId, container)
   - HighlightCoordinator.attachCPEEClickHandlers() or attachMermaidClickHandlers()
   ↓
4. HighlightCoordinator.setCurrentStepMapping(step.taskMapping)
   ↓
5. SVGs are now clickable and ready for highlighting
```

### Phase 3: User Click and Highlighting

```
1. User clicks task in SVG
   ↓
2. Click handler fires → HighlightCoordinator.onTaskClicked(taskId, sourceFormat, sectionId)
   ↓
3. Extract base ID from full Mermaid ID (if needed)
   ↓
4. HighlightCoordinator.findEquivalentTasks(baseTaskId, sourceFormat)
   → Uses currentStepMapping.findEquivalentTasks()
   → Returns array of equivalent tasks
   ↓
5. For each equivalent task:
   - HighlightCoordinator.findTaskInSVG(container, taskId)
   - HighlightCoordinator.highlightInSection(sectionId, taskId, isActive)
   - HighlightingService applies visual styles
   ↓
6. Also highlights source task as "active"
```

---

## Task Matching Logic

The matching logic is the heart of the system. It determines how tasks from different formats are identified as equivalent.

### Core Rules

1. **Input Intermediate Special Case**:
   - Input intermediate only has `id` (no `altId`)
   - Mapping TO input-intermediate uses `id` matching only
   - Only from input-cpee (input-cpee.id → input-intermediate.id)

2. **All Other Formats**:
   - Primary: Use `alt_id` matching
   - Fallback: Try all combinations of `id` and `alt_id`

### Matching Priority (for non-input-intermediate targets)

#### Priority 1: Primary `alt_id` Matching

**CPEE → Mermaid**:
```
sourceTask.altId → targetTask.id
```
Example: Input CPEE `alt_id="5"` → Output Intermediate `id="5"`

**CPEE → CPEE**:
```
sourceTask.altId → targetTask.altId
```
Example: Input CPEE `alt_id="5"` → Output CPEE `alt_id="5"`

**Mermaid → CPEE**:
```
sourceTask.id → targetTask.altId
```
Example: Input Intermediate `id="a9"` → Output CPEE `alt_id="a9"`

**Mermaid → Mermaid**:
```
sourceTask.id → targetTask.id
```
Example: Input Intermediate `id="a9"` → Output Intermediate `id="a9"`

**⚠️ Edge Case - Mermaid → Mermaid via CPEE**:
When direct `id → id` matching fails, the system uses CPEE as a bridge:
- **Input Mermaid → Output Mermaid**: 
  1. Find Input CPEE task matching Input Mermaid `id` (via mapping or direct lookup)
  2. Use Input CPEE's `alt_id` to match Output Mermaid `id`
- **Output Mermaid → Input Mermaid**:
  1. Find Output CPEE task matching Output Mermaid `id` (via mapping or direct lookup)
  2. Find Input CPEE with matching `alt_id`
  3. Use Input CPEE's `id` to match Input Mermaid `id`

**Example Edge Case**:
- Input Mermaid: `id="a1"` (matches Input CPEE `id="a1"`)
- Output Mermaid: `id="1"` (matches Input CPEE `alt_id="1"`)
- Direct match fails: `"a1"` ≠ `"1"`
- Via CPEE: Input Mermaid `id="a1"` → Input CPEE `id="a1"` → Input CPEE `alt_id="1"` → Output Mermaid `id="1"` ✓

#### Priority 1.5: Mermaid → Mermaid Edge Case (via CPEE)

**If direct `id → id` fails for Mermaid → Mermaid**:
The system attempts to match via CPEE as an intermediate step:

**Input Mermaid → Output Mermaid**:
1. Try mapping lookup: Find Input CPEE via `input-intermediate → input-cpee` mapping
2. Fallback: Direct lookup in `inputCpeeTasks` array
3. Use Input CPEE's `alt_id` to match Output Mermaid's `id`

**Output Mermaid → Input Mermaid**:
1. Try mapping lookup: Find Output CPEE via `output-intermediate → output-cpee` mapping
2. Fallback: Direct lookup in `outputCpeeTasks` array (find CPEE with `alt_id` matching Output Mermaid's `id`)
3. Find Input CPEE with matching `alt_id`
4. Use Input CPEE's `id` to match Input Mermaid's `id`

This handles cases where Input Mermaid uses `id` matching Input CPEE's `id`, while Output Mermaid uses `id` matching Input CPEE's `alt_id`.

#### Priority 2: Fallback Matching (Order Matters!)

**1. CPEE → CPEE specific fallbacks**:
```
sourceTask.id → targetTask.altId  (input CPEE.id → output CPEE.altId)
sourceTask.altId → targetTask.id   (input CPEE.altId → output CPEE.id)
```
Example: Input CPEE `id="a9"` → Output CPEE `alt_id="a9"` ✓

**2. General fallbacks**:
```
sourceTask.id → targetTask.altId  (if target is CPEE)
sourceTask.altId → targetTask.id  (if source is CPEE and target is Mermaid)
sourceTask.altId → targetTask.altId (if both are CPEE)
```

**3. Last Resort**:
```
sourceTask.id → targetTask.id  (most generic, dangerous!)
```
⚠️ **Warning**: This is only used as a last resort because IDs can be reused across different tasks. It's moved to the end to prevent false matches.

#### Priority 3: Text-Based Validation and Fallback

After ID-based matching, the system validates matches using text similarity:

**Text Similarity Calculation**:
- Uses normalized Levenshtein distance (edit distance)
- Normalizes strings (lowercase, trim) before comparison
- Returns similarity score between 0 (no similarity) and 1 (identical)
- Threshold: **0.7** (configurable via `TEXT_SIMILARITY_THRESHOLD`)

**Validation Process**:

1. **If ID match found**:
   - Calculate text similarity between source and matched task labels
   - If similarity ≥ 0.7: ✅ Accept ID match
   - If similarity < 0.7: ❌ Reject ID match and try text-based matching

2. **If no ID match found**:
   - Try text-based matching as fallback

3. **Text-Based Matching**:
   - Search all target tasks for best text match
   - Compare source task label with each target task label
   - Return best match only if similarity ≥ 0.7
   - If no match above threshold: return null

**Why This Matters**:

Sometimes ID/alt_id matching can produce incorrect matches due to:
- Graph errors (wrong IDs assigned to tasks)
- ID reuse across different tasks
- ID mismatches between input and output formats

**Example**:
- Input CPEE: `id="a11"`, `alt_id="6"`, `label="Add Butter and Milk"`
- Output CPEE: `id="a13"`, `alt_id="a11"`, `label="Add Cumin"` (wrong match by ID)
- Output CPEE: `id="a21"`, `alt_id="a13"`, `label="Add Butter and Milk"` (correct match)

**Process**:
1. ID match: `id="a11"` → `alt_id="a11"` → "Add Cumin" ❌
2. Text similarity: "Add Butter and Milk" vs "Add Cumin" = ~0.4 (< 0.7)
3. Reject ID match, try text matching
4. Text match: "Add Butter and Milk" ↔ "Add Butter and Milk" = 1.0 (> 0.7) ✅
5. Use text-based match instead

### Why Order Matters

Consider this example:
- **Input CPEE**: `id="a9"`, `alt_id="5"` (Inspect Parts)
- **Output CPEE**: `id="a7"`, `alt_id="a9"` (Inspect Parts)
- **Output CPEE**: `id="a9"`, `alt_id="a13"` (Assemble Chainsaw)

If we tried `id→id` first:
- ❌ Would match `id="a9"` → `id="a9"` (wrong task: Assemble Chainsaw)

If we try `id→altId` first:
- ✅ Matches `id="a9"` → `alt_id="a9"` (correct task: Inspect Parts)

### Example Matching Flow

**Scenario**: Click "Inspect Parts" in Input CPEE

**Input CPEE Task**:
- `id="a9"`
- `alt_id="5"`
- `label="Inspect Parts"`

**Finding equivalent in Output CPEE**:

1. **Primary**: `alt_id="5"` → `alt_id="5"` ❌ (no match)
2. **Fallback 1**: `id="a9"` → `alt_id="a9"` ✅ **MATCH!**
   - Found: Output CPEE task with `id="a7"`, `alt_id="a9"`

**Finding equivalent in Output Intermediate**:

1. **Primary**: `alt_id="5"` → `id="5"` ❌ (no match, Output Intermediate has `id="a9"`)
2. **Fallback**: `id="a9"` → `id="a9"` ✅ **MATCH!**
   - Found: Output Intermediate task with `id="a9"`

---

## Highlighting Process

### Step-by-Step Highlighting Flow

1. **Click Detection**:
   ```javascript
   // User clicks on SVG element
   clickDetector.attachClickListener(svgElement, callback)
   ```

2. **ID Extraction**:
   ```javascript
   // CPEE: taskContainer.getAttribute('element-id') → "a9"
   // Mermaid: taskContainer.id → "flowchart-a9:task:-5"
   ```

3. **Base ID Extraction** (for Mermaid):
   ```javascript
   extractBaseTaskId("flowchart-a9:task:-5") → "a9"
   ```

4. **Equivalent Task Lookup**:
   ```javascript
   const equivalents = taskMapping.findEquivalentTasks("a9", "input-cpee");
   // Returns: [
   //   { taskId: "a9", format: "input-intermediate", task: TaskIdentifier },
   //   { taskId: "a7", format: "output-cpee", task: TaskIdentifier },
   //   { taskId: "a9", format: "output-intermediate", task: TaskIdentifier }
   // ]
   ```

5. **SVG Element Finding**:
   ```javascript
   // For each equivalent task:
   findTaskInSVG(container, taskId)
   // Tries multiple strategies:
   // - Exact ID match
   // - Pattern matching
   // - Base ID extraction
   // - CSS selector
   ```

6. **Highlight Application**:
   ```javascript
   // Determine section type (cpee or mermaid)
   // Call appropriate highlighting method:
   highlightingService.highlightCPEETask(element, isActive)
   // or
   highlightingService.highlightMermaidNode(element, isActive)
   ```

### ID Format Handling

The system handles multiple ID formats:

#### CPEE IDs
- **Format**: Simple string (e.g., `"a9"`)
- **Source**: `element-id` attribute on SVG `<g>` element
- **Matching**: Direct comparison

#### Mermaid IDs
- **Full SVG ID**: `"flowchart-a9:task:-5"` (used in DOM)
- **Base ID**: `"a9"` (extracted for matching)
- **Source**: `id` attribute on SVG `<g class="node">` element

**Extraction Logic**:
```javascript
// Pattern: flowchart-XXX:task: or XXX:task:
const match = taskId.match(/-([a-z0-9]+):task:/) || taskId.match(/^([a-z0-9]+):task:/);
// Returns: "a9" from "flowchart-a9:task:-5"
```

**Finding Elements**:
1. Try exact match: `node.id === "flowchart-a9:task:-5"`
2. Try pattern match: `/^flowchart-a9(?:-task-|:task:|-|$)/.test(node.id)`
3. Try base ID pattern: `/^flowchart-a9(?:-task-|:task:|-|$)/.test(node.id)` with baseId="a9"
4. CSS selector fallback: `container.querySelector("#flowchart-a9\\:task\\:-5")`

### Using Full SVG ID from Metadata

When highlighting equivalent tasks, the system prefers the full SVG ID from metadata:

```javascript
// TaskIdentifier.metadata.fullId = "flowchart-a9:task:-5"
let highlightTaskId = mappedTaskId; // "a9"
if (taskObject.metadata.fullId) {
    highlightTaskId = taskObject.metadata.fullId; // Use "flowchart-a9:task:-5"
}
```

This improves matching accuracy because the full ID is more specific.

---

## Examples

### Example 1: Simple Case

**Input CPEE**:
```xml
<call id="a1" a:alt_id="1">
  <parameters><label>Vorschlag erstellen</label></parameters>
</call>
```

**Output Intermediate**:
```
a1:task:(Vorschlag erstellen)
```

**Output CPEE**:
```xml
<call id="a1" a:alt_id="a1">
  <parameters><label>Vorschlag erstellen</label></parameters>
</call>
```

**Click on Input CPEE "a1"**:
1. Extract: `id="a1"`, `alt_id="1"`
2. Find equivalent in Output Intermediate:
   - Primary: `alt_id="1"` → `id="1"` ❌ (Output Intermediate has `id="a1"`)
   - Fallback: `id="a1"` → `id="a1"` ✅
3. Find equivalent in Output CPEE:
   - Primary: `alt_id="1"` → `alt_id="a1"` ❌
   - Fallback: `id="a1"` → `id="a1"` ✅

### Example 2: Complex Case (ID Mismatch)

**Input CPEE**:
```xml
<call id="a9" a:alt_id="5">
  <parameters><label>Inspect Parts</label></parameters>
</call>
```

**Output CPEE**:
```xml
<call id="a7" a:alt_id="a9">
  <parameters><label>Inspect Parts</label></parameters>
</call>
<call id="a9" a:alt_id="a13">
  <parameters><label>Assemble Chainsaw</label></parameters>
</call>
```

**Click on Input CPEE "a9"**:
1. Extract: `id="a9"`, `alt_id="5"`
2. Find equivalent in Output CPEE:
   - Primary: `alt_id="5"` → `alt_id="a9"` ❌ (no task has `alt_id="5"`)
   - Fallback 1: `id="a9"` → `alt_id="a9"` ✅ **CORRECT MATCH**
     - Found: `id="a7"`, `alt_id="a9"` (Inspect Parts)
   - If we tried `id="a9"` → `id="a9"` first, would match wrong task!

**Why this works**:
- The correct match is `input.id="a9"` → `output.alt_id="a9"`
- The wrong match would be `input.id="a9"` → `output.id="a9"` (Assemble Chainsaw)
- By trying `id→altId` before `id→id`, we avoid the false match

### Example 3: Mermaid → Mermaid Edge Case (via CPEE)

**Input CPEE**:
```xml
<call id="a1" a:alt_id="1">
  <parameters><label>Vorbereitung der Visite</label></parameters>
</call>
```

**Input Mermaid**:
```
a1:task:(Vorbereitung der Visite)
```

**Output Mermaid**:
```
1:task:(Vorbereitung der Visite)
```

**Output CPEE**:
```xml
<call id="a1" a:alt_id="1">
  <parameters><label>Vorbereitung der Visite</label></parameters>
</call>
```

**Click on Input Mermaid "a1"**:
1. Extract: `id="a1"`
2. Find equivalent in Output Mermaid:
   - Primary: `id="a1"` → `id="a1"` ❌ (no match, Output Mermaid has `id="1"`)
   - Edge Case: Via CPEE:
     - Find Input CPEE with `id="a1"` (direct lookup)
     - Input CPEE has `alt_id="1"`
     - Match Output Mermaid with `id="1"` ✅ **MATCH!**

**Click on Output Mermaid "1"**:
1. Extract: `id="1"`
2. Find equivalent in Input Mermaid:
   - Primary: `id="1"` → `id="1"` ❌ (no match, Input Mermaid has `id="a1"`)
   - Edge Case: Via CPEE:
     - Find Output CPEE with `alt_id="1"` (direct lookup)
     - Output CPEE has `id="a1"` and `alt_id="1"`
     - Find Input CPEE with matching `alt_id="1"` (direct lookup)
     - Input CPEE has `id="a1"`
     - Match Input Mermaid with `id="a1"` ✅ **MATCH!**

**Why this works**:
- Input Mermaid uses `id` matching Input CPEE's `id`
- Output Mermaid uses `id` matching Input CPEE's `alt_id`
- CPEE acts as a bridge between the two Mermaid formats
- The system detects when direct matching fails and uses CPEE as an intermediate step

### Example 4: Text-Based Matching Fallback (Graph Errors)

**Input CPEE**:
```xml
<call id="a11" a:alt_id="6">
  <parameters><label>Add Butter and Milk</label></parameters>
</call>
```

**Output CPEE**:
```xml
<!-- Wrong match by ID (graph error) -->
<call id="a13" a:alt_id="a11">
  <parameters><label>Add Cumin</label></parameters>
</call>

<!-- Correct match by text -->
<call id="a21" a:alt_id="a13">
  <parameters><label>Add Butter and Milk</label></parameters>
</call>
```

**Click on Input CPEE "a11" (Add Butter and Milk)**:
1. Extract: `id="a11"`, `alt_id="6"`, `label="Add Butter and Milk"`
2. Find equivalent in Output CPEE:
   - Primary: `alt_id="6"` → `alt_id="a13"` ❌ (no match)
   - Fallback: `id="a11"` → `alt_id="a11"` → Found: `id="a13"`, `label="Add Cumin"` ❌ **WRONG MATCH**
   - **Text Validation**: "Add Butter and Milk" vs "Add Cumin" = ~0.4 (< 0.7 threshold)
   - **Reject ID match**, try text-based matching
   - **Text Match**: Search all output tasks, find `label="Add Butter and Milk"` with similarity = 1.0 ✅
   - **Result**: Use text-based match (`id="a21"`, `alt_id="a13"`) instead

**Why this works**:
- ID-based matching can produce incorrect results due to graph errors
- Text similarity validation catches these errors (< 0.7 threshold)
- Text-based fallback finds the correct task even when IDs are wrong
- This handles cases where the source graphs themselves have incorrect ID assignments

---

## Troubleshooting

### Common Issues

#### 1. Task Not Highlighting in Other Sections

**Symptoms**: Click task in one section, but it doesn't highlight in others.

**Possible Causes**:
- No mapping exists (check console logs for "No equivalent tasks found")
- Task not found in SVG (check "Task element not found" logs)
- Section not registered (check "Section not found" logs)
- Section in raw mode (highlights only work in visual mode)

**Debug Steps**:
1. Check console for mapping logs: `[TaskMapper] Mapping ...`
2. Check if `currentStepMapping` is set: `[HighlightCoordinator] Using TaskMapper`
3. Check task finding logs: `[HighlightCoordinator] Searching for task`
4. Verify section is in visual mode: `[HighlightCoordinator] Section ... is in raw mode`

#### 2. Multiple Tasks Highlighting (False Positives)

**Symptoms**: Clicking one task highlights multiple unrelated tasks.

**Possible Causes**:
- `id→id` fallback matching too early (should be last resort)
- IDs reused across different tasks
- Pattern matching too broad

**Solution**: Ensure fallback order is correct (see [Task Matching Logic](#task-matching-logic))

#### 3. Wrong Task Highlighted

**Symptoms**: Clicking task A highlights task B.

**Possible Causes**:
- Incorrect matching logic order
- Missing `alt_id` in source task
- Transitive mapping creating incorrect path

**Debug Steps**:
1. Check which matching strategy was used (console logs show "Found match using ...")
2. Verify `alt_id` values in source and target tasks
3. Check transitive mapping logs: `[TaskMapper] Transitive: ...`

#### 4. Mermaid IDs Not Matching

**Symptoms**: Clicking Mermaid node doesn't highlight equivalent tasks.

**Possible Causes**:
- Base ID extraction failing
- Full SVG ID format changed
- Pattern matching not covering all ID formats

**Debug Steps**:
1. Check extracted base ID: `[HighlightCoordinator] Extracted base ID: ...`
2. Check full ID: `[HighlightCoordinator] Mermaid node clicked: ...`
3. Verify pattern matching: `[HighlightCoordinator] Found Mermaid node by pattern match`

### Debug Logging

The system provides extensive console logging:

**TaskMapper Logs**:
```
[TaskMapper] Building mapping across formats...
[TaskMapper] Mapping input-cpee → output-cpee...
[TaskMapper] Found match using alt_id: "5" → "a9"
[TaskMapper] Fallback: Found match using id→altId: "a9" → "a9"
```

**HighlightCoordinator Logs**:
```
[HighlightCoordinator] Task clicked: a9 in input-cpee
[HighlightCoordinator] Extracted base ID: a9 from flowchart-a9:task:-5
[HighlightCoordinator] Using TaskMapper to find related tasks for: a9
[HighlightCoordinator] Found 3 equivalent tasks
[HighlightCoordinator] Highlighting flowchart-a9:task:-5 in output-intermediate
```

**Task Finding Logs**:
```
[HighlightCoordinator] Searching for task: flowchart-a9:task:-5 in container
[HighlightCoordinator] Found 12 Mermaid nodes
[HighlightCoordinator] ✓ Found Mermaid node by exact ID: flowchart-a9:task:-5
```

---

## Summary

The cross-sectional highlighting system is a sophisticated multi-component system that:

1. **Extracts** tasks from different formats into a unified `TaskIdentifier` model
2. **Maps** tasks across formats using intelligent matching logic prioritizing `alt_id`
3. **Tracks** SVG containers and click handlers for all sections
4. **Finds** equivalent tasks using bidirectional mappings
5. **Highlights** tasks visually across all sections simultaneously

The key insight is that **`alt_id` is the primary matching mechanism** for linking tasks across formats, with `id` serving as a fallback. The order of fallback strategies is critical to avoid false matches when IDs are reused.

The system handles complex scenarios like:
- Different ID schemes between formats
- ID reuse across different tasks
- Full SVG IDs vs base IDs in Mermaid
- Transitive mappings through intermediate formats
- **Edge case: Mermaid → Mermaid matching via CPEE bridge** when Input Mermaid uses `id` matching Input CPEE's `id`, while Output Mermaid uses `id` matching Input CPEE's `alt_id`
- **Graph errors: Text-based validation and fallback** to handle incorrect ID assignments in source graphs

### Key Matching Strategies

1. **Primary**: Use `alt_id` for most format pairs (CPEE ↔ Mermaid, CPEE ↔ CPEE)
2. **Input Intermediate Special Case**: Only uses `id` matching from input-cpee
3. **Mermaid → Mermaid Edge Case**: When direct `id → id` fails, uses CPEE as a bridge:
   - Input Mermaid `id` → Input CPEE `id` → Input CPEE `alt_id` → Output Mermaid `id`
   - Output Mermaid `id` → Output CPEE `alt_id` → Input CPEE `alt_id` → Input CPEE `id` → Input Mermaid `id`
4. **Fallback**: Tries all combinations of `id` and `alt_id` in carefully ordered sequence
5. **Last Resort**: Generic `id → id` matching (only when all else fails)
6. **Text-Based Validation**: After ID matching, validates with text similarity (threshold: 0.7)
   - If similarity < 0.7: Rejects ID match and tries text-based matching
   - If no ID match: Uses text-based matching as fallback
   - Handles graph errors where IDs are incorrectly assigned

This provides users with a seamless debugging experience when comparing workflows across different representation formats, even when ID schemes differ significantly between input and output Mermaid representations.
