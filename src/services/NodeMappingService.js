/**
 * Node Mapping Service
 * Handles extraction of nodes (tasks, gateways, events) from content and building node mappings
 * Single responsibility: Node extraction and mapping
 * 
 * CONFIGURABLE PARAMETERS:
 * - JACCARD_WEIGHT, JARO_WINKLER_WEIGHT, EXACT_MATCH_WEIGHT: Control similarity metric weights
 * - TEXT_SIMILARITY_THRESHOLD: Minimum similarity to accept text-based matches
 * - ID_MATCH_MIN_SIMILARITY: Below this, ID matches are considered "very low" and may be rejected
 * - TEXT_MATCH_SIGNIFICANT_DIFF: How much better a text match must be to override an ID match
 * - ID_MATCH_ACCEPT_THRESHOLD: Above this, ID matches are automatically accepted without checking alternatives
 */

import { NodeIdentifier } from '../models/NodeIdentifier.js';
import { calculateJaccardSimilarity, calculateJaroWinkler } from '../utils/similarity/StringSimilarity.js';

export class NodeMappingService {
    /**
     * Create a new NodeMappingService instance
     * @param {CPEENodeExtractor} cpeeNodeExtractor - Extractor for CPEE nodes
     * @param {MermaidNodeExtractor} mermaidNodeExtractor - Extractor for Mermaid nodes
     */
    constructor(cpeeNodeExtractor, mermaidNodeExtractor) {
        this.cpeeNodeExtractor = cpeeNodeExtractor;
        this.mermaidNodeExtractor = mermaidNodeExtractor;
        
        // ============================================
        // adjustable values to fine-tune matching behavior
        // ============================================
        
        // Text similarity metric weights (must sum to 1.0)
        this.JACCARD_WEIGHT = 0.60;           // Token-based similarity weight
        this.JARO_WINKLER_WEIGHT = 0.35;     // Character-based similarity weight
        this.EXACT_MATCH_WEIGHT = 0.05;       // Exact match bonus weight
        
        // Validate that weights sum to 1.0
        const weightSum = this.JACCARD_WEIGHT + this.JARO_WINKLER_WEIGHT + this.EXACT_MATCH_WEIGHT;
        const EPSILON = 1e-6;
        if (Math.abs(weightSum - 1.0) > EPSILON) {
            throw new Error(
                `NodeMappingService: Similarity weights must sum to 1.0, but sum to ${weightSum}. ` +
                `JACCARD_WEIGHT=${this.JACCARD_WEIGHT}, JARO_WINKLER_WEIGHT=${this.JARO_WINKLER_WEIGHT}, ` +
                `EXACT_MATCH_WEIGHT=${this.EXACT_MATCH_WEIGHT}`
            );
        }
        
        // Subset/superset matching boost
        this.SUBSET_MATCH_BOOST = 0.25;       // Boost when one label is subset of another (e.g., "Send Updates" vs "Send Updates to Customer")
        this.MIN_SUBSET_RATIO = 0.60;         // Minimum ratio of smaller set to larger set to consider it a subset match
        
        // Text matching thresholds
        this.TEXT_SIMILARITY_THRESHOLD = 0.75;              // Minimum similarity to accept a text-based match
        
        // ID match validation thresholds
        this.ID_MATCH_MIN_SIMILARITY = 0.50;               // Below this, ID match is considered "very low"
        this.TEXT_MATCH_SIGNIFICANT_DIFF = 0.20;           // Text match must be this much better to override ID match
        this.ID_MATCH_ACCEPT_THRESHOLD = 0.70;             // Above this, ID match is automatically accepted
    }

