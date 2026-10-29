// PhishGuard - Scan Page Controller
import { analyzeEmail } from './api.js';
import { demoEmails } from './mock-data.js';
import { setLatestResult } from './storage.js';
import { validateEmailFormat, validateMinText, validateUploadedFile, escapeHTML } from './utilities.js';

document.addEventListener('DOMContentLoaded', () => {
    // Current Active Tab Panel Mode (paste vs upload)
    let activeTabMode = 'paste'; // paste | upload
    let selectedFileObject = null;

    // Elements Selectors
    const form = document.getElementById('email-scan-form');
    const formCard = document.getElementById('form-container-card');
    const loader = document.getElementById('analysis-overlay');
    const analysisLoader = document.getElementById('analysis-loader');
    const validationSummary = document.getElementById('validation-summary-box');
    const errorList = document.getElementById('validation-error-list');
    const successToast = document.getElementById('success-toast');
    const successToastText = document.getElementById('success-toast-text');

    // Tab items
    const tabPaste = document.getElementById('tab-paste');
    const tabUpload = document.getElementById('tab-upload');
    const panelPaste = document.getElementById('panel-paste');
    const panelUpload = document.getElementById('panel-upload');

    // Text inputs & counters
    const senderInput = document.getElementById('sender');
    const recipientInput = document.getElementById('recipient');
    const subjectInput = document.getElementById('subject');
    const subjectCounter = document.getElementById('subject-counter');
    const bodyInput = document.getElementById('body');
    const bodyCounter = document.getElementById('body-counter');

    // Live Heuristic Signal Strip
    const liveHeuristicStrip = document.getElementById('live-heuristic-strip');
    const liveHeuristicBadges = document.getElementById('live-heuristic-badges');

    // Upload items
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');
    const fileDetailsCard = document.getElementById('selected-file-details');
    const filenameLabel = document.getElementById('selected-filename');
    const filesizeLabel = document.getElementById('selected-filesize');
    const removeFileBtn = document.getElementById('remove-file-btn');

    // Action Buttons
    const clearBtn = document.getElementById('clear-form-btn');
    const demoSafeBtn = document.getElementById('demo-safe-btn');
    const demoPhishBtn = document.getElementById('demo-phish-btn');
    const presetButtons = document.querySelectorAll('.preset-btn');

    // ==========================================
    // 1. Tab Switching Functionality
    // ==========================================
    function switchTab(mode) {
        if (mode === 'paste') {
            activeTabMode = 'paste';
            tabPaste.setAttribute('aria-selected', 'true');
            tabUpload.setAttribute('aria-selected', 'false');
            tabPaste.removeAttribute('tabindex');
            tabUpload.setAttribute('tabindex', '-1');
            panelPaste.classList.add('active');
            panelPaste.classList.remove('hidden');
            panelUpload.classList.remove('active');
            panelUpload.classList.add('hidden');
        } else {
            activeTabMode = 'upload';
            tabPaste.setAttribute('aria-selected', 'false');
            tabUpload.setAttribute('aria-selected', 'true');
            tabPaste.setAttribute('tabindex', '-1');
            tabUpload.removeAttribute('tabindex');
            panelPaste.classList.remove('active');
            panelPaste.classList.add('hidden');
            panelUpload.classList.add('active');
            panelUpload.classList.remove('hidden');
        }
        clearValidationErrors();
    }

    tabPaste?.addEventListener('click', (e) => { e.preventDefault(); switchTab('paste'); });
    tabUpload?.addEventListener('click', (e) => { e.preventDefault(); switchTab('upload'); });

    tabPaste?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            switchTab('upload');
            tabUpload.focus();
        }
    });

    tabUpload?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            switchTab('paste');
            tabPaste.focus();
        }
    });

    // ==========================================
    // 2. Character Counters & Live Real-Time Heuristics
    // ==========================================
    function updateCounter(input, label, limit) {
        if (!input || !label) return;
        const count = input.value.length;
        label.textContent = `${count.toLocaleString()} / ${limit.toLocaleString()} characters`;
        
        if (count >= limit * 0.95) {
            label.className = "counter-wrapper counter-danger";
        } else if (count >= limit * 0.8) {
            label.className = "counter-wrapper counter-warning";
        } else {
            label.className = "counter-wrapper";
        }
    }

    function analyzeLiveHeuristics() {
        if (!liveHeuristicStrip || !liveHeuristicBadges) return;
        
        const sender = senderInput?.value || '';
        const subject = subjectInput?.value || '';
        const body = bodyInput?.value || '';
        const combined = `${sender} ${subject} ${body}`.toLowerCase();

        if (combined.trim().length < 10) {
            liveHeuristicStrip.style.display = 'none';
            liveHeuristicBadges.innerHTML = '';
            return;
        }

        const badges = [];

        // 1. Homoglyphs & Lookalikes
        if (/micros0ft|paypa1|g00gle|app1e|amaz0n|bank0famerica/i.test(combined)) {
            badges.push(`<span class="badge badge-phishing"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Lookalike Homoglyph Detected</span>`);
        }

        // 2. High urgency / coercive terms
        if (/urgent|immediate|action required|suspended|within 24 hours|2 hours|terminate|account hold/i.test(combined)) {
            badges.push(`<span class="badge badge-warning"><i class="fa-solid fa-clock mr-1"></i> Coercive Psychological Urgency</span>`);
        }

        // 3. Financial / Wire / Payroll scams
        if (/wire transfer|escrow|\$142|\$849|direct deposit|w-4|debit/i.test(combined)) {
            badges.push(`<span class="badge badge-warning"><i class="fa-solid fa-money-bill-transfer mr-1"></i> Financial Transfer / Debit Cues</span>`);
        }

        // 4. Suspicious TLD / Deceptive links
        if (/\.xyz|\.cc|\.info|\.top|\.online|http:\/\/|download-release\.exe/i.test(combined)) {
            badges.push(`<span class="badge badge-phishing"><i class="fa-solid fa-link mr-1"></i> Suspicious TLD / Direct File Executable</span>`);
        }

        // 5. Credential harvesting keywords
        if (/password reset|verify credentials|identity verification portal|login to update/i.test(combined)) {
            badges.push(`<span class="badge badge-phishing"><i class="fa-solid fa-key mr-1"></i> Credential Prompt Cues</span>`);
        }

        if (badges.length > 0) {
            liveHeuristicStrip.style.display = 'block';
            liveHeuristicBadges.innerHTML = badges.join('');
        } else {
            liveHeuristicStrip.style.display = 'block';
            liveHeuristicBadges.innerHTML = `<span class="badge badge-safe"><i class="fa-solid fa-check mr-1"></i> Neutral Lexical Tone</span>`;
        }
    }

    subjectInput?.addEventListener('input', () => {
        updateCounter(subjectInput, subjectCounter, 500);
        analyzeLiveHeuristics();
    });

    bodyInput?.addEventListener('input', () => {
        updateCounter(bodyInput, bodyCounter, 100000);
        analyzeLiveHeuristics();
    });

    senderInput?.addEventListener('input', () => {
        analyzeLiveHeuristics();
    });

    // ==========================================
    // 3. EML/TXT File Upload Handling
    // ==========================================
    dropzone?.addEventListener('click', () => fileInput.click());

    dropzone?.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            fileInput.click();
        }
    });

    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    });

    function processFile(file) {
        clearValidationErrors();
        
        const validation = validateUploadedFile(file);
        const errorDiv = document.getElementById('file-upload-error');

        if (!validation.valid) {
            if (errorDiv) {
                errorDiv.textContent = validation.error;
                errorDiv.style.display = 'flex';
            }
            dropzone.setAttribute('aria-invalid', 'true');
            clearFileState();
            return;
        }

        selectedFileObject = file;
        if (errorDiv) errorDiv.style.display = 'none';
        dropzone.setAttribute('aria-invalid', 'false');

        if (filenameLabel) filenameLabel.textContent = file.name;
        if (filesizeLabel) filesizeLabel.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        if (fileDetailsCard) fileDetailsCard.style.display = 'flex';

        // Read file contents
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            // Parse headers
            const subjectMatch = content.match(/^Subject:\s*(.*)$/im);
            const fromMatch = content.match(/^From:\s*(.*)$/im);
            const toMatch = content.match(/^To:\s*(.*)$/im);

            if (subjectMatch && subjectInput) subjectInput.value = subjectMatch[1].trim();
            if (fromMatch && senderInput) senderInput.value = fromMatch[1].trim();
            if (toMatch && recipientInput) recipientInput.value = toMatch[1].trim();
            if (bodyInput) bodyInput.value = content;

            updateCounter(subjectInput, subjectCounter, 500);
            updateCounter(bodyInput, bodyCounter, 100000);
            analyzeLiveHeuristics();
            showToast(`Parsed email: ${file.name}`);
        };
        reader.readAsText(file);
    }

    function clearFileState() {
        selectedFileObject = null;
        if (fileInput) fileInput.value = '';
        if (fileDetailsCard) fileDetailsCard.style.display = 'none';
    }

    removeFileBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        clearFileState();
        showToast("Removed uploaded draft file.");
    });

    // ==========================================
    // 4. Load Real-World Attack Presets
    // ==========================================
    function loadDemoEmail(type) {
        clearValidationErrors();
        
        const demo = demoEmails[type];
        if (!demo) return;

        switchTab('paste');

        if (senderInput) senderInput.value = demo.sender || '';
        if (recipientInput) recipientInput.value = demo.recipient || '';
        if (subjectInput) subjectInput.value = demo.subject || '';
        if (bodyInput) bodyInput.value = demo.body || '';

        updateCounter(subjectInput, subjectCounter, 500);
        updateCounter(bodyInput, bodyCounter, 100000);
        analyzeLiveHeuristics();

        showToast(`Loaded preset: ${demo.name || type.toUpperCase()}`);
    }

    demoSafeBtn?.addEventListener('click', () => loadDemoEmail('safe'));
    demoPhishBtn?.addEventListener('click', () => loadDemoEmail('phishing'));

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetKey = btn.getAttribute('data-preset');
            loadDemoEmail(presetKey);
        });
    });

    // Check URL query parameter on initial load (e.g. scan.html?preset=m365_harvest)
    const urlParams = new URLSearchParams(window.location.search);
    const presetParam = urlParams.get('preset');
    if (presetParam && demoEmails[presetParam]) {
        loadDemoEmail(presetParam);
    }

    // ==========================================
    // 5. Clear Form
    // ==========================================
    clearBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        
        const hasContent = senderInput?.value || recipientInput?.value || subjectInput?.value || bodyInput?.value || selectedFileObject;

        if (hasContent && !confirm("Are you sure you want to clear all entered values?")) {
            return;
        }

        form.reset();
        clearFileState();
        clearValidationErrors();
        
        updateCounter(subjectInput, subjectCounter, 500);
        updateCounter(bodyInput, bodyCounter, 100000);
        if (liveHeuristicStrip) liveHeuristicStrip.style.display = 'none';

        senderInput?.focus();
        showToast("Form cleared.");
    });

    // ==========================================
    // 6. Validation & Submits
    // ==========================================
    function clearValidationErrors() {
        if (validationSummary) validationSummary.style.display = 'none';
        if (errorList) errorList.innerHTML = '';
        
        [senderInput, recipientInput, subjectInput, bodyInput].forEach(el => {
            if (el) {
                el.classList.remove('form-input--error');
                el.removeAttribute('aria-invalid');
            }
        });
    }

    function showValidationErrors(errors) {
        if (!validationSummary || !errorList) return;
        errorList.innerHTML = errors.map(err => `<li>${escapeHTML(err)}</li>`).join('');
        validationSummary.style.display = 'block';
        validationSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearValidationErrors();

        const sender = senderInput?.value.trim();
        const recipient = recipientInput?.value.trim();
        const subject = subjectInput?.value.trim();
        const body = bodyInput?.value.trim();

        const errors = [];

        if (sender && !validateEmailFormat(sender)) {
            errors.push("Sender address must be a valid email format (e.g. name@domain.com).");
            senderInput.classList.add('form-input--error');
            senderInput.setAttribute('aria-invalid', 'true');
        }

        if (recipient && !validateEmailFormat(recipient)) {
            errors.push("Recipient address must be a valid email format (e.g. name@domain.com).");
            recipientInput.classList.add('form-input--error');
            recipientInput.setAttribute('aria-invalid', 'true');
        }

        if (!subject) {
            errors.push("Subject line is required.");
            subjectInput.classList.add('form-input--error');
            subjectInput.setAttribute('aria-invalid', 'true');
        }

        if (!body) {
            errors.push("Email body content is required for threat detection.");
            bodyInput.classList.add('form-input--error');
            bodyInput.setAttribute('aria-invalid', 'true');
        } else if (body.length < 10) {
            errors.push("Email body content must contain at least 10 characters.");
            bodyInput.classList.add('form-input--error');
            bodyInput.setAttribute('aria-invalid', 'true');
        }

        if (errors.length > 0) {
            showValidationErrors(errors);
            return;
        }

        // Show analysis progress loader with staged progress
        const stepStatus = document.getElementById('analysis-step-status');
        const progressFill = document.getElementById('analysis-progress-fill');

        if (loader) loader.style.display = 'flex';
        if (analysisLoader) analysisLoader.style.display = 'flex';
        if (stepStatus) stepStatus.textContent = "1. Ingesting RFC822 headers & payload structure...";
        if (progressFill) progressFill.style.width = "25%";

        const t1 = setTimeout(() => {
            if (stepStatus) stepStatus.textContent = "2. Inspecting sender domain DNS, SPF & homoglyphs...";
            if (progressFill) progressFill.style.width = "50%";
        }, 300);

        const t2 = setTimeout(() => {
            if (stepStatus) stepStatus.textContent = "3. Extracting hyperlinks & analyzing destination risks...";
            if (progressFill) progressFill.style.width = "75%";
        }, 600);

        const t3 = setTimeout(() => {
            if (stepStatus) stepStatus.textContent = "4. Synthesizing ML NLP classification & threat radar...";
            if (progressFill) progressFill.style.width = "92%";
        }, 900);

        try {
            const data = await analyzeEmail(sender, recipient, subject, body);
            setLatestResult(data);

            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);

            if (stepStatus) stepStatus.textContent = "✓ Threat analysis complete! Generating report...";
            if (progressFill) progressFill.style.width = "100%";

            const scanId = data.scan_id || 'DEMO-SCAN';
            setTimeout(() => {
                window.location.href = `result.html?scan_id=${encodeURIComponent(scanId)}`;
            }, 500);
        } catch (err) {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            console.error("[PhishGuard] Scan execution error:", err);
            if (loader) loader.style.display = 'none';
            if (analysisLoader) analysisLoader.style.display = 'none';
            showValidationErrors([err.message || "An unexpected error occurred during email inspection. Please try again."]);
        }
    });

    function showToast(msg) {
        if (!successToast || !successToastText) return;
        successToastText.textContent = msg;
        successToast.style.display = 'flex';
        setTimeout(() => {
            successToast.style.display = 'none';
        }, 4000);
    }
});
