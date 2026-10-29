// PhishGuard - ES Utility and Validation Functions

/**
 * Validates the syntax formatting of an email address.
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmailFormat(email) {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates if the string has a minimum amount of non-whitespace characters.
 * @param {string} text
 * @param {number} minNonWhitespace
 * @returns {boolean}
 */
export function validateMinText(text, minNonWhitespace = 5) {
    if (!text) return false;
    const cleaned = text.replace(/\s/g, '');
    return cleaned.length >= minNonWhitespace;
}

/**
 * Validates file configuration parameters.
 * @param {File} file
 * @param {Array<string>} allowedExtensions
 * @param {number} maxSizeBytes
 * @returns {{valid: boolean, error: string}}
 */
export function validateUploadedFile(file, allowedExtensions = ['.eml', '.txt', '.msg'], maxSizeBytes = 5 * 1024 * 1024) {
    if (!file) {
        return { valid: false, error: "Please select or drop a file." };
    }

    const name = file.name.toLowerCase();
    const matchesExt = allowedExtensions.some(ext => name.endsWith(ext));
    if (!matchesExt) {
        return { valid: false, error: `Invalid file extension. Supported extensions: ${allowedExtensions.join(', ')}.` };
    }

    if (file.size > maxSizeBytes) {
        return { valid: false, error: "File exceeds the maximum size limit of 5 MB." };
    }

    return { valid: true, error: "" };
}

/**
 * Clean up text content and escape html to prevent direct script execution.
 * @param {string} unsafeText
 * @returns {string}
 */
export function escapeHTML(unsafeText) {
    if (!unsafeText) return '';
    return unsafeText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Retrieves the computed CSS variable value from document root.
 * Useful for Chart.js rendering and dynamic canvas theming.
 * @param {string} name
 * @returns {string}
 */
export function getCssColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
