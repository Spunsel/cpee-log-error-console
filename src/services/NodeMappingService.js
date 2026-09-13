/**
 * Node Mapping Service
 * Maps nodes between four formats using canonical IDs.
 *
 * CANONICAL ID CHAIN
 * ------------------
 * Tasks (always):
 *   Input CPEE.id = Input Mermaid.id = Output Mermaid.id = Output CPEE.altId
 *
 * Gateways (parallel/exclusive/loop, always):
 *   Input CPEE.eid + 's' = Input Mermaid.id = Output Mermaid.id = Output CPEE.altId
 *   (Mermaid represents a gateway as a start/end pair, e.g. e5s / e5e; the CPEE
 *    gateway maps to the start id e5s, and the paired end e5e is resolved
 *    separately during highlighting.)
 *
 * Text similarity fallback when ID matching fails.
 */

import { NodeIdentifier } from '../models/NodeIdentifier.js';
import { calculateJaccardSimilarity, calculateJaroWinkler } from '../utils/similarity/StringSimilarity.js';

/**
 * Determine whether a node represents a gateway (choose/parallel/loop or a
 * Mermaid diamond gateway).
 * @param {NodeIdentifier} node - Node to test
 * @returns {boolean} True if the node is a gateway
 */
export function isGatewayNode(node) {
    if (!node) {
        return false;
    }
    const type = node.type;
    if (type === 'gateway' || type === 'choose' || type === 'parallel' || type === 'loop' ||
        type === 'exclusivegateway' || type === 'parallelgateway' || type === 'decision') {
        return true;
    }
    const tagName = node.metadata?.tagName ? String(node.metadata.tagName).toLowerCase() : null;
    if (tagName && ['choose', 'parallel', 'loop'].includes(tagName)) {
        return true;
    }
    if (node.metadata?.shape === 'diamond') {
        return true;
    }
    return false;
}

/**
 * Compute the canonical cross-format id for a node in a given format.
 * This is the single source of truth for the canonical id chain (see file header).
 *
 * @param {NodeIdentifier} node - The node
 * @param {string} format - One of 'input-cpee', 'input-intermediate',
 *                          'output-intermediate', 'output-cpee'
 * @returns {string|null} Canonical id, or null when it cannot be determined
 */
export function getCanonicalNodeId(node, format) {
    if (!node) {
        return null;
    }

    if (isGatewayNode(node)) {
        // Gateway chain: input-cpee uses eid + 's'; output-cpee uses altId;
        // Mermaid (input/output) uses the node id directly (already e5s / e5e).
        if (format === 'input-cpee') {
            return node.eid ? `${node.eid}s` : (node.altId || null);
        }
        if (format === 'output-cpee') {
            // Normally the a:alt_id (e.g. e5s). Some restructured gateways (e.g. the
            // loop wrapper) carry only an eid; fall back to eid + 's' so they still
            // align with the Mermaid start id.
            return node.altId || (node.eid ? `${node.eid}s` : null);
        }
        return node.id || null;
    }

    // Task chain: output-cpee uses altId; all other formats use id.
    return format === 'output-cpee' ? (node.altId || null) : (node.id || null);
}

export class NodeMappingService {
    constructor(cpeeNodeExtractor, mermaidNodeExtractor) {
        this.cpeeNodeExtractor = cpeeNodeExtractor;
        this.mermaidNodeExtractor = mermaidNodeExtractor;
        this.TEXT_SIMILARITY_THRESHOLD = 0.75;
    }

    /**
     * Generate node mapping for a step
     */
    generateTaskMapping(cpeeStep) {
        const nodes = this.extractTasksFromStep(cpeeStep);
        
        if (nodes.inputCpeeTasks.length > 0 || nodes.inputMermaidTasks.length > 0 || 
            nodes.outputMermaidTasks.length > 0 || nodes.outputCpeeTasks.length > 0) {
            try {
                const taskMapping = this.buildMapping(
                    nodes.inputCpeeTasks,
                    nodes.inputMermaidTasks,
                    nodes.outputMermaidTasks,
                    nodes.outputCpeeTasks
                );
                cpeeStep.setTaskMapping(taskMapping);
                return taskMapping;
            } catch (error) {
                console.warn(`[NodeMappingService] Failed to generate mapping for Step ${cpeeStep.stepNumber}:`, error);
                return null;
            }
        }
        return null;
    }

