/**
 * Fix UTF-8 mojibake in fallback log files.
 *
 * Handles two layers of corruption:
 *
 * Layer 1 (double-encoding): UTF-8 bytes were decoded as Latin-1 by the CORS
 * proxy, then saved as UTF-8. E.g. "ö" (C3 B6) -> "Ã¶".
 * Fix: re-encode as Latin-1 and decode as UTF-8.
 *
 * Layer 2 (replacement characters): Some bytes (0x80-0x9F range in Latin-1,
 * which are C1 control characters) cannot survive the Latin-1 round-trip and
 * end up as U+FFFD. These correspond to uppercase umlauts (Ä, Ö, Ü) and ß
 * whose Latin-1 encodings (0xC4, 0xD6, 0xDC, 0xDF) became invalid UTF-8
 * lead bytes during the proxy corruption.
 * Fix: pattern-based restoration using the byte that follows U+FFFD.
 *
 * Usage: node scripts/fix-utf8-mojibake.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', 'fallback', 'logs');
const DRY_RUN = process.argv.includes('--dry-run');

const MOJIBAKE_PATTERN = /\xC3[\x80-\xBF]|\xC2[\x80-\xBF]/;
const REPLACEMENT_CHAR = '\uFFFD';

/**
 * Layer 1: Reverse double-encoding (Latin-1 misread of UTF-8)
 */
function fixDoubleEncoding(text) {
    const latin1Bytes = Buffer.from(text, 'latin1');
    return latin1Bytes.toString('utf-8');
}

/**
 * Layer 2: Restore U+FFFD replacement characters using contextual patterns.
 *
 * When the CORS proxy decoded UTF-8 as Latin-1, certain high bytes in the
 * Latin-1 C1 control range (0x80-0x9F) couldn't be properly represented.
 * During subsequent UTF-8 encoding, these became U+FFFD.
 *
 * The byte following U+FFFD tells us what the original character was, because
 * the second byte of the original UTF-8 sequence survived intact:
 *
 *   ß = UTF-8 C3 9F -> Latin-1 interprets C3 as "Ã", 9F as C1 control
 *     -> the 9F byte often gets paired with the next ASCII char
 *     -> In the YAML, the original C3 was consumed by the preceding character's
 *        mojibake, leaving 9F alone. When 9F is an invalid UTF-8 continuation
 *        byte without a lead byte, it becomes U+FFFD.
 *     -> The lowercase letter after U+FFFD was originally part of the word.
 *
 * Observed patterns in CPEE German logs:
 *   U+FFFD + 'x' (in word context) = ß (Straße -> Stra + FFFD + x + e)
 *   U+FFFD before known word stems  = Ü/Ä/Ö (Übungen -> FFFD + bungen)
 *   'ÜS' before known word stems    = Ü with spurious 'S' artifact (Übergabe -> ÜSbergabe)
 *   'ÜS' at word boundary           = corrupted closing German quote mark "
 *   U+FFFD + 0x1E                   = Ä (control char artifact from Latin-1 0x84)
 */