    /**
     * Extract nodes and generate node mapping for a step
     * @param {CPEEStep} cpeeStep - Step to process
     * @returns {Object|null} Node mapping or null if no nodes found
     */
    generateTaskMapping(cpeeStep) {
        // Extract nodes from all sections
        const nodes = this.extractTasksFromStep(cpeeStep);
        
        // Generate node mapping if we have nodes
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
                console.warn(`[NodeMappingService] Failed to generate node mapping for Step ${cpeeStep.stepNumber}:`, error);
                return null;
            }
        }
        
        return null;
    }

    /**
     * Extract all nodes from a step's content sections
     * @param {CPEEStep} cpeeStep - Step to extract nodes from
     * @returns {Object} Nodes by section
     * @private
     */
    extractTasksFromStep(cpeeStep) {
        // Extractors have static methods - get the class (works with both class and instance)
        const CPEENodeExtractorClass = this.cpeeNodeExtractor.constructor || this.cpeeNodeExtractor;
        const MermaidNodeExtractorClass = this.mermaidNodeExtractor.constructor || this.mermaidNodeExtractor;
        
        const inputCpeeTasks = CPEENodeExtractorClass.extract(
            cpeeStep.getInputCpeeTreeRaw().getContent()
        );
        const inputMermaidTasks = MermaidNodeExtractorClass.extract(
            cpeeStep.getInputMermaidRaw().getContent()
        );
        const outputMermaidTasks = MermaidNodeExtractorClass.extract(
            cpeeStep.getOutputMermaidRaw().getContent()
        );
        const outputCpeeTasks = CPEENodeExtractorClass.extract(
            cpeeStep.getOutputCpeeTreeRaw().getContent()
        );
        
        return {
            inputCpeeTasks,
            inputMermaidTasks,
            outputMermaidTasks,
            outputCpeeTasks
        };
    }

    /**
     * Build mapping between nodes in all four formats
     * Rules:
     * - Input intermediate only has id, so mapping TO it uses id from input-cpee
     * - All other mappings use alt_id primarily
     * - Fallback: try id + alt_id combinations if primary fails
     * @param {NodeIdentifier[]} inputCpee - Nodes from input CPEE tree
     * @param {NodeIdentifier[]} inputMermaid - Nodes from input Mermaid
     * @param {NodeIdentifier[]} outputMermaid - Nodes from output Mermaid
     * @param {NodeIdentifier[]} outputCpee - Nodes from output CPEE tree
     * @returns {NodeMapping} Mapping object with bidirectional links
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
        for (let i = 0; i < formats.length; i++) {
            for (let j = 0; j < formats.length; j++) {
                if (i !== j) {
                    this._mapBetweenFormats(
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
        this._createTransitiveMappings(mapping);
        
        return mapping;
    }

    /**
     * Map tasks between two formats
     * Rules:
     * - If target is input-intermediate: use id matching (only from input-cpee)
     * - Otherwise: use alt_id matching primarily, fallback to id + alt_id combinations
     * @param {NodeIdentifier[]} sourceTasks - Tasks from source format
     * @param {NodeIdentifier[]} targetTasks - Tasks from target format
     * @param {string} sourceFormat - Source format key (e.g., 'input-cpee')
     * @param {string} targetFormat - Target format key (e.g., 'input-intermediate')
     * @param {NodeMapping} mapping - Mapping object to populate
     * @param {NodeIdentifier[]} inputCpeeTasks - Input CPEE tasks (for transitive lookups)
     * @param {NodeIdentifier[]} outputCpeeTasks - Output CPEE tasks (for transitive lookups)
     * @private
     */
    _mapBetweenFormats(sourceTasks, targetTasks, sourceFormat, targetFormat, mapping, inputCpeeTasks = [], outputCpeeTasks = []) {
        sourceTasks.forEach(sourceTask => {
            let match = this._findMatch(
                sourceTask, 
                targetTasks, 
                sourceFormat, 
                targetFormat, 
                mapping, 
                inputCpeeTasks, 
                outputCpeeTasks
            );
            
            // GENERAL RULE: Always compare all possible matches and keep the one with highest similarity
            // Collect all potential matches (ID-based and text-based)
            const allMatches = [];
            
            // Add ID-based match if it exists
            if (match) {
                const idMatchSimilarity = this._calculateTextSimilarity(sourceTask.label, match.label);
                allMatches.push({
                    task: match,
                    score: idMatchSimilarity,
                    type: 'id'
                });
            }
            
            // Add text-based matches (find all above threshold, not just the best)
            const allTextMatches = this._findAllTextMatchesWithScore(sourceTask, targetTasks);
            allMatches.push(...allTextMatches);
            
            // Filter out duplicate tasks (same task ID)
            const uniqueMatches = [];
            const seenTaskIds = new Set();
            for (const matchCandidate of allMatches) {
                if (!seenTaskIds.has(matchCandidate.task.id)) {
                    seenTaskIds.add(matchCandidate.task.id);
                    uniqueMatches.push(matchCandidate);
                }
            }
            
            // GENERAL RULE: Always pick the match with highest similarity
            // Apply special rules for ID matches with very low similarity
            const idMatch = uniqueMatches.find(m => m.type === 'id');
            
            if (idMatch && idMatch.score >= this.ID_MATCH_ACCEPT_THRESHOLD) {
                // ID match has very high similarity - use it (optimization: skip comparing alternatives)
                match = idMatch.task;
            } else if (uniqueMatches.length === 0) {
                // No matches found
                match = null;
            } else {
                // Compare all matches and pick the highest similarity
                // Sort by score descending
                uniqueMatches.sort((a, b) => b.score - a.score);
                const bestMatch = uniqueMatches[0];
                
                // Special rule for very low ID matches: require significant difference to override
                if (idMatch && 
                    idMatch.score < this.ID_MATCH_MIN_SIMILARITY && 
                    bestMatch.type === 'text' &&
                    bestMatch.task.id !== idMatch.task.id) {
                    const similarityDiff = bestMatch.score - idMatch.score;
                    if (similarityDiff >= this.TEXT_MATCH_SIGNIFICANT_DIFF && 
                        bestMatch.score >= this.TEXT_SIMILARITY_THRESHOLD) {
                        // Text match is significantly better - use it
                        match = bestMatch.task;
                    } else {
                        // Text match not significantly better - keep ID match
                        match = idMatch.task;
                    }
                } else {
                    // General rule: pick highest similarity match
                    // For text matches, require minimum threshold
                    if (bestMatch.type === 'text' && bestMatch.score >= this.TEXT_SIMILARITY_THRESHOLD) {
                        match = bestMatch.task;
                    } else if (bestMatch.type === 'id') {
                        // ID match is best (even if below threshold, no better alternative)
                        match = bestMatch.task;
                    } else {
                        // Text match below threshold - fall back to ID match if exists
                        match = idMatch ? idMatch.task : null;
                    }
                }
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
     * @param {NodeIdentifier} sourceTask - Source task
     * @param {NodeIdentifier[]} targetTasks - Target tasks to search
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     * @param {NodeMapping} mapping - Mapping object (for transitive lookups)
     * @param {NodeIdentifier[]} inputCpeeTasks - Input CPEE tasks (for transitive lookups)
     * @param {NodeIdentifier[]} outputCpeeTasks - Output CPEE tasks (for transitive lookups)
     * @returns {NodeIdentifier|null} Matching task or null
     * @private
     */
    _findMatch(sourceTask, targetTasks, sourceFormat, targetFormat, mapping = null, inputCpeeTasks = [], outputCpeeTasks = []) {
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
     * @param {NodeMapping} mapping - Mapping object
     * @private
     */
    _createTransitiveMappings(mapping) {
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
                this._addTransitiveMappings(sourceFormat, targetFormat, intermediateMappings, mapping);
            }
        }
    }

    /**
     * Add transitive mappings between source and target through intermediates
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     * @param {string[]} intermediateFormats - Intermediate formats
     * @param {NodeMapping} mapping - Mapping object
     * @private
     */
    _addTransitiveMappings(sourceFormat, targetFormat, intermediateFormats, mapping) {
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

    /**
     * Calculate string similarity between two strings using combined metrics
     * Uses configurable weights: Jaccard + Jaro-Winkler + exact match bonus
     * Returns a value between 0 (no similarity) and 1 (identical)
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score (0-1)
     * @private
     */
    _calculateTextSimilarity(str1, str2) {
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
        
        // Calculate component similarities using pure utility functions
        const jaccardSimilarity = calculateJaccardSimilarity(s1, s2, {
            minSubsetRatio: this.MIN_SUBSET_RATIO,
            subsetMatchBoost: this.SUBSET_MATCH_BOOST
        });
        const jaroWinklerSimilarity = calculateJaroWinkler(s1, s2);
        
        // Combined similarity using configurable weights
        const combinedSimilarity = (this.JACCARD_WEIGHT * jaccardSimilarity) + 
                                   (this.JARO_WINKLER_WEIGHT * jaroWinklerSimilarity) + 
                                   (this.EXACT_MATCH_WEIGHT * exactMatch);
        
        return Math.min(1.0, Math.max(0.0, combinedSimilarity));
    }


    /**
     * Find best text match in target tasks
     * @param {NodeIdentifier} sourceTask - Source task
     * @param {NodeIdentifier[]} targetTasks - Target tasks to search
     * @returns {NodeIdentifier|null} Best matching task or null if no match above threshold
     * @private
     */
    _findBestTextMatch(sourceTask, targetTasks) {
        const result = this._findBestTextMatchWithScore(sourceTask, targetTasks);
        // Only return if above threshold
        if (result && result.score >= this.TEXT_SIMILARITY_THRESHOLD) {
            return result.match;
        }
        return null;
    }

    /**
     * Find best text match in target tasks with score
     * @param {NodeIdentifier} sourceTask - Source task
     * @param {NodeIdentifier[]} targetTasks - Target tasks to search
     * @returns {{match: NodeIdentifier, score: number}|null} Best matching task with score or null
     * @private
     */
    _findBestTextMatchWithScore(sourceTask, targetTasks) {
        if (!sourceTask || !sourceTask.label || targetTasks.length === 0) {
            return null;
        }
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const targetTask of targetTasks) {
            if (!targetTask || !targetTask.label) {
                continue;
            }
            
            const similarity = this._calculateTextSimilarity(sourceTask.label, targetTask.label);
            
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
     * Find all text matches in target tasks with scores above threshold
     * @param {NodeIdentifier} sourceTask - Source task
     * @param {NodeIdentifier[]} targetTasks - Target tasks to search
     * @returns {Array<{task: NodeIdentifier, score: number, type: string}>} Array of matching tasks with scores
     * @private
     */
    _findAllTextMatchesWithScore(sourceTask, targetTasks) {
        if (!sourceTask || !sourceTask.label || targetTasks.length === 0) {
            return [];
        }
        
        const matches = [];
        
        for (const targetTask of targetTasks) {
            if (!targetTask || !targetTask.label) {
                continue;
            }
            
            const similarity = this._calculateTextSimilarity(sourceTask.label, targetTask.label);
            
            // Include all matches above threshold (or at least the best match if none above threshold)
            if (similarity >= this.TEXT_SIMILARITY_THRESHOLD) {
                matches.push({
                    task: targetTask,
                    score: similarity,
                    type: 'text'
                });
            }
        }
        
        // If no matches above threshold, include the best match anyway (for comparison)
        if (matches.length === 0) {
            const bestMatch = this._findBestTextMatchWithScore(sourceTask, targetTasks);
            if (bestMatch) {
                matches.push({
                    task: bestMatch.match,
                    score: bestMatch.score,
                    type: 'text'
                });
            }
        }
        
        return matches;
    }
}

/**
 * Node Mapping data structure
 * Stores bidirectional mappings between nodes (tasks, gateways, events) in different formats
 */
class NodeMapping {
    constructor() {
        // Map structure: sourceFormat → sourceTaskId → targetFormat → [mappings]
        this.mappings = new Map();
        
        // Task storage: format → taskId → NodeIdentifier
        this.tasks = new Map();
    }
    
    /**
     * Add a mapping between two tasks
     * GENERAL RULE: Only one mapping per source→target format pair (highest similarity wins)
     * @param {NodeIdentifier} sourceTask - Source task
     * @param {string} sourceFormat - Source format key
     * @param {NodeIdentifier} targetTask - Target task
     * @param {string} targetFormat - Target format key
     * @param {boolean} isTransitive - Whether this is a transitive mapping
     */
    addMapping(sourceTask, sourceFormat, targetTask, targetFormat, isTransitive = false) {
        // Store tasks
        this.storeTask(sourceTask, sourceFormat);
        this.storeTask(targetTask, targetFormat);
        
        // ENSURE ONLY ONE MAPPING: Remove any existing mappings from source to target format
        // This ensures we only keep the best match (highest similarity)
        // We only do this for direct (non-transitive) mappings to avoid breaking transitive chains
        if (!isTransitive) {
            // Clear source→target mappings (only mappings from this source task to this target format)
            this.removeExistingMappings(sourceTask.id, sourceFormat, targetFormat);
            // Clear target→source mappings (only mappings from this target task to this source format)
            this.removeExistingMappings(targetTask.id, targetFormat, sourceFormat);
        }
        
        // Create bidirectional mapping
        this.addDirectionalMapping(sourceTask.id, sourceFormat, targetTask, targetFormat, isTransitive);
        this.addDirectionalMapping(targetTask.id, targetFormat, sourceTask, sourceFormat, isTransitive);
    }
    
    /**
     * Remove existing mappings from source to target format
     * Ensures only one mapping exists per source→target format pair
     * @param {string} sourceTaskId - Source task ID
     * @param {string} sourceFormat - Source format
     * @param {string} targetFormat - Target format
     */
    removeExistingMappings(sourceTaskId, sourceFormat, targetFormat) {
        const formatMap = this.mappings.get(sourceFormat);
        if (!formatMap) {
            return;
        }
        
        const taskMap = formatMap.get(sourceTaskId);
        if (!taskMap) {
            return;
        }
        
        // Clear all existing mappings to this target format
        // This ensures only the most recent (best) mapping is kept
        taskMap.set(targetFormat, []);
    }
    
    /**
     * Add a directional mapping
     * @param {string} sourceTaskId - Source task ID
     * @param {string} sourceFormat - Source format
     * @param {NodeIdentifier} targetTask - Target task
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
     * @param {NodeIdentifier} task - Task to store
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
     * @returns {NodeIdentifier|null} Task or null
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
        
        // Get the actual NodeIdentifier object to verify it exists
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
     * Create NodeMapping from plain object
     * @param {Object} obj - Plain object
     * @returns {NodeMapping} New NodeMapping instance
     */
    static fromObject(obj) {
        const mapping = new NodeMapping();
        
        // Restore tasks
        Object.entries(obj.tasks || {}).forEach(([format, formatTasks]) => {
            Object.entries(formatTasks).forEach(([_taskId, taskData]) => {
                const task = NodeIdentifier.fromObject(taskData);
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

export { NodeMapping };
