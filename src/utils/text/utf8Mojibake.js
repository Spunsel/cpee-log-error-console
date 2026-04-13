/**
 * Repair UTF-8 text that was wrongly decoded as Latin-1 / ISO-8859-1 (a common CORS-proxy issue).
 * Example: bytes C3 BC (ü) become U+00C3 "Ã" + U+00BC "¼" → displayed as "Ã¼"; this restores "ü".
 *
 * Only runs when typical mojibake byte-pair patterns are present, so valid UTF-8 strings are unchanged.
 */

/** Lead bytes of 2-byte UTF-8 sequences, as misread Latin-1 code units */
const UTF8_MOJIBAKE_PATTERN = /[\u00C2\u00C3][\u0080-\u00BF]/;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeUtf8Mojibake(text) {
    return typeof text === 'string' && text.length > 0 && UTF8_MOJIBAKE_PATTERN.test(text);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function repairUtf8Mojibake(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    const len = text.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function fixUtf8MojibakeIfPresent(text) {
    if (!looksLikeUtf8Mojibake(text)) {
        return text;
    }
    return repairUtf8Mojibake(text);
}
