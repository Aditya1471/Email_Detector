// PhishGuard - Main Bootstrapper & Homepage Interactive Playground Controller
import { initNavigation } from './navigation.js';
import { demoEmails } from './mock-data.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initHeroPlayground();
    initPricingSwitcher();
    initTrialModal();
    console.log("[PhishGuard] Application initialized successfully.");
});

/**
 * Interactive Live Quick-Scan Playground in Hero Section
 */
function initHeroPlayground() {
    const buttons = document.querySelectorAll('.scenario-pill-btn');
    if (!buttons.length) return;

    const radar = document.getElementById('playground-radar');
    const senderEl = document.getElementById('pg-sender');
    const subjectEl = document.getElementById('pg-subject');
    const bodyEl = document.getElementById('pg-body-preview');
    const scoreEl = document.getElementById('pg-score-num');
    const badgeEl = document.getElementById('pg-verdict-badge');
    const tagsContainer = document.getElementById('pg-tags-container');
    const deepLinkBtn = document.getElementById('pg-deep-link-btn');
    const statusText = document.getElementById('playground-status-text');

    const scenarioConfigs = {
        m365_harvest: {
            sender: "security-alert@micros0ft-support.verify-auth.com",
            subject: "Action Required: Immediate Microsoft 365 Password Reset Required",
            bodyHtml: `Our security telemetry detected unauthorized login attempts. Re-verify your corporate credentials at <span style="background: rgba(239,68,68,0.15); color: var(--color-phishing); padding: 1px 4px; border-radius: 3px; font-weight: 600;">http://micros0ft-login.verify-portal.xyz/auth</span> to prevent service suspension.`,
            score: "94/100",
            verdict: "✖ Phishing Detected",
            verdictClass: "badge-phishing",
            scoreColor: "var(--color-phishing)",
            tags: [
                { icon: "fa-triangle-exclamation", text: "Homoglyph Lookalike Domain ('micros0ft')", type: "badge-phishing" },
                { icon: "fa-link", text: "Deceptive .XYZ Link Destination", type: "badge-warning" },
                { icon: "fa-clock", text: "Coercive 2-Hour Urgency", type: "badge-warning" }
            ]
        },
        paypal_invoice: {
            sender: "billing-service@paypa1-notification-desk.com",
            subject: "Invoice #INV-98234 Confirmed: Automatic Debit of $849.00 USD Pending",
            bodyHtml: `Thank you for your order. $849.00 USD will be debited. If you did not authorize this, call fraud dispute or click <span style="background: rgba(239,68,68,0.15); color: var(--color-phishing); padding: 1px 4px; border-radius: 3px; font-weight: 600;">http://paypal-dispute-cancellation.cc/refund</span> to cancel invoice.`,
            score: "91/100",
            verdict: "✖ Phishing Detected",
            verdictClass: "badge-phishing",
            scoreColor: "var(--color-phishing)",
            tags: [
                { icon: "fa-triangle-exclamation", text: "Brand Typo ('paypa1' with number 1)", type: "badge-phishing" },
                { icon: "fa-money-bill-transfer", text: "Unauthorized Debit Pretext", type: "badge-warning" },
                { icon: "fa-shield", text: "Fake Dispute Cancellation Link", type: "badge-warning" }
            ]
        },
        ceo_wire: {
            sender: "richard.hendricks.ceo@vip-executive-direct.net",
            subject: "CONFIDENTIAL / TIME SENSITIVE: Urgent M&A Acquisition Wire Transfer",
            bodyHtml: `I am in an executive board meeting. We need an initial confidential escrow wire of <span style="background: rgba(245,158,11,0.15); color: var(--color-warning); padding: 1px 4px; border-radius: 3px; font-weight: 600;">$142,500 processed before 3:00 PM today</span>. Confirm you are at your desk for routing.`,
            score: "86/100",
            verdict: "✖ Executive BEC Phish",
            verdictClass: "badge-phishing",
            scoreColor: "var(--color-phishing)",
            tags: [
                { icon: "fa-user-tie", text: "Executive Impersonation (CEO Pretext)", type: "badge-phishing" },
                { icon: "fa-envelope-open", text: "External Non-Corporate Mailbox Domain", type: "badge-warning" },
                { icon: "fa-lock", text: "Secrecy & Wire Transfer Coercion", type: "badge-warning" }
            ]
        },
        clean_memo: {
            sender: "communications@internal-enterprise.com",
            subject: "All-Hands Meeting Notes & Q3 Engineering Milestone Summary",
            bodyHtml: `Thank you to everyone who joined our quarterly town hall! Security compliance completed with zero non-conformances. Next sprint planning starts Monday at 10:00 AM in Conference Room 4B.`,
            score: "12/100",
            verdict: "✓ Clean & Safe",
            verdictClass: "badge-safe",
            scoreColor: "var(--color-safe)",
            tags: [
                { icon: "fa-check", text: "Cryptographic SPF / DKIM Valid", type: "badge-safe" },
                { icon: "fa-shield-halved", text: "Internal Corporate Domain Alignment", type: "badge-safe" },
                { icon: "fa-font", text: "Neutral Lexical Tone", type: "badge-safe" }
            ]
        }
    };

    function selectScenario(scenarioKey) {
        const config = scenarioConfigs[scenarioKey];
        if (!config) return;

        // Show animated radar beam
        if (radar) radar.style.display = 'block';
        if (statusText) statusText.textContent = "Analyzing Heuristics & Signals...";

        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-scenario') === scenarioKey);
        });

        setTimeout(() => {
            if (radar) radar.style.display = 'none';
            if (statusText) statusText.textContent = "Diagnostic Verdict Ready";

            if (senderEl) senderEl.textContent = config.sender;
            if (subjectEl) subjectEl.textContent = config.subject;
            if (bodyEl) bodyEl.innerHTML = config.bodyHtml;
            if (scoreEl) {
                scoreEl.textContent = config.score;
                scoreEl.style.color = config.scoreColor;
            }
            if (badgeEl) {
                badgeEl.className = `badge ${config.verdictClass}`;
                badgeEl.textContent = config.verdict;
            }

            if (tagsContainer) {
                tagsContainer.innerHTML = config.tags.map(t => `
                    <span class="badge ${t.type}"><i class="fa-solid ${t.icon} mr-1"></i> ${t.text}</span>
                `).join('');
            }

            if (deepLinkBtn) {
                deepLinkBtn.setAttribute('href', `scan.html?preset=${scenarioKey}`);
            }
        }, 300);
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-scenario');
            selectScenario(key);
        });
    });
}

