// PhishGuard - Real-World Threat Scenarios & Intelligence Taxonomy

export const demoEmails = {
    m365_harvest: {
        name: "Microsoft 365 Credential Harvest",
        badge: "Credential Harvest",
        sender: "security-alert@micros0ft-support.verify-auth.com",
        recipient: "alex.turner@enterprise-corp.com",
        subject: "Action Required: Immediate Microsoft 365 Password Reset Required",
        body: "Dear User,\n\nOur automated security telemetry has detected multiple unauthorized login attempts to your Microsoft 365 tenant from an unverified IP address in Eastern Europe.\n\nTo prevent immediate suspension of your Microsoft Exchange and OneDrive services, you are required to re-verify your corporate credentials within 2 hours.\n\nPlease visit our secure identity verification portal: http://micros0ft-login.verify-portal.xyz/auth\n\nFailure to complete this verification will result in permanent account locking and SecOps escalation.\n\nMicrosoft Global Security Team",
        category: "phishing",
        expectedScore: 94
    },
    paypal_invoice: {
        name: "PayPal Fraudulent Invoice",
        badge: "Payment Fraud",
        sender: "billing-service@paypa1-notification-desk.com",
        recipient: "finance@enterprise-corp.com",
        subject: "Invoice #INV-98234 Confirmed: Automatic Debit of $849.00 USD Pending",
        body: "Hello Customer,\n\nThank you for your order with GeekSquad Technical Care. Your payment of $849.00 USD has been automatically processed and debited from your linked bank account.\n\nIf you did not authorize this subscription purchase, call our fraud dispute center immediately or click http://paypal-dispute-cancellation.cc/refund to cancel this invoice within 24 hours.\n\nTransaction ID: 9482-TX-2026\nPayPal Billing Operations",
        category: "phishing",
        expectedScore: 91
    },
    ceo_wire: {
        name: "CEO Executive Wire Transfer (BEC)",
        badge: "Executive BEC",
        sender: "richard.hendricks.ceo@vip-executive-direct.net",
        recipient: "controller@enterprise-corp.com",
        subject: "CONFIDENTIAL / TIME SENSITIVE: Urgent M&A Acquisition Wire Transfer",
        body: "Hi Robert,\n\nI am currently in an all-day executive board meeting with restricted mobile access. We are finalizing an off-market strategic acquisition and need an initial confidential escrow wire of $142,500 processed before 3:00 PM today.\n\nPlease confirm you are at your desk so I can send the overseas bank routing instructions. Do not discuss this with the team until we file the 8-K disclosure.\n\nThanks,\nRichard Hendricks\nChief Executive Officer",
        category: "phishing",
        expectedScore: 86
    },
    dhl_tracking: {
        name: "DHL Express Parcel Delivery Malware",
        badge: "Malware Drop",
        sender: "tracking-notice@dhl-express-logistics-portal.info",
        recipient: "employee@enterprise-corp.com",
        subject: "Delivery Failure Notice: Package #DHL-938217 On Hold at Customs",
        body: "Dear Recipient,\n\nYour international shipment #DHL-938217 could not be cleared for final delivery due to incomplete duty documentation.\n\nPlease download and print the attached digital shipping release document: http://dhl-express-waybill.info/download-release.exe\n\nPackages held for longer than 48 hours will be returned to the origin sender.\n\nDHL International Express Team",
        category: "phishing",
        expectedScore: 89
    },
    hr_payroll: {
        name: "HR Direct Deposit Update",
        badge: "Payroll Scam",
        sender: "hr-payroll-benefits@workday-employee-portal.co",
        recipient: "all-staff@enterprise-corp.com",
        subject: "Mandatory: Review and Confirm Your 2026 Direct Deposit & Tax Withholding",
        body: "All Employees,\n\nIn accordance with Q3 financial audits, all staff members must review their direct deposit bank routing information and submit updated W-4 withholding confirmations before the upcoming payroll cycle.\n\nAccess your employee self-service portal: http://workday-hr-benefits-update.co/login\n\nFailure to confirm your account may cause payment distribution delays.\n\nCorporate People Operations",
        category: "phishing",
        expectedScore: 83
    },
    clean_memo: {
        name: "Legitimate All-Hands Sync Memo",
        badge: "Clean / Safe",
        sender: "communications@internal-enterprise.com",
        recipient: "team@internal-enterprise.com",
        subject: "All-Hands Meeting Notes & Q3 Engineering Milestone Summary",
        body: "Hi Team,\n\nThank you to everyone who joined our quarterly engineering town hall today! Here is a summary of the main milestones:\n\n1. Security compliance audit completed with zero non-conformances.\n2. Ingestion latency decreased by 40% across all services.\n3. Next sprint planning starts Monday at 10:00 AM in Conference Room 4B.\n\nHave a wonderful weekend!\n\nInternal Communications Team",
        category: "safe",
        expectedScore: 12
    },
    // Compatibility keys
    safe: {
        sender: "communications@internal-enterprise.com",
        recipient: "team@internal-enterprise.com",
        subject: "All-Hands Meeting Notes & Q3 Engineering Milestone Summary",
        body: "Hi Team,\n\nThank you to everyone who joined our quarterly engineering town hall today! Here is a summary of the main milestones:\n\n1. Security compliance audit completed with zero non-conformances.\n2. Ingestion latency decreased by 40% across all services.\n3. Next sprint planning starts Monday at 10:00 AM in Conference Room 4B.\n\nHave a wonderful weekend!\n\nInternal Communications Team"
    },
    phishing: {
        sender: "security-alert@micros0ft-support.verify-auth.com",
        recipient: "alex.turner@enterprise-corp.com",
        subject: "Action Required: Immediate Microsoft 365 Password Reset Required",
        body: "Dear User,\n\nOur automated security telemetry has detected multiple unauthorized login attempts to your Microsoft 365 tenant from an unverified IP address in Eastern Europe.\n\nTo prevent immediate suspension of your Microsoft Exchange and OneDrive services, you are required to re-verify your corporate credentials within 2 hours.\n\nPlease visit our secure identity verification portal: http://micros0ft-login.verify-portal.xyz/auth\n\nFailure to complete this verification will result in permanent account locking and SecOps escalation.\n\nMicrosoft Global Security Team"
    },
    suspicious: {
        sender: "tracking-notice@dhl-express-logistics-portal.info",
        recipient: "employee@enterprise-corp.com",
        subject: "Delivery Failure Notice: Package #DHL-938217 On Hold at Customs",
        body: "Dear Recipient,\n\nYour international shipment #DHL-938217 could not be cleared for final delivery due to incomplete duty documentation.\n\nPlease download and print the attached digital shipping release document: http://dhl-express-waybill.info/download-release.exe\n\nPackages held for longer than 48 hours will be returned to the origin sender.\n\nDHL International Express Team"
    }
};

