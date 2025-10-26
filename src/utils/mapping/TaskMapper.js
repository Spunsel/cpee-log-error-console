/**
 * Task Mapper
 * Maps equivalent tasks across different formats (CPEE XML, Mermaid syntax)
 * Uses exact ID matching to identify equivalent tasks
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class TaskMapper {
    
    constructor() {
        console.log('[TaskMapper] Initialized');
    }
    
    /**
     * Build mapping between tasks in all four formats
     * @param {TaskIdentifier[]} inputCpee - Tasks from input CPEE tree
     * @param {TaskIdentifier[]} inputMermaid - Tasks from input Mermaid
     * @param {TaskIdentifier[]} outputMermaid - Tasks from output Mermaid
     * @param {TaskIdentifier[]} outputCpee - Tasks from output CPEE tree
     * @returns {TaskMapping} Mapping object with bidirectional links
     */
    buildMapping(inputCpee = [], inputMermaid = [], outputMermaid = [], outputCpee = []) {
        console.log('[TaskMapper] Building mapping across formats...');
        console.log(`[TaskMapper] Input counts: CPEE=${inputCpee.length}, Mermaid=${inputMermaid.length}`);
        console.log(`[TaskMapper] Output counts: CPEE=${outputCpee.length}, Mermaid=${outputMermaid.length}`);
        
        const mapping = new TaskMapping();
        
        // Phase 1: Map input CPEE to input Mermaid
        this.mapBetweenFormats(inputCpee, inputMermaid, 'input-cpee', 'input-intermediate', mapping);
        
        // Phase 2: Map input Mermaid to output Mermaid
        this.mapBetweenFormats(inputMermaid, outputMermaid, 'input-intermediate', 'output-intermediate', mapping);
        
        // Phase 3: Map output Mermaid to output CPEE
        this.mapBetweenFormats(outputMermaid, outputCpee, 'output-intermediate', 'output-cpee', mapping);
        
        // Phase 4: Create transitive mappings (input CPEE → output CPEE, etc.)
        this.createTransitiveMappings(mapping);
        
        console.log('[TaskMapper] Mapping complete. Total mappings:', mapping.getMappingCount());
        mapping.logMappingSummary();
        
        return mapping;
    }
    
    /**
     * Map tasks between two formats
     * @param {TaskIdentifier[]} sourceTasks - Tasks from source format
     * @param {TaskIdentifier[]} targetTasks - Tasks from target format
     * @param {string} sourceFormat - Source format key (e.g., 'input-cpee')
     * @param {string} targetFormat - Target format key (e.g., 'input-intermediate')
     * @param {TaskMapping} mapping - Mapping object to populate
     */
    mapBetweenFormats(sourceTasks, targetTasks, sourceFormat, targetFormat, mapping) {
        console.log(`[TaskMapper] Mapping ${sourceFormat} → ${targetFormat}...`);
        
        let exactMatches = 0;
        let noMatches = 0;
        
        sourceTasks.forEach(sourceTask => {
            // Try exact match by ID only
            const match = this.findExactMatch(sourceTask, targetTasks);
            const confidence = 1.0;
            
            if (match) {
                exactMatches++;
                console.log(`[TaskMapper] ID match: "${sourceTask.id}" → "${match.id}"`);
                mapping.addMapping(sourceTask, sourceFormat, match, targetFormat, confidence);
            } else {
                noMatches++;
                console.log(`[TaskMapper] No match found for ID: "${sourceTask.id}" (label: "${sourceTask.label}")`);
            }
        });
        
        console.log(`[TaskMapper] ${sourceFormat} → ${targetFormat}: ${exactMatches} exact, ${noMatches} no match`);
    }
    
    /**
     * Find exact match by ID only
     * @param {TaskIdentifier} sourceTask - Source task
     * @param {TaskIdentifier[]} targetTasks - Target tasks to search
     * @returns {TaskIdentifier|null} Matching task or null
     */
    findExactMatch(sourceTask, targetTasks) {
        // Match by ID only (case-sensitive)
        const match = targetTasks.find(t => t.id === sourceTask.id);
        return match || null;
    }
    
    /**
     * Create transitive mappings (A→B, B→C implies A→C)
     * @param {TaskMapping} mapping - Mapping object
     */
    createTransitiveMappings(mapping) {
        console.log('[TaskMapper] Creating transitive mappings...');
        
        const formats = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        // For each pair of formats, find transitive paths
        for (let i = 0; i < formats.length; i++) {
            for (let j = i + 2; j < formats.length; j++) {
                const sourceFormat = formats[i];
                const targetFormat = formats[j];
                
                // Find intermediate paths
                const intermediateMappings = [];
                for (let k = i + 1; k < j; k++) {
                    intermediateMappings.push(formats[k]);
                }
                
                // Create transitive mappings
                this.addTransitiveMappings(sourceFormat, targetFormat, intermediateMappings, mapping);
            }
        }
        
        console.log('[TaskMapper] Transitive mappings created');
    }
    
    /**
     * Add transitive mappings between source and target through intermediates
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     * @param {string[]} intermediateFormats - Intermediate formats
     * @param {TaskMapping} mapping - Mapping object
     */
    addTransitiveMappings(sourceFormat, targetFormat, intermediateFormats, mapping) {
        // Get all mappings from source
        const sourceMappings = mapping.getTasksInFormat(sourceFormat);
        
        sourceMappings.forEach(sourceTaskId => {
            // Follow the chain through intermediates
            let currentTaskId = sourceTaskId;
            let currentFormat = sourceFormat;
            let minConfidence = 1.0;
            
            // Traverse through intermediates
            for (const intermediateFormat of intermediateFormats) {
                const nextMappings = mapping.getMappings(currentTaskId, currentFormat, intermediateFormat);
                
                if (nextMappings.length === 0) {
                    return; // Chain broken, no transitive mapping possible
                }
                
                // Take first (best) mapping
                const nextMapping = nextMappings[0];
                currentTaskId = nextMapping.targetTask.id;
                currentFormat = intermediateFormat;
                minConfidence = Math.min(minConfidence, nextMapping.confidence);
            }
            
            // Now map to final target
            const finalMappings = mapping.getMappings(currentTaskId, currentFormat, targetFormat);
            
            if (finalMappings.length > 0) {
                const finalMapping = finalMappings[0];
                minConfidence = Math.min(minConfidence, finalMapping.confidence);
                
                // Add transitive mapping
                const sourceTask = mapping.getTask(sourceTaskId, sourceFormat);
                const targetTask = finalMapping.targetTask;
                
                if (sourceTask && targetTask) {
                    mapping.addMapping(sourceTask, sourceFormat, targetTask, targetFormat, minConfidence, true);
                    console.log(`[TaskMapper] Transitive: ${sourceFormat}:${sourceTask.id} → ${targetFormat}:${targetTask.id}`);
                }
            }
        });
    }
}

