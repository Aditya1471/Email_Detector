// PhishGuard - Authentication Controller (Login & Registration)
import { loginUser, registerUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorBox = document.getElementById('auth-error-box');
    const errorText = document.getElementById('auth-error-text');

    // ==========================================
    // 1. Password Visibility Eye Toggle
    // ==========================================
    const togglePwBtn = document.getElementById('toggle-pw-btn');
    const pwInput = document.getElementById('password');
    const eyeIcon = document.getElementById('pw-eye-icon');

    if (togglePwBtn && pwInput && eyeIcon) {
        togglePwBtn.addEventListener('click', () => {
            const isPw = pwInput.type === 'password';
            pwInput.type = isPw ? 'text' : 'password';
            eyeIcon.className = isPw ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            togglePwBtn.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
        });
    }

    // ==========================================
    // 2. Demo Autofill Trigger (Login Page Only)
    // ==========================================
    const demoBtn = document.getElementById('demo-auth-btn');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('email');
            const pwInput = document.getElementById('password');
            if (emailInput && pwInput) {
                emailInput.value = "operator@phishguard-sandbox.com";
                pwInput.value = "password123";
                // Trigger submit
                if (loginForm) loginForm.requestSubmit();
            }
        });
    }

    // ==========================================
    // 3. Login Submission Validation
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            let hasError = false;

            // Validate Email format
            if (!email.includes('@')) {
                showFieldValidationError('email', 'Please enter a valid email address.');
                hasError = true;
            }

            // Validate Password
            if (password.length < 4) {
                showFieldValidationError('password', 'Password must be at least 4 characters.');
                hasError = true;
            }

            if (hasError) {
                showSummaryError("Please correct validation errors before logging in.");
                return;
            }

            // Disable submit & show spinner
            const submitBtn = document.getElementById('submit-auth-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = "Signing In...";

            try {
                await loginUser(email, password);
                window.location.href = 'dashboard.html';
            } catch (err) {
                showSummaryError(err.message || "Failed to log in.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Sign In to Account";
            }
        });
    }

    // ==========================================
    // 4. Registration Submission Validation
    // ==========================================
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirm-password').value.trim();
            const termsChecked = document.getElementById('terms').checked;
            let hasError = false;

            // Name
            if (name.length < 2) {
                showFieldValidationError('name', 'Full name is required (minimum 2 characters).');
                hasError = true;
            }

            // Email
            if (!email.includes('@')) {
                showFieldValidationError('email', 'Please enter a valid email address.');
                hasError = true;
            }

            // Password strength
            if (password.length < 6) {
                showFieldValidationError('password', 'Password must be at least 6 characters.');
                hasError = true;
            }

            // Confirm Password match
            if (password !== confirmPassword) {
                showFieldValidationError('confirm-password', 'Passwords do not match.');
                hasError = true;
            }

            // Terms
            if (!termsChecked) {
                showFieldValidationError('terms', 'You must agree to the Terms of Service.');
                hasError = true;
            }

            if (hasError) {
                showSummaryError("Please correct registration errors.");
                return;
            }

            // Disable submit & show spinner
            const submitBtn = document.getElementById('submit-auth-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = "Creating Account...";

            try {
                await registerUser(name, email, password);
                window.location.href = 'dashboard.html';
            } catch (err) {
                showSummaryError(err.message || "Failed to register account.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Create Account";
            }
        });
    }

    // ==========================================
    // 5. Utility Form Error Helpers
    // ==========================================
    function showFieldValidationError(fieldId, msg) {
        const input = document.getElementById(fieldId);
        const errorDiv = document.getElementById(`${fieldId}-error`);
        if (input && errorDiv) {
            input.classList.add('form-input--error');
            input.setAttribute('aria-invalid', 'true');
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }

    function showSummaryError(msg) {
        if (errorBox && errorText) {
            errorText.textContent = msg;
            errorBox.style.display = 'flex';
            // Scroll to error box for accessibility focus
            errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function clearErrors() {
        if (errorBox) errorBox.style.display = 'none';
        
        const inputs = document.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.classList.remove('form-input--error');
            input.removeAttribute('aria-invalid');
        });

        const errorDivs = document.querySelectorAll('.error-message');
        errorDivs.forEach(div => {
            div.textContent = '';
            div.style.display = 'none';
        });
    }
});
