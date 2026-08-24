// PhishGuard - Storage Handoff Interface

const LATEST_RESULT_KEY = 'phishguard_latest_result';

/**
 * Saves analysis verdict result to sessionStorage.
 * @param {object} result
 */
export function setLatestResult(result) {
    if (!result) return;
    
    // Safety check: Create a sanitized clone to avoid storing password fields
    const sanitized = {
        scan_id: result.scan_id,
        classification: result.classification,
        risk_score: result.risk_score,
        confidence: result.confidence,
        model_version: result.model_version,
        processing_time_ms: result.processing_time_ms,
        indicators: result.indicators,
        recommendation: result.recommendation,
        disclaimer: result.disclaimer,
        sender: result.sender,
        recipient: result.recipient,
        subject: result.subject
        // Note: Do not store complete raw body or file content
    };

    sessionStorage.setItem(LATEST_RESULT_KEY, JSON.stringify(sanitized));
}

/**
 * Retrieves the stored analysis result.
 * @returns {object|null}
 */
export function getLatestResult() {
    const raw = sessionStorage.getItem(LATEST_RESULT_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Clear stored results.
 */
export function clearLatestResult() {
    sessionStorage.removeItem(LATEST_RESULT_KEY);
}