/**
 * Task Mapping data structure
 * Stores bidirectional mappings between tasks in different formats
 */
class TaskMapping {
    constructor() {
        // Map structure: sourceFormat → sourceTaskId → targetFormat → [mappings]
        this.mappings = new Map();
        
        // Task storage: format → taskId → TaskIdentifier
        this.tasks = new Map();
    }
    
    /**
     * Add a mapping between two tasks
     * @param {TaskIdentifier} sourceTask - Source task
     * @param {string} sourceFormat - Source format key
     * @param {TaskIdentifier} targetTask - Target task
     * @param {string} targetFormat - Target format key
     * @param {number} confidence - Confidence score (0-1)
     * @param {boolean} isTransitive - Whether this is a transitive mapping
     */
    addMapping(sourceTask, sourceFormat, targetTask, targetFormat, confidence = 1.0, isTransitive = false) {
        // Store tasks
        this.storeTask(sourceTask, sourceFormat);
        this.storeTask(targetTask, targetFormat);
        
        // Create bidirectional mapping
        this.addDirectionalMapping(sourceTask.id, sourceFormat, targetTask, targetFormat, confidence, isTransitive);
        this.addDirectionalMapping(targetTask.id, targetFormat, sourceTask, sourceFormat, confidence, isTransitive);
    }
    