export const mitreAttackTaxonomy = {
    m365_harvest: [
        { id: "T1566.002", name: "Spearphishing Link", tactic: "Initial Access", desc: "Adversary sends targeted emails containing malicious links to lure victims to credential harvesting sites." },
        { id: "T1586.002", name: "Compromised Account", tactic: "Resource Development", desc: "Use of legitimate email infrastructure or spoofed addresses to bypass SPF/DKIM." },
        { id: "T1056.001", name: "Keylogging / Credential Input", tactic: "Credential Access", desc: "Adversary captures account login credentials via hosted fake identity portal." }
    ],
    paypal_invoice: [
        { id: "T1566.002", name: "Spearphishing Link", tactic: "Initial Access", desc: "Fake invoice notification with deceptive dispute link." },
        { id: "T1534", name: "Internal Spearphishing", tactic: "Lateral Movement", desc: "Targets finance department to initiate unauthorized payment debit." }
    ],
    ceo_wire: [
        { id: "T1656", name: "Impersonation", tactic: "Defense Evasion", desc: "Adversary mimics corporate executive identity to coerce unauthorized funds transfer." },
        { id: "T1566.003", name: "Spearphishing via Service", tactic: "Initial Access", desc: "Executive pretexting without suspicious link to evade automated signature filters." }
    ],
    default: [
        { id: "T1566", name: "Phishing", tactic: "Initial Access", desc: "Adversary sends phishing messages to gain initial access to employee accounts or endpoints." },
        { id: "T1204", name: "User Execution", tactic: "Execution", desc: "Relies on recipient interaction (clicking deceptive link or downloading payload)." }
    ]
};

