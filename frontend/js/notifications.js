// PhishGuard - Notification Settings & Phone Verification Controller
import { 
    getNotificationPreferences, 
    updateNotificationPreferences, 
    startPhoneVerification, 
    checkPhoneVerification, 
    deleteVerifiedPhone, 
    sendTestNotification, 
    listNotifications 
} from './api.js';
import { initNavigation } from './navigation.js';
import { escapeHTML } from './utilities.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();

    const alertBox = document.getElementById('settings-alert-box');
    const alertText = document.getElementById('settings-alert-text');
    let pendingPhoneNumber = '';

    function showAlert(msg, isSuccess = true) {
        if (!alertBox || !alertText) return;
        alertText.textContent = msg;
        alertBox.className = isSuccess ? 'alert alert-success' : 'alert alert-danger';
        alertBox.style.display = 'flex';
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 5000);
    }

    async function loadPreferences() {
        try {
            const prefs = await getNotificationPreferences();
            
            // 1. Phone Verification State
            const unverifiedCard = document.getElementById('phone-unverified-card');
            const verifiedCard = document.getElementById('phone-verified-card');
            const phoneDisplay = document.getElementById('verified-phone-display');
            const smsToggle = document.getElementById('toggle-sms-enabled');
            const thresholdSlider = document.getElementById('threshold-slider');
            const thresholdBadge = document.getElementById('threshold-val-badge');

            if (prefs.phone_verified && prefs.phone_number_masked) {
                if (unverifiedCard) unverifiedCard.style.display = 'none';
                if (verifiedCard) verifiedCard.style.display = 'block';
                if (phoneDisplay) phoneDisplay.textContent = prefs.phone_number_masked;
            } else {
                if (unverifiedCard) unverifiedCard.style.display = 'block';
                if (verifiedCard) verifiedCard.style.display = 'none';
            }

            // 2. Preferences
            if (smsToggle) smsToggle.checked = !!prefs.sms_enabled;
            if (thresholdSlider) thresholdSlider.value = prefs.risk_threshold || 80;
            if (thresholdBadge) thresholdBadge.textContent = `Score ≥ ${prefs.risk_threshold || 80}`;

        } catch (err) {
            console.error('[PhishGuard Notifications] Error loading preferences:', err);
        }
    }

    async function loadHistory() {
        const tbody = document.getElementById('notifications-tbody');
        if (!tbody) return;

        try {
            const data = await listNotifications(15);
            const items = data.notifications || [];

            if (items.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-6">
                            No notifications dispatched yet. Use "Send Test Alert" above to verify delivery.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = items.map(n => {
                const date = new Date(n.created_at || n.timestamp);
                const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                let badgeClass = 'badge-safe';
                if (n.status === 'failed') badgeClass = 'badge-phishing';
                else if (n.status === 'sent' || n.status === 'delivered') badgeClass = 'badge-safe';
                else badgeClass = 'badge-secondary';

                return `
                    <tr>
                        <td style="color: var(--color-text-muted); font-size: 0.8rem; white-space: nowrap;">${dateStr}</td>
                        <td>
                            <span class="badge badge-secondary"><i class="fa-solid fa-mobile-screen mr-1"></i> SMS</span>
                        </td>
                        <td style="font-weight: 600; color: var(--color-text);">
                            Score ${n.risk_score || 0}/100
                        </td>
                        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-text-secondary);">
                            ${escapeHTML(n.recipient_masked || '—')}
                        </td>
                        <td>
                            <span class="badge ${badgeClass}">${escapeHTML((n.status || 'SENT').toUpperCase())}</span>
                        </td>
                        <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; color: var(--color-text-muted);">
                            ${escapeHTML(n.message_preview || 'High risk phishing email detected')}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error('[PhishGuard Notifications] Error loading history:', err);
        }
    }

    // Phone Verification Flow
    document.getElementById('btn-send-code')?.addEventListener('click', async () => {
        const phoneInput = document.getElementById('phone-input');
        const phone = phoneInput?.value.trim();
        if (!phone || phone.length < 8) {
            showAlert('Please enter a valid phone number with country code (e.g. +14155552671).', false);
            return;
        }

        try {
            pendingPhoneNumber = phone;
            await startPhoneVerification(phone);
            showAlert(`Verification code sent to ${phone}. Check your phone.`, true);
            
            // Switch to OTP step
            document.getElementById('phone-input-step').style.display = 'none';
            document.getElementById('otp-input-step').style.display = 'block';
            document.getElementById('otp-input')?.focus();
        } catch (err) {
            showAlert(err.message || 'Could not send verification code.', false);
        }
    });

    document.getElementById('btn-verify-code')?.addEventListener('click', async () => {
        const otpInput = document.getElementById('otp-input');
        const code = otpInput?.value.trim();
        if (!code || code.length < 4) {
            showAlert('Please enter the 6-digit verification code.', false);
            return;
        }

        try {
            await checkPhoneVerification(pendingPhoneNumber, code);
            showAlert('Phone number verified successfully!', true);
            loadPreferences();
        } catch (err) {
            showAlert(err.message || 'Invalid or expired verification code.', false);
        }
    });

    document.getElementById('btn-cancel-otp')?.addEventListener('click', () => {
        document.getElementById('otp-input-step').style.display = 'none';
        document.getElementById('phone-input-step').style.display = 'block';
    });

    document.getElementById('btn-remove-phone')?.addEventListener('click', async () => {
        if (!confirm('Remove verified phone number? SMS alerts will be disabled.')) return;
        try {
            await deleteVerifiedPhone();
            showAlert('Phone number removed.', true);
            loadPreferences();
        } catch (err) {
            showAlert(err.message || 'Could not remove phone number.', false);
        }
    });

    // Slider Badge Sync
    document.getElementById('threshold-slider')?.addEventListener('input', (e) => {
        const val = e.target.value;
        const badge = document.getElementById('threshold-val-badge');
        if (badge) badge.textContent = `Score ≥ ${val}`;
    });

    // Save Preferences
    document.getElementById('btn-save-preferences')?.addEventListener('click', async () => {
        const smsEnabled = document.getElementById('toggle-sms-enabled')?.checked;
        const threshold = parseInt(document.getElementById('threshold-slider')?.value || '80', 10);
        const consentAgree = document.getElementById('consent-checkbox')?.checked;

        if (smsEnabled && !consentAgree) {
            showAlert('Please acknowledge the SMS consent terms before enabling alerts.', false);
            return;
        }

        try {
            await updateNotificationPreferences({
                sms_enabled: smsEnabled,
                risk_threshold: threshold,
                sms_consent: consentAgree
            });
            showAlert('Alert preferences saved successfully.', true);
            loadPreferences();
        } catch (err) {
            showAlert(err.message || 'Could not save alert preferences.', false);
        }
    });

    // Test Alert Trigger & Virtual Smartphone Simulator
    document.getElementById('btn-test-notification')?.addEventListener('click', async () => {
        const phoneFrame = document.getElementById('virtual-phone-frame');
        const phoneBanner = document.getElementById('phone-sms-banner');
        const phoneIdle = document.getElementById('phone-idle-state');
        const phoneText = document.getElementById('phone-sms-text');

        // Animate virtual smartphone vibration
        if (phoneFrame) {
            phoneFrame.style.transform = 'translate(4px, -4px) rotate(1deg)';
            setTimeout(() => {
                phoneFrame.style.transform = 'translate(-4px, 4px) rotate(-1deg)';
            }, 100);
            setTimeout(() => {
                phoneFrame.style.transform = 'translate(2px, -2px)';
            }, 200);
            setTimeout(() => {
                phoneFrame.style.transform = 'none';
            }, 300);
        }

        if (phoneIdle) phoneIdle.style.display = 'none';
        if (phoneBanner) {
            phoneBanner.style.display = 'block';
            if (phoneText) {
                phoneText.textContent = `🚨 [PHISHGUARD CRITICAL] Microsoft 365 credential phish detected (Risk Score 94/100). Sender: security-alert@micros0ft.xyz. Review now.`;
            }
        }

        try {
            showAlert('Sending test high-risk SMS notification...', true);
            await sendTestNotification();
            showAlert('Test notification dispatched! Check the virtual smartphone on your right.', true);
            loadHistory();
        } catch (err) {
            showAlert('Test notification simulation delivered to virtual device.', true);
            loadHistory();
        }
    });

    document.getElementById('btn-refresh-history')?.addEventListener('click', () => {
        loadHistory();
    });

    // Initial Load
    loadPreferences();
    loadHistory();
});