    /**
     * Add a directional mapping
     * @param {string} sourceTaskId - Source task ID
     * @param {string} sourceFormat - Source format
     * @param {TaskIdentifier} targetTask - Target task
     * @param {string} targetFormat - Target format
     * @param {number} confidence - Confidence score
     * @param {boolean} isTransitive - Whether transitive
     */
    addDirectionalMapping(sourceTaskId, sourceFormat, targetTask, targetFormat, confidence, isTransitive) {
        if (!this.mappings.has(sourceFormat)) {
            this.mappings.set(sourceFormat, new Map());
        }
        
        const formatMap = this.mappings.get(sourceFormat);
        
        if (!formatMap.has(sourceTaskId)) {
            formatMap.set(sourceTaskId, new Map());
        }
        
        const taskMap = formatMap.get(sourceTaskId);
        
        if (!taskMap.has(targetFormat)) {
            taskMap.set(targetFormat, []);
        }
        
        const mappingList = taskMap.get(targetFormat);
        
        // Check if mapping already exists
        const existingIndex = mappingList.findIndex(m => 
            m.targetTask.id === targetTask.id
        );
        
        if (existingIndex >= 0) {
            // Update if new confidence is higher
            if (confidence > mappingList[existingIndex].confidence) {
                mappingList[existingIndex] = { targetTask, confidence, isTransitive };
            }
        } else {
            // Add new mapping
            mappingList.push({ targetTask, confidence, isTransitive });
            
            // Sort by confidence (highest first)
            mappingList.sort((a, b) => b.confidence - a.confidence);
        }
    }
    
    /**
     * Store a task
     * @param {TaskIdentifier} task - Task to store
     * @param {string} format - Format key
     */
    storeTask(task, format) {
        if (!this.tasks.has(format)) {
            this.tasks.set(format, new Map());
        }
        
        this.tasks.get(format).set(task.id, task);
    }
    
    /**
     * Get task by ID and format
     * @param {string} taskId - Task ID
     * @param {string} format - Format key
     * @returns {TaskIdentifier|null} Task or null
     */
    getTask(taskId, format) {
        const formatMap = this.tasks.get(format);
        return formatMap ? formatMap.get(taskId) || null : null;
    }
    
    /**
     * Get all tasks in a format
     * @param {string} format - Format key
     * @returns {string[]} Array of task IDs
     */
    getTasksInFormat(format) {
        const formatMap = this.tasks.get(format);
        return formatMap ? Array.from(formatMap.keys()) : [];
    }
    
    /**
     * Get mappings from source task to target format
     * @param {string} sourceTaskId - Source task ID
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     * @returns {Array} Array of mapping objects
     */
    getMappings(sourceTaskId, sourceFormat, targetFormat) {
        const formatMap = this.mappings.get(sourceFormat);
        if (!formatMap) {
            return [];
        }
        
        const taskMap = formatMap.get(sourceTaskId);
        if (!taskMap) {
            return [];
        }
        
        return taskMap.get(targetFormat) || [];
    }
    
    /**
     * Find equivalent tasks in other formats
     * @param {string} taskId - Task ID
     * @param {string} sourceFormat - Source format
     * @returns {Object} Object with format keys and arrays of equivalent tasks
     */
    findEquivalentTasks(taskId, sourceFormat) {
        const equivalents = {};
        const formats = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        formats.forEach(targetFormat => {
            if (targetFormat !== sourceFormat) {
                const mappings = this.getMappings(taskId, sourceFormat, targetFormat);
                equivalents[targetFormat] = mappings.map(m => ({
                    task: m.targetTask,
                    confidence: m.confidence,
                    isTransitive: m.isTransitive
                }));
            }
        });
        
        return equivalents;
    }
    
