// PhishGuard - Header Scroll, Mobile Navigation & User Session Controller
import { setupThemeToggle } from './theme.js';

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
    if (!header) return;

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

    if (!toggle || !menu) return;

    let lastFocusedElement = null;

    function openMenu() {
        lastFocusedElement = document.activeElement;
        menu.classList.add("nav-menu--open");
        toggle.classList.add("nav-toggle--active");
        if (header) header.classList.add("site-header--menu-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close navigation menu");
        document.body.classList.add("navigation-is-open");
    }

    function closeMenu({ restoreFocus = true } = {}) {
        menu.classList.remove("nav-menu--open");
        toggle.classList.remove("nav-toggle--active");
        if (header) header.classList.remove("site-header--menu-open");
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
        if (isOpen) closeMenu();
        else openMenu();
    }

    toggle.addEventListener("click", toggleMenu);

    menu.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            closeMenu({ restoreFocus: false });
        });
    });

    document.addEventListener("click", (event) => {
        const clickedInsideMenu = menu.contains(event.target) || toggle.contains(event.target);
        if (!clickedInsideMenu && toggle.getAttribute("aria-expanded") === "true") {
            closeMenu({ restoreFocus: false });
        }
    });

    registerEscapeClosure(() => {
        if (toggle.getAttribute("aria-expanded") === "true") {
            closeMenu({ restoreFocus: true });
        }
    });
}

function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll(".nav-link");
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href");
        if (currentPath === linkPath || (currentPath.endsWith(linkPath) && linkPath !== "") || (currentPath.endsWith("/") && linkPath === "index.html")) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        } else {
            link.classList.remove("active");
            link.removeAttribute("aria-current");
        }
    });
}

export function renderUserNavigationState() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    const isLoggedIn = localStorage.getItem('phishguard_logged_in') === 'true';
    const userEmail = localStorage.getItem('phishguard_user_email') || 'user@example.com';
    const initial = userEmail.charAt(0).toUpperCase() || 'U';

    const authContainer = document.getElementById('nav-auth-container') || document.getElementById('nav-auth-link');
    if (!authContainer) return;

    if (isLoggedIn) {
        // Render user menu popover
        const userMenuHtml = `
            <div class="nav-user" id="nav-user-wrapper">
                <button type="button" class="nav-user__trigger" id="nav-user-trigger" aria-expanded="false" aria-haspopup="true" aria-label="User account menu">
                    <span class="nav-user__avatar">${initial}</span>
                    <span class="nav-user__name" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${userEmail.split('@')[0]}</span>
                    <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem; color: var(--color-text-muted);"></i>
                </button>
                <div class="nav-user__dropdown" id="nav-user-dropdown" role="menu">
                    <div class="nav-user__header">
                        <p class="nav-user__email">${userEmail}</p>
                        <span class="badge badge-safe" style="font-size: 0.65rem; margin-top: 4px;">Protected Account</span>
                    </div>
                    <a href="dashboard.html" class="nav-user__item" role="menuitem">
                        <i class="fa-solid fa-chart-line"></i> Security Dashboard
                    </a>
                    <a href="integrations.html" class="nav-user__item" role="menuitem">
                        <i class="fa-solid fa-inbox"></i> Inbox Integrations
                    </a>
                    <a href="notification-settings.html" class="nav-user__item" role="menuitem">
                        <i class="fa-solid fa-bell"></i> Alert Preferences
                    </a>
                    <div style="height: 1px; background: var(--color-divider); margin: 4px 0;"></div>
                    <button type="button" class="nav-user__item nav-user__item--danger" id="nav-logout-btn" role="menuitem">
                        <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                    </button>
                </div>
            </div>
        `;
        authContainer.outerHTML = userMenuHtml;

        const trigger = document.getElementById('nav-user-trigger');
        const dropdown = document.getElementById('nav-user-dropdown');
        const logoutBtn = document.getElementById('nav-logout-btn');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('nav-user__dropdown--open');
                if (isOpen) {
                    dropdown.classList.remove('nav-user__dropdown--open');
                    trigger.setAttribute('aria-expanded', 'false');
                } else {
                    dropdown.classList.add('nav-user__dropdown--open');
                    trigger.setAttribute('aria-expanded', 'true');
                }
            });

            document.addEventListener('click', (e) => {
                if (!document.getElementById('nav-user-wrapper')?.contains(e.target)) {
                    dropdown.classList.remove('nav-user__dropdown--open');
                    trigger.setAttribute('aria-expanded', 'false');
                }
            });

            registerEscapeClosure(() => {
                dropdown.classList.remove('nav-user__dropdown--open');
                trigger.setAttribute('aria-expanded', 'false');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('phishguard_logged_in');
                localStorage.removeItem('phishguard_access_token');
                localStorage.removeItem('phishguard_user_email');
                window.location.href = 'index.html';
            });
        }
    } else {
        // Show Sign in button
        if (authContainer.tagName === 'A' || authContainer.id === 'nav-auth-link') {
            authContainer.textContent = 'Sign in';
            authContainer.setAttribute('href', 'login.html');
        }
    }
}

export function initNavigation() {
    setupHeaderScrollTracking();
    setupMobileNavigation();
    setupThemeToggle();
    setupEscapeKeyClosures();
    highlightActiveNav();
    renderUserNavigationState();
}