/**
 * Dynamic Pricing Switcher (Monthly vs Annual)
 */
function initPricingSwitcher() {
    const monthlyBtn = document.getElementById('btn-billing-monthly');
    const annualBtn = document.getElementById('btn-billing-annual');
    const proPriceEl = document.getElementById('price-pro');
    const enterprisePriceEl = document.getElementById('price-enterprise');
    const proSubtext = document.getElementById('subtext-pro');
    const enterpriseSubtext = document.getElementById('subtext-enterprise');

    if (!monthlyBtn || !annualBtn) return;

    monthlyBtn.addEventListener('click', () => {
        monthlyBtn.classList.add('active');
        annualBtn.classList.remove('active');
        if (proPriceEl) proPriceEl.innerHTML = '$39<span style="font-size: 1rem; color: var(--color-text-muted); font-weight: normal;">/mo</span>';
        if (enterprisePriceEl) enterprisePriceEl.innerHTML = '$159<span style="font-size: 1rem; color: var(--color-text-muted); font-weight: normal;">/mo</span>';
        if (proSubtext) proSubtext.textContent = 'Billed monthly';
        if (enterpriseSubtext) enterpriseSubtext.textContent = 'Billed monthly';
    });

    annualBtn.addEventListener('click', () => {
        annualBtn.classList.add('active');
        monthlyBtn.classList.remove('active');
        if (proPriceEl) proPriceEl.innerHTML = '$31<span style="font-size: 1rem; color: var(--color-text-muted); font-weight: normal;">/mo</span>';
        if (enterprisePriceEl) enterprisePriceEl.innerHTML = '$127<span style="font-size: 1rem; color: var(--color-text-muted); font-weight: normal;">/mo</span>';
        if (proSubtext) proSubtext.textContent = 'Billed annually ($372/yr - save $96)';
        if (enterpriseSubtext) enterpriseSubtext.textContent = 'Billed annually ($1,524/yr - save $384)';
    });
}

