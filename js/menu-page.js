// Sticky category nav — active state on scroll
(function () {
  const sections = document.querySelectorAll('.mp-section[id]');
  const navLinks = document.querySelectorAll('.mp-nav__link');
  const nav = document.querySelector('.mp-nav');

  if (!sections.length || !navLinks.length || !nav) return;

  const barra = nav.querySelector('.mp-nav__inner');

  /* La categoria attiva viene portata in vista dentro la barra.

     Qui non si usa scrollIntoView: quello muove tutti i contenitori che
     scorrono, finestra compresa, e scorrendo la pagina partiva in
     continuazione strappando la barra di mano a chi la stava
     trascinando. scrollLeft muove solo la barra.

     In piu non si muove niente se la voce e gia visibile, e si sta
     fermi mentre il dito e sulla barra. */
  let ditoSullaBarra = false;
  let liberaDito;

  if (barra) {
    barra.addEventListener('touchstart', () => {
      ditoSullaBarra = true;
      clearTimeout(liberaDito);
    }, { passive: true });

    barra.addEventListener('touchend', () => {
      // Un attimo di tregua dopo il tocco: il dito lascia ma lo
      // scorrimento per inerzia continua
      clearTimeout(liberaDito);
      liberaDito = setTimeout(() => { ditoSullaBarra = false; }, 1500);
    }, { passive: true });
  }

  function portaInVista(link, animato) {
    if (!barra || ditoSullaBarra) return;

    const v = link.getBoundingClientRect();
    const b = barra.getBoundingClientRect();
    // Gia leggibile per intero: non si tocca niente
    if (v.left >= b.left + 8 && v.right <= b.right - 8) return;

    const meta = (barra.clientWidth - link.offsetWidth) / 2;
    barra.scrollTo({
      left: link.offsetLeft - meta,
      behavior: animato ? 'smooth' : 'auto'
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            const attiva = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('active', attiva);
            if (attiva) portaInVista(link, true);
          });
        }
      });
    },
    { rootMargin: '-25% 0px -65% 0px' }
  );

  sections.forEach((section) => observer.observe(section));

  navLinks.forEach((link) => {
    link.addEventListener('click', () => portaInVista(link, true));
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

  /* ----- La fila continua di lato -----
     Una freccia fissa sul bordo destro: occupa il posto di una categoria,
     e proprio questo fa capire che la fila prosegue oltre. Si puo anche
     toccare, e fa scorrere di quasi una schermata. Arrivati in fondo si
     gira dall'altra parte e riporta all'inizio.
     Le sfumature ai bordi restano come rinforzo (vedi menu-page.css). */

  let freccia;

  function creaFreccia() {
    if (!barra || freccia) return;
    freccia = document.createElement('button');
    freccia.type = 'button';
    freccia.className = 'mp-nav__freccia';
    freccia.setAttribute('aria-label', 'Mostra le altre categorie');
    freccia.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="9 18 15 12 9 6"></polyline>' +
      '</svg>';

    // Si puo anche toccare, per chi non pensa a trascinare
    freccia.addEventListener('click', () => {
      barra.scrollTo({ left: barra.clientWidth * 0.75, behavior: 'smooth' });
    });

    // Dentro la fila, come ultima voce: la barra ha gli angoli tondi e
    // ritaglia quello che contiene, quindi la freccia non puo sbordare.
    // Appoggiata sopra (in .mp-nav) copriva la curva dell'angolo.
    barra.appendChild(freccia);
  }

  function aggiornaFreccia() {
    if (!barra) return;
    const scorre = barra.scrollWidth - barra.clientWidth > 4;

    // Se le categorie ci stanno tutte la freccia non ha senso
    nav.classList.toggle('is-scorrevole', scorre);
    // Compare solo da ferma all'inizio: appena si scorre ha gia detto
    // quello che doveva dire, e il posto serve alle categorie
    nav.classList.toggle('is-inizio', barra.scrollLeft <= 4);
  }

  if (barra) {
    creaFreccia();
    barra.addEventListener('scroll', aggiornaFreccia, { passive: true });
    window.addEventListener('resize', aggiornaFreccia, { passive: true });
    window.addEventListener('load', aggiornaFreccia);
    aggiornaFreccia();
  }

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
