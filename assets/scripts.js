// NeuroAttention Lab — shared client scripts

// ─── Navbar scroll state ───────────────────────────────
(function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const onScroll = () => {
    if (window.scrollY > 16) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu — open/close with a dimming backdrop, tap-outside and Esc.
  const btn = nav.querySelector('.mobile-menu-btn');
  const menu = document.querySelector('.mobile-menu');
  if (btn && menu) {
    let backdrop = document.querySelector('.mobile-menu-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'mobile-menu-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }
    const isOpen = () => menu.classList.contains('open');
    const openMenu = () => {
      menu.classList.add('open');
      backdrop.classList.add('visible');
      btn.setAttribute('aria-expanded', 'true');
    };
    const closeMenu = () => {
      menu.classList.remove('open');
      backdrop.classList.remove('visible');
      btn.setAttribute('aria-expanded', 'false');
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen() ? closeMenu() : openMenu();
    });
    // Tap the dimmed area to close.
    backdrop.addEventListener('click', closeMenu);
    // Tap anywhere outside the menu / button to close.
    document.addEventListener('click', (e) => {
      if (!isOpen()) return;
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      closeMenu();
    });
    // Esc closes.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) closeMenu();
    });
    // Following a link closes the menu.
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  }

  // Language switch
  const langButtons = nav.querySelectorAll('.lang-btn');
  langButtons.forEach((b) => {
    b.addEventListener('click', () => {
      langButtons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  // Active link highlighting by current page
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const links = nav.querySelectorAll('.nav-link, .mobile-link');
  links.forEach((l) => {
    const target = (l.getAttribute('href') || '').toLowerCase();
    if (target === page) l.classList.add('active');
    if (page === '' && target === 'index.html') l.classList.add('active');
  });
})();

// ─── Scroll reveal (IntersectionObserver) ──────────────
(function initReveal() {
  const items = document.querySelectorAll('.fade-up, .fade-left, .fade-right, .fade-scale');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
  );
  items.forEach((el) => obs.observe(el));
})();

// ─── Count-up stats on view ────────────────────────────
(function initCountUp() {
  const nodes = document.querySelectorAll('[data-count]');
  if (!nodes.length) return;
  const animate = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animate(e.target);
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  nodes.forEach((n) => obs.observe(n));
})();

// ─── Smooth scroll for in-page anchors ─────────────────
(function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