    /**
     * Extract nodes from all step sections
     */
    extractTasksFromStep(cpeeStep) {
        const CPEEExtractor = this.cpeeNodeExtractor.constructor || this.cpeeNodeExtractor;
        const MermaidExtractor = this.mermaidNodeExtractor.constructor || this.mermaidNodeExtractor;
        
        return {
            inputCpeeTasks: CPEEExtractor.extract(cpeeStep.getInputCpeeTreeRaw().getContent()),
            inputMermaidTasks: MermaidExtractor.extract(cpeeStep.getInputMermaidRaw().getContent()),
            outputMermaidTasks: MermaidExtractor.extract(cpeeStep.getOutputMermaidRaw().getContent()),
            outputCpeeTasks: CPEEExtractor.extract(cpeeStep.getOutputCpeeTreeRaw().getContent())
        };
    }

    /**
     * Build mapping between all four formats
     */
    buildMapping(inputCpee = [], inputMermaid = [], outputMermaid = [], outputCpee = []) {
        const mapping = new NodeMapping();
        const formats = [
            { key: 'input-cpee', tasks: inputCpee },
            { key: 'input-intermediate', tasks: inputMermaid },
            { key: 'output-intermediate', tasks: outputMermaid },
            { key: 'output-cpee', tasks: outputCpee }
        ];

        // Store every extracted node up front so it remains resolvable even when
        // it has no counterpart in any other section (e.g. a gateway/loop that
        // only exists in the output CPEE tree). addMapping only stores nodes that
        // participate in a mapping, which would otherwise leave such nodes
        // unretrievable and therefore un-highlightable.
        for (const { key, tasks } of formats) {
            for (const task of tasks) {
                mapping.storeTask(task, key);
            }
        }

        // Map between all format pairs
        for (const source of formats) {
            for (const target of formats) {
                if (source.key !== target.key) {
                    this._mapBetweenFormats(source.tasks, target.tasks, source.key, target.key, mapping);
                }
            }
        }
        
        return mapping;
    }

    /**
     * Map tasks between two formats using canonical ID, with text fallback
     */
    _mapBetweenFormats(sourceTasks, targetTasks, sourceFormat, targetFormat, mapping) {
        for (const sourceTask of sourceTasks) {
            const sourceCanonicalId = this._getCanonicalId(sourceTask, sourceFormat);
            if (!sourceCanonicalId) {
                continue;
            }
            
            // Try ID match first
            let match = null;
            for (const targetTask of targetTasks) {
                if (this._getCanonicalId(targetTask, targetFormat) === sourceCanonicalId) {
                    match = targetTask;
                    break;
                }
            }
            
            // Text fallback if no ID match
            if (!match) {
                match = this._findTextMatch(sourceTask, targetTasks, mapping, targetFormat, sourceFormat);
            }
            
            if (match) {
                mapping.addMapping(sourceTask, sourceFormat, match, targetFormat);
            }
        }
    }

    /**
     * Get canonical ID for a node in a format (see getCanonicalNodeId).
     * Tasks: output-cpee → altId, others → id.
     * Gateways: input-cpee → eid + 's', output-cpee → altId, Mermaid → id.
     */
    _getCanonicalId(task, format) {
        return getCanonicalNodeId(task, format);
    }

    /**
     * Find best text match, but don't steal targets that already have ID-based mappings
     */
    _findTextMatch(sourceTask, targetTasks, mapping, targetFormat, sourceFormat) {
        if (!sourceTask?.label) {
            return null;
        }
        
        let bestMatch = null;
        let bestScore = this.TEXT_SIMILARITY_THRESHOLD;
        
        for (const target of targetTasks) {
            if (!target?.label) {
                continue;
            }
            
            // Skip if target already has an ID-based mapping to this source format
            if (mapping.hasIdBasedMapping(target.id, targetFormat, sourceFormat)) {
                continue;
            }
            
            const score = this._textSimilarity(sourceTask.label, target.label);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = target;
            }
        }
        
        return bestMatch;
    }

    /**
     * Calculate text similarity using Jaccard + Jaro-Winkler
     */
    _textSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        if (s1 === s2) {
            return 1.0;
        }
        
        const jaccard = calculateJaccardSimilarity(s1, s2, { minSubsetRatio: 0.6, subsetMatchBoost: 0.25 });
        const jaroWinkler = calculateJaroWinkler(s1, s2);
        return 0.6 * jaccard + 0.4 * jaroWinkler;
    }
}