export const mockResponses = {
    safe: {
        scan_id: "scan-safe-001",
        classification: "safe",
        risk_score: 12,
        confidence: 96.5,
        model_version: "heuristic-xgb-v1.2",
        processing_time_ms: 18,
        indicators: [
            {
                code: "SPF_DKIM_PASS",
                severity: "low",
                title: "Cryptographic Alignment Valid",
                message: "DKIM signature and SPF routing match sender domain internal-enterprise.com."
            },
            {
                code: "CLEAN_LEXICAL_CUES",
                severity: "low",
                title: "Neutral Lexical Tone",
                message: "No coercive urgency triggers, extortion language, or credential prompts detected."
            }
        ],
        recommendation: "Safe. This email contains no visible warning flags. Proceed with standard communication.",
        disclaimer: "This result is an automated threat indicator based on heuristic inspection rules, not a guarantee."
    },
    suspicious: {
        scan_id: "scan-susp-002",
        classification: "suspicious",
        risk_score: 54,
        confidence: 84.0,
        model_version: "heuristic-xgb-v1.2",
        processing_time_ms: 24,
        indicators: [
            {
                code: "UNVERIFIED_EXTERNAL_LINK",
                severity: "medium",
                title: "External Tracking Link",
                message: "Contains external link to an unverified logistics top-level domain (.info)."
            },
            {
                code: "MODERATE_URGENCY",
                severity: "medium",
                title: "Time-Sensitive Request",
                message: "The message emphasizes a 48-hour delivery hold limit."
            }
        ],
        recommendation: "Caution. Verify the sender identity through a trusted alternative channel before clicking any links.",
        disclaimer: "This result is an automated threat indicator based on heuristic inspection rules, not a guarantee."
    },
    phishing: {
        scan_id: "scan-phish-003",
        classification: "phishing",
        risk_score: 94,
        confidence: 98.7,
        model_version: "heuristic-xgb-v1.2",
        processing_time_ms: 22,
        indicators: [
            {
                code: "LOOKALIKE_SENDER_DOMAIN",
                severity: "high",
                title: "Homoglyph Lookalike Domain",
                message: "Sender address uses character substitution ('micros0ft' with number 0 instead of letter O)."
            },
            {
                code: "CREDENTIAL_THEFT_PATTERN",
                severity: "high",
                title: "Credential Harvesting Language",
                message: "Coercive action demands immediate password reset under penalty of service suspension."
            },
            {
                code: "DECEPTIVE_HYPERLINK_TARGET",
                severity: "high",
                title: "Deceptive Link Target",
                message: "Hyperlink points to an unauthorized third-party top-level domain (verify-portal.xyz)."
            },
            {
                code: "HIGH_RISK_TLD",
                severity: "medium",
                title: "High-Risk Top Level Domain",
                message: "Destination hosted on a low-reputation top level domain (.xyz)."
            }
        ],
        recommendation: "Critical Threat. Do not click links, open attachments, or input corporate credentials. Quarantine and report immediately.",
        disclaimer: "This result is an automated threat indicator based on heuristic inspection rules, not a guarantee."
    }
};
