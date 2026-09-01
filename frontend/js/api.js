// PhishGuard - Mock & Real API Gateway Controller
import { mockResponses } from './mock-data.js';

// Toggle this flag to switch between live FastAPI server and local browser mock analysis
export const USE_MOCK_API = false; 
export const API_BASE_URL = "http://localhost:8000/api/v1";
export const APP_ENV = "development"; // Change to "production" in production environments

/**
 * Helper to construct request headers with optional JSON content-type and JWT authorization.
 */
function getHeaders(includeJsonContentType = true) {
    const headers = {};
    if (includeJsonContentType) {
        headers['Content-Type'] = 'application/json';
    }
    const token = localStorage.getItem('phishguard_access_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Standardizes fetch responses, intercepts 401 Unauthorized codes to trigger session logouts.
 */
async function handleResponse(response) {
    if (response.status === 401) {
        localStorage.removeItem('phishguard_logged_in');
        localStorage.removeItem('phishguard_user_email');
        localStorage.removeItem('phishguard_access_token');
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        throw new Error("Session expired. Please log in again.");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned status: ${response.status}`);
    }
    return await response.json();
}

/**
 * Centralized error handler preventing silent mock fallbacks in production mode.
 */
function handleError(e, fallbackFn, ...args) {
    console.warn("[PhishGuard API] Request failed:", e);
    if (APP_ENV === 'production') {
        alert("PhishGuard Security Service is currently unavailable. Please try again later.");
        throw new Error("PhishGuard Service is currently unavailable. Please try again later.");
    }
    return fallbackFn(...args);
}

/**
 * Submits email details for analysis.
 */
export async function analyzeEmail(sender, recipient, subject, body, fileInfo = null) {
    if (USE_MOCK_API) {
        return runMockAnalysis(sender, recipient, subject, body, fileInfo);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scans/text`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({ sender, recipient, subject, body })
        });
        const data = await handleResponse(response);
        saveScanToHistory(data);
        return data;
    } catch (e) {
        return handleError(e, runMockAnalysis, sender, recipient, subject, body, fileInfo);
    }
}

/**
 * Fetch scan report details.
 */
export async function getScanResult(scan_id) {
    if (USE_MOCK_API) {
        return runMockGetScanResult(scan_id);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scans/${scan_id}`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, runMockGetScanResult, scan_id);
    }
}

/**
 * Submit feedback details.
 */
export async function submitFeedback(scan_id, rating, comment) {
    if (USE_MOCK_API) {
        return { success: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scans/${scan_id}/feedback`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({ rating, comment })
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: true }));
    }
}

/**
 * Fetch scan history logs list.
 */