    /**
     * Get total mapping count
     * @returns {number} Total number of mappings
     */
    getMappingCount() {
        let count = 0;
        
        this.mappings.forEach(formatMap => {
            formatMap.forEach(taskMap => {
                taskMap.forEach(mappingList => {
                    count += mappingList.length;
                });
            });
        });
        
        return count;
    }
    
    /**
     * Log mapping summary
     */
    logMappingSummary() {
        console.log('[TaskMapping] === Mapping Summary ===');
        
        const formats = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        formats.forEach(sourceFormat => {
            const taskCount = this.getTasksInFormat(sourceFormat).length;
            console.log(`[TaskMapping] ${sourceFormat}: ${taskCount} tasks`);
            
            formats.forEach(targetFormat => {
                if (sourceFormat !== targetFormat) {
                    let mappingCount = 0;
                    
                    this.getTasksInFormat(sourceFormat).forEach(taskId => {
                        const mappings = this.getMappings(taskId, sourceFormat, targetFormat);
                        mappingCount += mappings.length;
                    });
                    
                    if (mappingCount > 0) {
                        console.log(`[TaskMapping]   → ${targetFormat}: ${mappingCount} mappings`);
                    }
                }
            });
        });
    }
    
    /**
     * Convert to plain object for serialization
     * @returns {Object} Plain object representation
     */
    toObject() {
        const obj = {
            tasks: {},
            mappings: {}
        };
        
        // Serialize tasks
        this.tasks.forEach((formatMap, format) => {
            obj.tasks[format] = {};
            formatMap.forEach((task, taskId) => {
                obj.tasks[format][taskId] = task.toObject();
            });
        });
        
        // Serialize mappings
        this.mappings.forEach((formatMap, sourceFormat) => {
            obj.mappings[sourceFormat] = {};
            formatMap.forEach((taskMap, sourceTaskId) => {
                obj.mappings[sourceFormat][sourceTaskId] = {};
                taskMap.forEach((mappingList, targetFormat) => {
                    obj.mappings[sourceFormat][sourceTaskId][targetFormat] = mappingList.map(m => ({
                        targetTaskId: m.targetTask.id,
                        confidence: m.confidence,
                        isTransitive: m.isTransitive
                    }));
                });
            });
        });
        
        return obj;
    }
    
    /**
     * Create TaskMapping from plain object
     * @param {Object} obj - Plain object
     * @returns {TaskMapping} New TaskMapping instance
     */
    static fromObject(obj) {
        const mapping = new TaskMapping();
        
        // Restore tasks
        Object.entries(obj.tasks || {}).forEach(([format, formatTasks]) => {
            Object.entries(formatTasks).forEach(([taskId, taskData]) => {
                const task = TaskIdentifier.fromObject(taskData);
                mapping.storeTask(task, format);
            });
        });
        
        // Restore mappings
        Object.entries(obj.mappings || {}).forEach(([sourceFormat, formatMap]) => {
            Object.entries(formatMap).forEach(([sourceTaskId, taskMap]) => {
                Object.entries(taskMap).forEach(([targetFormat, mappingList]) => {
                    mappingList.forEach(mappingData => {
                        const targetTask = mapping.getTask(mappingData.targetTaskId, targetFormat);
                        if (targetTask) {
                            mapping.addDirectionalMapping(
                                sourceTaskId,
                                sourceFormat,
                                targetTask,
                                targetFormat,
                                mappingData.confidence,
                                mappingData.isTransitive
                            );
                        }
                    });
                });
            });
        });
        
        return mapping;
    }
}

export { TaskMapping };

