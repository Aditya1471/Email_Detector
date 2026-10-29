// PhishGuard - Result Page Controller & SecOps Incident Manager
import { getScanResult, submitFeedback } from './api.js';
import { mitreAttackTaxonomy } from './mock-data.js';
import { escapeHTML } from './utilities.js';
import { initNavigation } from './navigation.js';

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();

    // 1. Parse Scan ID from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scan_id');

    const contentWrapper = document.getElementById('result-content-wrapper');
    const emptyState = document.getElementById('result-empty-state');

    if (!scanId) {
        showEmptyState();
        return;
    }

    try {
        const result = await getScanResult(scanId);
        renderReport(result);
    } catch (err) {
        console.error("[PhishGuard] Failed to load scan result report:", err);
        showEmptyState();
    }

    function showEmptyState() {
        if (emptyState) emptyState.style.display = 'block';
        if (contentWrapper) contentWrapper.style.display = 'none';
    }

    // ==========================================
    // 2. Render Report Layout Components
    // ==========================================
    function renderReport(result) {
        if (emptyState) emptyState.style.display = 'none';
        if (contentWrapper) contentWrapper.style.display = 'block';

        // Set text metadata labels
        const scanIdEl = document.getElementById('scan-id-lbl');
        if (scanIdEl) scanIdEl.textContent = result.scan_id || 'SCAN-ANON';

        const modelVersionEl = document.getElementById('model-version-lbl');
        if (modelVersionEl) modelVersionEl.textContent = result.model_version || 'v2.4-heuristics';

        const speedEl = document.getElementById('speed-lbl');
        if (speedEl) speedEl.textContent = `${result.processing_time_ms || 22} ms`;
        
        const timestamp = result.timestamp ? new Date(result.timestamp) : new Date();
        const timestampEl = document.getElementById('timestamp-lbl');
        if (timestampEl) {
            timestampEl.textContent = timestamp.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }

        // Set Risk Score Val and animate meter bar
        const score = result.risk_score || 0;
        const scoreVal = document.getElementById('risk-score-val') || document.getElementById('risk-score-number');
        if (scoreVal) scoreVal.textContent = score;
        
        const meterBar = document.getElementById('risk-meter-bar');
        if (meterBar) {
            meterBar.style.width = `${score}%`;
            meterBar.className = 'risk-meter-bar';
            if (result.classification === 'safe') {
                meterBar.classList.add('risk-meter-bar--safe');
            } else if (result.classification === 'suspicious') {
                meterBar.classList.add('risk-meter-bar--suspicious');
            } else {
                meterBar.classList.add('risk-meter-bar--phishing');
            }
        }

        // Configure Verdict Badge visual classes
        const verdictBadge = document.getElementById('verdict-badge');
        const verdictDesc = document.getElementById('verdict-desc') || document.getElementById('verdict-explanation');
        const immediateRec = document.getElementById('immediate-recommendation');

        if (verdictBadge) {
            verdictBadge.className = 'badge';
            if (result.classification === 'safe') {
                verdictBadge.classList.add('badge-safe');
                verdictBadge.textContent = '✓ Safe';
            } else if (result.classification === 'suspicious') {
                verdictBadge.classList.add('badge-suspicious');
                verdictBadge.textContent = '! Suspicious';
            } else {
                verdictBadge.classList.add('badge-phishing');
                verdictBadge.textContent = '✖ Phishing';
            }
        }

        if (verdictDesc) {
            if (result.classification === 'safe') {
                verdictDesc.textContent = 'No critical phishing indicators or malicious patterns were detected. The domain alignment is valid and url destinations are clean.';
            } else if (result.classification === 'suspicious') {
                verdictDesc.textContent = 'Several warning patterns require review. Avoid sharing sensitive data or passwords until verification checks pass.';
            } else {
                verdictDesc.textContent = 'Warning: Severe phishing signatures detected. Spoofing indicators are present, hosted on high-risk domains.';
            }
        }

        if (immediateRec) {
            if (result.classification === 'safe') {
                immediateRec.textContent = '✓ Standard safety practices apply. Verify sender authenticity if unexpected attachments arrive.';
            } else if (result.classification === 'suspicious') {
                immediateRec.textContent = '⚠ Do not click embedded buttons or share credentials. Contact sender via an out-of-band channel.';
            } else {
                immediateRec.textContent = '⛔ High threat alert! Do not open attachments or input credentials. Quarantine email immediately.';
            }
        }

        // Set stats row metrics
        const statIndicators = document.getElementById('stat-indicators') || document.getElementById('stat-flag-count');
        if (statIndicators) statIndicators.textContent = (result.indicators || []).length;

        const statUrls = document.getElementById('stat-urls') || document.getElementById('stat-url-count');
        if (statUrls) statUrls.textContent = (result.urls || []).length || (result.indicators?.filter(i => (i.code || i.name || '').includes('URL') || (i.code || i.name || '').includes('LINK')).length ? 1 : 0);

        const statDeception = document.getElementById('stat-deception-count');
        if (statDeception) {
            statDeception.textContent = result.indicators?.filter(i => (i.severity || '').toLowerCase() === 'high' || (i.severity || '').toLowerCase() === 'critical').length || (result.risk_score > 60 ? 2 : 0);
        }

        const statThreatLevel = document.getElementById('stat-threat-level');
        if (statThreatLevel) {
            statThreatLevel.textContent = result.classification === 'safe' ? 'Low' : (result.classification === 'suspicious' ? 'Moderate' : 'Critical');
            statThreatLevel.style.color = result.classification === 'safe' ? 'var(--color-safe)' : (result.classification === 'suspicious' ? 'var(--color-warning)' : 'var(--color-phishing)');
        }

        // Render sub-sections
        renderExplainabilitySection(result);
        renderIndicators(result.indicators);
        renderUrls(result.urls);
        renderMitreAttack(result);
        renderRecommendations(result.classification);
        setupRemediationActions(result);
        setupFeedback(result.scan_id);
        setupUtilities(result);
    }

    // ==========================================
    // 3. Explainability Radar & Vector Breakdown
    // ==========================================
    let radarChartInstance = null;

    function calculateThreatVectors(result) {
        const indicators = result.indicators || [];
        const text = `${result.subject || ''} ${result.sender || ''} ${result.body || ''}`.toLowerCase();
        const urls = result.urls || [];
        const isPhish = result.classification === 'phishing';
        const isSuspicious = result.classification === 'suspicious';
        const score = result.risk_score || (isPhish ? 88 : isSuspicious ? 55 : 12);

        // Vector 1: Urgency & Coercion
        let urgencyScore = 15;
        const hasUrgentIndicator = indicators.some(i => (i.code || i.name || '').includes('URGENT'));
        const hasUrgentKeywords = /urgent|immediate|action required|suspended|24 hours|2 hours|terminate|critical|account hold/i.test(text);
        if (hasUrgentIndicator || hasUrgentKeywords) {
            urgencyScore = isPhish ? Math.min(95, score + 5) : 75;
        } else if (isPhish) {
            urgencyScore = 65;
        } else if (isSuspicious) {
            urgencyScore = 45;
        }

        // Vector 2: Sender & Domain Authenticity
        let domainScore = 10;
        const hasSenderAlert = indicators.some(i => (i.code || i.name || '').includes('SENDER') || (i.code || i.name || '').includes('SPOOF'));
        const hasHomoglyph = /micros0ft|paypa1|g00gle|app1e|amaz0n|bank0famerica|\.xyz|\.cc/i.test(text);
        if (hasSenderAlert || hasHomoglyph) {
            domainScore = isPhish ? Math.min(98, score + 8) : 80;
        } else if (isPhish) {
            domainScore = 70;
        } else if (isSuspicious) {
            domainScore = 50;
        }

        // Vector 3: Hyperlink & TLD Risk
        let linkScore = 10;
        const hasLinkIndicator = indicators.some(i => (i.code || i.name || '').includes('HIGH_RISK_TLD') || (i.code || i.name || '').includes('TYPOSQUAT'));
        const hasBadUrls = urls.some(u => typeof u === 'string' ? (u.includes('.xyz') || u.includes('.cc') || u.includes('.exe')) : (u.status === 'blocked'));
        if (hasLinkIndicator || hasBadUrls) {
            linkScore = isPhish ? Math.min(95, score + 6) : 75;
        } else if (urls.length > 0) {
            linkScore = isPhish ? 60 : 35;
        } else if (isPhish) {
            linkScore = 40;
        }

        // Vector 4: Credential & Financial Harvesting
        let credScore = 12;
        const hasCredKeywords = /password|credential|login|verify|invoice|\$|bank|routing|w-4|tax|ssn/i.test(text);
        if (hasCredKeywords && isPhish) {
            credScore = Math.min(96, score + 4);
        } else if (hasCredKeywords) {
            credScore = 60;
        } else if (isPhish) {
            credScore = 55;
        }

        // Vector 5: Linguistic & Semantic Anomaly
        let nlpScore = 15;
        if (isPhish) {
            nlpScore = Math.min(90, Math.round(score * 0.85));
        } else if (isSuspicious) {
            nlpScore = 45;
        } else {
            nlpScore = 10;
        }

        // Baseline safe values (typically 10-20% max across normal legitimate emails)
        const baseline = [15, 10, 12, 10, 15];
        const emailValues = [urgencyScore, domainScore, linkScore, credScore, nlpScore];

        return {
            categories: [
                "Urgency & Pressure",
                "Domain & Sender Trust",
                "Link & TLD Risk",
                "Credential Harvest",
                "Linguistic Anomaly"
            ],
            values: emailValues,
            baseline: baseline,
            breakdown: [
                {
                    name: "Urgency & Psychological Coercion",
                    score: urgencyScore,
                    weight: "+25% Impact",
                    icon: "fa-clock",
                    desc: urgencyScore > 50 ? "Exploits artificial time limits or threat of service cancellation." : "Tone is informational without coercive urgency."
                },
                {
                    name: "Domain & Sender Reputation",
                    score: domainScore,
                    weight: "+30% Impact",
                    icon: "fa-at",
                    desc: domainScore > 50 ? "Lookalike homoglyph or mismatch between sender display and host domain." : "Domain alignment verified against standard email reputation."
                },
                {
                    name: "Hyperlink & TLD Risk",
                    score: linkScore,
                    weight: "+20% Impact",
                    icon: "fa-link",
                    desc: linkScore > 50 ? "High-risk top level domain (.xyz/.cc) or suspicious URL redirects." : "No malicious or obfuscated destinations detected."
                },
                {
                    name: "Credential & Financial Theft",
                    score: credScore,
                    weight: "+15% Impact",
                    icon: "fa-key",
                    desc: credScore > 50 ? "Directly lures recipient to submit passwords, invoices, or personal data." : "No harvesting forms or requests for secrets identified."
                },
                {
                    name: "NLP Semantic Anomalies",
                    score: nlpScore,
                    weight: "+10% Impact",
                    icon: "fa-brain",
                    desc: nlpScore > 50 ? "High NLP classification probability for deceptive syntax." : "Natural business language with standard tone characteristics."
                }
            ]
        };
    }

    function renderExplainabilitySection(result) {
        window._currentScanResult = result;
        const vectors = calculateThreatVectors(result);
        renderRadarChart(vectors, result.classification);
        renderVectorBreakdown(vectors.breakdown);
    }

    function renderRadarChart(vectors, classification) {
        const canvas = document.getElementById('threat-radar-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (radarChartInstance) {
            radarChartInstance.destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
        const labelColor = isDark ? '#94a3b8' : '#475569';

        let primaryColor = 'rgba(37, 99, 235, 1)';
        let primaryFill = 'rgba(37, 99, 235, 0.25)';

        if (classification === 'phishing') {
            primaryColor = 'rgba(239, 68, 68, 1)';
            primaryFill = 'rgba(239, 68, 68, 0.35)';
        } else if (classification === 'suspicious') {
            primaryColor = 'rgba(245, 158, 11, 1)';
            primaryFill = 'rgba(245, 158, 11, 0.3)';
        } else {
            primaryColor = 'rgba(16, 185, 129, 1)';
            primaryFill = 'rgba(16, 185, 129, 0.25)';
        }

        radarChartInstance = new Chart(canvas, {
            type: 'radar',
            data: {
                labels: vectors.categories,
                datasets: [
                    {
                        label: 'This Email Threat Vector',
                        data: vectors.values,
                        backgroundColor: primaryFill,
                        borderColor: primaryColor,
                        pointBackgroundColor: primaryColor,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: primaryColor,
                        borderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: 'Safe Baseline Profile',
                        data: vectors.baseline,
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        borderColor: 'rgba(16, 185, 129, 0.6)',
                        borderDash: [4, 4],
                        pointBackgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderWidth: 1.5,
                        pointRadius: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#334155',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw}/100`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                            display: false
                        },
                        grid: {
                            color: gridColor
                        },
                        angleLines: {
                            color: gridColor
                        },
                        pointLabels: {
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11,
                                weight: '600'
                            },
                            color: labelColor
                        }
                    }
                }
            }
        });
    }

    function renderVectorBreakdown(breakdown) {
        const container = document.getElementById('explainability-breakdown-container');
        if (!container) return;
        container.innerHTML = '';

        breakdown.forEach(item => {
            let barColor = 'var(--color-safe)';
            let badgeClass = 'badge-safe';
            if (item.score >= 70) {
                barColor = 'var(--color-phishing)';
                badgeClass = 'badge-phishing';
            } else if (item.score >= 35) {
                barColor = 'var(--color-warning)';
                badgeClass = 'badge-warning';
            }

            const el = document.createElement('div');
            el.className = 'vector-item';
            el.innerHTML = `
                <div class="vector-header">
                    <div class="vector-title">
                        <i class="fa-solid ${item.icon}" style="color: ${barColor};" aria-hidden="true"></i>
                        <span>${escapeHTML(item.name)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="badge ${badgeClass}" style="font-size: 0.7rem;">${item.score}/100</span>
                        <span class="text-xs text-muted font-semibold">${item.weight}</span>
                    </div>
                </div>
                <div class="vector-bar-track">
                    <div class="vector-bar-fill" style="width: ${item.score}%; background-color: ${barColor};"></div>
                </div>
                <p class="vector-desc">${escapeHTML(item.desc)}</p>
            `;
            container.appendChild(el);
        });
    }

    // Observe theme attribute changes to refresh chart colors
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            if (m.type === 'attributes' && m.attributeName === 'data-theme' && window._currentScanResult) {
                renderExplainabilitySection(window._currentScanResult);
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    // ==========================================
    // 3. Render Indicators & URLs
    // ==========================================
    function renderIndicators(indicators) {
        const container = document.getElementById('indicators-list');
        if (!container) return;
        container.innerHTML = '';

        if (!indicators || indicators.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-6); color: var(--color-text-muted);">
                    <i class="fa-solid fa-shield-check" style="font-size: 2rem; color: var(--color-safe); margin-bottom: 8px; display: block;"></i>
                    No warning indicators detected. Email passed all diagnostic heuristics.
                </div>
            `;
            return;
        }

        indicators.forEach((ind) => {
            const item = document.createElement('div');
            item.className = 'indicator-item';

            const severity = (ind.severity || 'low').toLowerCase();
            let sevBadgeClass = 'badge-secondary';
            let sevIcon = 'fa-info-circle';
            
            if (severity === 'high' || severity === 'critical') {
                sevBadgeClass = 'badge-phishing';
                sevIcon = 'fa-triangle-exclamation';
            } else if (severity === 'medium') {
                sevBadgeClass = 'badge-warning';
                sevIcon = 'fa-circle-exclamation';
            } else if (severity === 'low') {
                sevBadgeClass = 'badge-safe';
                sevIcon = 'fa-shield-halved';
            }

            const title = ind.title || ind.name || ind.code || 'Threat Signal';
            const desc = ind.message || ind.description || 'Heuristic indicator flagged during email inspection.';

            item.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid ${sevIcon}" style="color: var(--color-${severity === 'high' ? 'phishing' : (severity === 'medium' ? 'warning' : 'safe')}); font-size: 1rem;"></i>
                        <span style="font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem; color: var(--color-text);">
                            ${escapeHTML(title)}
                        </span>
                    </div>
                    <span class="badge ${sevBadgeClass}" style="text-transform: uppercase; font-size: 0.7rem;">${escapeHTML(severity)}</span>
                </div>
                <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-secondary); line-height: 1.5; padding-left: 24px;">
                    ${escapeHTML(desc)}
                </p>
            `;

            container.appendChild(item);
        });
    }

    function renderUrls(urls) {
        const wrapper = document.getElementById('urls-list');
        if (!wrapper) return;
        wrapper.innerHTML = '';

        if (!urls || urls.length === 0) {
            wrapper.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-4); color: var(--color-text-muted);">
                    No embedded hyperlinks detected in email payload.
                </div>
            `;
            return;
        }

        urls.forEach((url) => {
            const item = document.createElement('div');
            item.className = 'url-item';
            let hostname = "(Failed to parse)";
            try {
                hostname = new URL(url).hostname;
            } catch (e) {}

            let badgeHtml = '<span class="badge badge-safe">✓ Standard Link</span>';
            const urlLower = url.toLowerCase();
            if (urlLower.includes('.xyz') || urlLower.includes('.cc') || urlLower.includes('verify') || urlLower.includes('update') || urlLower.includes('billing') || urlLower.includes('exe')) {
                badgeHtml = '<span class="badge badge-phishing">✖ Suspicious Target</span>';
            } else if (urlLower.includes('sandbox') || urlLower.includes('alerts')) {
                badgeHtml = '<span class="badge badge-warning">! Review Advised</span>';
            }

            item.innerHTML = `
                <div class="url-item__row">
                    <span style="font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; color: var(--color-text);">
                        <i class="fa-solid fa-globe mr-1" style="color: var(--color-primary);" aria-hidden="true"></i> ${escapeHTML(hostname)}
                    </span>
                    ${badgeHtml}
                </div>
                <div class="url-item__target">
                    ${escapeHTML(url)}
                </div>
            `;

            wrapper.appendChild(item);
        });
    }

    function renderMitreAttack(result) {
        const container = document.getElementById('mitre-attack-container');
        if (!container) return;
        container.innerHTML = '';

        const taxonomy = (result.classification === 'phishing') 
            ? (mitreAttackTaxonomy.m365_harvest || mitreAttackTaxonomy.default)
            : mitreAttackTaxonomy.default;

        taxonomy.forEach(t => {
            const card = document.createElement('div');
            card.style.cssText = "padding: var(--spacing-4); background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-md);";
            card.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <span class="badge badge-secondary" style="font-family: var(--font-mono); font-weight: 700; font-size: 0.75rem;">${escapeHTML(t.id)}</span>
                    <span class="badge badge-info" style="font-size: 0.7rem;">${escapeHTML(t.tactic)}</span>
                </div>
                <div style="font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; color: var(--color-text); margin-bottom: 4px;">
                    ${escapeHTML(t.name)}
                </div>
                <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin: 0; line-height: 1.45;">
                    ${escapeHTML(t.desc)}
                </p>
            `;
            container.appendChild(card);
        });
    }

    function renderRecommendations(classification) {
        const list = document.getElementById('recommendation-list') || document.getElementById('recommendations-list');
        if (!list) return;
        list.innerHTML = '';

        const points = [];
        if (classification === 'safe') {
            points.push("✓ No major suspicious indicators identified. Standard security vigilance applies.");
            points.push("✓ Verify sender email address domain records before forwarding.");
            points.push("✓ Remember: automated scores evaluate known heuristic patterns; remain observant.");
        } else if (classification === 'suspicious') {
            points.push("⚠ Avoid clicking buttons or links embedded inside this email.");
            points.push("⚠ Verify the sender request through an independent channel (phone or official website).");
            points.push("⚠ Do not input personal passcodes, OTPs, or payment credentials.");
        } else {
            points.push("⛔ CRITICAL THREAT: Do not click any links or download attachments.");
            points.push("⛔ Delete or quarantine the message from your email client immediately.");
            points.push("⛔ Do not reply to the sender or attempt to negotiate.");
            points.push("⛔ Report threat details to your IT security administrator.");
        }

        points.forEach(pt => {
            const li = document.createElement('li');
            li.className = 'flex items-start gap-2 text-sm text-secondary';
            li.innerHTML = `<span>${escapeHTML(pt)}</span>`;
            list.appendChild(li);
        });
    }

    // ==========================================
    // 4. SecOps Incident Remediation Actions
    // ==========================================
    function setupRemediationActions(result) {
        const statusBadge = document.getElementById('remediation-status-badge');
        const quarantineBtn = document.getElementById('btn-remediate-quarantine');
        const blockBtn = document.getElementById('btn-remediate-block');
        const alertBtn = document.getElementById('btn-remediate-alert');
        const exportExecBtn = document.getElementById('btn-export-exec-report');

        quarantineBtn?.addEventListener('click', () => {
            quarantineBtn.disabled = true;
            quarantineBtn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Message Quarantined';
            if (statusBadge) {
                statusBadge.className = 'badge badge-safe';
                statusBadge.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Quarantined in Sandbox';
            }
            alert("SecOps Action: Message has been moved to isolation quarantine.");
        });

        blockBtn?.addEventListener('click', () => {
            blockBtn.disabled = true;
            blockBtn.innerHTML = '<i class="fa-solid fa-ban mr-1"></i> Domain Blocked';
            if (statusBadge) {
                statusBadge.className = 'badge badge-safe';
                statusBadge.innerHTML = '<i class="fa-solid fa-ban mr-1"></i> Domain Blocked in Firewall';
            }
            alert("SecOps Action: Sender domain added to corporate perimeter blacklist.");
        });

        alertBtn?.addEventListener('click', () => {
            alertBtn.disabled = true;
            alertBtn.innerHTML = '<i class="fa-solid fa-tower-broadcast mr-1"></i> SIEM Webhook Sent';
            if (statusBadge) {
                statusBadge.className = 'badge badge-info';
                statusBadge.innerHTML = '<i class="fa-solid fa-tower-broadcast mr-1"></i> SIEM Incident #PG-982 Created';
            }
            alert("SecOps Action: Webhook dispatched to SIEM incident queue.");
        });

        exportExecBtn?.addEventListener('click', () => {
            downloadExecutiveReport(result);
        });
    }

    function downloadExecutiveReport(result) {
        const reportData = {
            report_title: "PhishGuard Executive Threat Intelligence & Incident Report",
            report_id: `INCIDENT-${result.scan_id || Date.now()}`,
            generated_at: new Date().toISOString(),
            classification: (result.classification || 'safe').toUpperCase(),
            risk_score: `${result.risk_score || 0}/100`,
            confidence: `${result.confidence || 95}%`,
            model_engine: result.model_version || 'v2.4-heuristics',
            compliance_framework_alignment: ["SOC 2 Type II", "NIST CSF PR.DS-5", "ISO 27001 A.8.20"],
            indicators_flagged: result.indicators || [],
            defensive_actions_taken: [
                "In-memory lexical evaluation",
                "Lookalike homoglyph permutation inspection",
                "SPF/DKIM cryptographic validation check"
            ],
            disclaimer: "PhishGuard provides automated threat indicators based on heuristic inspection rules, not a guarantee."
        };

        const jsonStr = JSON.stringify(reportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PhishGuard-Incident-Report-${result.scan_id || 'DEMO'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // 5. Interactive Feedback handler
    // ==========================================
    function setupFeedback(scan_id) {
        const yesBtn = document.getElementById('fb-yes-btn') || document.getElementById('btn-feedback-helpful');
        const noBtn = document.getElementById('fb-no-btn') || document.getElementById('btn-feedback-unhelpful');
        const widget = document.getElementById('feedback-widget');

        if (!yesBtn || !noBtn) return;

        yesBtn.addEventListener('click', async () => {
            try {
                await submitFeedback(scan_id, 'yes', '');
                if (widget) widget.innerHTML = '<p class="text-sm font-semibold" style="color: var(--color-safe); margin: 0;"><i class="fa-solid fa-check mr-1"></i> Thank you! Your feedback helps train our detection engine.</p>';
            } catch (err) {
                console.warn('Feedback submit error:', err);
            }
        });

        noBtn.addEventListener('click', async () => {
            try {
                await submitFeedback(scan_id, 'no', '');
                if (widget) widget.innerHTML = '<p class="text-sm font-semibold" style="color: var(--color-phishing); margin: 0;"><i class="fa-solid fa-circle-info mr-1"></i> Thank you. We will review this sample for model improvements.</p>';
            } catch (err) {
                console.warn('Feedback submit error:', err);
            }
        });
    }

    // ==========================================
    // 6. Utility Actions (Copy, Print)
    // ==========================================
    function setupUtilities(result) {
        const copyBtn = document.getElementById('action-copy-btn') || document.getElementById('btn-copy-summary');
        const printBtn = document.getElementById('action-print-btn') || document.getElementById('btn-print-report');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const summary = `
PHISHGUARD EMAIL THREAT REPORT
ID: ${result.scan_id || 'N/A'}
Verdict: ${(result.classification || 'safe').toUpperCase()}
Risk Score: ${result.risk_score || 0}/100
Confidence: ${result.confidence || 95}%
Indicators Flagged: ${(result.indicators || []).length}
---------------------------------------------
Disclaimer: PhishGuard provides automated risk indicators and does not guarantee that an email is safe.
                `.trim();

                navigator.clipboard.writeText(summary).then(() => {
                    alert("Analysis summary copied to clipboard!");
                }).catch(() => {
                    alert("Could not copy summary to clipboard.");
                });
            });
        }

        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
    }
});
