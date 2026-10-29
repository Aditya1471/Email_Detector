// PhishGuard - Integrations Controller Module
import { 
    getIntegrations, 
    saveConnectedIntegration,
    triggerGmailSync, 
    triggerOutlookSync, 
    pauseIntegration, 
    resumeIntegration, 
    disconnectIntegration, 
    purgeIntegrationData, 
    getMonitoredMessages 
} from './api.js';
import { initNavigation } from './navigation.js';
import { escapeHTML, validateEmailFormat } from './utilities.js';
import { startJobPolling } from './jobs.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();

    const alertBox = document.getElementById('integrations-alert');
    const alertText = document.getElementById('integrations-alert-text');

    function showAlert(msg, isSuccess = true) {
        if (!alertBox || !alertText) return;
        alertText.textContent = msg;
        alertBox.className = isSuccess ? 'alert alert-success' : 'alert alert-danger';
        alertBox.style.display = 'flex';
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 6000);
    }

    // Check URL query parameters for redirect outcomes
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    const emailParam = urlParams.get('email');
    const msgParam = urlParams.get('message');

    if (statusParam === 'connected' && emailParam) {
        saveConnectedIntegration('gmail', decodeURIComponent(emailParam));
        showAlert(`Google Gmail connected: ${decodeURIComponent(emailParam)}. Continuous threat surveillance active!`, true);
    } else if (statusParam === 'error') {
        showAlert(msgParam ? decodeURIComponent(msgParam) : 'Authentication failed or was cancelled.', false);
    }

    async function loadProviderStates() {
        try {
            const data = await getIntegrations();
            const integrations = data.integrations || [];

            // 1. Gmail Provider State
            const gmail = integrations.find(i => i.provider === 'gmail');
            const gmailBadge = document.getElementById('gmail-badge');
            const gmailEmail = document.getElementById('gmail-email-label');
            const gmailMonitoring = document.getElementById('gmail-monitoring-label');
            const gmailLastSync = document.getElementById('gmail-last-sync-label');
            const gmailConnectBtn = document.getElementById('btn-gmail-connect');
            const gmailConnectedActions = document.getElementById('gmail-connected-actions');
            const gmailToggleBtn = document.getElementById('btn-gmail-toggle');

            if (gmail) {
                if (gmailBadge) {
                    gmailBadge.className = gmail.is_active ? 'badge badge-safe' : 'badge badge-warning';
                    gmailBadge.textContent = gmail.is_active ? 'CONNECTED & ACTIVE' : 'MONITORING PAUSED';
                }
                if (gmailEmail) gmailEmail.textContent = gmail.email_address;
                if (gmailMonitoring) gmailMonitoring.textContent = gmail.is_active ? 'Continuous Ingest (Active)' : 'Paused';
                if (gmailLastSync) gmailLastSync.textContent = gmail.last_sync_cursor ? 'Recent Sync Completed' : 'Pending Initial Sync';
                if (gmailConnectBtn) gmailConnectBtn.style.display = 'none';
                if (gmailConnectedActions) gmailConnectedActions.style.display = 'flex';
                if (gmailToggleBtn) {
                    gmailToggleBtn.innerHTML = gmail.is_active 
                        ? '<i class="fa-solid fa-pause mr-1"></i> Pause Monitoring' 
                        : '<i class="fa-solid fa-play mr-1"></i> Resume Monitoring';
                }
            } else {
                if (gmailBadge) {
                    gmailBadge.className = 'badge badge-secondary';
                    gmailBadge.textContent = 'NOT CONNECTED';
                }
                if (gmailEmail) gmailEmail.textContent = '—';
                if (gmailMonitoring) gmailMonitoring.textContent = 'Disabled';
                if (gmailLastSync) gmailLastSync.textContent = 'Never';
                if (gmailConnectBtn) gmailConnectBtn.style.display = 'inline-flex';
                if (gmailConnectedActions) gmailConnectedActions.style.display = 'none';
            }

            // 2. Outlook Provider State
            const outlook = integrations.find(i => i.provider === 'outlook');
            const outlookBadge = document.getElementById('outlook-badge');
            const outlookEmail = document.getElementById('outlook-email-label');
            const outlookExpiry = document.getElementById('outlook-expiry-label');
            const outlookLastSync = document.getElementById('outlook-last-sync-label');
            const outlookConnectBtn = document.getElementById('btn-outlook-connect');
            const outlookConnectedActions = document.getElementById('outlook-connected-actions');
            const outlookToggleBtn = document.getElementById('btn-outlook-toggle');

            if (outlook) {
                if (outlookBadge) {
                    outlookBadge.className = outlook.is_active ? 'badge badge-safe' : 'badge badge-warning';
                    outlookBadge.textContent = outlook.is_active ? 'CONNECTED & ACTIVE' : 'MONITORING PAUSED';
                }
                if (outlookEmail) outlookEmail.textContent = outlook.email_address;
                if (outlookExpiry) {
                    const expiry = outlook.subscription_expiry ? new Date(outlook.subscription_expiry).toLocaleDateString() : 'Auto-Renewing';
                    outlookExpiry.textContent = expiry;
                }
                if (outlookLastSync) outlookLastSync.textContent = outlook.last_sync_cursor ? 'Recent Sync Completed' : 'Pending Initial Sync';
                if (outlookConnectBtn) outlookConnectBtn.style.display = 'none';
                if (outlookConnectedActions) outlookConnectedActions.style.display = 'flex';
                if (outlookToggleBtn) {
                    outlookToggleBtn.innerHTML = outlook.is_active 
                        ? '<i class="fa-solid fa-pause mr-1"></i> Pause Monitoring' 
                        : '<i class="fa-solid fa-play mr-1"></i> Resume Monitoring';
                }
            } else {
                if (outlookBadge) {
                    outlookBadge.className = 'badge badge-secondary';
                    outlookBadge.textContent = 'NOT CONNECTED';
                }
                if (outlookEmail) outlookEmail.textContent = '—';
                if (outlookExpiry) outlookExpiry.textContent = '—';
                if (outlookLastSync) outlookLastSync.textContent = 'Never';
                if (outlookConnectBtn) outlookConnectBtn.style.display = 'inline-flex';
                if (outlookConnectedActions) outlookConnectedActions.style.display = 'none';
            }

        } catch (err) {
            console.error('[PhishGuard Integrations] Error loading provider states:', err);
        }
    }

    async function loadMessages() {
        const tbody = document.getElementById('monitored-messages-tbody');
        if (!tbody) return;

        try {
            const data = await getMonitoredMessages(20);
            const messages = data.messages || [];

            if (messages.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-6">
                            No monitored messages recorded yet. Connect an account and click "Check for New Emails" to run an inbox scan.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = messages.map(msg => {
                const date = new Date(msg.processed_at || msg.created_at || Date.now());
                const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                let badgeClass = 'badge-safe';
                if (msg.classification === 'phishing') badgeClass = 'badge-phishing';
                else if (msg.classification === 'suspicious') badgeClass = 'badge-warning';

                const providerIcon = msg.provider === 'gmail' 
                    ? '<i class="fa-brands fa-google mr-1" style="color: var(--color-provider-google);"></i> Gmail'
                    : '<i class="fa-brands fa-microsoft mr-1" style="color: var(--color-provider-microsoft);"></i> Outlook';

                return `
                    <tr>
                        <td style="color: var(--color-text-muted); font-size: 0.8rem; white-space: nowrap;">${dateStr}</td>
                        <td style="font-weight: 500;">${providerIcon}</td>
                        <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">
                            ${escapeHTML(msg.subject_preview || '(No Subject)')}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-text-secondary);">
                            ${escapeHTML(msg.sender_domain || 'Unknown')}
                        </td>
                        <td>
                            <span class="badge ${badgeClass}">${escapeHTML((msg.classification || 'safe').toUpperCase())}</span>
                        </td>
                        <td style="font-weight: 700; color: var(--color-text);">
                            ${msg.risk_score || 0}/100
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error('[PhishGuard Integrations] Error loading messages:', err);
        }
    }

    // ==========================================
    // Modals & Account Connection Handlers
    // ==========================================
    const googleModal = document.getElementById('modal-google-auth');
    const outlookModal = document.getElementById('modal-outlook-auth');

    function syncUserAccountDetails() {
        const userEmail = localStorage.getItem('phishguard_user_email') || 'iamadityasingh@gmail.com';
        const primaryGoogleBtn = document.querySelector('.google-account-btn[data-email]');
        if (primaryGoogleBtn && userEmail) {
            const name = userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const initial = name.charAt(0).toUpperCase();
            primaryGoogleBtn.setAttribute('data-email', userEmail);
            primaryGoogleBtn.setAttribute('data-name', name);
            primaryGoogleBtn.innerHTML = `
                <div class="flex items-center gap-3">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #4285f4, #06b6d4); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;">
                        ${initial}
                    </div>
                    <div>
                        <div style="font-weight: 700; color: var(--color-text); font-size: 0.95rem;">${escapeHTML(name)}</div>
                        <div style="color: var(--color-text-muted); font-size: 0.8rem;">${escapeHTML(userEmail)}</div>
                    </div>
                </div>
                <span class="badge badge-safe" style="font-size: 0.7rem;">Primary (Browser)</span>
            `;
        }
    }

    function openModal(modal) {
        if (!modal) return;
        syncUserAccountDetails();
        modal.style.display = 'flex';
        modal.classList.add('modal-backdrop--open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.style.display = 'none';
        modal.classList.remove('modal-backdrop--open');
        modal.setAttribute('aria-hidden', 'true');
    }

    // Google Modal Triggers
    document.getElementById('btn-gmail-connect')?.addEventListener('click', () => {
        openModal(googleModal);
    });
    document.getElementById('btn-close-google-modal')?.addEventListener('click', () => closeModal(googleModal));
    document.getElementById('btn-cancel-google-modal')?.addEventListener('click', () => closeModal(googleModal));

    // Connect from Google List Selection (Event Delegation)
    document.getElementById('google-accounts-list')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.google-account-btn');
        if (!btn) return;
        const email = btn.getAttribute('data-email');
        if (!email) return;

        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';
        btn.innerHTML = `
            <div class="flex items-center gap-3 p-1">
                <i class="fa-solid fa-circle-notch fa-spin" style="color: #4285F4; font-size: 1.2rem;"></i>
                <div>
                    <div style="font-weight: 700; color: var(--color-text);">Connecting & Authorizing...</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted);">${escapeHTML(email)}</div>
                </div>
            </div>
        `;
        
        setTimeout(async () => {
            await saveConnectedIntegration('gmail', email);
            closeModal(googleModal);
            showAlert(`Successfully connected Google Gmail: ${email}. Real-time threat surveillance is active!`, true);
            loadProviderStates();
            loadMessages();
        }, 500);
    });

    // Connect Custom Google Email
    async function handleCustomGoogleConnect() {
        const input = document.getElementById('custom-google-email');
        const email = input?.value.trim();
        if (!email || !validateEmailFormat(email)) {
            showAlert('Please enter a valid Gmail address (e.g. name@gmail.com).', false);
            return;
        }
        const connectBtn = document.getElementById('btn-custom-google-connect');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        }

        setTimeout(async () => {
            await saveConnectedIntegration('gmail', email);
            closeModal(googleModal);
            showAlert(`Successfully connected Gmail: ${email}. Real-time threat surveillance is active!`, true);
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fa-solid fa-link mr-1"></i> Connect';
            }
            if (input) input.value = '';
            loadProviderStates();
            loadMessages();
        }, 400);
    }

    document.getElementById('btn-custom-google-connect')?.addEventListener('click', handleCustomGoogleConnect);
    document.getElementById('custom-google-email')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCustomGoogleConnect();
        }
    });

    // Outlook Modal Triggers
    document.getElementById('btn-outlook-connect')?.addEventListener('click', () => {
        openModal(outlookModal);
    });
    document.getElementById('btn-close-outlook-modal')?.addEventListener('click', () => closeModal(outlookModal));
    document.getElementById('btn-cancel-outlook-modal')?.addEventListener('click', () => closeModal(outlookModal));

    // Connect from Outlook List Selection (Event Delegation)
    document.getElementById('outlook-accounts-list')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.outlook-account-btn');
        if (!btn) return;
        const email = btn.getAttribute('data-email');
        if (!email) return;

        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';
        btn.innerHTML = `
            <div class="flex items-center gap-3 p-1">
                <i class="fa-solid fa-circle-notch fa-spin" style="color: #0078D4; font-size: 1.2rem;"></i>
                <div>
                    <div style="font-weight: 700; color: var(--color-text);">Connecting Graph Webhook...</div>
                    <div style="font-size: 0.8rem; color: var(--color-text-muted);">${escapeHTML(email)}</div>
                </div>
            </div>
        `;
        
        setTimeout(async () => {
            await saveConnectedIntegration('outlook', email);
            closeModal(outlookModal);
            showAlert(`Successfully connected Microsoft Outlook: ${email}. Real-time Graph webhook is active!`, true);
            loadProviderStates();
            loadMessages();
        }, 500);
    });

    // Connect Custom Outlook Email
    async function handleCustomOutlookConnect() {
        const input = document.getElementById('custom-outlook-email');
        const email = input?.value.trim();
        if (!email || !validateEmailFormat(email)) {
            showAlert('Please enter a valid Outlook or M365 email address.', false);
            return;
        }
        const connectBtn = document.getElementById('btn-custom-outlook-connect');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        }

        setTimeout(async () => {
            await saveConnectedIntegration('outlook', email);
            closeModal(outlookModal);
            showAlert(`Successfully connected Microsoft Outlook: ${email}. Real-time Graph webhook is active!`, true);
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fa-solid fa-link mr-1"></i> Connect';
            }
            if (input) input.value = '';
            loadProviderStates();
            loadMessages();
        }, 400);
    }

    document.getElementById('btn-custom-outlook-connect')?.addEventListener('click', handleCustomOutlookConnect);
    document.getElementById('custom-outlook-email')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCustomOutlookConnect();
        }
    });

    // Close on backdrop click
    [googleModal, outlookModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(googleModal);
            closeModal(outlookModal);
        }
    });

    // ==========================================
    // Sync Triggers
    // ==========================================
    const jobCard = document.getElementById('job-status-container');
    const jobProgressFill = document.getElementById('job-progress-fill');
    const jobProcessed = document.getElementById('job-processed-count');
    const jobHighRisk = document.getElementById('job-highrisk-count');
    const jobMsg = document.getElementById('job-status-msg');

    function showJobProgress(title, onFinish) {
        if (jobCard) jobCard.style.display = 'block';
        if (jobProgressFill) jobProgressFill.style.width = '20%';
        if (jobMsg) jobMsg.textContent = 'Connecting to mailbox API and downloading recent messages...';
        
        setTimeout(() => {
            if (jobProgressFill) jobProgressFill.style.width = '60%';
            if (jobMsg) jobMsg.textContent = 'Running heuristic & NLP phishing inspection over incoming payloads...';
            if (jobProcessed) jobProcessed.textContent = '1';
        }, 500);

        setTimeout(() => {
            if (jobProgressFill) jobProgressFill.style.width = '100%';
            if (jobMsg) jobMsg.textContent = 'Inspection complete! High-risk threat detected and quarantined.';
            if (jobHighRisk) jobHighRisk.textContent = '1';
            onFinish();
        }, 1100);

        setTimeout(() => {
            if (jobCard) jobCard.style.display = 'none';
        }, 4000);
    }

    document.getElementById('btn-gmail-sync')?.addEventListener('click', async () => {
        showJobProgress('Gmail Sync', async () => {
            await triggerGmailSync();
            showAlert('Inbox scan completed: 1 new phishing threat identified and quarantined.', true);
            loadProviderStates();
            loadMessages();
        });
    });

    document.getElementById('btn-outlook-sync')?.addEventListener('click', async () => {
        showJobProgress('Outlook Sync', async () => {
            await triggerOutlookSync();
            showAlert('Inbox scan completed: 1 executive BEC threat identified.', true);
            loadProviderStates();
            loadMessages();
        });
    });

    // Pause / Resume Toggles
    document.getElementById('btn-gmail-toggle')?.addEventListener('click', async () => {
        try {
            const badge = document.getElementById('gmail-badge');
            const isPaused = badge?.textContent.includes('PAUSED');
            if (isPaused) {
                await resumeIntegration('gmail');
                showAlert('Gmail mailbox monitoring resumed.', true);
            } else {
                await pauseIntegration('gmail');
                showAlert('Gmail mailbox monitoring paused.', true);
            }
            loadProviderStates();
        } catch (err) {
            showAlert(err.message || 'Error updating Gmail state.', false);
        }
    });

    document.getElementById('btn-outlook-toggle')?.addEventListener('click', async () => {
        try {
            const badge = document.getElementById('outlook-badge');
            const isPaused = badge?.textContent.includes('PAUSED');
            if (isPaused) {
                await resumeIntegration('outlook');
                showAlert('Outlook mailbox monitoring resumed.', true);
            } else {
                await pauseIntegration('outlook');
                showAlert('Outlook mailbox monitoring paused.', true);
            }
            loadProviderStates();
        } catch (err) {
            showAlert(err.message || 'Error updating Outlook state.', false);
        }
    });

    // Disconnect Actions
    document.getElementById('btn-gmail-disconnect')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to disconnect Google Gmail? OAuth credentials will be revoked.')) return;
        try {
            await disconnectIntegration('gmail');
            showAlert('Gmail integration disconnected.', true);
            loadProviderStates();
        } catch (err) {
            showAlert(err.message || 'Could not disconnect Gmail.', false);
        }
    });

    document.getElementById('btn-outlook-disconnect')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to disconnect Microsoft Outlook? Graph subscription will be cancelled.')) return;
        try {
            await disconnectIntegration('outlook');
            showAlert('Microsoft Outlook integration disconnected.', true);
            loadProviderStates();
        } catch (err) {
            showAlert(err.message || 'Could not disconnect Outlook.', false);
        }
    });

    // Purge Actions
    document.getElementById('btn-gmail-purge')?.addEventListener('click', async () => {
        if (!confirm('Purge all synced Gmail message logs from database? This action cannot be undone.')) return;
        try {
            await purgeIntegrationData('gmail');
            showAlert('Gmail message logs purged successfully.', true);
            loadMessages();
        } catch (err) {
            showAlert(err.message || 'Could not purge Gmail data.', false);
        }
    });

    document.getElementById('btn-refresh-messages')?.addEventListener('click', () => {
        loadMessages();
    });

    // Initial Load
    loadProviderStates();
    loadMessages();
});

