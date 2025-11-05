/**
 * Task Mapper
 * Maps equivalent tasks across different formats (CPEE XML, Mermaid syntax)
 * Uses exact ID matching to identify equivalent tasks
 */

import { TaskIdentifier } from '../../models/TaskIdentifier.js';

export class TaskMapper {
    
    constructor() {
        this.TEXT_SIMILARITY_THRESHOLD = 0.95;
    }
    
    /**
     * Calculate string similarity between two strings using combined metrics:
     * 70% Jaccard similarity (token-based) + 25% Jaro-Winkler + 5% exact match bonus
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
        
        // Exact match bonus (fast path)
        const exactMatch = s1 === s2 ? 1.0 : 0.0;
        if (exactMatch === 1.0) {
            return 1.0;
        }
        
        // Calculate component similarities
        const jaccardSimilarity = this.calculateJaccardSimilarity(s1, s2);
        const jaroWinklerSimilarity = this.calculateJaroWinkler(s1, s2);
        
        // Combined similarity: 70% Jaccard + 25% Jaro-Winkler + 5% exact match bonus
        const combinedSimilarity = (0.70 * jaccardSimilarity) + 
                                   (0.25 * jaroWinklerSimilarity) + 
                                   (0.05 * exactMatch);
        
        return Math.min(1.0, Math.max(0.0, combinedSimilarity));
    }
    
    /**
     * Calculate Jaccard similarity (token-based) between two strings
     * Measures word-level similarity, order-insensitive
     * Returns a value between 0 (no similarity) and 1 (identical word sets)
     * @param {string} str1 - First string (should be normalized)
     * @param {string} str2 - Second string (should be normalized)
     * @returns {number} Jaccard similarity score (0-1)
     */
    calculateJaccardSimilarity(str1, str2) {
        // Tokenize: split by whitespace and filter empty tokens
        const tokens1 = new Set(str1.split(/\s+/).filter(token => token.length > 0));
        const tokens2 = new Set(str2.split(/\s+/).filter(token => token.length > 0));
        
        // If both are empty, return 1.0
        if (tokens1.size === 0 && tokens2.size === 0) {
            return 1.0;
        }
        
        // If one is empty, return 0.0
        if (tokens1.size === 0 || tokens2.size === 0) {
            return 0.0;
        }
        
        // Calculate intersection (common tokens)
        let intersection = 0;
        for (const token of tokens1) {
            if (tokens2.has(token)) {
                intersection++;
            }
        }
        
        // Calculate union (all unique tokens from both sets)
        const union = tokens1.size + tokens2.size - intersection;
        
        // Jaccard = intersection / union
        return union > 0 ? intersection / union : 0.0;
    }
    
