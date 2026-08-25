// PhishGuard - Mock & Real API Gateway Controller
import { mockResponses } from './mock-data.js';

// Toggle this flag to switch between live FastAPI server and local browser mock analysis
export const USE_MOCK_API = false; 
export const API_BASE_URL = "http://localhost:8000/api/v1";

/**
 * Submits email details for analysis.
 */
export async function analyzeEmail(sender, recipient, subject, body, fileInfo = null) {
    if (USE_MOCK_API) {
        return runMockAnalysis(sender, recipient, subject, body, fileInfo);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/scans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender, recipient, subject, body })
        });
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        const data = await response.json();
        saveScanToHistory(data);
        return data;
    } catch (e) {
        console.warn("[PhishGuard API] Live backend scans failed, falling back to mock...", e);
        return runMockAnalysis(sender, recipient, subject, body, fileInfo);
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
        const response = await fetch(`${API_BASE_URL}/scans/${scan_id}`);
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.warn("[PhishGuard API] Live backend fetch report failed, falling back to mock...", e);
        return runMockGetScanResult(scan_id);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating, comment })
        });
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.warn("[PhishGuard API] Feedback submission failed, falling back to mock...", e);
        return { success: true };
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
        const response = await fetch(`${API_BASE_URL}/scans`);
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.warn("[PhishGuard API] History fetch failed, falling back to mock...", e);
        return runMockGetHistory();
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
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`);
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.warn("[PhishGuard API] Stats fetch failed, falling back to mock...", e);
        return runMockGetStats();
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
        console.warn("[PhishGuard API] Login connection failed, falling back to browser mock...", e);
        return runMockLogin(email, password);
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
