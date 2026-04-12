/**
 * Node Mapping Service
 * Maps nodes between four formats using canonical IDs.
 * 
 * CANONICAL ID RULE:
 * Input CPEE.id = Input Mermaid.id = Output Mermaid.id = Output CPEE.altId
 * 
 * Text similarity fallback when ID matching fails.
 */

import { NodeIdentifier } from '../models/NodeIdentifier.js';
import { calculateJaccardSimilarity, calculateJaroWinkler } from '../utils/similarity/StringSimilarity.js';

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
     * Get canonical ID: altId for output-cpee, id for all others
     */
    _getCanonicalId(task, format) {
        if (!task) {
            return null;
        }
        return format === 'output-cpee' ? (task.altId || null) : (task.id || null);
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
        const sourceCanonicalId = sourceFormat === 'output-cpee' ? sourceTask.altId : sourceTask.id;
        const targetCanonicalId = targetFormat === 'output-cpee' ? targetTask.altId : targetTask.id;
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
    
    findGatewayByAltId(altId, sectionId) {
        for (const taskId of this.getTasksInFormat(sectionId)) {
            const task = this.getTask(taskId, sectionId);
            if (task && this._isGateway(task) && (task.altId === altId || task.id === altId)) {
                return task;
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