export async function getScanHistory() {
    if (USE_MOCK_API) {
        return runMockGetHistory();
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scans`, {
            headers: getHeaders(false)
        });
        const data = await handleResponse(response);
        return data.items || data;
    } catch (e) {
        return handleError(e, runMockGetHistory);
    }
}

/**
 * Fetch stats aggregators.
 */
export async function getDashboardStats() {
    if (USE_MOCK_API) {
        return runMockGetStats();
    }

    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, runMockGetStats);
    }
}

export async function loginUser(email, password) {
    if (USE_MOCK_API) {
        return runMockLogin(email, password);
    }

    try {
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        if (!response.ok) {
            throw new Error("Invalid email or password.");
        }
        const data = await response.json();
        localStorage.setItem('phishguard_logged_in', 'true');
        localStorage.setItem('phishguard_user_email', email);
        if (data.access_token) {
            localStorage.setItem('phishguard_access_token', data.access_token);
        }
        return data;
    } catch (e) {
        return handleError(e, runMockLogin, email, password);
    }
}

/**
 * Mock registration check.
 */
export async function registerUser(name, email, password) {
    if (USE_MOCK_API) {
        return runMockRegister(name, email, password);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, confirm_password: password })
        });
        if (!response.ok) {
            throw new Error("Registration failed. Email may already be registered or password is too short.");
        }
        const data = await response.json();
        localStorage.setItem('phishguard_logged_in', 'true');
        localStorage.setItem('phishguard_user_email', email);
        return data;
    } catch (e) {
        console.warn("[PhishGuard API] Registration connection failed, falling back to browser mock...", e);
        return runMockRegister(name, email, password);
    }
}

// ==========================================
// FALLBACK BROWSER MOCK IMPLEMENTATIONS
// ==========================================

async function runMockAnalysis(sender, recipient, subject, body, fileInfo = null) {
    const delay = 800 + Math.floor(Math.random() * 400);
    await new Promise(resolve => setTimeout(resolve, delay));

    if (fileInfo) {
        const name = fileInfo.name.toLowerCase();
        if (name.includes('safe') || name.includes('meeting')) {
            return {
                ...mockResponses.safe,
                sender: "file-sender@example.com",
                subject: fileInfo.name
            };
        } else if (name.includes('billing') || name.includes('hold')) {
            return {
                ...mockResponses.suspicious,
                sender: "billing@example-hold.com",
                subject: fileInfo.name
            };
        } else {
            return {
                ...mockResponses.phishing,
                sender: "alert@fictional-domain.xyz",
                subject: fileInfo.name
            };
        }
    }

    const fullText = `${sender} ${subject} ${body}`.toLowerCase();
    let classification = 'safe';
    let responsePayload = { ...mockResponses.safe };

    if (fullText.includes('fictional-bank') || fullText.includes('limit') || fullText.includes('identity verification') || fullText.includes('.xyz')) {
        classification = 'phishing';
        responsePayload = { ...mockResponses.phishing };
    } else if (fullText.includes('billing') || fullText.includes('hold') || fullText.includes('temporary hold') || fullText.includes('urgency')) {
        classification = 'suspicious';
        responsePayload = { ...mockResponses.suspicious };
    } else {
        let score = 15;
        const indicators = [];
        
        if (sender.includes('admin') || sender.includes('security') || sender.includes('alert')) {
            score += 15;
            indicators.push({
                code: "SENDER_ALERT",
                severity: "medium",
                title: "Alert Sender Address",
                message: "Sender email address claims administrative authority roles."
            });
        }
        
        if (fullText.includes('urgent') || fullText.includes('immediate') || fullText.includes('action required')) {
            score += 20;
            indicators.push({
                code: "URGENT_LANGUAGE",
                severity: "medium",
                title: "Urgent Warning Markers",
                message: "The message pressures the recipient to react quickly."
            });
        }

        if (body.includes('http://') || body.includes('https://')) {
            score += 15;
            indicators.push({
                code: "HYPERLINK_CHECK",
                severity: "low",
                title: "Extracted Hyperlinks",
                message: "Identified outgoing hyperlinks in email body payload."
            });
        }

        if (score >= 45) {
            classification = 'suspicious';
            responsePayload = {
                scan_id: "scan-custom-" + Math.floor(Math.random() * 9999),
                classification,
                risk_score: score,
                confidence: 84.0,
                model_version: "heuristic-xgb-v1.2",
                processing_time_ms: 84,
                indicators,
                recommendation: "Caution. Verify the sender identity through a trusted alternative channel before clicking any links.",
                disclaimer: "This demonstration result is an automated indicator based on heuristic rules, not a guarantee."
            };
        } else {
            responsePayload = {
                scan_id: "scan-custom-" + Math.floor(Math.random() * 9999),
                classification,
                risk_score: score,
                confidence: 92.5,
                model_version: "heuristic-xgb-v1.2",
                processing_time_ms: 70,
                indicators: indicators.length ? indicators : [{ code: "CLEAN_TEXT", severity: "low", title: "Clean scan results", message: "No threat markers identified in input headers." }],
                recommendation: "Safe. This email contains no visible warning flags. Proceed with standard communication.",
                disclaimer: "This demonstration result is an automated indicator based on heuristic rules, not a guarantee."
            };
        }
    }

    const finalResult = {
        ...responsePayload,
        sender: sender || "undisclosed-sender@example.com",
        recipient: recipient || "recipient@example.com",
        subject: subject || "(No Subject)",
        timestamp: new Date().toISOString()
    };

    saveScanToHistory(finalResult);
    return finalResult;
}

function saveScanToHistory(result) {
    try {
        const history = JSON.parse(localStorage.getItem('phishguard_scan_history') || '[]');
        const record = {
            scan_id: result.scan_id,
            timestamp: result.timestamp || new Date().toISOString(),
            subject: result.subject,
            classification: result.classification,
            risk_score: result.risk_score,
            model_version: result.model_version
        };
        history.unshift(record);
        localStorage.setItem('phishguard_scan_history', JSON.stringify(history.slice(0, 50)));
    } catch (e) {
        console.warn("[PhishGuard] Could not save scan to history localStorage:", e);
    }
}

function runMockGetScanResult(scan_id) {
    const latestStr = sessionStorage.getItem('phishguard_latest_result');
    if (latestStr) {
        const latest = JSON.parse(latestStr);
        if (latest.scan_id === scan_id) {
            return latest;
        }
    }
    if (scan_id === 'scan-safe-001') return { ...mockResponses.safe, sender: "colleague@organization-sandbox.com", subject: "Weekly Sync Agenda", timestamp: new Date().toISOString() };
    if (scan_id === 'scan-suspicious-002') return { ...mockResponses.suspicious, sender: "updates@sandbox-billing-alerts.com", subject: "Suspicious Activity Hold", timestamp: new Date().toISOString() };
    if (scan_id === 'scan-phishing-003') return { ...mockResponses.phishing, sender: "support@fictional-bank-security.com", subject: "URGENT: Account Limitation", timestamp: new Date().toISOString() };
    throw new Error(`Report not found for ID: ${scan_id}`);
}

function runMockGetHistory() {
    const history = JSON.parse(localStorage.getItem('phishguard_scan_history') || '[]');
    if (history.length === 0) {
        const defaults = [
            { scan_id: "scan-phishing-003", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), subject: "URGENT: Account Limitation Notice", classification: "phishing", risk_score: 92, model_version: "heuristic-xgb-v1.2" },
            { scan_id: "scan-suspicious-002", timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), subject: "Action Required: Billing Profile Hold", classification: "suspicious", risk_score: 48, model_version: "heuristic-xgb-v1.2" },
            { scan_id: "scan-safe-001", timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), subject: "Weekly Sync Agenda: Marketing Review", classification: "safe", risk_score: 12, model_version: "heuristic-xgb-v1.2" }
        ];
        localStorage.setItem('phishguard_scan_history', JSON.stringify(defaults));
        return defaults;
    }
    return history;
}

function runMockGetStats() {
    const history = runMockGetHistory();
    let total = history.length;
    let safeCount = 0;
    let suspiciousCount = 0;
    let phishingCount = 0;
    let scoreSum = 0;

    history.forEach(item => {
        scoreSum += item.risk_score;
        if (item.classification === 'safe') safeCount++;
        else if (item.classification === 'suspicious') suspiciousCount++;
        else if (item.classification === 'phishing') phishingCount++;
    });

    const avgRiskScore = total > 0 ? Math.round(scoreSum / total) : 0;
    return {
        total_scans: total,
        safe_results: safeCount,
        suspicious_results: suspiciousCount,
        phishing_results: phishingCount,
        average_risk_score: avgRiskScore
    };
}

async function runMockLogin(email, password) {
    if (!email.includes('@') || password.length < 4) {
        throw new Error("Invalid email format or password (minimum 4 characters).");
    }
    localStorage.setItem('phishguard_logged_in', 'true');
    localStorage.setItem('phishguard_user_email', email);
    return { success: true, email };
}

async function runMockRegister(name, email, password) {
    if (name.trim().length < 2) {
        throw new Error("Please enter your name.");
    }
    if (!email.includes('@')) {
        throw new Error("Please enter a valid email.");
    }
    if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
    }
    localStorage.setItem('phishguard_logged_in', 'true');
    localStorage.setItem('phishguard_user_email', email);
    return { success: true, email };
}

/**
 * Fetch connected email accounts for current user.
 */
export async function getIntegrations() {
    if (USE_MOCK_API) {
        return { integrations: [], count: 0 };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ integrations: [], count: 0 }));
    }
}

/**
 * Initiates Gmail OAuth connection flow and retrieves authorization URL.
 */
export async function getGmailAuthUrl() {
    if (USE_MOCK_API) {
        return { provider: "gmail", authorization_url: "#" };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/gmail/connect`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ provider: "gmail", authorization_url: "#" }));
    }
}

