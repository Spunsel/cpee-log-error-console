/**
 * Task Mapper
 * Maps equivalent tasks across different formats (CPEE XML, Mermaid syntax)
 * Uses exact ID matching to identify equivalent tasks
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class TaskMapper {
    
    constructor() {
        this.TEXT_SIMILARITY_THRESHOLD = 0.7;
    }
    
    /**
     * Calculate string similarity between two strings using normalized Levenshtein distance
     * Returns a value between 0 (no similarity) and 1 (identical)
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score (0-1)
     */
    calculateTextSimilarity(str1, str2) {
        if (!str1 || !str2) {
            return 0;
        }
        
        // Normalize strings
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        
        // Exact match
        if (s1 === s2) {
            return 1.0;
        }
        
        // Calculate Levenshtein distance
        const distance = this.levenshteinDistance(s1, s2);
        const maxLength = Math.max(s1.length, s2.length);
        
        if (maxLength === 0) {
            return 1.0;
        }
        
        // Normalize to 0-1 range (1 = identical, 0 = completely different)
        return 1 - (distance / maxLength);
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Edit distance
     */
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        // Initialize base cases
        for (let i = 0; i <= m; i++) {
            dp[i][0] = i;
        }
        for (let j = 0; j <= n; j++) {
            dp[0][j] = j;
        }
        
        // Fill the DP table
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,     // deletion
                        dp[i][j - 1] + 1,     // insertion
                        dp[i - 1][j - 1] + 1  // substitution
                    );
                }
            }
        }
        
        return dp[m][n];
    }
    
    /**
     * Find best text match in target tasks
     * @param {TaskIdentifier} sourceTask - Source task
     * @param {TaskIdentifier[]} targetTasks - Target tasks to search
     * @returns {TaskIdentifier|null} Best matching task or null if no match above threshold
     */
    findBestTextMatch(sourceTask, targetTasks) {
        if (!sourceTask || !sourceTask.label || targetTasks.length === 0) {
            return null;
        }
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const targetTask of targetTasks) {
            if (!targetTask || !targetTask.label) {
                continue;
            }
            
            const similarity = this.calculateTextSimilarity(sourceTask.label, targetTask.label);
            
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = targetTask;
            }
        }
        
        // Only return if above threshold
        if (bestScore >= this.TEXT_SIMILARITY_THRESHOLD) {
            return bestMatch;
        }
        
        return null;
    }
    
    /**
     * Build mapping between tasks in all four formats
     * Rules:
     * - Input intermediate only has id, so mapping TO it uses id from input-cpee
     * - All other mappings use alt_id primarily
     * - Fallback: try id + alt_id combinations if primary fails
     * @param {TaskIdentifier[]} inputCpee - Tasks from input CPEE tree
     * @param {TaskIdentifier[]} inputMermaid - Tasks from input Mermaid
     * @param {TaskIdentifier[]} outputMermaid - Tasks from output Mermaid
     * @param {TaskIdentifier[]} outputCpee - Tasks from output CPEE tree
     * @returns {TaskMapping} Mapping object with bidirectional links
     */
    buildMapping(inputCpee = [], inputMermaid = [], outputMermaid = [], outputCpee = []) {
        const mapping = new TaskMapping();
        const formats = [
            { key: 'input-cpee', tasks: inputCpee },
            { key: 'input-intermediate', tasks: inputMermaid },
            { key: 'output-intermediate', tasks: outputMermaid },
            { key: 'output-cpee', tasks: outputCpee }
        ];
        
        // Map between all format pairs
        for (let i = 0; i < formats.length; i++) {
            for (let j = 0; j < formats.length; j++) {
                if (i !== j) {
                    this.mapBetweenFormats(
                        formats[i].tasks,
                        formats[j].tasks,
                        formats[i].key,
                        formats[j].key,
                        mapping,
                        inputCpee,  // Pass CPEE tasks for transitive lookups
                        outputCpee
                    );
                }
            }
        }
        
        // Create transitive mappings to fill gaps
        this.createTransitiveMappings(mapping);
        
        return mapping;
    }
    
    /**
     * Map tasks between two formats
     * Rules:
     * - If target is input-intermediate: use id matching (only from input-cpee)
     * - Otherwise: use alt_id matching primarily, fallback to id + alt_id combinations
     * @param {TaskIdentifier[]} sourceTasks - Tasks from source format
     * @param {TaskIdentifier[]} targetTasks - Tasks from target format
     * @param {string} sourceFormat - Source format key (e.g., 'input-cpee')
     * @param {string} targetFormat - Target format key (e.g., 'input-intermediate')
     * @param {TaskMapping} mapping - Mapping object to populate
     * @param {TaskIdentifier[]} inputCpeeTasks - Input CPEE tasks (for transitive lookups)
     * @param {TaskIdentifier[]} outputCpeeTasks - Output CPEE tasks (for transitive lookups)
     */
    mapBetweenFormats(sourceTasks, targetTasks, sourceFormat, targetFormat, mapping, inputCpeeTasks = [], outputCpeeTasks = []) {
        sourceTasks.forEach(sourceTask => {
            let match = this.findMatch(
                sourceTask, 
                targetTasks, 
                sourceFormat, 
                targetFormat, 
                mapping, 
                inputCpeeTasks, 
                outputCpeeTasks
            );
            
            // Validate ID-based match with text similarity
            if (match) {
                const textSimilarity = this.calculateTextSimilarity(sourceTask.label, match.label);
                
                if (textSimilarity < this.TEXT_SIMILARITY_THRESHOLD) {
                    // ID match found but text doesn't match - reject and try text matching
                    // Try text-based matching instead
                    const textMatch = this.findBestTextMatch(sourceTask, targetTasks);
                    if (textMatch) {
                        match = textMatch;
                    } else {
                        match = null;
                    }
                }
            } else {
                // No ID match found - try text-based matching as fallback
                match = this.findBestTextMatch(sourceTask, targetTasks);
            }
            
            if (match) {
                mapping.addMapping(sourceTask, sourceFormat, match, targetFormat);
            }
        });
    }
    
    /**
     * Find match between source task and target tasks
     * Rules:
     * - If target is input-intermediate: use id matching (input-cpee.id → input-intermediate.id)
     * - All other cases: use alt_id primarily, then fallback to id + alt_id combinations
     * - For Mermaid → Mermaid: try matching via CPEE if direct match fails
     * @param {TaskIdentifier} sourceTask - Source task
     * @param {TaskIdentifier[]} targetTasks - Target tasks to search
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     * @param {TaskMapping} mapping - Mapping object (for transitive lookups)
     * @param {TaskIdentifier[]} inputCpeeTasks - Input CPEE tasks (for transitive lookups)
     * @param {TaskIdentifier[]} outputCpeeTasks - Output CPEE tasks (for transitive lookups)
     * @returns {TaskIdentifier|null} Matching task or null
     */
    findMatch(sourceTask, targetTasks, sourceFormat, targetFormat, mapping = null, inputCpeeTasks = [], outputCpeeTasks = []) {
        const targetIsInputIntermediate = targetFormat === 'input-intermediate';
        const sourceIsInputCpee = sourceFormat === 'input-cpee';
        
        // SPECIAL CASE: Mapping TO input-intermediate should only use id from input-cpee
        if (targetIsInputIntermediate && sourceIsInputCpee) {
            // Use id matching: input-cpee.id → input-intermediate.id
            const match = targetTasks.find(t => t.id === sourceTask.id);
            if (match) {
                return match;
            }
            // No fallback for this case - input-intermediate only has id
            return null;
        }
        
        // ALL OTHER CASES: Use alt_id primarily, then fallback to id + alt_id combinations
        
        const sourceIsCpee = sourceFormat.includes('cpee');
        const targetIsCpee = targetFormat.includes('cpee');
        const sourceIsMermaid = sourceFormat.includes('intermediate');
        const targetIsMermaid = targetFormat.includes('intermediate');
        
        // PRIORITY 1: Try alt_id matching (primary logic for all other graphs)
        if (sourceIsCpee && targetIsMermaid) {
            // CPEE → Mermaid: match CPEE.altId to Mermaid.id
            if (sourceTask.altId) {
                const match = targetTasks.find(t => t.id === sourceTask.altId);
                if (match) {
                    return match;
                }
            }
        } else if (sourceIsCpee && targetIsCpee) {
            // CPEE → CPEE: match alt_id to alt_id
            if (sourceTask.altId) {
                const match = targetTasks.find(t => t.altId === sourceTask.altId);
                if (match) {
                    return match;
                }
            }
        } else if (targetIsCpee) {
            // Mermaid → CPEE: match Mermaid.id to CPEE.altId
            const match = targetTasks.find(t => t.altId === sourceTask.id);
            if (match) {
                return match;
            }
        } else if (sourceIsCpee) {
            // CPEE → Other Mermaid: match CPEE.altId to Mermaid.id
            if (sourceTask.altId) {
                const match = targetTasks.find(t => t.id === sourceTask.altId);
                if (match) {
                    return match;
                }
            }
        } else if (targetIsMermaid && sourceIsMermaid) {
            // Mermaid → Mermaid: try matching id to id (they might have same ids)
            let match = targetTasks.find(t => t.id === sourceTask.id);
            if (match) {
                return match;
            }
            
            // EDGE CASE: If direct id match fails, try matching via CPEE
            // Input Mermaid might use id="a1" (matches input CPEE.id)
            // Output Mermaid might use id="1" (matches input CPEE.alt_id)
            // Solution: Find corresponding CPEE task, use its alt_id to match output Mermaid
            if (sourceFormat === 'input-intermediate' && targetFormat === 'output-intermediate') {
                // Try using mapping if available (may not exist during initial mapping phase)
                if (mapping) {
                    const inputCpeeMappings = mapping.getMappings(sourceTask.id, 'input-intermediate', 'input-cpee');
                    if (inputCpeeMappings.length > 0) {
                        const inputCpeeTask = inputCpeeMappings[0].targetTask;
                        // Use Input CPEE's alt_id to match Output Mermaid's id
                        if (inputCpeeTask.altId) {
                            match = targetTasks.find(t => t.id === inputCpeeTask.altId);
                            if (match) {
                                return match;
                            }
                        }
                    }
                }
                
                // Fallback: Direct lookup in inputCpeeTasks array (works during initial mapping)
                // Input Mermaid id="a1" should match Input CPEE id="a1"
                const inputCpeeTask = inputCpeeTasks.find(t => t.id === sourceTask.id);
                if (inputCpeeTask && inputCpeeTask.altId) {
                    // Use Input CPEE's alt_id to match Output Mermaid's id
                    match = targetTasks.find(t => t.id === inputCpeeTask.altId);
                    if (match) {
                        return match;
                    }
                }
            }
            
            // Also try reverse: Output Mermaid → Input Mermaid via Output CPEE
            if (sourceFormat === 'output-intermediate' && targetFormat === 'input-intermediate') {
                // Try using mapping if available
                if (mapping) {
                    const outputCpeeMappings = mapping.getMappings(sourceTask.id, 'output-intermediate', 'output-cpee');
                    if (outputCpeeMappings.length > 0) {
                        const outputCpeeTask = outputCpeeMappings[0].targetTask;
                        // Find Input CPEE with matching alt_id
                        if (outputCpeeTask.altId) {
                            const inputCpeeTask = inputCpeeTasks.find(t => t.altId === outputCpeeTask.altId);
                            if (inputCpeeTask) {
                                // Use Input CPEE's id to match Input Mermaid's id
                                match = targetTasks.find(t => t.id === inputCpeeTask.id);
                                if (match) {
                                    return match;
                                }
                            }
                        }
                    }
                }
                
                // Fallback: Direct lookup in outputCpeeTasks array (works during initial mapping)
                // Output Mermaid id="1" should match Output CPEE alt_id="1"
                const outputCpeeTask = outputCpeeTasks.find(t => t.altId === sourceTask.id);
                if (outputCpeeTask && outputCpeeTask.altId) {
                    // Find Input CPEE with matching alt_id
                    const inputCpeeTask = inputCpeeTasks.find(t => t.altId === outputCpeeTask.altId);
                    if (inputCpeeTask) {
                        // Use Input CPEE's id to match Input Mermaid's id
                        match = targetTasks.find(t => t.id === inputCpeeTask.id);
                        if (match) {
                            return match;
                        }
                    }
                }
            }
        }
        
        // PRIORITY 2: Fallback - try all combinations of id and alt_id
        // Order matters: try more specific matches first before generic id→id
        
        // For CPEE → CPEE: try id → altId (input CPEE.id matches output CPEE.altId)
        if (sourceIsCpee && targetIsCpee) {
            let match = targetTasks.find(t => t.altId === sourceTask.id);
            if (match) {
                return match;
            }
            // Try: altId → id (input CPEE.altId matches output CPEE.id)
            if (sourceTask.altId) {
                match = targetTasks.find(t => t.id === sourceTask.altId);
                if (match) {
                    return match;
                }
            }
        }
        
        // Try: source.id → target.altId (if target is CPEE)
        if (targetIsCpee) {
            const match = targetTasks.find(t => t.altId === sourceTask.id);
            if (match) {
                return match;
            }
        }
        
        // Try: source.altId → target.id (if source is CPEE and target is Mermaid)
        if (sourceIsCpee && sourceTask.altId && targetIsMermaid) {
            const match = targetTasks.find(t => t.id === sourceTask.altId);
            if (match) {
                return match;
            }
        }
        
        // Try: source.altId → target.altId (if both are CPEE) - already tried in primary, but check again
        if (sourceIsCpee && targetIsCpee && sourceTask.altId) {
            const match = targetTasks.find(t => t.altId === sourceTask.altId);
            if (match) {
                return match;
            }
        }
        
        // LAST RESORT: Try: source.id → target.id (most generic, only if nothing else worked)
        // This is dangerous because IDs can be reused across different tasks, so use it last
        const idMatch = targetTasks.find(t => t.id === sourceTask.id);
        if (idMatch) {
            return idMatch;
        }
        
        // No match found
        return null;
    }
    
    /**
     * Create transitive mappings (A→B, B→C implies A→C)
     * @param {TaskMapping} mapping - Mapping object
     */
    createTransitiveMappings(mapping) {
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
        
        // Get the actual TaskIdentifier object to verify it exists
        let sourceTask = this.getTask(taskId, sourceFormat);
        
        // If not found, try to extract base ID and search again (for Mermaid SVG IDs)
        if (!sourceTask && taskId.includes(':task:')) {
            const baseIdMatch = taskId.match(/:([a-z0-9]+):task:/) || 
                               taskId.match(/^([a-z0-9]+):task:/) ||
                               taskId.match(/flowchart-([a-z0-9]+)(?:-task-|:task:|-)/);
            if (baseIdMatch && baseIdMatch[1]) {
                const baseId = baseIdMatch[1];
                sourceTask = this.getTask(baseId, sourceFormat);
                if (sourceTask) {
                    taskId = baseId; // Use base ID for mapping lookup
                }
            }
        }
        
        if (!sourceTask) {
            return equivalents;
        }
        
        formats.forEach(targetFormat => {
            if (targetFormat !== sourceFormat) {
                // Look up mappings using the task's id (mappings are stored by id)
                // Try both the original taskId and the sourceTask.id
                let mappings = this.getMappings(taskId, sourceFormat, targetFormat);
                if (mappings.length === 0 && taskId !== sourceTask.id) {
                    // If no mappings found with taskId, try with sourceTask.id
                    mappings = this.getMappings(sourceTask.id, sourceFormat, targetFormat);
                }
                
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
        // Summary logging removed
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

