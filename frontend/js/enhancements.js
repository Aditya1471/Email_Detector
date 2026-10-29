/**
 * PhishGuard UI Enhancements — Premium Dynamic Effects
 * Adds: animated counters, toast notifications, typing effects,
 * live clock, page transitions, and interactive micro-animations.
 */
(function() {
  'use strict';

  // ── 1. Animated Counter for KPI numbers ──────────────────────────────────
  function animateCounter(el, target, duration = 1400, suffix = '') {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      el.textContent = Math.round(start + (target - start) * eased).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── 2. Intersection Observer for scroll-triggered animations ─────────────
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          // Trigger counter animation for KPI cards
          const kpiEl = entry.target.querySelector('[data-counter]');
          if (kpiEl && !kpiEl.dataset.animated) {
            kpiEl.dataset.animated = 'true';
            const target = parseInt(kpiEl.dataset.counter, 10);
            const suffix = kpiEl.dataset.suffix || '';
            animateCounter(kpiEl, target, 1600, suffix);
          }
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.animate-fade-up, .metric-card, .feature-card, .kpi-stat').forEach(el => {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });
  }

  // ── 3. Premium Toast Notification System ─────────────────────────────────
  function createToastContainer() {
    let container = document.getElementById('pg-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pg-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 99999;
        display: flex; flex-direction: column-reverse; gap: 10px;
        max-width: min(380px, calc(100vw - 48px));
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function(message, type = 'info', duration = 4000) {
    const container = createToastContainer();
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = {
      success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
      error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
      warning: { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
      info:    { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' }
    };
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const c = colors[type] || colors.info;
    toast.style.cssText = `
      padding: 14px 18px; border-radius: 14px; pointer-events: all;
      background: ${isDark ? '#1e2740' : c.bg};
      border: 1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : c.border};
      color: ${isDark ? '#e2e8f0' : c.text};
      box-shadow: 0 8px 32px rgba(0,0,0,${isDark ? 0.4 : 0.12});
      font-size: 0.88rem; font-weight: 600; line-height: 1.45;
      display: flex; align-items: flex-start; gap: 10px;
      animation: toastIn 300ms cubic-bezier(0.16,1,0.3,1) both;
      max-width: 100%;
    `;
    toast.innerHTML = `<span style="font-size:1.1rem;flex-shrink:0;">${icons[type] || '💬'}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Inject keyframes if not already there
    if (!document.getElementById('pg-toast-styles')) {
      const s = document.createElement('style');
      s.id = 'pg-toast-styles';
      s.textContent = `
        @keyframes toastIn  { from { opacity:0; transform: translateX(20px) scale(0.95); } to { opacity:1; transform: translateX(0) scale(1); } }
        @keyframes toastOut { from { opacity:1; transform: translateX(0) scale(1); } to { opacity:0; transform: translateX(20px) scale(0.95); } }
      `;
      document.head.appendChild(s);
    }

    setTimeout(() => {
      toast.style.animation = 'toastOut 250ms cubic-bezier(0.16,1,0.3,1) forwards';
      setTimeout(() => toast.remove(), 260);
    }, duration);
  };

  // ── 4. Button press ripple effect ──────────────────────────────────────
  function initRippleEffect() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-primary, .btn-secondary');
      if (!btn) return;
      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.5;
      ripple.style.cssText = `
        position: absolute; border-radius: 50%; pointer-events: none;
        width: ${size}px; height: ${size}px;
        top: ${e.clientY - rect.top - size / 2}px;
        left: ${e.clientX - rect.left - size / 2}px;
        background: rgba(255,255,255,0.3);
        animation: ripple 500ms linear;
        transform: scale(0);
      `;
      if (!document.getElementById('pg-ripple-styles')) {
        const s = document.createElement('style');
        s.id = 'pg-ripple-styles';
        s.textContent = '@keyframes ripple { to { transform: scale(1); opacity: 0; } }';
        document.head.appendChild(s);
      }
      const prevPos = btn.style.position;
      const prevOvf = btn.style.overflow;
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => {
        ripple.remove();
        if (!prevPos) btn.style.position = '';
        if (!prevOvf) btn.style.overflow = '';
      }, 520);
    });
  }

  // ── 5. Live Clock in Dashboard ─────────────────────────────────────────
  function initLiveClock() {
    const el = document.getElementById('last-updated-time');
    if (!el) return;
    function tick() {
      const now = new Date();
      el.textContent = `Live telemetry · Last refreshed: ${now.toLocaleTimeString()}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── 6. Dynamic scanning animation on scan submit ───────────────────────
  function initScanAnimation() {
    const form = document.getElementById('email-scan-form');
    const submitBtn = document.getElementById('submit-scan-btn');
    if (!form || !submitBtn) return;
    form.addEventListener('submit', () => {
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Scanning & Analyzing...';
      submitBtn.disabled = true;
    });
  }

  // ── 7. Theme toggle enhancement ───────────────────────────────────────
  function initThemeEnhancement() {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const html = document.documentElement;
      const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.style.transition = 'background-color 300ms ease, color 300ms ease';
      setTimeout(() => html.style.transition = '', 350);
    });
  }

  // ── 8. Card hover depth effect (subtle tilt) ─────────────────────────
  function initCardTilt() {
    document.querySelectorAll('.metric-card, .provider-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        card.style.transform = `translateY(-3px) perspective(600px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 400ms cubic-bezier(0.16,1,0.3,1)';
        setTimeout(() => card.style.transition = '', 400);
      });
    });
  }

  // ── 9. Auto-show hero badge with typewriter ──────────────────────────
  function initHeroBadge() {
    const badge = document.querySelector('.hero-badge');
    if (!badge) return;
    badge.style.opacity = '0';
    badge.style.transform = 'translateY(6px)';
    setTimeout(() => {
      badge.style.transition = 'opacity 600ms ease, transform 600ms cubic-bezier(0.16,1,0.3,1)';
      badge.style.opacity = '1';
      badge.style.transform = 'translateY(0)';
    }, 200);
  }

  // ── Initialize all ────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    try { initScrollAnimations(); } catch(e) {}
    try { initRippleEffect(); } catch(e) {}
    try { initLiveClock(); } catch(e) {}
    try { initScanAnimation(); } catch(e) {}
    try { initThemeEnhancement(); } catch(e) {}
    try { initCardTilt(); } catch(e) {}
    try { initHeroBadge(); } catch(e) {}
  }
})();
