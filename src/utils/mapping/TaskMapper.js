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
        
        // Phase 1: Map input CPEE to input Mermaid (using id)
        this.mapBetweenFormats(inputCpee, inputMermaid, 'input-cpee', 'input-intermediate', mapping);
        
        // Phase 2: Map output Mermaid to output CPEE (using alt_id - Mermaid.id to CPEE.altId)
        this.mapBetweenFormats(outputMermaid, outputCpee, 'output-intermediate', 'output-cpee', mapping);
        
        // Phase 3: Map output CPEE to input CPEE (using alt_id)
        this.mapBetweenFormats(outputCpee, inputCpee, 'output-cpee', 'input-cpee', mapping);
        
        // Phase 4: Map output CPEE to output Intermediate (using alt_id - already done in Phase 2 via reverse)
        // Note: Output CPEE → Output Intermediate is already bidirectional from Phase 2
        
        // Phase 5: Map input CPEE to output Intermediate (using alt_id - Input CPEE.altId → Output Intermediate.id)
        // This is needed because Input Intermediate and Output Intermediate have different IDs
        this.mapBetweenFormats(inputCpee, outputMermaid, 'input-cpee', 'output-intermediate', mapping);
        
        // Phase 6: Create transitive mappings (input CPEE → output CPEE, input-intermediate → output-intermediate, etc.)
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
        
        // Determine which field to use for matching based on format pair
        const matchField = this.getMatchField(sourceFormat, targetFormat);
        console.log(`[TaskMapper] Using match field: ${matchField} for ${sourceFormat} → ${targetFormat}`);
        
        let exactMatches = 0;
        let noMatches = 0;
        
        sourceTasks.forEach(sourceTask => {
            // Find match using the appropriate field
            const match = this.findMatch(sourceTask, targetTasks, matchField, sourceFormat, targetFormat);
            
            if (match) {
                exactMatches++;
                const sourceValue = matchField === 'id' ? sourceTask.id : sourceTask.altId;
                console.log(`[TaskMapper] ${matchField} match: "${sourceValue}" → "${match.id}"`);
                mapping.addMapping(sourceTask, sourceFormat, match, targetFormat);
            } else {
                noMatches++;
                const sourceValue = matchField === 'id' ? sourceTask.id : sourceTask.altId;
                console.log(`[TaskMapper] No match found for ${matchField}: "${sourceValue}" (label: "${sourceTask.label}")`);
            }
        });
        
        console.log(`[TaskMapper] ${sourceFormat} → ${targetFormat}: ${exactMatches} exact, ${noMatches} no match`);
    }
    
    /**
     * Determine which field to use for matching based on format pair
     * Rules:
     * - input-cpee → input-intermediate: use id
     * - output-cpee → input-cpee: use alt_id
     * - output-cpee → output-intermediate: use alt_id
     * - output-intermediate → output-cpee: match Mermaid id to CPEE alt_id
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     * @returns {string} 'id' or 'alt_id'
     */
    getMatchField(sourceFormat, targetFormat) {
        // Input CPEE → Input Intermediate: use id
        if (sourceFormat === 'input-cpee' && targetFormat === 'input-intermediate') {
            return 'id';
        }
        
        // Output CPEE → Input CPEE: use alt_id
        if (sourceFormat === 'output-cpee' && targetFormat === 'input-cpee') {
            return 'alt_id';
        }
        
        // Output CPEE → Output Intermediate: use alt_id
        if (sourceFormat === 'output-cpee' && targetFormat === 'output-intermediate') {
            return 'alt_id';
        }
        
        // Output Intermediate → Output CPEE: match Mermaid id to CPEE alt_id
        if (sourceFormat === 'output-intermediate' && targetFormat === 'output-cpee') {
            return 'alt_id'; // Match Mermaid.id to CPEE.altId
        }
        
        // Input CPEE → Output Intermediate: use alt_id (Input CPEE.altId → Output Intermediate.id)
        if (sourceFormat === 'input-cpee' && targetFormat === 'output-intermediate') {
            return 'alt_id';
        }
        
        // Input Mermaid → Output Mermaid: use id (for continuity, though they may differ)
        // Note: This may not work if IDs are different (e.g., "a1" vs "1"), but we try it
        if (sourceFormat === 'input-intermediate' && targetFormat === 'output-intermediate') {
            return 'id';
        }
        
        // Default: use id for backward compatibility
        return 'id';
    }
    
    /**
     * Find match using specified field
     * @param {TaskIdentifier} sourceTask - Source task
     * @param {TaskIdentifier[]} targetTasks - Target tasks to search
     * @param {string} matchField - Field to match on ('id' or 'alt_id')
     * @param {string} sourceFormat - Source format (for determining match direction)
     * @param {string} targetFormat - Target format (for determining match direction)
     * @returns {TaskIdentifier|null} Matching task or null
     */
    findMatch(sourceTask, targetTasks, matchField, sourceFormat, targetFormat) {
        if (matchField === 'alt_id') {
            // Determine matching direction based on format types
            const sourceIsCpee = sourceFormat.includes('cpee');
            const targetIsCpee = targetFormat.includes('cpee');
            const targetIsMermaid = targetFormat.includes('intermediate');
            
            if (sourceIsCpee && targetIsMermaid) {
                // CPEE → Mermaid: match CPEE.altId to Mermaid.id
                if (!sourceTask.altId) {
                    return null;
                }
                const match = targetTasks.find(t => t.id === sourceTask.altId);
                return match || null;
            } else if (sourceIsCpee && targetIsCpee) {
                // CPEE → CPEE: match alt_id to alt_id
                if (!sourceTask.altId) {
                    return null;
                }
                const match = targetTasks.find(t => t.altId === sourceTask.altId);
                return match || null;
            } else if (targetIsCpee) {
                // Mermaid → CPEE: match Mermaid.id to CPEE.altId
                const match = targetTasks.find(t => t.altId === sourceTask.id);
                return match || null;
            } else {
                // Fallback: try matching sourceTask.altId to targetTask.id
                if (!sourceTask.altId) {
                    return null;
                }
                const match = targetTasks.find(t => t.id === sourceTask.altId);
                return match || null;
            }
        } else {
            // Match sourceTask.id to targetTask.id
            const match = targetTasks.find(t => t.id === sourceTask.id);
            return match || null;
        }
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
            
            // Traverse through intermediates
            for (const intermediateFormat of intermediateFormats) {
                const nextMappings = mapping.getMappings(currentTaskId, currentFormat, intermediateFormat);
                
                if (nextMappings.length === 0) {
                    return; // Chain broken, no transitive mapping possible
                }
                
                // Take first mapping
                const nextMapping = nextMappings[0];
                currentTaskId = nextMapping.targetTask.id;
                currentFormat = intermediateFormat;
            }
            
            // Now map to final target
            const finalMappings = mapping.getMappings(currentTaskId, currentFormat, targetFormat);
            
            if (finalMappings.length > 0) {
                const finalMapping = finalMappings[0];
                
                // Add transitive mapping
                const sourceTask = mapping.getTask(sourceTaskId, sourceFormat);
                const targetTask = finalMapping.targetTask;
                
                if (sourceTask && targetTask) {
                    mapping.addMapping(sourceTask, sourceFormat, targetTask, targetFormat, true);
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
     * @param {boolean} isTransitive - Whether this is a transitive mapping
     */
    addMapping(sourceTask, sourceFormat, targetTask, targetFormat, isTransitive = false) {
        // Store tasks
        this.storeTask(sourceTask, sourceFormat);
        this.storeTask(targetTask, targetFormat);
        
        // Create bidirectional mapping
        this.addDirectionalMapping(sourceTask.id, sourceFormat, targetTask, targetFormat, isTransitive);
        this.addDirectionalMapping(targetTask.id, targetFormat, sourceTask, sourceFormat, isTransitive);
    }
    
    /**
     * Add a directional mapping
     * @param {string} sourceTaskId - Source task ID
     * @param {string} sourceFormat - Source format
     * @param {TaskIdentifier} targetTask - Target task
     * @param {string} targetFormat - Target format
     * @param {boolean} isTransitive - Whether transitive
     */
    addDirectionalMapping(sourceTaskId, sourceFormat, targetTask, targetFormat, isTransitive) {
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
            // Update existing mapping (prefer non-transitive over transitive)
            if (!isTransitive || mappingList[existingIndex].isTransitive) {
                mappingList[existingIndex] = { targetTask, isTransitive };
            }
        } else {
            // Add new mapping
            mappingList.push({ targetTask, isTransitive });
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
     * @param {string} taskId - Task ID (from clicked element, should be the task's id field)
     * @param {string} sourceFormat - Source format
     * @returns {Object} Object with format keys and arrays of equivalent tasks
     */
    findEquivalentTasks(taskId, sourceFormat) {
        const equivalents = {};
        const formats = ['input-cpee', 'input-intermediate', 'output-intermediate', 'output-cpee'];
        
        console.log(`[TaskMapping] findEquivalentTasks: looking for taskId="${taskId}" in format="${sourceFormat}"`);
        
        // Get the actual TaskIdentifier object to verify it exists
        const sourceTask = this.getTask(taskId, sourceFormat);
        if (!sourceTask) {
            console.warn(`[TaskMapping] Task "${taskId}" not found in format "${sourceFormat}"`);
            return equivalents;
        }
        
        console.log(`[TaskMapping] Found source task: id="${sourceTask.id}", altId="${sourceTask.altId || 'none'}", label="${sourceTask.label}"`);
        
        formats.forEach(targetFormat => {
            if (targetFormat !== sourceFormat) {
                // Look up mappings using the task's id (mappings are stored by id)
                const mappings = this.getMappings(taskId, sourceFormat, targetFormat);
                
                console.log(`[TaskMapping]   ${sourceFormat} → ${targetFormat}: found ${mappings.length} mapping(s)`);
                mappings.forEach(m => {
                    console.log(`[TaskMapping]     → ${m.targetTask.id} (${m.targetTask.label})${m.isTransitive ? ' [transitive]' : ''}`);
                });
                
                equivalents[targetFormat] = mappings.map(m => ({
                    task: m.targetTask,
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
            Object.entries(formatTasks).forEach(([_taskId, taskData]) => {
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