    /**
     * Calculate Jaro-Winkler similarity between two strings
     * Improved version of Jaro distance with prefix weighting
     * Better than Levenshtein for handling typos and minor variations
     * Returns a value between 0 (no similarity) and 1 (identical)
     * @param {string} str1 - First string (should be normalized)
     * @param {string} str2 - Second string (should be normalized)
     * @returns {number} Jaro-Winkler similarity score (0-1)
     */
    calculateJaroWinkler(str1, str2) {
        // Calculate Jaro distance
        const jaro = this.calculateJaro(str1, str2);
        
        // Calculate common prefix length (up to 4 characters)
        let prefixLength = 0;
        const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));
        for (let i = 0; i < maxPrefix; i++) {
            if (str1[i] === str2[i]) {
                prefixLength++;
            } else {
                break;
            }
        }
        
        // Jaro-Winkler = Jaro + (0.1 * prefixLength * (1 - Jaro))
        const winkler = jaro + (0.1 * prefixLength * (1 - jaro));
        
        return Math.min(1.0, winkler);
    }
    
    /**
     * Calculate Jaro distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Jaro distance (0-1)
     */
    calculateJaro(str1, str2) {
        if (str1 === str2) {
            return 1.0;
        }
        
        const len1 = str1.length;
        const len2 = str2.length;
        
        if (len1 === 0 || len2 === 0) {
            return 0.0;
        }
        
        // Match window: floor(max(len1, len2) / 2) - 1
        const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
        
        // Find matching characters
        const matches1 = new Array(len1).fill(false);
        const matches2 = new Array(len2).fill(false);
        
        let matches = 0;
        let transpositions = 0;
        
        // Find matches
        for (let i = 0; i < len1; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, len2);
            
            for (let j = start; j < end; j++) {
                if (matches2[j] || str1[i] !== str2[j]) {
                    continue;
                }
                matches1[i] = true;
                matches2[j] = true;
                matches++;
                break;
            }
        }
        
        if (matches === 0) {
            return 0.0;
        }
        
        // Find transpositions
        let k = 0;
        for (let i = 0; i < len1; i++) {
            if (!matches1[i]) {
                continue;
            }
            while (!matches2[k]) {
                k++;
            }
            if (str1[i] !== str2[k]) {
                transpositions++;
            }
            k++;
        }
        
        // Calculate Jaro distance
        const jaro = (
            (matches / len1) +
            (matches / len2) +
            ((matches - transpositions / 2) / matches)
        ) / 3.0;
        
        return jaro;
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     * @deprecated Replaced by combined Jaccard + Jaro-Winkler approach
     * Kept for reference or potential future use
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
        const result = this.findBestTextMatchWithScore(sourceTask, targetTasks);
        // Only return if above threshold
        if (result && result.score >= this.TEXT_SIMILARITY_THRESHOLD) {
            return result.match;
        }
        return null;
    }
    
    /**
     * Find best text match in target tasks with score
     * @param {TaskIdentifier} sourceTask - Source task
     * @param {TaskIdentifier[]} targetTasks - Target tasks to search
     * @returns {{match: TaskIdentifier, score: number}|null} Best matching task with score or null
     */
    findBestTextMatchWithScore(sourceTask, targetTasks) {
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
        
        if (bestMatch) {
            return { match: bestMatch, score: bestScore };
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
                const idMatchTextSimilarity = this.calculateTextSimilarity(sourceTask.label, match.label);
                
                // If ID match has text similarity above threshold, use it (don't look for other matches)
                if (idMatchTextSimilarity >= this.TEXT_SIMILARITY_THRESHOLD) {
                    // ID match is good enough - keep it
                    // Don't search for other text matches
                } else {
                    // ID match exists but text similarity is below threshold
                    // Look for better text match as fallback
                const bestTextMatchResult = this.findBestTextMatchWithScore(sourceTask, targetTasks);
                
                    // Only use text match if it's better than the ID match
                if (bestTextMatchResult && 
                    bestTextMatchResult.score > idMatchTextSimilarity &&
                        bestTextMatchResult.score >= this.TEXT_SIMILARITY_THRESHOLD &&
                    bestTextMatchResult.match.id !== match.id) {
                        // Better text match found that meets threshold - use it instead
                    match = bestTextMatchResult.match;
                }
                    // Otherwise, keep the ID match (even if below threshold, ID takes precedence)
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
        
        // PRIORITY 2: Fallback - try ID + alt_id combinations (only if pure alt_id matching failed)
        // PRIORITY 1 already tried pure alt_id matching:
        //   - altId → id (CPEE → Mermaid)
        //   - altId → altId (CPEE → CPEE)
        //   - id → altId (Mermaid → CPEE)
        // PRIORITY 2 now tries ID + alt_id combinations that weren't tried:
        //   - id → altId (CPEE → CPEE) - mixing source.id with target.altId
        //   - altId → id (CPEE → CPEE) - mixing source.altId with target.id
        
        // For CPEE → CPEE: try id → altId (input CPEE.id matches output CPEE.altId)
        // This is a combination, not pure alt_id matching (already tried altId→altId in PRIORITY 1)
        if (sourceIsCpee && targetIsCpee) {
            let match = targetTasks.find(t => t.altId === sourceTask.id);
            if (match) {
                return match;
            }
            // Try: altId → id (input CPEE.altId matches output CPEE.id)
            // This is a combination, not pure alt_id matching
            if (sourceTask.altId) {
                match = targetTasks.find(t => t.id === sourceTask.altId);
                if (match) {
                    return match;
                }
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

