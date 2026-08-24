// PhishGuard - Fictional Harmless Demo Content & Responses

export const demoEmails = {
    safe: {
        sender: "colleague@organization-sandbox.com",
        recipient: "team@organization-sandbox.com",
        subject: "Weekly Sync Agenda: Q3 Marketing Campaign Review",
        body: "Hi Team,\n\nI hope you are doing well. I have scheduled our campaign review sync for tomorrow at 2:00 PM in conference room 4B. We will review the slide decks and outline the main execution deliverables. Please review the agenda document before the sync. Let me know if the time works for you.\n\nBest regards,\nSarah Jenkins\nProject Lead"
    },
    suspicious: {
        sender: "updates@sandbox-billing-alerts.com",
        recipient: "user@organization-sandbox.com",
        subject: "Action Required: Suspicious Activity Hold on Billing Profile",
        body: "Attention User,\n\nWe detected a login attempt on your billing dashboard from a device located in an unfamiliar country. To protect your details, a temporary hold has been configured on your card transfers. Please review the activity details at http://sandbox-billing-alerts.com/activity to clear the block.\n\nWarning: Failure to verify within 48 hours will trigger billing adjustments."
    },
    phishing: {
        sender: "support@fictional-bank-security.com",
        recipient: "customer@sandbox-mail.com",
        subject: "URGENT: Account Limitation Notice - Identity Verification Required",
        body: "Dear Valued Customer,\n\nYour account has been flagged for violating our security policy due to multiple incorrect passcode entries. To secure your online banking funds and avoid permanent account limitation, you must verify your identity immediately.\n\nPlease visit our secure banking link at http://fictional-bank-security-portal.xyz/login to update your passcode, security questions, and verify your personal credentials.\n\nThis is an automated threat warning. Failure to verify immediately will result in complete account termination."
    }
};

export const mockResponses = {
    safe: {
        scan_id: "scan-safe-001",
        classification: "safe",
        risk_score: 12,
        confidence: 94.5,
        model_version: "heuristic-xgb-v1.2",
        processing_time_ms: 68,
        indicators: [
            {
                code: "MX_RECORD_VALID",
                severity: "low",
                title: "Valid mail server records",
                message: "The sender domain contains active DNS MX and SPF routing records."
            },
            {
                code: "STANDARD_TYPOGRAPHY",
                severity: "low",
                title: "Standard formatting",
                message: "The email contents contain standard spacing and neutral lexical patterns."
            }
        ],
        recommendation: "Safe. This email contains no visible warning flags. Proceed with standard communication.",
        disclaimer: "This demonstration result is an automated indicator based on heuristic rules, not a guarantee."
    },
    suspicious: {
        scan_id: "scan-suspicious-002",
        classification: "suspicious",
        risk_score: 48,
        confidence: 82.0,
        model_version: "heuristic-xgb-v1.2",
        processing_time_ms: 92,
        indicators: [
            {
                code: "URGENT_LANGUAGE",
                severity: "medium",
                title: "Urgency signals",
                message: "The message pressures the recipient with a 48-hour verification limit."
            },
            {
                code: "EXTERNAL_URL",
                severity: "medium",
                title: "External hyperlink",
                message: "Contains a link to a billing alerts domain requiring verification."
            }
        ],
        recommendation: "Caution. Verify the sender identity through a trusted alternative channel before clicking any links.",
        disclaimer: "This demonstration result is an automated indicator based on heuristic rules, not a guarantee."
    },
    phishing: {
        scan_id: "scan-phishing-003",
        classification: "phishing",
        risk_score: 92,
        confidence: 97.8,
        model_version: "heuristic-xgb-v1.2",
        processing_time_ms: 110,
        indicators: [
            {
                code: "URGENT_LIMITATION",
                severity: "high",
                title: "Social engineering keywords",
                message: "Highly urgent warning terms matching password limitations and fund locks."
            },
            {
                code: "BRAND_TYPOSQUAT",
                severity: "high",
                title: "Brand impersonation signature",
                message: "Sender domain mimics a secure banking institution using a lookalike URL configuration."
            },
            {
                code: "HIGH_RISK_TLD",
                severity: "high",
                title: "Dangerous link TLD",
                message: "Includes link destinations hosted on cheap or high-risk top level domains (.xyz)."
            }
        ],
        recommendation: "Critical Warning. Do not click links, open attachments, or input bank credentials. Report and delete the message.",
        disclaimer: "This demonstration result is an automated indicator based on heuristic rules, not a guarantee."
    }
};
