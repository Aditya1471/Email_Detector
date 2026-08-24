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
    const label = document.querySelector("[data-theme-label]");
    
    if (!toggle) {
        return;
    }

    const isDark = theme === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute(
        "aria-label", 
        isDark ? "Switch to light theme" : "Switch to dark theme"
    );

    // Dynamic icon and label configurations
    if (icon) {
        icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
    if (label) {
        label.textContent = isDark ? "Light Mode" : "Dark Mode";
    }

    // Swap logo assets path depending on theme
    const navbarLogo = document.getElementById('navbar-logo');
    const footerLogo = document.getElementById('footer-logo');
    
    if (navbarLogo) {
        navbarLogo.src = isDark ? '/assets/logo-mark-dark.svg' : '/assets/logo-mark.svg';
    }
    if (footerLogo) {
        footerLogo.src = isDark ? '/assets/logo-mark-dark.svg' : '/assets/logo-mark.svg';
    }
}

export function setupThemeToggle() {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) {
        return;
    }

    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    toggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
    });
}
