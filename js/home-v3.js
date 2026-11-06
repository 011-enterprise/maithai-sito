/* ===== HOME V3 — Slider sedi ===== */

document.addEventListener('DOMContentLoaded', function () {
  const slides     = document.querySelectorAll('.v3-sedi__slide');
  const photos     = document.querySelectorAll('.v3-sedi__photo');
  const prevBtn    = document.querySelector('.v3-sedi__btn--prev');
  const nextBtn    = document.querySelector('.v3-sedi__btn--next');
  const counterEl  = document.querySelector('.v3-sedi__counter');
  const controls   = document.querySelector('.v3-sedi__controls');
  const leftEl     = document.querySelector('.v3-sedi__left');
  const sediSection = document.querySelector('.v3-sedi');
  const total = slides.length;
  let current = 0;
  let autoplayTimer;

  function isMobile() { return window.innerWidth <= 768; }

  /* ---- Crea pallini ---- */
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'v3-sedi__dots';
  slides.forEach(function (_, i) {
    const dot = document.createElement('button');
    dot.className = 'v3-sedi__dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Vai alla sede ' + (i + 1));
    dot.addEventListener('click', function () {
      stopAutoplay();
      showSlide(i);
      riprendiSeLibero();
    });
    dotsWrap.appendChild(dot);
  });
  controls.appendChild(dotsWrap);

  /* ---- Aggiorna pallini ---- */
  function updateDots(idx) {
    Array.from(dotsWrap.children).forEach(function (d, i) {
      d.classList.toggle('active', i === idx);
    });
    counterEl.innerHTML = '<strong>' + (idx + 1) + '</strong> / ' + total;
  }

  /* ---- Mostra slide ---- */
  function showSlide(idx) {
    const newIdx = (idx + total) % total;

    if (isMobile()) {
      leftEl.scrollTo({ left: newIdx * leftEl.clientWidth, behavior: 'smooth' });
      current = newIdx;
      updateDots(current);
      return;
    }

    slides[current].classList.remove('active');
    if (photos[current]) photos[current].classList.remove('active');
    current = newIdx;
    slides[current].classList.add('active');
    if (photos[current]) photos[current].classList.add('active');
    updateDots(current);
  }

  /* ---- Aggiorna pallini durante lo scroll (mobile) ---- */
  leftEl.addEventListener('scroll', function () {
    if (!isMobile()) return;
    const idx = Math.round(leftEl.scrollLeft / leftEl.clientWidth);
    if (idx !== current) {
      current = idx;
      updateDots(current);
    }
  }, { passive: true });

  /* ---- Autoplay ----
     6 secondi: ogni slide porta indirizzo, orari e telefono, e a 4,5
     secondi cambiava prima che si finisse di leggerli. */
  function startAutoplay() {
    // Si spegne sempre il precedente prima di accenderne uno nuovo.
    // Senza questa riga i timer si sommavano: bastava passare il mouse
    // sulla sezione e premere una freccia (ferma, riparte) e poi uscire
    // col mouse (riparte di nuovo) per averne due in corsa insieme, e il
    // vecchio non si poteva piu spegnere perche se ne teneva solo l'ultimo.
    // Da qui i salti: due slide regolari e la terza che scappa via.
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(function () { showSlide(current + 1); }, 6000);
  }

  function stopAutoplay() {
    clearInterval(autoplayTimer);
  }

  /* Col mouse sulla sezione lo scorrimento resta fermo: chi sta leggendo
     un indirizzo non se lo vede cambiare sotto gli occhi. Dopo una
     freccia si riparte solo se il mouse e gia andato via, altrimenti
     bastava un clic per rimettere in moto tutto. */
  var mouseSullaSezione = false;

  function riprendiSeLibero() {
    if (!mouseSullaSezione) startAutoplay();
  }

  /* ---- Controlli frecce (desktop) ---- */
  if (prevBtn) prevBtn.addEventListener('click', function () { stopAutoplay(); showSlide(current - 1); riprendiSeLibero(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { stopAutoplay(); showSlide(current + 1); riprendiSeLibero(); });

  sediSection.addEventListener('mouseenter', function () {
    mouseSullaSezione = true;
    stopAutoplay();
  });

  sediSection.addEventListener('mouseleave', function () {
    mouseSullaSezione = false;
    startAutoplay();
  });

  /* ---- Swipe touch (desktop fallback — su mobile usa scroll nativo) ---- */
  var touchStartX = 0;
  sediSection.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  sediSection.addEventListener('touchend', function (e) {
    if (isMobile()) return; // su mobile gestisce lo scroll nativo
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 40) return;
    stopAutoplay();
    showSlide(dx < 0 ? current + 1 : current - 1);
    riprendiSeLibero();
  }, { passive: true });

  /* ---- Tasto tastiera (desktop) ---- */
  document.addEventListener('keydown', function (e) {
    const rect = sediSection.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    if (e.key === 'ArrowLeft')  { stopAutoplay(); showSlide(current - 1); riprendiSeLibero(); }
    if (e.key === 'ArrowRight') { stopAutoplay(); showSlide(current + 1); riprendiSeLibero(); }
  });


  /* ---- Foto pronte prima che servano ----
     Stanno in contenitori nascosti e hanno loading="lazy": il browser
     le scarica solo quando compaiono, e al cambio di slide si vede un
     lampo vuoto mentre arrivano 400-500 KB. Qui si scaldano dopo il
     caricamento della pagina, quindi senza rallentarne l'apertura. */
  window.addEventListener('load', function () {
    // Da telefono la colonna delle foto e nascosta: scaricarle sarebbero
    // tre mega di traffico per niente
    if (isMobile()) return;
    photos.forEach(function (box) {
      var img = box.querySelector('img');
      if (!img) return;
      img.loading = 'eager';
      var anticipo = new Image();
      anticipo.src = img.currentSrc || img.src;
    });
  });

  startAutoplay();
});
