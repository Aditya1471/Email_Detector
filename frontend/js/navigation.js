// PhishGuard - Header Scroll & Mobile Navigation Controller
import { setupThemeToggle } from './theme.js';

// Centralised Escape-key registration hook callbacks list
const escapeClosures = [];

export function registerEscapeClosure(callback) {
    if (typeof callback === 'function' && !escapeClosures.includes(callback)) {
        escapeClosures.push(callback);
    }
}

export function setupEscapeKeyClosures() {
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }
        
        // Execute all registered Escape callbacks
        escapeClosures.forEach(callback => {
            try {
                callback();
            } catch (err) {
                console.error("[PhishGuard] Error in Escape closure callback:", err);
            }
        });
    });
}

function setupHeaderScrollTracking() {
    const header = document.querySelector("[data-site-header]");
    if (!header) {
        return;
    }

    const threshold = 12;
    let ticking = false;

    function updateHeaderState() {
        const shouldShowScrolledState = window.scrollY > threshold;
        header.classList.toggle("navbar--scrolled", shouldShowScrolledState);
        ticking = false;
    }

    function handleScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateHeaderState);
            ticking = true;
        }
    }

    updateHeaderState();
    window.addEventListener("scroll", handleScroll, { passive: true });
}

function setupMobileNavigation() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const menu = document.querySelector("[data-nav-menu]");
    const header = document.querySelector("[data-site-header]");

    if (!toggle || !menu) {
        return;
    }

    let lastFocusedElement = null;

    function openMenu() {
        lastFocusedElement = document.activeElement;
        menu.classList.add("nav-menu--open");
        toggle.classList.add("nav-toggle--active");
        if (header) {
            header.classList.add("site-header--menu-open");
        }
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close navigation menu");
        document.body.classList.add("navigation-is-open");
    }

    function closeMenu({ restoreFocus = true } = {}) {
        menu.classList.remove("nav-menu--open");
        toggle.classList.remove("nav-toggle--active");
        if (header) {
            header.classList.remove("site-header--menu-open");
        }
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
        document.body.classList.remove("navigation-is-open");

        if (restoreFocus && lastFocusedElement) {
            try {
                lastFocusedElement.focus();
            } catch (e) {
                console.warn("[PhishGuard] Could not restore focus to:", lastFocusedElement);
            }
        }
    }

    function toggleMenu() {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    toggle.addEventListener("click", toggleMenu);

    // Auto-close menu when selecting any link
    menu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            closeMenu({ restoreFocus: false });
        });
    });

    // Close when clicking outside navbar bounds
    document.addEventListener("click", (event) => {
        const clickedInsideMenu = menu.contains(event.target) || toggle.contains(event.target);
        if (!clickedInsideMenu && toggle.getAttribute("aria-expanded") === "true") {
            closeMenu({ restoreFocus: false });
        }
    });

    // Register Escape key callback trigger for closing the menu
    registerEscapeClosure(() => {
        if (toggle.getAttribute("aria-expanded") === "true") {
            closeMenu({ restoreFocus: true });
        }
    });
}

// Active Page Nav Highlighting
function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll(".nav-menu a");
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href");
        if (currentPath === linkPath || (currentPath === "/" && linkPath === "index.html") || (currentPath.endsWith(linkPath) && linkPath !== "")) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        } else {
            link.classList.remove("active");
            link.removeAttribute("aria-current");
        }
    });
}

// Central navigation bootloader initialization
export function initNavigation() {
    setupHeaderScrollTracking();
    setupMobileNavigation();
    setupThemeToggle();
    setupEscapeKeyClosures();
    highlightActiveNav();
    renderUserNavigationState();
}

function renderUserNavigationState() {
    const authLink = document.getElementById('nav-auth-link');
    if (authLink) {
        const isLoggedIn = localStorage.getItem('phishguard_logged_in') === 'true';
        if (isLoggedIn) {
            authLink.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Logout';
            authLink.setAttribute('href', '#');
            // Remove previous listeners using cloning
            const newAuthLink = authLink.cloneNode(true);
            authLink.parentNode.replaceChild(newAuthLink, authLink);
            
            newAuthLink.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('phishguard_logged_in');
                window.location.href = 'index.html';
            });
        }
    }
}
