# Changelog

## Phase 1: Canonical id chain for cross-graph task & gateway mapping

Nodes are linked across the four sections (`input-cpee`, `input-intermediate`
[Mermaid], `output-intermediate` [Mermaid], `output-cpee`) via a single canonical id:

- **Tasks:** `input-cpee id` = `input-mermaid id` = `output-mermaid id` = `output-cpee a:alt_id`
- **Gateways:** `input-cpee eid + "s"` = `input-mermaid id` = `output-mermaid id` = `output-cpee a:alt_id`
  (Mermaid renders a gateway as a start/end pair, e.g. `e5s` / `e5e`.)

### Step 1: Canonical id derivation

- [x] Added an `eid` field to `NodeIdentifier` (constructor, `toObject`, `fromObject`).
- [x] `CPEENodeExtractor.extractTaskFromElement` extracts the gateway `eid` from the CPEE XML.
- [x] Added centralized `getCanonicalNodeId(node, format)` and `isGatewayNode(node)` to `NodeMappingService`.
- [x] Gateway canonical id = `eid + "s"` for input-cpee, `a:alt_id` for output-cpee; tasks use `id` (or `alt_id` for output-cpee).
- [x] `NodeMapping.addMapping` and `findGatewayByAltId` compare via `getCanonicalNodeId` instead of raw ids.

### Step 2: Cross-graph gateway highlighting via positional SVG element-id

The rendered CPEE SVG carries no semantic id (`alt_id`/`eid`) on its elements — the
`presetaltid` `info` override is not applied, so only the base `element-endpoint` and
the positional `element-id` (`choose_N` / `parallel_N` / `loop_N`) are present. Gateway
highlighting is therefore keyed on that positional element-id, exactly as tasks are
keyed on their `element-id`.

- [x] `CPEENodeExtractor` assigns each gateway node the positional SVG element-id (`choose_0`, `parallel_0`, `loop_0`, …) matching the WfAdaptor, while keeping `eid`/`altId` for the canonical id.
- [x] `CrossGraphHighlightCoordinator.resolveCPEEGatewayElementId` looks the gateway node up by its clicked `element-id` and derives the canonical id via `getCanonicalNodeId`.
- [x] Added `highlightCPEEGatewayByElementId` to highlight all SVG elements sharing a gateway's element-id (opening diamond + closing `_finish` diamond).
- [x] `getCanonicalNodeId` for output-cpee gateways falls back to `eid + "s"` when `a:alt_id` is absent (restructured loop wrapper), so they still align with the Mermaid start id.
- [x] Fixed the closing gateway half (`*_finish`, a `primitive` group without the `complex` class) being highlighted as a task box: `applySectionHighlight` also detects gateways by their positional `element-id`.

### Step 3: Correct nested-gateway numbering & highlight all duplicates

Loop unrolling in the output CPEE can make the same task/gateway appear multiple
times (e.g. `a11`/`a12`, `choose_0`/`choose_1` sharing a canonical id); all copies
must highlight together. Nested gateways also exposed a numbering bug.

- [x] `CPEENodeExtractor.findGatewayElements` now collects gateways in **post-order** (children before parents), matching the WfAdaptor's element-id numbering, which is assigned when the *closing* element is emitted (verified against a nested `choose` inside an `otherwise`).
- [x] Added `NodeMapping.getTasksByCanonicalId(canonicalId, format, predicate)` to surface all nodes sharing a canonical id (the directional mapping keeps only the first "wins" target).
- [x] Replaced the alt_id-based `highlightAllDuplicateCPEEElements` (broken — the SVG has no `element-alt_id`) with `highlightAllCPEEDuplicates`, which resolves the canonical id from the mapping and highlights every matching node.
- [x] Gateway highlighting now highlights all gateway nodes sharing the canonical id (loop-unrolled duplicates), each via its positional element-id.
- [x] Duplicate matching keeps the same kind (task vs gateway) to avoid a rare alt_id collision.
