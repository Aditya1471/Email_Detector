// PhishGuard - Dashboard Page Controller
import { getDashboardStats, getIntegrations, getScanHistory } from './api.js';
import { escapeHTML } from './utilities.js';

document.addEventListener('DOMContentLoaded', () => {
    let distributionChart = null;
    let categoryChart = null;

    const contentWrapper = document.getElementById('dashboard-content-wrapper');
    const emptyState = document.getElementById('dashboard-empty-state');
    const refreshBtn = document.getElementById('refresh-dashboard-btn');

    // 1. Initial bootloader data fetch
    loadDashboardData();
    loadInboxStatus();

    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadDashboardData();
            loadInboxStatus();
        });
    }

    async function loadInboxStatus() {
        const stateElem = document.getElementById('dashboard-inbox-state');
        const syncElem = document.getElementById('dashboard-inbox-last-sync');
        if (!stateElem) return;

        try {
            const data = await getIntegrations();
            const gmail = (data.integrations || []).find(item => item.provider === 'gmail');
            if (gmail) {
                stateElem.textContent = gmail.is_active ? `Active (${gmail.email_address})` : `Paused (${gmail.email_address})`;
                stateElem.style.color = gmail.is_active ? 'var(--color-safe, #10b981)' : 'var(--color-suspicious, #f59e0b)';
                syncElem.textContent = gmail.last_sync_cursor ? new Date(gmail.updated_at).toLocaleString() : 'Never';
            } else {
                stateElem.textContent = 'Not Connected';
                stateElem.style.color = 'var(--color-text-muted)';
                syncElem.textContent = 'N/A';
            }
        } catch (e) {
            stateElem.textContent = 'Unavailable';
            syncElem.textContent = '--';
        }
    }

    async function loadDashboardData() {
        try {
            const stats = await getDashboardStats();
            const history = await getScanHistory();

            if (stats.total_scans === 0) {
                showEmptyState();
                return;
            }

            renderDashboard(stats, history);
        } catch (err) {
            console.error("[PhishGuard] Failed to load dashboard details:", err);
            showEmptyState();
        }
    }

    function showEmptyState() {
        emptyState.style.display = 'block';
        contentWrapper.style.display = 'none';
    }

    // ==========================================
    // 2. Render Page Modules
    // ==========================================
    function renderDashboard(stats, history) {
        emptyState.style.display = 'none';
        contentWrapper.style.display = 'flex';

        // Set card numbers
        document.getElementById('card-total-scans').textContent = stats.total_scans;
        document.getElementById('card-safe-scans').textContent = stats.safe_results;
        document.getElementById('card-suspicious-scans').textContent = stats.suspicious_results;
        document.getElementById('card-phishing-scans').textContent = stats.phishing_results;
        document.getElementById('card-avg-score').textContent = stats.average_risk_score;

        // Render recent scan history table logs
        renderHistoryTable(history);

        // Draw Chart.js visualizations
        drawCharts(stats, history);
    }

    function renderHistoryTable(history) {
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '';

        history.forEach((item) => {
            const tr = document.createElement('tr');
            
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            let badgeHtml = '';
            if (item.classification === 'safe') {
                badgeHtml = '<span class="status-badge status-badge--safe">✓ Safe</span>';
            } else if (item.classification === 'suspicious') {
                badgeHtml = '<span class="status-badge status-badge--suspicious">! Suspicious</span>';
            } else {
                badgeHtml = '<span class="status-badge status-badge--phishing">✖ Phishing</span>';
            }

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td><div style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; color: var(--color-text);">${escapeHTML(item.subject)}</div></td>
                <td>${badgeHtml}</td>
                <td><strong style="color: var(--color-text);">${item.risk_score}</strong> <span style="font-size: 0.75rem; color: var(--color-text-muted);">/ 100</span></td>
                <td><a href="result.html?scan_id=${item.scan_id}" class="btn btn-outline" style="padding: 0.25rem 0.75rem; height: 30px; font-size: 0.8rem;">View Report</a></td>
            `;

            tbody.appendChild(tr);
        });
    }

    // ==========================================
    // 3. Chart.js Graphs Rendering (Theme-aware)
    // ==========================================
    function drawCharts(stats, history) {
        // Destroy existing instances to prevent overlays errors
        if (distributionChart) distributionChart.destroy();
        if (categoryChart) categoryChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#cbd5e1' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

        // A. category distribution pie/doughnut chart
        const ctxCategory = document.getElementById('category-chart-canvas');
        if (ctxCategory) {
            categoryChart = new Chart(ctxCategory, {
                type: 'doughnut',
                data: {
                    labels: ['Safe', 'Suspicious', 'Phishing'],
                    datasets: [{
                        data: [stats.safe_results, stats.suspicious_results, stats.phishing_results],
                        backgroundColor: [
                            '#10b981', // Safe Green
                            '#f59e0b', // Suspicious Amber
                            '#ef4444'  // Phishing Red
                        ],
                        borderWidth: isDark ? 2 : 1,
                        borderColor: isDark ? '#111827' : '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: textColor, font: { family: 'Outfit', weight: 600 } }
                        }
                    }
                }
            });
        }

        // B. Recent Activity score line chart
        const ctxDistribution = document.getElementById('distribution-chart-canvas');
        if (ctxDistribution) {
            // Reverse history to show chronological timeline (left to right)
            const chronologicalHistory = [...history].reverse().slice(-10); // Show last 10 scans
            const labels = chronologicalHistory.map((item, idx) => `Scan #${idx + 1}`);
            const dataPoints = chronologicalHistory.map(item => item.risk_score);
            const borderColors = chronologicalHistory.map(item => {
                if (item.classification === 'safe') return '#10b981';
                if (item.classification === 'suspicious') return '#f59e0b';
                return '#ef4444';
            });

            distributionChart = new Chart(ctxDistribution, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Risk Score / 100',
                        data: dataPoints,
                        backgroundColor: borderColors,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'Inter' } }
                        },
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'Inter' } }
                        }
                    }
                }
            });
        }
    }

    // Dynamic Chart redraw when theme toggle is clicked
    const themeBtn = document.getElementById('theme-toggle-btn') || document.querySelector('[data-theme-toggle]');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            // Set delay to let documentElement data-theme update first
            setTimeout(() => {
                loadDashboardData();
            }, 150);
        });
    }
});