/**
 * Node Mapping data structure - stores bidirectional mappings between formats
 */
class NodeMapping {
    constructor() {
        // format → taskId → targetFormat → targetTask
        this.mappings = new Map();
        // format → taskId → NodeIdentifier
        this.tasks = new Map();
        // Track which mappings are ID-based: "format:taskId:targetFormat" → boolean
        this.idBasedMappings = new Set();
    }
    
    /**
     * Add bidirectional mapping between two tasks
     * First mapping wins (ID-based mappings are added first)
     */
    addMapping(sourceTask, sourceFormat, targetTask, targetFormat) {
        this.storeTask(sourceTask, sourceFormat);
        this.storeTask(targetTask, targetFormat);
        
        // Check if this is an ID-based mapping (canonical IDs match)
        const sourceCanonicalId = getCanonicalNodeId(sourceTask, sourceFormat);
        const targetCanonicalId = getCanonicalNodeId(targetTask, targetFormat);
        const isIdBased = sourceCanonicalId && targetCanonicalId && sourceCanonicalId === targetCanonicalId;
        
        // Add mapping in both directions (first wins)
        this._addDirectional(sourceTask.id, sourceFormat, targetTask, targetFormat, isIdBased);
        this._addDirectional(targetTask.id, targetFormat, sourceTask, sourceFormat, isIdBased);
    }
    
    _addDirectional(sourceId, sourceFormat, targetTask, targetFormat, isIdBased) {
        if (!this.mappings.has(sourceFormat)) {
            this.mappings.set(sourceFormat, new Map());
        }
        const formatMap = this.mappings.get(sourceFormat);
        
        if (!formatMap.has(sourceId)) {
            formatMap.set(sourceId, new Map());
        }
        const taskMap = formatMap.get(sourceId);
        
        // First mapping wins - don't overwrite
        if (taskMap.has(targetFormat)) {
            return;
        }
        
        taskMap.set(targetFormat, targetTask);
        
        if (isIdBased) {
            this.idBasedMappings.add(`${sourceFormat}:${sourceId}:${targetFormat}`);
        }
    }
    
    hasIdBasedMapping(taskId, format, targetFormat) {
        return this.idBasedMappings.has(`${format}:${taskId}:${targetFormat}`);
    }
    
    storeTask(task, format) {
        if (!this.tasks.has(format)) {
            this.tasks.set(format, new Map());
        }
        this.tasks.get(format).set(task.id, task);
    }
    
    getTask(taskId, format) {
        return this.tasks.get(format)?.get(taskId) || null;
    }
    
    getTasksInFormat(format) {
        return this.tasks.get(format) ? Array.from(this.tasks.get(format).keys()) : [];
    }

    /**
     * Return every node in a format whose canonical id matches. This surfaces
     * duplicates that share a canonical id (e.g. a task/gateway that appears
     * multiple times because a loop was unrolled), which the directional
     * mapping collapses to a single "first wins" target.
     * @param {string} canonicalId - Canonical id to match
     * @param {string} format - Format/section id
     * @param {Function} [predicate] - Optional extra filter on each node
     * @returns {NodeIdentifier[]} Matching nodes (may be empty)
     */
    getTasksByCanonicalId(canonicalId, format, predicate = null) {
        if (!canonicalId) {
            return [];
        }
        const result = [];
        const formatMap = this.tasks.get(format);
        if (!formatMap) {
            return result;
        }
        for (const task of formatMap.values()) {
            if (getCanonicalNodeId(task, format) === canonicalId && (!predicate || predicate(task))) {
                result.push(task);
            }
        }
        return result;
    }
    
    getMappings(sourceTaskId, sourceFormat, targetFormat) {
        const target = this.mappings.get(sourceFormat)?.get(sourceTaskId)?.get(targetFormat);
        return target ? [{ targetTask: target }] : [];
    }
    