function fixReplacementCharacters(text) {
    let result = text;

    // Pattern: FFFD followed by specific characters that form known German words
    // These are deterministic: the byte after FFFD disambiguates the original char.

    // ß patterns: FFFD + 'x' in word context = ß
    // ß (C3 9F) -> the 9F byte is a C1 control char in Latin-1, lost during
    // encoding round-trip. In some proxy chains it survived as literal 'x' (0x78).
    result = result.replace(/\uFFFDx/g, 'ß');

    // Ü patterns: FFFD alone before known Ü-word stems (FFFD = Ü, next chars are the word)
    result = result.replace(/\uFFFD(?=b(?:ungen|ber(?!\.)|bung|bersicht|berweis|bergab|bergang|berprüf|bersetz|bnungen))/g, 'Ü');
    // FFFD before other Ü-word stems
    result = result.replace(/\uFFFD(?=berweisen|bermittl)/g, 'Ü');

    // ÜS pattern: The double-encoding of Ü (C3 9C) sometimes produces a spurious
    // 'S' (0x53) after decoding. "Übergabe" becomes "ÜSbergabe". The 'S' must be
    // consumed (removed) since it's an artifact, not part of the original text.
    // All German "Üb..." words match ÜSb..., so we use ÜSb as the general trigger.
    // MUST run before the ÜS-to-quote rule below.
    result = result.replace(/ÜSb(?=e[^c]|ung|lich|rig|el\b)/g, 'Üb');

    // Recovery: previous runs may have wrongly converted ÜSb -> "b (via the quote rule).
    // Fix "b + German word stem back to Üb where it clearly should be Ü.
    result = result.replace(/"b(?=erarbeit|erweis|ungen(?:\s|\\n)|ermittl|ersicht|ergang|erprüf|ergabe|ertrag)/g, 'Üb');

    // ÜS at end of words = corrupted closing German quotation mark „..."
    // Pattern: ~word + ÜS at boundary = „word" (the ~ is „, the ÜS is ")
    result = result.replace(/ÜS(?=\b|[^a-zA-ZäöüÄÖÜß]|$)/g, '"');
    // Also fix ~word pattern (~ = opening German quote „)
    result = result.replace(/\u201A~|�~/g, '„');

    // Ä patterns: FFFD + control char 0x1E (from Latin-1 0x84 = IND)
    result = result.replace(/\uFFFD\x1e/g, 'Ä');
    // FFFD before known Ä-word stems
    result = result.replace(/\uFFFD(?=rztin|rzte|nderung|rger|mter|ther(?=apie|apeut|er\b)|hnlich|ltere|ngst|rmel|pfel|quivalent|rztlich)/g, 'Ä');

    // Ö patterns: FFFD before known Ö-word stems
    result = result.replace(/\uFFFD(?=ffnung|ffentlich|sterreich|konomie|kologie)/g, 'Ö');
    // FFFD + 'l' at word boundary (Öl) or FFFD + 'rt' (Örtlich)
    result = result.replace(/\uFFFD(?=l(?:\b|[^a-zA-Z]))/g, 'Ö');
    result = result.replace(/\uFFFD(?=l$)/gm, 'Ö');
    result = result.replace(/\uFFFD(?=rtlich)/g, 'Ö');

    // Apostrophe: FFFD + '"s' = curly apostrophe (') that got corrupted
    // e.g. "Lothar's" -> "Lothar" + FFFD + '"s'
    result = result.replace(/\uFFFD"(?=s\b)/g, '\u2019');

    return result;
}

function hasMojibake(text) {
    return MOJIBAKE_PATTERN.test(text);
}

function hasReplacementChars(text) {
    return text.includes(REPLACEMENT_CHAR);
}

function hasCorruptedUmlauts(text) {
    return /ÜSb(?=e[^c]|ung|lich|rig|el\b)/.test(text) || /"b(?=erarbeit|erweis|ungen[\s\\]|ermittl|ersicht|ergang|erprüf|ergabe|ertrag)/.test(text);
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let fixed = content;
    let changed = false;

    // Layer 1: Fix double-encoding
    if (hasMojibake(fixed)) {
        fixed = fixDoubleEncoding(fixed);
        changed = true;
    }

    // Layer 2: Fix U+FFFD replacement characters and ÜS artifacts
    const needsLayer2 = hasReplacementChars(fixed) || hasCorruptedUmlauts(fixed);
    if (needsLayer2) {
        const before = fixed;
        fixed = fixReplacementCharacters(fixed);
        if (fixed !== before) {
            changed = true;
        }
    }

    if (!changed) {
        return { changed: false, remainingFffd: 0 };
    }

    const remainingFffd = (fixed.match(/\uFFFD/g) || []).length;

    if (!DRY_RUN) {
        fs.writeFileSync(filePath, fixed, 'utf-8');
    }

    return { changed: true, remainingFffd };
}

function main() {
    console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Scanning fallback logs for encoding issues...\n`);

    if (!fs.existsSync(LOGS_DIR)) {
        console.error(`Logs directory not found: ${LOGS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.xes.yaml'));
    let fixedCount = 0;
    let totalRemaining = 0;

    for (const file of files) {
        const filePath = path.join(LOGS_DIR, file);
        try {
            const { changed, remainingFffd } = processFile(filePath);
            if (changed) {
                fixedCount++;
                const suffix = remainingFffd > 0 ? ` (${remainingFffd} U+FFFD remaining)` : '';
                console.log(`  ${DRY_RUN ? 'Would fix' : 'Fixed'}: ${file}${suffix}`);
                totalRemaining += remainingFffd;
            }
        } catch (err) {
            console.error(`  ERROR processing ${file}: ${err.message}`);
        }
    }

    console.log(`\nDone. ${fixedCount} of ${files.length} files ${DRY_RUN ? 'would be' : 'were'} fixed.`);
    if (totalRemaining > 0) {
        console.log(`Note: ${totalRemaining} U+FFFD characters remain across all files (may need manual review or additional patterns).`);
    }
}

main();
