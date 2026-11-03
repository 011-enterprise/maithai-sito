// Sticky category nav — active state on scroll
(function () {
  const sections = document.querySelectorAll('.mp-section[id]');
  const navLinks = document.querySelectorAll('.mp-nav__link');
  const nav = document.querySelector('.mp-nav');

  if (!sections.length || !navLinks.length || !nav) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            const attiva = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('active', attiva);
            // Da telefono la barra scorre: la categoria in cui ci si trova
            // potrebbe essere fuori vista, quindi la si porta al centro.
            // block: 'nearest' per non muovere anche la pagina.
            if (attiva && window.matchMedia('(max-width: 768px)').matches) {
              link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          });
        }
      });
    },
    { rootMargin: '-25% 0px -65% 0px' }
  );

  sections.forEach((section) => observer.observe(section));

  // Smooth scroll nav links — scroll active link into view in the nav bar
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Inietta le icone nei link dalla nav (visibili sempre)
  navLinks.forEach((link) => {
    const iconSrc = link.getAttribute('data-icon');
    if (!iconSrc) return;
    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = '';
    img.className = 'mp-nav__icon';
    link.insertBefore(img, link.firstChild);
  });

  // Da telefono la barra e gia fissa in basso (vedi menu-page.css): niente
  // passaggio da orizzontale a laterale, quindi tutta la logica qui sotto
  // non deve girare. Resta solo l'evidenziazione della categoria attiva.
  const DA_TELEFONO = window.matchMedia('(max-width: 768px)');

  /* ----- Segnali che la fila delle categorie continua di lato -----
     Le sfumature sui bordi si accendono e si spengono a seconda di dove
     si e arrivati: a destra finche c'e altro, a sinistra appena ci si
     sposta. In piu, la prima volta che si apre la pagina, la barra fa un
     piccolo movimento: e il modo piu diretto per dire che si trascina. */
  const inner = nav.querySelector('.mp-nav__inner');

  function aggiornaSfumature() {
    if (!inner) return;
    const massimo = inner.scrollWidth - inner.clientWidth;
    nav.classList.toggle('is-scorso', inner.scrollLeft > 4);
    nav.classList.toggle('is-in-fondo', massimo <= 4 || inner.scrollLeft >= massimo - 4);
  }

  if (inner) {
    inner.addEventListener('scroll', aggiornaSfumature, { passive: true });
    window.addEventListener('resize', aggiornaSfumature, { passive: true });
    aggiornaSfumature();
  }

  function accennaScorrimento() {
    if (!inner || !DA_TELEFONO.matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (inner.scrollWidth - inner.clientWidth < 20) return;   // ci sta tutto
    try {
      if (sessionStorage.getItem('maithai-filtri-visto')) return;
      sessionStorage.setItem('maithai-filtri-visto', '1');
    } catch (e) { /* navigazione privata: l'accenno si rivede, poco male */ }

    setTimeout(() => {
      inner.scrollTo({ left: 56, behavior: 'smooth' });
      setTimeout(() => inner.scrollTo({ left: 0, behavior: 'smooth' }), 650);
    }, 900);
  }

  window.addEventListener('load', accennaScorrimento);

  // Sidebar: slide in da sinistra dopo scroll
  let navNaturalTop = 0;
  let isSidebar = false;
  let isAnimating = false;
  const HEADER_H = 100;   // altezza header desktop
  const EXTRA_SCROLL = 0;
  const HYSTERESIS = 80;

  // La nav e sticky e poi diventa fixed: misurarla direttamente restituisce
  // la posizione in cui e incollata, non quella naturale. Questo marcatore
  // resta sempre nel flusso, quindi la misura e valida a ogni scroll.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.height = '0';
  nav.parentNode.insertBefore(sentinel, nav);

  function initNavTop() {
    navNaturalTop = sentinel.getBoundingClientRect().top + window.scrollY;
  }

  // Al caricamento con la pagina gia scrollata lo stato va applicato subito
  // e senza animazione, altrimenti a ogni ricarica parte il fade + slide.
  function applySidebarNow() {
    if (isSidebar) return;
    nav.style.transition = 'none';
    nav.classList.add('is-sidebar', 'is-visible');
    nav.offsetHeight; // force reflow
    nav.style.transition = '';
    isSidebar = true;
  }

  function enterSidebar() {
    if (isSidebar || isAnimating) return;
    isAnimating = true;
    // Fade out barra orizzontale
    nav.style.opacity = '0';
    setTimeout(() => {
      // Switch a sidebar (già invisibile + fuori schermo)
      nav.classList.add('is-sidebar');
      nav.style.opacity = '';
      nav.offsetHeight; // force reflow
      // Slide in + fade in sovrapposti
      requestAnimationFrame(() => {
        nav.classList.add('is-visible');
      });
      isSidebar = true;
      setTimeout(() => { isAnimating = false; }, 750);
    }, 300);
  }

  function exitSidebar() {
    if (!isSidebar || isAnimating) return;
    isAnimating = true;
    // Slide out + fade out sidebar
    nav.classList.remove('is-visible');
    setTimeout(() => {
      // Ripristina barra orizzontale partendo invisibile
      nav.classList.remove('is-sidebar');
      nav.style.opacity = '0';
      nav.offsetHeight;
      // Fade in barra
      requestAnimationFrame(() => {
        nav.style.opacity = '';
      });
      isSidebar = false;
      setTimeout(() => { isAnimating = false; }, 450);
    }, 500);
  }

  function updateNavPosition() {
    if (DA_TELEFONO.matches) return;
    const scrollY = window.scrollY;
    const trigger = navNaturalTop - HEADER_H + EXTRA_SCROLL;
    if (scrollY > trigger) {
      enterSidebar();
    } else if (scrollY < trigger - HYSTERESIS) {
      exitSidebar();
    }
  }

  // Allo start va valutato subito lo stato: il browser puo ripristinare lo
  // scroll a meta pagina, e senza questa chiamata la nav restava in alto
  // finche l'utente non scrollava di nuovo.
  function syncToScroll(immediate) {
    // Girando il telefono o ridimensionando la finestra si puo passare da
    // una modalita all'altra: qui si ripulisce lo stato dell'altra.
    if (DA_TELEFONO.matches) {
      nav.classList.remove('is-sidebar', 'is-visible');
      nav.style.opacity = '';
      nav.style.transition = '';
      isSidebar = false;
      isAnimating = false;
      return;
    }

    initNavTop();
    const trigger = navNaturalTop - HEADER_H + EXTRA_SCROLL;
    if (immediate && window.scrollY > trigger) {
      applySidebarNow();
    } else {
      updateNavPosition();
    }
  }

  window.addEventListener('scroll', updateNavPosition, { passive: true });
  window.addEventListener('resize', () => syncToScroll(false), { passive: true });

  // Il ripristino dello scroll avviene entro il load, quindi si rimisura li
  window.addEventListener('load', () => syncToScroll(true));
  syncToScroll(true);
})();