/**
 * 14-Day Free Trial Activation Modal
 */
function initTrialModal() {
    const trialBtns = document.querySelectorAll('[data-action="trial-modal"]');
    if (!trialBtns.length) return;

    trialBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            openTrialModal();
        });
    });
}

function openTrialModal() {
    const existing = document.getElementById('trial-modal-overlay');
    if (existing) existing.remove();

    const modalHtml = `
        <div id="trial-modal-overlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
            <div class="card" style="max-width: 480px; width: 100%; padding: var(--spacing-8); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); position: relative; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <button type="button" id="close-trial-modal" style="position: absolute; top: 1.25rem; right: 1.25rem; background: transparent; border: none; font-size: 1.2rem; color: var(--color-text-muted); cursor: pointer;" aria-label="Close">
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <div class="flex items-center gap-2 mb-3">
                    <span class="badge badge-info"><i class="fa-solid fa-sparkles mr-1"></i> Instant Trial Activation</span>
                </div>

                <h3 style="font-size: 1.4rem; margin-bottom: var(--spacing-2);">Start Your 14-Day Pro SecOps Trial</h3>
                <p class="text-sm text-muted mb-6">
                    Full enterprise access to continuous inbox monitoring, SMS alerts, and deep heuristic inspection. No credit card required.
                </p>

                <form id="trial-form">
                    <div class="form-group mb-4">
                        <label for="trial-email" class="form-label">Corporate Work Email</label>
                        <input type="email" id="trial-email" class="form-input" placeholder="security-lead@company.com" required>
                    </div>

                    <div class="form-group mb-6">
                        <label for="trial-org" class="form-label">Organization Name</label>
                        <input type="text" id="trial-org" class="form-input" placeholder="Acme Security Corp" required>
                    </div>

                    <button type="submit" class="btn btn-primary btn--full btn--lg" id="trial-submit-btn">
                        <i class="fa-solid fa-bolt mr-1"></i> Activate Instant Access
                    </button>
                </form>

                <div id="trial-success-box" style="display: none; text-align: center; padding: var(--spacing-4) 0;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--color-safe-soft); color: var(--color-safe); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto var(--spacing-3) auto;">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h4 style="margin-bottom: var(--spacing-1);">Trial Account Provisioned!</h4>
                    <p class="text-sm text-muted mb-4">You have been granted 14 days of Pro SecOps tier capabilities.</p>
                    <a href="dashboard.html" class="btn btn-primary btn--full">Enter Security Dashboard</a>
                </div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const overlay = document.getElementById('trial-modal-overlay');
    const closeBtn = document.getElementById('close-trial-modal');
    const form = document.getElementById('trial-form');
    const submitBtn = document.getElementById('trial-submit-btn');
    const successBox = document.getElementById('trial-success-box');

    closeBtn?.addEventListener('click', () => overlay.remove());
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Provisioning Tenant...';

        setTimeout(() => {
            form.style.display = 'none';
            successBox.style.display = 'block';
            localStorage.setItem('phishguard_logged_in', 'true');
            localStorage.setItem('phishguard_user_email', document.getElementById('trial-email').value || 'analyst@enterprise.com');
        }, 800);
    });
}
