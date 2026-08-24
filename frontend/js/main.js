// PhishGuard - Main Bootstrapper ES Module
import { initNavigation } from './navigation.js';

document.addEventListener('DOMContentLoaded', () => {
    // Bootstrap Shared Navigation Actions
    initNavigation();
    console.log("[PhishGuard] Application initialized successfully.");
});
