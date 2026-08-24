// PhishGuard - Result Page Controller
import { getScanResult, submitFeedback } from './api.js';
import { escapeHTML } from './utilities.js';

document.addEventListener('DOMContentLoaded', async () => {
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
        // Fetch result data
        const result = await getScanResult(scanId);
        renderReport(result);
    } catch (err) {
        console.error("[PhishGuard] Failed to load scan result report:", err);
        showEmptyState();
    }

    function showEmptyState() {
        emptyState.style.display = 'block';
        contentWrapper.style.display = 'none';
    }

    // ==========================================
    // 2. Render Report Layout Components
    // ==========================================
    function renderReport(result) {
        emptyState.style.display = 'none';
        contentWrapper.style.display = 'block';

        // Set text metadata labels
        document.getElementById('scan-id-lbl').textContent = result.scan_id;
        document.getElementById('model-version-lbl').textContent = result.model_version;
        document.getElementById('speed-lbl').textContent = `${result.processing_time_ms} ms`;
        
        const timestamp = result.timestamp ? new Date(result.timestamp) : new Date();
        document.getElementById('timestamp-lbl').textContent = timestamp.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // Set Risk Score Val and animate gauge circle ring
        const score = result.risk_score;
        document.getElementById('risk-score-val').textContent = score;
        
        const scoreRing = document.getElementById('score-ring');
        if (scoreRing) {
            // Circumference of r=40 is 251.2
            const offset = 251.2 - (251.2 * score) / 100;
            // Delay slightly for render animation sweep
            setTimeout(() => {
                scoreRing.style.strokeDashoffset = offset;
            }, 100);

            // Set ring color based on risk levels
            if (result.classification === 'safe') {
                scoreRing.style.stroke = 'var(--color-safe)';
            } else if (result.classification === 'suspicious') {
                scoreRing.style.stroke = 'var(--color-suspicious)';
            } else {
                scoreRing.style.stroke = 'var(--color-phishing)';
            }
        }

        // Configure Verdict Badge visual classes
        const verdictBadge = document.getElementById('verdict-badge');
        const verdictIcon = document.getElementById('verdict-icon-container');
        const verdictTitle = document.getElementById('verdict-title');
        const verdictDesc = document.getElementById('verdict-desc');
        const verdictCard = document.getElementById('risk-verdict-card');

        // Reset badge styles
        verdictBadge.className = 'status-badge';

        if (result.classification === 'safe') {
            verdictBadge.classList.add('status-badge--safe');
            verdictBadge.textContent = '✓ Safe';
            verdictIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--color-safe);"></i>';
            verdictTitle.textContent = 'No major threat indicators detected';
            verdictDesc.textContent = 'No warning patterns were flagged in this scan. The domain alignment is valid and url destinations are clean.';
            verdictCard.style.borderTop = '4.5px solid var(--color-safe)';
        } else if (result.classification === 'suspicious') {
            verdictBadge.classList.add('status-badge--suspicious');
            verdictBadge.textContent = '! Suspicious';
            verdictIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-suspicious);"></i>';
            verdictTitle.textContent = 'Caution: Indicators require review';
            verdictDesc.textContent = 'Several warning patterns require review. Avoid sharing sensitive data or passwords until verification checks pass.';
            verdictCard.style.borderTop = '4.5px solid var(--color-suspicious)';
        } else {
            verdictBadge.classList.add('status-badge--phishing');
            verdictBadge.textContent = '✖ Phishing';
            verdictIcon.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color: var(--color-phishing);"></i>';
            verdictTitle.textContent = 'Warning: Severe phishing signatures detected';
            verdictDesc.textContent = 'Do not click links or input credentials. Spoofing indicators are present, hosted on high-risk domains.';
            verdictCard.style.borderTop = '4.5px solid var(--color-phishing)';
        }

        // Set stats row metrics
        document.getElementById('stat-indicators').textContent = result.indicators.length;
        document.getElementById('stat-confidence').textContent = `${result.confidence.toFixed(1)}%`;

        // Render detected heuristic indicators accordion list
        renderIndicators(result.indicators);

        // Scan URLs from email content if available
        const urls = extractUrls(result.subject + ' ' + (result.body || ''));
        document.getElementById('stat-urls').textContent = urls.length;
        renderUrls(urls);

        // Render checklist recommendation points
        renderRecommendations(result.classification);

        // Bind interactive feedback actions
        setupFeedback(result.scan_id);

        // Bind utility actions buttons
        setupUtilities(result);
    }

    // ==========================================
    // 3. Sub-Components Rendering
    // ==========================================
    function renderIndicators(indicators) {
        const wrapper = document.getElementById('indicator-list-wrapper');
        wrapper.innerHTML = '';

        if (!indicators || indicators.length === 0) {
            wrapper.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-md); color: var(--color-text-muted);">
                    No indicator details available.
                </div>
            `;
            return;
        }

        indicators.forEach((ind, index) => {
            const indId = `ind-panel-${index}`;
            const triggerId = `ind-trig-${index}`;

            const item = document.createElement('div');
            item.className = 'indicator-item';

            // Severity badge markup
            const sevBadge = `<span class="severity-badge severity-${ind.severity}">${ind.severity.toUpperCase()}</span>`;

            item.innerHTML = `
                <button type="button" class="indicator-trigger" id="${triggerId}" aria-expanded="false" aria-controls="${indId}">
                    <span style="display: flex; align-items: center; gap: var(--spacing-sm);">
                        <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; transition: transform var(--transition-fast);"></i>
                        <span>${escapeHTML(ind.title)}</span>
                    </span>
                    ${sevBadge}
                </button>
                <div class="indicator-content" id="${indId}" role="region" aria-labelledby="${triggerId}">
                    <p style="margin-bottom: var(--spacing-xs); font-weight: 500; color: var(--color-text);">${escapeHTML(ind.message)}</p>
                    <p style="color: var(--color-text-secondary); margin-bottom: 0; font-size: 0.85rem;">
                        <strong>Signal classification check:</strong> Automated scans evaluate language contexts, domain records, and destination links. This alert does not guarantee threat presence but warns of typical patterns.
                    </p>
                </div>
            `;

            // Expand / Collapse listeners
            const trigger = item.querySelector('.indicator-trigger');
            const content = item.querySelector('.indicator-content');
            const chevron = item.querySelector('.fa-chevron-down');

            trigger.addEventListener('click', () => {
                const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                trigger.setAttribute('aria-expanded', !isExpanded);
                content.classList.toggle('expanded');
                
                if (chevron) {
                    chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });

            wrapper.appendChild(item);
        });
    }

    function extractUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex) || [];
        // Deduplicate URLs
        return [...new Set(matches)];
    }

    function renderUrls(urls) {
        const card = document.getElementById('url-card-block');
        const body = document.getElementById('url-table-body');
        body.innerHTML = '';

        if (!urls || urls.length === 0) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';

        urls.forEach((url) => {
            const tr = document.createElement('tr');
            let hostname = "(Failed to parse)";
            try {
                hostname = new URL(url).hostname;
            } catch (e) {}

            let badgeHtml = '<span class="status-badge status-badge--safe">✓ Verified Link</span>';
            let rowStyle = '';

            // Flag suspicious top level domains or patterns
            const urlLower = url.toLowerCase();
            if (urlLower.includes('.xyz') || urlLower.includes('verify') || urlLower.includes('update') || urlLower.includes('billing')) {
                badgeHtml = '<span class="status-badge status-badge--phishing">✖ Blocked Link</span>';
                rowStyle = 'color: var(--color-phishing);';
            } else if (urlLower.includes('sandbox') || urlLower.includes('alerts')) {
                badgeHtml = '<span class="status-badge status-badge--suspicious">! Caution</span>';
            }

            tr.innerHTML = `
                <td><div class="url-text" style="${rowStyle}" title="${escapeHTML(url)}">${escapeHTML(url)}</div></td>
                <td><strong style="color: var(--color-text); font-size: 0.85rem;">${escapeHTML(hostname)}</strong></td>
                <td>${badgeHtml}</td>
            `;

            body.appendChild(tr);
        });
    }

    function renderRecommendations(classification) {
        const list = document.getElementById('recommendation-list');
        const card = document.getElementById('recommendation-card');
        list.innerHTML = '';

        const points = [];
        if (classification === 'safe') {
            card.style.borderLeftColor = 'var(--color-safe)';
            points.push("No major suspicious factors identified. You may interact normally.");
            points.push("Check the sender email address domain records before forwarding.");
            points.push("Remember: verification algorithms are automated indicators, check links visually.");
        } else if (classification === 'suspicious') {
            card.style.borderLeftColor = 'var(--color-suspicious)';
            points.push("Avoid clicking buttons or links inside the text body.");
            points.push("Verify the request through an independent channel (phone or official website).");
            points.push("Do not input personal passcodes or payment details.");
            points.push("Report the message to your team operations leads where appropriate.");
        } else {
            card.style.borderLeftColor = 'var(--color-phishing)';
            points.push("CRITICAL ALERT: Do not open any file attachments.");
            points.push("Delete the message from your mail profile immediately.");
            points.push("Do not respond to the sender email address.");
            points.push("Report threat details to security teams to block future spam runs.");
        }

        points.forEach(pt => {
            const li = document.createElement('li');
            li.textContent = pt;
            list.appendChild(li);
        });
    }

    // ==========================================
    // 4. Interactive Form handlers
    // ==========================================
    function setupFeedback(scan_id) {
        const yesBtn = document.getElementById('fb-yes-btn');
        const noBtn = document.getElementById('fb-no-btn');
        const commentGrp = document.getElementById('feedback-comment-group');
        const submitBtn = document.getElementById('fb-submit-btn');
        const commentInput = document.getElementById('fb-comment');
        
        const formPane = document.getElementById('feedback-form-pane');
        const successPane = document.getElementById('feedback-success-pane');

        let rating = null;

        yesBtn.addEventListener('click', () => {
            rating = 'yes';
            yesBtn.classList.add('btn-success');
            noBtn.classList.remove('btn-danger');
            commentGrp.style.display = 'block';
        });

        noBtn.addEventListener('click', () => {
            rating = 'no';
            noBtn.classList.add('btn-danger');
            yesBtn.classList.remove('btn-success');
            commentGrp.style.display = 'block';
        });

        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            try {
                await submitFeedback(scan_id, rating, commentInput.value);
                formPane.style.display = 'none';
                successPane.style.display = 'block';
            } catch (err) {
                alert("Failed to submit feedback. Please try again.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Feedback';
            }
        });
    }

    // ==========================================
    // 5. Utility Actions (Copy, Print, Download)
    // ==========================================
    function setupUtilities(result) {
        // Copy summary clipboard action
        document.getElementById('action-copy-btn').addEventListener('click', () => {
            const summary = `
PHISHGUARD EMAIL ANALYSIS REPORT
ID: ${result.scan_id}
Verdict: ${result.classification.toUpperCase()}
Risk Score: ${result.risk_score}/100
Confidence: ${result.confidence}%
Heuristic Indicators: ${result.indicators.length}
---------------------------------------------
Disclaimer: This is an automated indicators check based on heuristic signatures. It does not guarantee security decisions.
            `.trim();

            navigator.clipboard.writeText(summary).then(() => {
                alert("Summary copied to clipboard!");
            }).catch(() => {
                alert("Failed to copy to clipboard.");
            });
        });

        // Print page trigger
        document.getElementById('action-print-btn').addEventListener('click', () => {
            window.print();
        });

        // Download report plain text file attachment trigger
        document.getElementById('action-download-btn').addEventListener('click', () => {
            const indicatorsListText = result.indicators.map((ind, i) => `${i+1}. [${ind.severity.toUpperCase()}] ${ind.title}: ${ind.message}`).join('\n');
            const fileContent = `
=============================================
             PHISHGUARD REPORT
=============================================
Report ID: ${result.scan_id}
Timestamp: ${new Date(result.timestamp || Date.now()).toLocaleString()}
Classification: ${result.classification.toUpperCase()}
Risk Heuristic Score: ${result.risk_score}/100
Scan Confidence: ${result.confidence}%
Model Version: ${result.model_version}
Processing Time: ${result.processing_time_ms} ms

DETECTED RISK INDICATORS:
${indicatorsListText || "No risk indicators flagged."}

RECOMMENDATIONS:
- Verify sender addresses independently.
- Avoid opening suspicious attachments.
- Never share credential verification credentials.

DISCLAIMER:
PhishGuard provides automated risk indicators and does not guarantee that an email is safe. Use caution when evaluating links and attachments.
            `.trim();

            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `phishguard-report-${result.scan_id}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }
});
