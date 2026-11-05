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
      startAutoplay();
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
    autoplayTimer = setInterval(function () { showSlide(current + 1); }, 6000);
  }

  function stopAutoplay() {
    clearInterval(autoplayTimer);
  }

  /* ---- Controlli frecce (desktop) ---- */
  if (prevBtn) prevBtn.addEventListener('click', function () { stopAutoplay(); showSlide(current - 1); startAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { stopAutoplay(); showSlide(current + 1); startAutoplay(); });

  sediSection.addEventListener('mouseenter', stopAutoplay);
  sediSection.addEventListener('mouseleave', startAutoplay);

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
    startAutoplay();
  }, { passive: true });

  /* ---- Tasto tastiera (desktop) ---- */
  document.addEventListener('keydown', function (e) {
    const rect = sediSection.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    if (e.key === 'ArrowLeft')  { stopAutoplay(); showSlide(current - 1); startAutoplay(); }
    if (e.key === 'ArrowRight') { stopAutoplay(); showSlide(current + 1); startAutoplay(); }
  });

  startAutoplay();
});
