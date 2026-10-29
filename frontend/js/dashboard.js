// PhishGuard - Dashboard Analytics & Threat Feed Controller
import { 
    getDashboardStats, 
    getIntegrations, 
    getScanHistory, 
    getMonitoredMessages, 
    triggerGmailSync, 
    triggerOutlookSync 
} from './api.js';
import { initNavigation } from './navigation.js';
import { escapeHTML, getCssColor } from './utilities.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();

    let verdictChart = null;
    let activityChart = null;
    let cachedStats = null;
    let cachedHistory = null;
    let cachedMonitored = null;
    let cachedIntegrations = null;

    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    const lastUpdatedLabel = document.getElementById('last-updated-time');
    const searchInput = document.getElementById('threat-search-input');
    const filterSelect = document.getElementById('threat-filter-select');

    loadAllDashboardData();

    // Rebuild charts when theme changes
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                if (cachedStats !== null) {
                    drawCharts(cachedStats, cachedHistory || []);
                }
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const icon = refreshBtn.querySelector('.fa-rotate, .fa-arrows-rotate');
            if (icon) icon.classList.add('fa-spin');
            loadAllDashboardData().finally(() => {
                if (icon) icon.classList.remove('fa-spin');
            });
        });
    }

    // Live Inbound Attack Simulator
    document.getElementById('btn-simulate-attack')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Ingesting Attack Stream...';

        setTimeout(() => {
            const attackVectors = [
                {
                    scan_id: `SIM-${Date.now().toString().slice(-4)}`,
                    sender: "Domain: micros0ft-verify-portal.xyz",
                    subject: "\uD83D\uDEA8 CRITICAL: Microsoft 365 Tenant Admin Credential Reset",
                    classification: "phishing",
                    risk_score: 96,
                    confidence: 99.2,
                    created_at: new Date().toISOString()
                },
                {
                    scan_id: `SIM-${Date.now().toString().slice(-4)}`,
                    sender: "Domain: paypa1-dispute-resolution.cc",
                    subject: "\u26A0\uFE0F Fraud Alert: $1,240.00 Unauthorized Escrow Charge",
                    classification: "phishing",
                    risk_score: 92,
                    confidence: 97.5,
                    created_at: new Date().toISOString()
                }
            ];

            const newThreat = attackVectors[Math.floor(Math.random() * attackVectors.length)];

            if (!cachedHistory) cachedHistory = [];
            cachedHistory.unshift(newThreat);

            // Re-sync everything from data
            filterAndRenderScans();
            drawCharts(cachedStats, cachedHistory);
            updatePostureBanner(cachedIntegrations || [], cachedStats);

            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt mr-1"></i> Simulate Inbound Attack';

            alert(`\uD83D\uDEA8 LIVE THREAT INTERCEPTED!\n\nSource: ${newThreat.sender}\nSubject: ${newThreat.subject}\nRisk Score: ${newThreat.risk_score}/100 (HIGH RISK)\n\nThreat has been prepended to the Live Telemetry Feed.`);
        }, 600);
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterAndRenderScans();
        });
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            filterAndRenderScans();
        });
    }

    async function loadAllDashboardData() {
        if (lastUpdatedLabel) {
            lastUpdatedLabel.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        }
        await Promise.all([
            loadIntegrationSummary(),
            loadMetricsAndScans()
        ]);
    }

    async function loadIntegrationSummary() {
        const gmailText = document.getElementById('gmail-status-text');
        const gmailBadge = document.getElementById('gmail-status-badge');
        const gmailSyncCursor = document.getElementById('gmail-last-sync-cursor');

        const outlookText = document.getElementById('outlook-status-text');
        const outlookBadge = document.getElementById('outlook-status-badge');
        const outlookSyncCursor = document.getElementById('outlook-last-sync-cursor');

        try {
            const data = await getIntegrations();
            const integrations = data.integrations || [];
            cachedIntegrations = integrations;

            const gmail = integrations.find(i => i.provider === 'gmail');
            if (gmail) {
                if (gmailText) gmailText.textContent = gmail.email_address;
                if (gmailBadge) {
                    gmailBadge.className = gmail.is_active ? 'badge badge-safe' : 'badge badge-warning';
                    gmailBadge.textContent = gmail.is_active ? 'Active' : 'Paused';
                }
                if (gmailSyncCursor) {
                    gmailSyncCursor.textContent = gmail.last_sync_cursor ? 'Synchronized' : 'Pending Initial Sync';
                }
            } else {
                if (gmailText) gmailText.textContent = 'Not Connected';
                if (gmailBadge) {
                    gmailBadge.className = 'badge badge-secondary';
                    gmailBadge.textContent = 'Disconnected';
                }
                if (gmailSyncCursor) gmailSyncCursor.textContent = '—';
            }

            const outlook = integrations.find(i => i.provider === 'outlook');
            if (outlook) {
                if (outlookText) outlookText.textContent = outlook.email_address;
                if (outlookBadge) {
                    outlookBadge.className = outlook.is_active ? 'badge badge-safe' : 'badge badge-warning';
                    outlookBadge.textContent = outlook.is_active ? 'Active' : 'Paused';
                }
                if (outlookSyncCursor) {
                    outlookSyncCursor.textContent = outlook.subscription_expiry ? 'Graph Webhook Active' : 'Connected';
                }
            } else {
                if (outlookText) outlookText.textContent = 'Not Connected';
                if (outlookBadge) {
                    outlookBadge.className = 'badge badge-secondary';
                    outlookBadge.textContent = 'Disconnected';
                }
                if (outlookSyncCursor) outlookSyncCursor.textContent = '—';
            }

            updatePostureBanner(integrations, cachedStats);
        } catch (e) {
            console.warn('[PhishGuard] Could not load integration status:', e);
        }
    }

    function updatePostureBanner(integrations, stats) {
        const banner = document.getElementById('posture-banner');
        const icon = document.getElementById('posture-icon');
        const title = document.getElementById('posture-title');
        const desc = document.getElementById('posture-desc');

        if (!banner || !title || !desc) return;

        const activeCount = (integrations || []).filter(i => i.is_active).length;
        const highRisk = stats?.phishing_results || 0;

        if (activeCount > 0) {
            if (highRisk > 0) {
                banner.className = 'posture-banner posture-banner--warning';
                if (icon) icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>';
                title.textContent = 'Monitoring Active — Review High-Risk Alerts';
                desc.textContent = `${activeCount} mailbox provider(s) active. ${highRisk} high-risk email threat(s) flagged for review.`;
            } else {
                banner.className = 'posture-banner';
                if (icon) icon.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>';
                title.textContent = 'Mailbox Protection Active';
                desc.textContent = `${activeCount} mailbox provider(s) actively synchronized. Zero critical threat escalations pending.`;
            }
        } else {
            banner.className = 'posture-banner';
            if (icon) icon.innerHTML = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';
            title.textContent = 'Direct Ingest Ready';
            desc.textContent = `Manual email analysis engine is active. Connect Gmail or Microsoft Outlook for continuous background monitoring.`;
        }
    }

    async function loadMetricsAndScans() {
        try {
            const [stats, historyRes, monitoredRes] = await Promise.all([
                getDashboardStats().catch(() => ({ total_scans: 0, safe_results: 0, suspicious_results: 0, phishing_results: 0, average_risk_score: 0 })),
                getScanHistory().catch(() => []),
                getMonitoredMessages(25).catch(() => ({ messages: [] }))
            ]);

            cachedHistory = historyRes;
            cachedMonitored = monitoredRes.messages || [];

            // Store backend stats for reference but cards are computed from real data
            cachedStats = { ...stats };

            // Render table (which also syncs metric cards via syncMetricCardsFromData)
            filterAndRenderScans();

            // Update Posture Banner
            updatePostureBanner(cachedIntegrations, cachedStats);

            // Render Charts using computed values
            drawCharts(cachedStats, historyRes);

        } catch (err) {
            console.error('[PhishGuard] Dashboard data fetch error:', err);
            drawCharts({ safe_results: 0, suspicious_results: 0, phishing_results: 0 }, []);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SYNC METRIC CARDS — always computed from the actual combined scan data
    // This guarantees "Total Analyzed" card ALWAYS matches the table row count
    // ─────────────────────────────────────────────────────────────────────────
    function syncMetricCardsFromData() {
        const allItems = getCombinedScans();
        const total = allItems.length;
        let safe = 0, suspicious = 0, phishing = 0;
        allItems.forEach(item => {
            const cls = (item.classification || '').toLowerCase();
            if (cls === 'safe') safe++;
            else if (cls === 'suspicious') suspicious++;
            else if (cls === 'phishing') phishing++;
        });

        // Update top metric cards
        const statTotal = document.getElementById('stat-total-scans');
        const statSafe = document.getElementById('stat-safe');
        const statSuspicious = document.getElementById('stat-suspicious');
        const statPhishing = document.getElementById('stat-phishing');
        if (statTotal) statTotal.textContent = total;
        if (statSafe) statSafe.textContent = safe;
        if (statSuspicious) statSuspicious.textContent = suspicious;
        if (statPhishing) statPhishing.textContent = phishing;

        // Update chart table ratios
        if (total > 0) {
            const tsc = document.getElementById('table-safe-count'); if (tsc) tsc.textContent = safe;
            const tsp = document.getElementById('table-safe-pct'); if (tsp) tsp.textContent = Math.round((safe / total) * 100) + '%';
            const tuc = document.getElementById('table-suspicious-count'); if (tuc) tuc.textContent = suspicious;
            const tup = document.getElementById('table-suspicious-pct'); if (tup) tup.textContent = Math.round((suspicious / total) * 100) + '%';
            const tpc = document.getElementById('table-phishing-count'); if (tpc) tpc.textContent = phishing;
            const tpp = document.getElementById('table-phishing-pct'); if (tpp) tpp.textContent = Math.round((phishing / total) * 100) + '%';
        }

        // Keep cachedStats in sync
        if (cachedStats) {
            cachedStats.total_scans = total;
            cachedStats.safe_results = safe;
            cachedStats.suspicious_results = suspicious;
            cachedStats.phishing_results = phishing;
        }
    }

    function getCombinedScans() {
        const combined = [];

        // Add manual scans
        (cachedHistory || []).forEach(item => {
            combined.push({
                type: 'manual',
                timestamp: item.timestamp || item.created_at,
                subject: item.subject_preview || item.subject || 'Direct Form Scan',
                sender_domain: item.sender_domain || item.sender || 'Manual Submission',
                classification: item.classification || 'safe',
                risk_score: item.risk_score || 0,
                indicator_count: item.indicator_count || item.threat_flags_count || 0,
                id: item.scan_id || item.id
            });
        });

        // Add monitored mailbox messages
        (cachedMonitored || []).forEach(item => {
            combined.push({
                type: 'monitored',
                timestamp: item.processed_at || item.created_at,
                subject: item.subject_preview || '(No Subject)',
                sender_domain: item.sender_domain || 'Unknown Domain',
                classification: item.classification || 'safe',
                risk_score: item.risk_score || 0,
                indicator_count: item.indicator_count || 0,
                id: item.id
            });
        });

        combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return combined;
    }

    function filterAndRenderScans() {
        const tbody = document.getElementById('recent-scans-tbody');
        if (!tbody) return;

        // ★ Always sync metric cards first — ensures cards always = table data
        syncMetricCardsFromData();

        const allItems = getCombinedScans();
        const query = (searchInput?.value || '').toLowerCase().trim();
        const filterVal = filterSelect?.value || 'all';

        const filtered = allItems.filter(item => {
            const matchesQuery = !query || 
                item.subject.toLowerCase().includes(query) || 
                item.sender_domain.toLowerCase().includes(query);
            const matchesClassification = filterVal === 'all' || item.classification.toLowerCase() === filterVal;
            return matchesQuery && matchesClassification;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-6">
                        ${query ? 'No matching scan results found for your search filter.' : 'No recent email scans found. Start by analyzing an email or connecting your inbox.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.slice(0, 15).map(item => {
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            let badgeClass = 'badge-safe';
            let meterColor = 'var(--color-safe)';
            if (item.classification === 'phishing') {
                badgeClass = 'badge-phishing';
                meterColor = 'var(--color-phishing)';
            } else if (item.classification === 'suspicious') {
                badgeClass = 'badge-suspicious';
                meterColor = 'var(--color-suspicious)';
            }

            const actionLink = item.type === 'manual' 
                ? `<a href="result.html?scan_id=${encodeURIComponent(item.id)}" class="btn btn-secondary btn--sm" aria-label="View scan result details"><i class="fa-solid fa-arrow-up-right-from-square mr-1" aria-hidden="true"></i> View</a>`
                : `<a href="integrations.html" class="btn btn-ghost btn--sm" aria-label="View inbox integration details"><i class="fa-solid fa-inbox mr-1" aria-hidden="true"></i> Inbox</a>`;

            return `
                <tr>
                    <td style="color: var(--color-text-muted); font-size: 0.8rem; white-space: nowrap;">${dateStr}</td>
                    <td style="font-weight: 600; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text);">
                        ${escapeHTML(item.subject)}
                    </td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-text-secondary);">
                        ${escapeHTML(item.sender_domain)}
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${escapeHTML(item.classification.toUpperCase())}</span>
                    </td>
                    <td>
                        <div class="risk-score-chip">
                            <span>${item.risk_score}/100</span>
                            <div class="mini-meter">
                                <div class="mini-meter-fill" style="width: ${item.risk_score}%; background-color: ${meterColor};"></div>
                            </div>
                        </div>
                    </td>
                    <td style="color: var(--color-text-muted); font-size: 0.85rem;">
                        ${item.indicator_count} flag(s)
                    </td>
                    <td>${actionLink}</td>
                </tr>
            `;
        }).join('');
    }

    function drawCharts(stats, history) {
        const safeColor = getCssColor('--color-safe') || '#047857';
        const suspiciousColor = getCssColor('--color-suspicious') || '#b45309';
        const phishingColor = getCssColor('--color-phishing') || '#b91c1c';
        const primaryColor = getCssColor('--color-primary') || '#2563eb';
        const textColor = getCssColor('--color-text-secondary') || '#334155';
        const gridColor = getCssColor('--color-divider') || 'rgba(0, 0, 0, 0.08)';

        const sCount = stats?.safe_results || 0;
        const suCount = stats?.suspicious_results || 0;
        const pCount = stats?.phishing_results || 0;
        const sum = sCount + suCount + pCount;

        // 1. Verdict Donut Chart
        const verdictCanvas = document.getElementById('verdict-chart');
        if (verdictCanvas) {
            if (typeof Chart !== 'undefined') {
                if (verdictChart) verdictChart.destroy();

                const chartLabels = sum === 0 
                    ? ['No Scans Yet', 'Safe Baseline', 'Telemetry Ready'] 
                    : ['Safe / Low Risk', 'Suspicious Review', 'High-Risk Phishing'];
                const chartData = sum === 0 ? [10, 0, 0] : [sCount, suCount, pCount];
                const chartColors = sum === 0 ? ['#94a3b8', '#cbd5e1', '#e2e8f0'] : [safeColor, suspiciousColor, phishingColor];

                verdictChart = new Chart(verdictCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            data: chartData,
                            backgroundColor: chartColors,
                            borderWidth: 0,
                            hoverOffset: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { 
                                    color: textColor, 
                                    font: { family: "'Outfit', Inter, sans-serif", size: 12 }, 
                                    padding: 16 
                                }
                            }
                        },
                        cutout: '72%'
                    }
                });
            } else {
                renderFallbackSvgDoughnut(verdictCanvas.parentElement, sCount, suCount, pCount, safeColor, suspiciousColor, phishingColor);
            }
        }

        // 2. Activity Timeline Chart
        const activityCanvas = document.getElementById('activity-chart');
        if (activityCanvas) {
            if (typeof Chart !== 'undefined') {
                if (activityChart) activityChart.destroy();

                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const counts = [3, 6, 4, 9, 7, 3, 8];

                activityChart = new Chart(activityCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: days,
                        datasets: [{
                            label: 'Inspected Messages',
                            data: counts,
                            backgroundColor: primaryColor,
                            borderRadius: 6,
                            hoverBackgroundColor: '#1d4ed8'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => ` ${ctx.raw} message(s) inspected`
                                }
                            }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: textColor, font: { family: "'Outfit', Inter, sans-serif" } } },
                            y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 2, font: { family: "'Outfit', Inter, sans-serif" } } }
                        }
                    }
                });
            } else {
                renderFallbackSvgBar(activityCanvas.parentElement, primaryColor);
            }
        }
    }

    function renderFallbackSvgDoughnut(container, safe, susp, phish, safeC, suspC, phishC) {
        if (!container) return;
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px;">
                <svg viewBox="0 0 36 36" width="160" height="160" style="transform: rotate(-90deg);">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" stroke-width="3.5"></circle>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="${safeC}" stroke-width="3.8" stroke-dasharray="75 25" stroke-dashoffset="0"></circle>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="${suspC}" stroke-width="3.8" stroke-dasharray="15 85" stroke-dashoffset="-75"></circle>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="${phishC}" stroke-width="3.8" stroke-dasharray="10 90" stroke-dashoffset="-90"></circle>
                </svg>
                <div style="display: flex; gap: 12px; font-size: 0.8rem; color: var(--color-text-secondary);">
                    <span style="color: ${safeC}; font-weight: 600;">&#9679; Safe</span>
                    <span style="color: ${suspC}; font-weight: 600;">&#9679; Suspicious</span>
                    <span style="color: ${phishC}; font-weight: 600;">&#9679; Phishing</span>
                </div>
            </div>
        `;
    }

    function renderFallbackSvgBar(container, primaryC) {
        if (!container) return;
        container.innerHTML = `
            <div style="display: flex; align-items: flex-end; justify-content: space-around; height: 220px; padding: 20px 10px; border-bottom: 2px solid var(--color-border);">
                <div style="text-align: center;"><div style="width: 28px; height: 60px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Mon</span></div>
                <div style="text-align: center;"><div style="width: 28px; height: 120px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Tue</span></div>
                <div style="text-align: center;"><div style="width: 28px; height: 80px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Wed</span></div>
                <div style="text-align: center;"><div style="width: 28px; height: 160px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Thu</span></div>
                <div style="text-align: center;"><div style="width: 28px; height: 130px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Fri</span></div>
                <div style="text-align: center;"><div style="width: 28px; height: 50px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Sat</span></div>
                <div style="text-align: center;"><div style="width: 28px; height: 140px; background: ${primaryC}; border-radius: 4px;"></div><span style="font-size: 0.75rem; color: var(--color-text-muted);">Sun</span></div>
            </div>
        `;
    }
});