    /**
     * Find equivalent tasks in other formats
     */
    findEquivalentTasks(taskId, sourceFormat) {
        const equivalents = {};
        const formats = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        let sourceTask = this.getTask(taskId, sourceFormat);
        
        // Extract base ID from Mermaid SVG IDs like "flowchart-a3:task:-49"
        if (!sourceTask && taskId.includes('-')) {
            const match = taskId.match(/flowchart-([a-z0-9]+)|:([a-z0-9]+):|^([a-z0-9]+):/i);
            if (match) {
                const baseId = match[1] || match[2] || match[3];
                sourceTask = this.getTask(baseId, sourceFormat);
                if (sourceTask) {
                    taskId = baseId;
                }
            }
        }
        
        if (!sourceTask) {
            return equivalents;
        }
        
        for (const targetFormat of formats) {
            if (targetFormat === sourceFormat) {
                continue;
            }
            
            const mappings = this.getMappings(taskId, sourceFormat, targetFormat);
            equivalents[targetFormat] = mappings.map(m => ({ task: m.targetTask, isTransitive: false }));
        }
        
        return equivalents;
    }
    
    // ==================== Gateway Methods ====================
    
    /**
     * Find a gateway in a section by its canonical id (see getCanonicalNodeId).
     * Also matches raw altId/id as a fallback for backwards compatibility.
     * @param {string} canonicalId - Canonical gateway id (e.g. 'e5s')
     * @param {string} sectionId - Section/format id
     * @returns {NodeIdentifier|null} Matching gateway or null
     */
    findGatewayByAltId(canonicalId, sectionId) {
        for (const taskId of this.getTasksInFormat(sectionId)) {
            const task = this.getTask(taskId, sectionId);
            if (task && this._isGateway(task)) {
                const canonical = getCanonicalNodeId(task, sectionId);
                if (canonical === canonicalId || task.altId === canonicalId || task.id === canonicalId) {
                    return task;
                }
            }
        }
        return null;
    }
    
    getGatewaysInSection(sectionId) {
        return this.getTasksInFormat(sectionId)
            .map(id => this.getTask(id, sectionId))
            .filter(task => task && this._isGateway(task));
    }
    
    _isGateway(task) {
        if (!task) {
            return false;
        }
        const gatewayTypes = ['gateway', 'choose', 'parallel', 'loop', 'exclusivegateway', 'parallelgateway', 'decision'];
        if (gatewayTypes.includes(task.type)) {
            return true;
        }
        if (task.metadata?.tagName && ['choose', 'parallel', 'loop'].includes(task.metadata.tagName)) {
            return true;
        }
        if (task.metadata?.shape === 'diamond') {
            return true;
        }
        return false;
    }

    getMappingCount() {
        let count = 0;
        this.mappings.forEach(formatMap => {
            formatMap.forEach(taskMap => {
                count += taskMap.size;
            });
        });
        return count;
    }
    
    toObject() {
        const obj = { tasks: {}, mappings: {} };
        
        this.tasks.forEach((formatMap, format) => {
            obj.tasks[format] = {};
            formatMap.forEach((task, taskId) => {
                obj.tasks[format][taskId] = task.toObject();
            });
        });
        
        this.mappings.forEach((formatMap, sourceFormat) => {
            obj.mappings[sourceFormat] = {};
            formatMap.forEach((taskMap, sourceTaskId) => {
                obj.mappings[sourceFormat][sourceTaskId] = {};
                taskMap.forEach((targetTask, targetFormat) => {
                    obj.mappings[sourceFormat][sourceTaskId][targetFormat] = [{ targetTaskId: targetTask.id }];
                });
            });
        });
        
        return obj;
    }
    
    static fromObject(obj) {
        const mapping = new NodeMapping();
        
        Object.entries(obj.tasks || {}).forEach(([format, formatTasks]) => {
            Object.entries(formatTasks).forEach(([_taskId, taskData]) => {
                mapping.storeTask(NodeIdentifier.fromObject(taskData), format);
            });
        });
        
        Object.entries(obj.mappings || {}).forEach(([sourceFormat, formatMap]) => {
            Object.entries(formatMap).forEach(([sourceTaskId, taskMap]) => {
                Object.entries(taskMap).forEach(([targetFormat, mappingList]) => {
                    mappingList.forEach(mappingData => {
                        const targetTask = mapping.getTask(mappingData.targetTaskId, targetFormat);
                        if (targetTask) {
                            mapping._addDirectional(sourceTaskId, sourceFormat, targetTask, targetFormat, false);
                        }
                    });
                });
            });
        });
        
        return mapping;
    }
}

export { NodeMapping };