/**
 * Pauses Gmail automatic inbox monitoring.
 */
export async function pauseGmailIntegration() {
    if (USE_MOCK_API) {
        return { success: true, message: "Monitoring paused." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/gmail/pause`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Resumes Gmail automatic inbox monitoring.
 */
export async function resumeGmailIntegration() {
    if (USE_MOCK_API) {
        return { success: true, message: "Monitoring resumed." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/gmail/resume`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Disconnects Gmail account and purges stored OAuth tokens.
 */
export async function disconnectGmailIntegration() {
    if (USE_MOCK_API) {
        return { success: true, message: "Disconnected." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/gmail`, {
            method: 'DELETE',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Deletes stored scan summaries and monitored message records for Gmail.
 */
export async function deleteGmailIntegrationData() {
    if (USE_MOCK_API) {
        return { success: true, message: "Data deleted." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/gmail/data`, {
            method: 'DELETE',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Retrieves the status and progress of a background job.
 */
export async function getJobStatus(jobId) {
    if (USE_MOCK_API) {
        return {
            job_id: jobId,
            job_type: "gmail_sync",
            status: "completed",
            result_summary: {
                messages_found: 2,
                messages_processed: 2,
                messages_skipped: 0,
                messages_failed: 0,
                high_risk_count: 0
            }
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => { throw e; });
    }
}

/**
 * Manually triggers inbox check for new emails with background polling.
 */
export async function syncGmailIntegration(onProgress = null) {
    if (USE_MOCK_API) {
        return {
            status: "completed",
            messages_found: 2,
            messages_processed: 2,
            messages_skipped: 0,
            messages_failed: 0,
            high_risk_count: 1,
            last_sync_at: new Date().toISOString(),
            recent_messages: []
        };
    }

    try {
        const enqueueRes = await fetch(`${API_BASE_URL}/integrations/gmail/sync`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        const jobInfo = await handleResponse(enqueueRes);

        // If returned direct result (legacy or sync fallback)
        if (jobInfo.messages_processed !== undefined) {
            return jobInfo;
        }

        // If background job queued (HTTP 202)
        if (jobInfo.job_id) {
            if (onProgress) onProgress("queued", "Job queued in background worker...");

            const maxAttempts = 60; // 60 seconds max
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const job = await getJobStatus(jobInfo.job_id);

                if (onProgress) {
                    onProgress(job.status, `Processing inbox (${job.status})...`);
                }

                if (job.status === "completed") {
                    return job.result_summary || {
                        status: "completed",
                        messages_found: 0,
                        messages_processed: 0,
                        messages_skipped: 0,
                        messages_failed: 0,
                        high_risk_count: 0
                    };
                } else if (job.status === "failed") {
                    throw new Error(job.error_message || "Background sync job failed.");
                } else if (job.status === "cancelled") {
                    throw new Error(job.error_message || "Background sync job was cancelled.");
                }
            }
            throw new Error("Job timed out waiting for worker execution.");
        }

        return jobInfo;
    } catch (e) {
        return handleError(e, () => {
            throw e;
        });
    }
}

/**
 * Retrieves the Microsoft OAuth 2.0 authorization URL.
 */
export async function getOutlookAuthUrl() {
    if (USE_MOCK_API) {
        return {
            provider: "outlook",
            authorization_url: "#",
            message: "Microsoft OAuth connection is mocked."
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/outlook/connect`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ provider: "outlook", authorization_url: "#" }));
    }
}

/**
 * Manually triggers inbox check for new Outlook emails with background polling.
 */
export async function syncOutlookIntegration(onProgress = null) {
    if (USE_MOCK_API) {
        return {
            status: "completed",
            messages_found: 2,
            messages_processed: 2,
            messages_skipped: 0,
            messages_failed: 0,
            high_risk_count: 1,
            last_sync_at: new Date().toISOString(),
            recent_messages: []
        };
    }

    try {
        const enqueueRes = await fetch(`${API_BASE_URL}/integrations/outlook/sync`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        const jobInfo = await handleResponse(enqueueRes);

        if (jobInfo.messages_processed !== undefined) {
            return jobInfo;
        }

        if (jobInfo.job_id) {
            if (onProgress) onProgress("queued", "Job queued in background worker...");

            const maxAttempts = 60;
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const job = await getJobStatus(jobInfo.job_id);

                if (onProgress) {
                    onProgress(job.status, `Processing Outlook inbox (${job.status})...`);
                }

                if (job.status === "completed") {
                    return job.result_summary || {
                        status: "completed",
                        messages_found: 0,
                        messages_processed: 0,
                        messages_skipped: 0,
                        messages_failed: 0,
                        high_risk_count: 0
                    };
                } else if (job.status === "failed") {
                    throw new Error(job.error_message || "Background sync job failed.");
                } else if (job.status === "cancelled") {
                    throw new Error(job.error_message || "Background sync job was cancelled.");
                }
            }
            throw new Error("Job timed out waiting for worker execution.");
        }

        return jobInfo;
    } catch (e) {
        return handleError(e, () => { throw e; });
    }
}

/**
 * Pauses Outlook email monitoring.
 */
export async function pauseOutlookIntegration() {
    if (USE_MOCK_API) {
        return { success: true, message: "Monitoring paused." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/outlook/pause`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Resumes Outlook email monitoring.
 */
export async function resumeOutlookIntegration() {
    if (USE_MOCK_API) {
        return { success: true, message: "Monitoring resumed." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/outlook/resume`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Disconnects Outlook account and removes credentials.
 */
export async function disconnectOutlookIntegration() {
    if (USE_MOCK_API) {
        return { success: true, message: "Outlook account disconnected." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/outlook`, {
            method: 'DELETE',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}

/**
 * Retrieves recent monitored email summaries across all integrations.
 */
export async function getMonitoredMessages(limit = 20) {
    if (USE_MOCK_API) {
        return { messages: [], count: 0 };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/integrations/messages?limit=${limit}`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ messages: [], count: 0 }));
    }
}

/**
 * Initiates phone verification via OTP SMS.
 */
export async function startPhoneVerification(phoneNumber) {
    if (USE_MOCK_API) {
        return { status: "pending", phone_number_masked: "+1 ••• ••• 0123", mock_mode: true, message: "Verification code sent (use 123456)." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/phone/start-verification`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({ phone_number: phoneNumber })
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => { throw e; });
    }
}

/**
 * Confirms OTP verification code for user's phone number.
 */
export async function checkPhoneVerification(phoneNumber, code) {
    if (USE_MOCK_API) {
        return { success: true, message: "Phone number verified successfully.", is_phone_verified: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/phone/check-verification`, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({ phone_number: phoneNumber, code: code })
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => { throw e; });
    }
}

/**
 * Fetches user notification preferences.
 */
export async function getNotificationPreferences() {
    if (USE_MOCK_API) {
        return {
            phone_number_masked: null,
            is_phone_verified: false,
            sms_alerts_enabled: false,
            risk_threshold: 80,
            browser_alerts_enabled: true,
            alerts_paused: false,
            consent_recorded_at: null
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/preferences`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({
            phone_number_masked: null,
            is_phone_verified: false,
            sms_alerts_enabled: false,
            risk_threshold: 80,
            browser_alerts_enabled: true,
            alerts_paused: false,
            consent_recorded_at: null
        }));
    }
}

/**
 * Updates user notification preferences (opt-in, threshold, pause).
 */
export async function updateNotificationPreferences(preferences) {
    if (USE_MOCK_API) {
        return { ...preferences, is_phone_verified: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/preferences`, {
            method: 'PATCH',
            headers: getHeaders(true),
            body: JSON.stringify(preferences)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => { throw e; });
    }
}

/**
 * Sends a safe test notification SMS.
 */
export async function sendTestNotification() {
    if (USE_MOCK_API) {
        return { success: true, message: "Test SMS alert sent successfully.", channel: "sms" };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/test`, {
            method: 'POST',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => { throw e; });
    }
}

/**
 * Retrieves delivery audit logs of notifications.
 */
export async function getNotifications(limit = 20) {
    if (USE_MOCK_API) {
        return { notifications: [], count: 0 };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications?limit=${limit}`, {
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ notifications: [], count: 0 }));
    }
}

/**
 * Removes user's stored phone number and disables SMS notifications.
 */
export async function deletePhoneNumber() {
    if (USE_MOCK_API) {
        return { success: true, message: "Phone number removed." };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/phone`, {
            method: 'DELETE',
            headers: getHeaders(false)
        });
        return await handleResponse(response);
    } catch (e) {
        return handleError(e, () => ({ success: false, message: e.message }));
    }
}


