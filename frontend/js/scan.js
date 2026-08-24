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
    const subjectInput = document.getElementById('subject');
    const subjectCounter = document.getElementById('subject-counter');
    const bodyInput = document.getElementById('body');
    const bodyCounter = document.getElementById('body-counter');

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
            panelUpload.classList.remove('active');
        } else {
            activeTabMode = 'upload';
            tabPaste.setAttribute('aria-selected', 'false');
            tabUpload.setAttribute('aria-selected', 'true');
            tabPaste.setAttribute('tabindex', '-1');
            tabUpload.removeAttribute('tabindex');
            panelPaste.classList.remove('active');
            panelUpload.classList.add('active');
        }
        clearValidationErrors();
    }

    tabPaste.addEventListener('click', (e) => { e.preventDefault(); switchTab('paste'); });
    tabUpload.addEventListener('click', (e) => { e.preventDefault(); switchTab('upload'); });

    // Keyboard navigation support for tabs (left/right arrow keys)
    tabPaste.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            switchTab('upload');
            tabUpload.focus();
        }
    });

    tabUpload.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            switchTab('paste');
            tabPaste.focus();
        }
    });

    // ==========================================
    // 2. Character Counters
    // ==========================================
    function updateCounter(input, label, limit) {
        const count = input.value.length;
        label.textContent = `${count.toLocaleString()} / ${limit.toLocaleString()} characters`;
        
        // Counter warning thresholds
        if (count >= limit * 0.95) {
            label.className = "counter-wrapper counter-danger";
        } else if (count >= limit * 0.8) {
            label.className = "counter-wrapper counter-warning";
        } else {
            label.className = "counter-wrapper";
        }
    }

    subjectInput.addEventListener('input', () => updateCounter(subjectInput, subjectCounter, 500));
    bodyInput.addEventListener('input', () => updateCounter(bodyInput, bodyCounter, 100000));

    // ==========================================
    // 3. EML/TXT File Upload Handling
    // ==========================================
    dropzone.addEventListener('click', () => fileInput.click());

    // Keyboard support for file drop zone click triggers
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            fileInput.click();
        }
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    });

    function processFile(file) {
        clearValidationErrors();
        
        const validation = validateUploadedFile(file);
        const errorDiv = document.getElementById('file-upload-error');

        if (!validation.valid) {
            errorDiv.textContent = validation.error;
            errorDiv.style.display = 'flex';
            dropzone.setAttribute('aria-invalid', 'true');
            clearFileState();
            return;
        }

        // Successfully validated
        selectedFileObject = file;
        errorDiv.style.display = 'none';
        dropzone.setAttribute('aria-invalid', 'false');

        // Render file card metadata details
        filenameLabel.textContent = file.name;
        filesizeLabel.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        fileDetailsCard.style.display = 'flex';

        showToast(`Selected file: ${file.name}`);
    }

    function clearFileState() {
        selectedFileObject = null;
        fileInput.value = '';
        fileDetailsCard.style.display = 'none';
    }

    removeFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearFileState();
        showToast("Removed uploaded draft file.");
    });

    // ==========================================
    // 4. Load Demo Emails Actions
    // ==========================================
    function loadDemoEmail(type) {
        clearValidationErrors();
        
        const demo = demoEmails[type];
        if (!demo) return;

        // Reset forms tabs to paste
        switchTab('paste');

        // Load values
        document.getElementById('sender').value = demo.sender;
        document.getElementById('recipient').value = demo.recipient;
        subjectInput.value = demo.subject;
        bodyInput.value = demo.body;

        // Update counters
        updateCounter(subjectInput, subjectCounter, 500);
        updateCounter(bodyInput, bodyCounter, 100000);

        showToast(`Fictional ${type.toUpperCase()} demo data loaded.`);
    }

    demoSafeBtn.addEventListener('click', () => loadDemoEmail('safe'));
    demoPhishBtn.addEventListener('click', () => loadDemoEmail('phishing'));

    // ==========================================
    // 5. Clear Form
    // ==========================================
    clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Ask for confirmation if form contains text values
        const hasContent = document.getElementById('sender').value || 
                            document.getElementById('recipient').value || 
                            subjectInput.value || 
                            bodyInput.value || 
                            selectedFileObject;

        if (hasContent && !confirm("Are you sure you want to clear all entered values?")) {
            return;
        }

        form.reset();
        clearFileState();
        clearValidationErrors();
        
        // Reset counters
        updateCounter(subjectInput, subjectCounter, 500);
        updateCounter(bodyInput, bodyCounter, 100000);

        // Put focus back to first element
        document.getElementById('sender').focus();
        showToast("Form cleared.");
    });

    // ==========================================
    // 6. Validation & Submits
    // ==========================================
    function clearValidationErrors() {
        validationSummary.style.display = 'none';
        errorList.innerHTML = '';
        
        const fields = ['sender', 'recipient', 'subject', 'body', 'upload-dropzone'];
        fields.forEach(fId => {
            const el = document.getElementById(fId);
            if (el) {
                el.removeAttribute('aria-invalid');
                el.removeAttribute('aria-describedby');
            }
            const errEl = document.getElementById(`${fId}-error`);
            if (errEl) {
                errEl.style.display = 'none';
                errEl.innerHTML = '';
            }
        });
        
        const fileErr = document.getElementById('file-upload-error');
        if (fileErr) {
            fileErr.style.display = 'none';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearValidationErrors();

        const senderVal = document.getElementById('sender').value.trim();
        const recipientVal = document.getElementById('recipient').value.trim();
        const subjectVal = subjectInput.value.trim();
        const bodyVal = bodyInput.value.trim();

        const errors = [];

        // Validate Sender
        if (senderVal && !validateEmailFormat(senderVal)) {
            errors.push({ id: 'sender', message: "Please enter a valid sender email address (e.g. name@example.com)." });
        }

        // Validate Recipient
        if (recipientVal && !validateEmailFormat(recipientVal)) {
            errors.push({ id: 'recipient', message: "Please enter a valid recipient email address (e.g. name@example.com)." });
        }

        // Validate Subject Length
        if (subjectVal.length > 500) {
            errors.push({ id: 'subject', message: "Email subject cannot exceed 500 characters." });
        }

        // Mode specific validation checks
        if (activeTabMode === 'paste') {
            if (!validateMinText(bodyVal, 5)) {
                errors.push({ id: 'body', message: "Please paste a valid email body (minimum 5 non-whitespace characters) before continuing." });
            } else if (bodyVal.length > 100000) {
                errors.push({ id: 'body', message: "Email body cannot exceed 100,000 characters." });
            }
        } else {
            // Upload mode validations
            if (!selectedFileObject) {
                errors.push({ id: 'upload-dropzone', message: "Please select or drop a valid email file (.eml or .txt) in upload mode." });
            }
        }

        // If errors exist, render validation alert panel
        if (errors.length > 0) {
            renderErrors(errors);
            return;
        }

        // Inputs are valid. Start Loading overlay trigger.
        setLoadingState(true);

        try {
            // Submit scan call to mock API layer
            const result = await analyzeEmail(
                senderVal,
                recipientVal,
                subjectVal,
                activeTabMode === 'paste' ? bodyVal : "",
                selectedFileObject ? { name: selectedFileObject.name, size: selectedFileObject.size } : null
            );

            // Save results to storage and redirect
            setLatestResult(result);
            window.location.href = `/result.html?scan_id=${result.scan_id}`;
        } catch (err) {
            setLoadingState(false);
            renderErrors([{ id: 'form-container-card', message: err.message || "Failed to analyze email signals. Please try again." }]);
        }
    });

    function renderErrors(errors) {
        errorList.innerHTML = '';
        errors.forEach((err, idx) => {
            // Append to error list summary
            const li = document.createElement('li');
            li.innerHTML = `<a href="#${err.id}" style="color: inherit; font-weight: 600;">${escapeHTML(err.message)}</a>`;
            errorList.appendChild(li);

            // Connect validation attributes
            const inputEl = document.getElementById(err.id);
            if (inputEl) {
                inputEl.setAttribute('aria-invalid', 'true');
                inputEl.setAttribute('aria-describedby', `${err.id}-error`);
            }

            const errorMsgEl = document.getElementById(`${err.id}-error`);
            if (errorMsgEl) {
                errorMsgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHTML(err.message)}`;
                errorMsgEl.style.display = 'flex';
            }
        });

        validationSummary.style.display = 'block';
        
        // Accessible focus redirection to first error input element
        const firstErrId = errors[0].id;
        const targetEl = document.getElementById(firstErrId);
        if (targetEl) {
            targetEl.focus();
        } else {
            validationSummary.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            formCard.style.display = 'none';
            analysisLoader.style.display = 'flex';
            analysisLoader.setAttribute('aria-busy', 'true');
        } else {
            formCard.style.display = 'block';
            analysisLoader.style.display = 'none';
            analysisLoader.setAttribute('aria-busy', 'false');
        }
    }

    // Toast alerts helper
    function showToast(message) {
        successToastText.textContent = message;
        successToast.style.display = 'block';
        setTimeout(() => {
            successToast.style.display = 'none';
        }, 3000);
    }
});
