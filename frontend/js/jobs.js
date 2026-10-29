// PhishGuard - Background Job State Machine & Polling Engine
import { getJobStatus } from './api.js';

/**
 * Manages background Celery worker job polling with accessible DOM progress updates.
 * @param {string} jobId - Unique UUID of background job
 * @param {Object} options - UI hooks and completion callbacks
 */
export function startJobPolling(jobId, {
    containerId = 'job-status-container',
    titleId = 'job-status-title',
    badgeId = 'job-status-badge',
    msgId = 'job-status-msg',
    progressFillId = 'job-progress-fill',
    spinnerId = 'job-status-spinner',
    processedId = 'job-processed-count',
    skippedId = 'job-skipped-count',
    highRiskId = 'job-highrisk-count',
    failedId = 'job-failed-count',
    onComplete = null,
    onError = null,
    pollIntervalMs = 2000,
    maxAttempts = 45
} = {}) {
    if (!jobId) return;

    let attempts = 0;
    const container = document.getElementById(containerId);
    const title = document.getElementById(titleId);
    const badge = document.getElementById(badgeId);
    const msg = document.getElementById(msgId);
    const fill = document.getElementById(progressFillId);
    const spinner = document.getElementById(spinnerId);

    if (container) {
        container.style.display = 'flex';
        container.setAttribute('aria-busy', 'true');
    }

    if (badge) {
        badge.className = 'badge badge-secondary';
        badge.textContent = 'QUEUED';
    }

    if (msg) {
        msg.textContent = 'Sync job submitted to background queue. Awaiting worker pickup...';
    }

    if (fill) fill.style.width = '15%';

    const poller = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(poller);
            if (container) container.setAttribute('aria-busy', 'false');
            if (msg) msg.textContent = 'Job polling timed out. Background tasks continue on worker server.';
            if (spinner) spinner.style.display = 'none';
            if (badge) {
                badge.className = 'badge badge-warning';
                badge.textContent = 'TIMEOUT';
            }
            return;
        }

        try {
            const job = await getJobStatus(jobId);
            const summary = job.result_summary || {};
            const processed = summary.messages_processed || 0;
            const skipped = summary.messages_skipped || 0;
            const highRisk = summary.high_risk_messages || 0;
            const failed = summary.messages_failed || 0;

            if (document.getElementById(processedId)) document.getElementById(processedId).textContent = processed;
            if (document.getElementById(skippedId)) document.getElementById(skippedId).textContent = skipped;
            if (document.getElementById(highRiskId)) document.getElementById(highRiskId).textContent = highRisk;
            if (document.getElementById(failedId)) document.getElementById(failedId).textContent = failed;

            if (job.state === 'running') {
                if (badge) {
                    badge.className = 'badge badge-info';
                    badge.textContent = 'RUNNING';
                }
                if (msg) msg.textContent = 'Worker inspecting mailbox messages with heuristic heuristics and ML...';
                if (fill) fill.style.width = '65%';
            } else if (job.state === 'completed') {
                clearInterval(poller);
                if (container) container.setAttribute('aria-busy', 'false');
                if (spinner) spinner.style.display = 'none';
                if (badge) {
                    badge.className = 'badge badge-safe';
                    badge.textContent = 'COMPLETED';
                }
                if (fill) fill.style.width = '100%';
                if (msg) msg.textContent = `Synchronization finished. Inspected ${processed} message(s), ${highRisk} high-risk alert(s) identified.`;
                if (typeof onComplete === 'function') onComplete(job);
            } else if (job.state === 'failed') {
                clearInterval(poller);
                if (container) container.setAttribute('aria-busy', 'false');
                if (spinner) spinner.style.display = 'none';
                if (badge) {
                    badge.className = 'badge badge-phishing';
                    badge.textContent = 'FAILED';
                }
                if (fill) fill.style.width = '100%';
                if (msg) msg.textContent = `Job error: ${job.error_message || 'Synchronization task encountered an error.'}`;
                if (typeof onError === 'function') onError(job);
            }
        } catch (err) {
            console.warn('[PhishGuard Jobs] Polling error:', err);
        }
    }, pollIntervalMs);
}
