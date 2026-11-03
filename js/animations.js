// ===== ANIMAZIONI MAI THAI =====

// ----- Hamburger menu mobile -----
(function () {
  const burger    = document.querySelector('.v3-header__burger');
  const mobileNav = document.getElementById('v3-nav-mobile');
  if (!burger || !mobileNav) return;

  burger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('is-open');
    burger.classList.toggle('is-open', isOpen);
    burger.setAttribute('aria-expanded', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  const chiudi = () => {
    mobileNav.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', chiudi);
  });

  // Vie d'uscita oltre alla X: toccare il rosso attorno alle voci, o Esc
  mobileNav.addEventListener('click', e => {
    if (e.target === mobileNav) chiudi();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) chiudi();
  });
})();

// ----- Scroll to top button -----
(function () {
  const btn = document.querySelector('.scroll-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('is-visible');
    } else {
      btn.classList.remove('is-visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();


// ----- Loader tra pagine -----
(function () {
  const loader = document.getElementById('page-loader');
  if (!loader) return;

  // Mostra loader al click su link interni
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;

    link.addEventListener('click', function (e) {
      e.preventDefault();
      loader.classList.add('is-active');
      setTimeout(() => {
        window.location.href = href;
      }, 500);
    });
  });
})();


(function () {

  // ----- Intersection Observer: scroll reveal -----
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  // ----- Intersection Observer: scroll reveal con stagger -----
  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        Array.from(entry.target.children).forEach((child, i) => {
          child.style.transitionDelay = `${i * 0.09}s`;
        });
        entry.target.classList.add('is-visible');
        staggerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  // Osserva tutti gli elementi con data-reveal
  document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));
  document.querySelectorAll('[data-reveal-stagger]').forEach(el => staggerObserver.observe(el));

  // Osserva elementi slide-da-destra
  const rightObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        rightObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('[data-reveal-right]').forEach(el => rightObserver.observe(el));

  // Auto-osserva elementi ricorrenti nelle pagine interne
  document.querySelectorAll('.mp-section__title, .drinks-grid, .sede-block__inner').forEach(el => {
    el.setAttribute('data-reveal', '');
    revealObserver.observe(el);
  });

  document.querySelectorAll('.dish-grid').forEach(el => {
    el.setAttribute('data-reveal-stagger', '');
    staggerObserver.observe(el);
  });

  // ----- Hero: split del titolo in parole -----
  const heroTitle = document.querySelector('.hero__title, .mp-hero__title, .sp-hero__title');
  if (heroTitle) {
    const words = heroTitle.textContent.trim().split(' ');
    heroTitle.innerHTML = words
      .map((word, i) =>
        `<span class="hero__word" style="transition-delay:${0.15 + i * 0.13}s">${word}</span>`
      )
      .join(' ');

    requestAnimationFrame(() => {
      setTimeout(() => {
        heroTitle.querySelectorAll('.hero__word').forEach(w => w.classList.add('is-visible'));
      }, 80);
    });
  }

  // ----- Hero: sottotitolo e bottoni -----
  const heroSub     = document.querySelector('.hero__sub');
  const heroActions = document.querySelector('.hero__actions');

  if (heroSub) {
    heroSub.style.transitionDelay = '0.65s';
    requestAnimationFrame(() => setTimeout(() => heroSub.classList.add('is-visible'), 80));
  }

  if (heroActions) {
    heroActions.style.transitionDelay = '0.85s';
    requestAnimationFrame(() => setTimeout(() => heroActions.classList.add('is-visible'), 80));
  }

})();
