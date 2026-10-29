// PhishGuard - Centralized Theme Controller Module

const THEME_STORAGE_KEY = "phishguard-theme";

export function getPreferredTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
    }
    // Respect browser system preference color schemes
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggle(theme);
}

export function updateThemeToggle(theme) {
    const toggle = document.querySelector("[data-theme-toggle]");
    const icon = document.querySelector("[data-theme-icon]");
    
    if (!toggle) {
        return;
    }

    const isDark = theme === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute(
        "aria-label", 
        isDark ? "Switch to light theme" : "Switch to dark theme"
    );

    // Ensure NO text nodes or rogue spans exist inside the icon-only toggle button
    Array.from(toggle.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'I' && node.tagName !== 'svg')) {
            node.remove();
        }
    });

    // Dynamic icon configuration
    if (icon) {
        icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }

    // Swap logo assets path depending on theme
    const navbarLogo = document.getElementById('navbar-logo');
    const footerLogo = document.getElementById('footer-logo');
    
    if (navbarLogo) {
        navbarLogo.src = isDark ? 'assets/logo-mark-dark.svg' : 'assets/logo-mark.svg';
    }
    if (footerLogo) {
        footerLogo.src = isDark ? 'assets/logo-mark-dark.svg' : 'assets/logo-mark.svg';
    }
}

export function setupThemeToggle() {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) {
        return;
    }

    // Initialize with preferred theme
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    toggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
    });

    // Listen for system theme changes if user hasn't explicitly set a preference
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            applyTheme(e.matches ? "dark" : "light");
        }
    });
}
