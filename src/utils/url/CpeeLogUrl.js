/**
 * Helpers for CPEE log (XES YAML) URLs on cpee.org.
 * Local/versioned instance ids may use a trailing "_v2" suffix; the log file is served without it.
 */

/**
 * @param {string} [uuid]
 * @returns {string|undefined}
 */
export function normalizeUuidForCpeeLogUrl(uuid) {
    if (uuid === null || uuid === undefined || typeof uuid !== 'string') {
        return uuid;
    }
    if (!uuid.endsWith('_v2')) {
        return uuid;
    }
    const base = uuid.slice(0, -3);
    return base.length > 0 ? base : uuid;
}

/**
 * @param {string} cpeeLogsEndpoint - e.g. https://cpee.org/logs
 * @param {string} uuid - instance uuid (possibly with _v2 suffix)
 * @returns {string}
 */
export function buildCpeeLogXesYamlUrl(cpeeLogsEndpoint, uuid) {
    const id = normalizeUuidForCpeeLogUrl(uuid);
    return `${cpeeLogsEndpoint}/${id}.xes.yaml`;
}
