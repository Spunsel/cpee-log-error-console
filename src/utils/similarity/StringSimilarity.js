/**
 * String Similarity Utilities
 * Pure functions for calculating string similarity metrics
 * These are stateless algorithms that can be used independently
 */

/**
 * Calculate Jaro distance between two strings
 * Pure function - no state or configuration needed
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Jaro distance (0-1), where 1 is identical
 */
function calculateJaro(str1, str2) {
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
 * Calculate Jaro-Winkler similarity between two strings
 * Improved version of Jaro distance with prefix weighting
 * Better than Levenshtein for handling typos and minor variations
 * Pure function - no state or configuration needed
 * @param {string} str1 - First string (should be normalized)
 * @param {string} str2 - Second string (should be normalized)
 * @returns {number} Jaro-Winkler similarity score (0-1), where 1 is identical
 */
export function calculateJaroWinkler(str1, str2) {
    // Calculate Jaro distance
    const jaro = calculateJaro(str1, str2);
    
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
 * Calculate Jaccard similarity (token-based) between two strings
 * Measures word-level similarity, order-insensitive
 * Enhanced to handle subset/superset relationships
 * 
 * @param {string} str1 - First string (should be normalized)
 * @param {string} str2 - Second string (should be normalized)
 * @param {Object} options - Optional configuration
 * @param {number} options.minSubsetRatio - Minimum ratio for subset matching (default: 0.60)
 * @param {number} options.subsetMatchBoost - Boost for subset relationships (default: 0.25)
 * @returns {number} Jaccard similarity score (0-1), where 1 is identical word sets
 */
export function calculateJaccardSimilarity(str1, str2, options = {}) {
    const {
        minSubsetRatio = 0.60,
        subsetMatchBoost = 0.25
    } = options;
    
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
    
    // Check if one set is a subset of another
    const smallerSize = Math.min(tokens1.size, tokens2.size);
    const subsetRatio = intersection / smallerSize;
    
    // If all tokens from smaller set are in larger set (subset relationship)
    // This handles cases like "Send Updates" vs "Send Updates to Customer"
    if (subsetRatio >= minSubsetRatio && intersection === smallerSize) {
        // Calculate base similarity using overlap coefficient (intersection / min size)
        const overlapCoefficient = intersection / smallerSize;
        // Apply boost for subset relationship
        const boostedSimilarity = Math.min(1.0, overlapCoefficient + subsetMatchBoost);
        return boostedSimilarity;
    }
    
    // Standard Jaccard calculation
    // Calculate union (all unique tokens from both sets)
    const union = tokens1.size + tokens2.size - intersection;
    
    // Jaccard = intersection / union
    return union > 0 ? intersection / union : 0.0;
}

