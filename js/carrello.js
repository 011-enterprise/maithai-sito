/* ===========================================================
   CARRELLO — Mai Thai
   Ordinazione senza backend: l'ordine parte via WhatsApp.
   Tutto lato browser, quindi funziona su GitHub Pages.

   I prezzi NON sono duplicati qui: vengono letti dall'HTML, che resta
   l'unico punto in cui modificarli. Per i piatti con piu prezzi le
   etichette stanno nell'attributo data-varianti della card.
   =========================================================== */

(function () {
  'use strict';

  /* ---------- DESTINATARIO DEGLI ORDINI ----------
     WhatsApp Business del cliente: +39 327 0776496.
     Formato richiesto da wa.me: prefisso internazionale, senza + ne spazi.
     Un numero solo: chi lo riceve smista l'ordine alla sede che copre
     l'indirizzo del cliente. Per questo il cliente non sceglie la sede,
     che non avrebbe modo di sapere, ma scrive il proprio indirizzo. */
  var ORDINI_A = '393270776496';

  /* ---------- Sedi gestite separatamente ----------
     Cuneo e Mondovì non fanno capo alla titolarita di Torino: gli ordini
     di quelle zone non possono passare dal numero unico. Se il cliente
     scrive una di queste citta, gli mostriamo il numero da chiamare. */
  var CITTA_SEPARATE = [
    { citta: 'mondovi', nome: 'Mondovì', telefono: '0174 300 296' },
    { citta: 'cuneo',   nome: 'Cuneo',   telefono: '0171 480 470' }
  ];

  /* ---------- CONDIZIONI DI CONSEGNA ----------
     Il minimo si calcola sui soli piatti: sommarci la consegna
     significherebbe far raggiungere la soglia a chi non l'ha raggiunta. */
  var ORDINE_MINIMO = 20.00;
  var COSTO_CONSEGNA = 5.00;
  var CONSEGNA_GRATIS_DA = 50.00;

  var CHIAVE = 'maithai-carrello';
  var CHIAVE_DATI = 'maithai-dati-cliente';

  var carrello = {};
  var controlli = [];

  /* =========================================================
     STATO E SALVATAGGIO
     ========================================================= */

  // localStorage puo fallire (navigazione privata, spazio esaurito):
  // in quel caso il carrello funziona lo stesso, solo non sopravvive al reload.
  function carica() {
    try {
      carrello = JSON.parse(localStorage.getItem(CHIAVE)) || {};
    } catch (e) {
      carrello = {};
    }
  }

  function salva() {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(carrello));
    } catch (e) { /* silenzioso */ }
  }

  /* ---------- Prezzi ----------
     Nel sito i prezzi sono all'italiana ("€14,00"), per i conti serve
     il punto decimale. */

  function leggiPrezzo(testo) {
    var m = (testo || '').match(/(\d+)[.,](\d{2})/);
    return m ? parseFloat(m[1] + '.' + m[2]) : 0;
  }

  function formatta(n) {
    return '€' + n.toFixed(2).replace('.', ',');
  }

  function chiaveDi(nome, variante) {
    return variante ? nome + ' — ' + variante : nome;
  }

  /* ---------- Operazioni ---------- */

  /* piccante: livello di partenza (0-3) per i piatti in cui si puo
     regolare, null per antipasti e bevande. La piccantezza non entra
     nella chiave: e un attributo della riga, modificabile sul posto
     come la nota, non un piatto diverso. */
  /* =========================================================
     CONFERMA DELL'AGGIUNTA
     Il selettore "− 1 +" che compare sulla card dice che qualcosa e
     successo, ma non che il piatto e finito nel carrello, che sta in
     cima e puo essere fuori schermo. Qui una copia della foto vola
     fino all'icona, che poi fa uno scatto con il numero aggiornato.
     Con le animazioni disattivate nel sistema si mostra invece una
     striscia in basso, cosi il segnale non si perde.
     ========================================================= */

  var MOTO_RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)');
  var origineVolo = null;   // da dove parte: impostato da chi aggiunge

  function daDove(el) { origineVolo = el || null; }

  // La foto del piatto: card del menu, popup o riga delle bevande
  function fotoDi(el) {
    if (!el) return null;
    if (el.tagName === 'IMG') return el;
    var contenitore = el.closest('.dish-card-sm, .dish-modal__box, .dish-modal, .drinks-list li');
    return contenitore ? contenitore.querySelector('img') : null;
  }

  function confermaAggiunta(nome) {
    var partenza = fotoDi(origineVolo) || origineVolo;
    origineVolo = null;

    if (MOTO_RIDOTTO.matches || !vola(partenza)) avviso(nome);
    scattoCarrello();
  }

  // Restituisce false se non riesce a partire: in quel caso resta l'avviso
  function vola(partenza) {
    if (!partenza || !fab || fab.hidden) return false;

    var a = partenza.getBoundingClientRect();
    var b = fab.getBoundingClientRect();
    if (!a.width || !b.width) return false;

    var clone = document.createElement('div');
    clone.className = 'cart-volo';
    clone.style.left = a.left + 'px';
    clone.style.top = a.top + 'px';
    clone.style.width = a.width + 'px';
    clone.style.height = a.height + 'px';
    if (partenza.tagName === 'IMG') {
      clone.style.backgroundImage = 'url("' + (partenza.currentSrc || partenza.src) + '")';
    }
    document.body.appendChild(clone);

    if (typeof clone.animate !== 'function') { clone.remove(); return false; }

    var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    var dy = (b.top + b.height / 2) - (a.top + a.height / 2);

    var volo = clone.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
      // Passaggio a meta strada un po' piu in alto: la curva si legge
      // meglio di una linea dritta
      { transform: 'translate(' + (dx * 0.55) + 'px, ' + (dy * 0.45 - 40) + 'px) scale(0.5)',
        opacity: 0.9, offset: 0.6 },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(0.1)', opacity: 0.2 }
    ], { duration: 620, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' });

    volo.onfinish = function () { clone.remove(); };
    volo.oncancel = function () { clone.remove(); };
    return true;
  }

  /* Il popup copre quasi tutto lo schermo: lasciandolo aperto, il volo
     del piatto e il carrello resterebbero nascosti dietro. Si chiude
     dopo aver fatto partire l'animazione, che e gia staccata dal popup. */
  function chiudiPopup() {
    var modal = document.getElementById('dish-modal');
    if (!modal || !modal.classList.contains('is-open')) return;
    var x = modal.querySelector('.dish-modal__close');
    if (x) {
      x.click();                    // stessa chiusura del pulsante, in menu-modal.js
    } else {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  function scattoCarrello() {
    if (!fab) return;
    var icona = fab.querySelector('.cart-fab__icona');
    if (!icona) return;
    icona.classList.remove('is-scatto');
    void icona.offsetWidth;          // riavvia l'animazione se si aggiunge in fretta
    icona.classList.add('is-scatto');
  }

  var avvisoEl, avvisoTimer;

  function avviso(nome) {
    if (!avvisoEl) {
      avvisoEl = document.createElement('div');
      avvisoEl.className = 'cart-avviso';
      avvisoEl.setAttribute('role', 'status');
      avvisoEl.innerHTML =
        '<span class="cart-avviso__t"></span>' +
        '<button type="button" class="cart-avviso__b">Vedi il carrello</button>';
      avvisoEl.querySelector('.cart-avviso__b').addEventListener('click', function () {
        nascondiAvviso();
        apriPannello();
      });
      document.body.appendChild(avvisoEl);
    }
    avvisoEl.querySelector('.cart-avviso__t').textContent = nome + ' aggiunto al carrello';
    avvisoEl.classList.add('is-visibile');
    clearTimeout(avvisoTimer);
    avvisoTimer = setTimeout(nascondiAvviso, 3000);
  }

  function nascondiAvviso() {
    if (avvisoEl) avvisoEl.classList.remove('is-visibile');
  }

  function aggiungi(nome, prezzo, variante, piccante) {
    var k = chiaveDi(nome, variante);
    if (carrello[k]) {
      carrello[k].qta++;
    } else {
      carrello[k] = {
        nome: nome,
        prezzo: prezzo,
        variante: variante || '',
        qta: 1,
        nota: '',
        piccante: (typeof piccante === 'number') ? piccante : null
      };
    }
    salva();
    aggiornaTutto();
    confermaAggiunta(nome);
  }

  // muto: dentro il pannello aperto la riga si aggiorna sotto gli occhi,
  // una conferma in piu sarebbe rumore
  function cambiaQta(k, delta, muto) {
    if (!carrello[k]) return;
    var nome = carrello[k].nome;
    carrello[k].qta += delta;
    if (carrello[k].qta <= 0) delete carrello[k];
    salva();
    aggiornaTutto();
    // Solo in aggiunta: togliendo un piatto la conferma sarebbe fuori luogo
    if (delta > 0 && !muto) confermaAggiunta(nome);
  }

  function rimuovi(k) {
    delete carrello[k];
    salva();
    aggiornaTutto();
  }

  // Solo i piatti, senza consegna: e su questo che si misura il minimo
  function subtotale() {
    return Object.keys(carrello).reduce(function (t, k) {
      return t + carrello[k].prezzo * carrello[k].qta;
    }, 0);
  }

  // Sopra la soglia la consegna non si paga. Si misura sui piatti, come
  // il minimo: sommarci la consegna stessa sarebbe circolare.
  function costoConsegna() {
    return subtotale() >= CONSEGNA_GRATIS_DA ? 0 : COSTO_CONSEGNA;
  }

  function consegnaGratis() {
    return costoConsegna() === 0;
  }

  function totale() {
    return subtotale() + costoConsegna();
  }

  function mancaAlMinimo() {
    var m = ORDINE_MINIMO - subtotale();
    return m > 0 ? m : 0;
  }

  function numeroArticoli() {
    return Object.keys(carrello).reduce(function (n, k) {
      return n + carrello[k].qta;
    }, 0);
  }

  /* =========================================================
     CONTROLLI SU CARD E BEVANDE
     ========================================================= */

  // Crea la coppia "Aggiungi" / "− qta +" per una voce.
  // onAggiungi() e separato perche i piatti con varianti aprono una scelta
  // invece di aggiungere direttamente.
  function creaControlli(chiaveFn, onAggiungi, classe) {
    var wrap = document.createElement('div');
    wrap.className = classe || 'cart-btn-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cart-btn';
    btn.textContent = 'Aggiungi';

    var box = document.createElement('div');
    box.className = 'cart-qta';
    box.hidden = true;

    var meno = document.createElement('button');
    meno.type = 'button';
    meno.className = 'cart-qta__btn';
    meno.textContent = '−';
    meno.setAttribute('aria-label', 'Togli uno');

    var num = document.createElement('span');
    num.className = 'cart-qta__n';

    var piu = document.createElement('button');
    piu.type = 'button';
    piu.className = 'cart-qta__btn';
    piu.textContent = '+';
    piu.setAttribute('aria-label', 'Aggiungi uno');

    box.appendChild(meno);
    box.appendChild(num);
    box.appendChild(piu);
    wrap.appendChild(btn);
    wrap.appendChild(box);

    // La card apre il popup del piatto: senza stopPropagation ogni clic
    // sui pulsanti aprirebbe anche quello.
    function stop(e) { e.stopPropagation(); }

    btn.addEventListener('click', function (e) { stop(e); daDove(wrap); onAggiungi(); });
    piu.addEventListener('click', function (e) { stop(e); daDove(wrap); cambiaQta(chiaveFn(), 1); });
    meno.addEventListener('click', function (e) { stop(e); cambiaQta(chiaveFn(), -1); });

    wrap.aggiorna = function () {
      var voce = carrello[chiaveFn()];
      btn.hidden = !!voce;
      box.hidden = !voce;
      if (voce) num.textContent = voce.qta;
    };

    controlli.push(wrap);
    return wrap;
  }

  /* ---------- Scelta variante ----------
     Per i piatti con piu prezzi (es. Noodle Soup): piccolo menu a
     comparsa con le opzioni lette da data-varianti. */

  /* Le opzioni di un piatto possono venire da due posti:

     1. data-varianti sulla card, quando cambia anche il prezzo
        (Noodle Soup: Vegetariana 10, Classica 13)
     2. il campo 'scelta' di DISH_DATA, per la proteina a scelta
        (Pad Thai e Pad Thai Omelette), dove il prezzo e sempre lo stesso

     Nel secondo caso il prezzo non viene riscritto: si prende quello
     della card, che resta l'unico punto in cui modificarlo. */
  function opzioniDi(nome, nodoPrezzo) {
    var attr = nodoPrezzo.getAttribute('data-varianti');
    if (attr) {
      return attr.split('|').map(function (pezzo) {
        var p = pezzo.split(':');
        return { nome: p[0].trim(), prezzo: leggiPrezzo(p[1]) };
      });
    }

    // DISH_DATA e dichiarato in menu-modal.js, caricato prima di questo file
    if (typeof DISH_DATA !== 'undefined' && DISH_DATA[nome] && DISH_DATA[nome].scelta) {
      var prezzo = leggiPrezzo(nodoPrezzo.textContent);
      return DISH_DATA[nome].scelta.map(function (s) {
        return { nome: s, prezzo: prezzo };
      });
    }

    return null;
  }

  /* La piccantezza si regola su tutti i piatti tranne antipasti e
     bevande: li non ha senso. Restituisce il livello di partenza preso
     dalla ricetta, oppure null se il piatto non e regolabile. */
  var SEZIONI_SENZA_PICCANTE = ['antipasti'];

  function piccanteDiPartenza(card, nome) {
    var sezione = card.closest('.mp-section');
    if (sezione && SEZIONI_SENZA_PICCANTE.indexOf(sezione.id) !== -1) return null;
    if (typeof DISH_DATA === 'undefined' || !DISH_DATA[nome]) return null;
    return DISH_DATA[nome].spice || 0;
  }

  // Con le opzioni la chiave dipende da quale e stata scelta: cerco una
  // qualsiasi voce del carrello che appartenga a questo piatto.
  function chiaveEsistente(nome) {
    var k = Object.keys(carrello).filter(function (x) {
      return carrello[x].nome === nome;
    });
    return k[0] || chiaveDi(nome, '');
  }

  function apriSceltaVariante(nome, varianti, ancora, piccante) {
    // Chiude un eventuale menu gia aperto
    var vecchio = document.querySelector('.cart-varianti');
    if (vecchio) vecchio.remove();

    var menu = document.createElement('div');
    menu.className = 'cart-varianti';

    varianti.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cart-varianti__opt';
      b.innerHTML = '<span>' + v.nome + '</span><strong>' + formatta(v.prezzo) + '</strong>';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        aggiungi(nome, v.prezzo, v.nome, piccante);
        menu.remove();
        chiudiPopup();
      });
      menu.appendChild(b);
    });

    ancora.appendChild(menu);

    // Un clic fuori chiude il menu
    setTimeout(function () {
      document.addEventListener('click', function chiudi() {
        menu.remove();
        document.removeEventListener('click', chiudi);
      }, { once: true });
    }, 0);
  }

  /* ---------- Montaggio sulle card ---------- */

  function montaSulleCard() {
    document.querySelectorAll('.dish-card-sm').forEach(function (card) {
      var nodoNome = card.querySelector('.dish-card-sm__name');
      var nodoPrezzo = card.querySelector('.dish-card-sm__price');
      var info = card.querySelector('.dish-card-sm__info');
      if (!nodoNome || !nodoPrezzo || !info) return;

      // Il nome puo contenere lo span della quantita ("3pz"): prendo solo
      // il primo nodo di testo, come fa gia il popup.
      var nome = nodoNome.firstChild.textContent.trim();
      var opzioni = opzioniDi(nome, nodoPrezzo);
      var piccante = piccanteDiPartenza(card, nome);

      var wrap;
      if (opzioni) {
        wrap = creaControlli(
          function () { return chiaveEsistente(nome); },
          function () { apriSceltaVariante(nome, opzioni, wrap, piccante); }
        );
        wrap.classList.add('cart-btn-wrap--varianti');
      } else {
        var prezzo = leggiPrezzo(nodoPrezzo.textContent);
        wrap = creaControlli(
          function () { return chiaveDi(nome, ''); },
          function () { aggiungi(nome, prezzo, '', piccante); }
        );
      }
      info.appendChild(wrap);
    });
  }

  /* ---------- Montaggio sulle bevande ----------
     Struttura diversa dalle card: <li> con nome e prezzo affiancati. */

  function montaSulleBevande() {
    document.querySelectorAll('.drinks-list li').forEach(function (li) {
      var nodoNome = li.querySelector('.drinks-list__name');
      var nodoPrezzo = li.querySelector('.drinks-list__price');
      if (!nodoNome || !nodoPrezzo) return;

      var nome = nodoNome.textContent.trim();
      var prezzo = leggiPrezzo(nodoPrezzo.textContent);

      var wrap = creaControlli(
        function () { return chiaveDi(nome, ''); },
        function () { aggiungi(nome, prezzo, ''); },
        'cart-btn-wrap cart-btn-wrap--drink'
      );
      li.appendChild(wrap);
    });
  }

  /* ---------- Pulsante dentro il popup piatto ---------- */

  var popupWrap, popupNome, popupPrezzo, popupOpzioni, popupPiccante;

  function montaSulPopup() {
    var modal = document.getElementById('dish-modal');
    if (!modal) return;
    var info = modal.querySelector('.dish-modal__info');
    if (!info) return;

    popupWrap = creaControlli(
      function () {
        return popupOpzioni ? chiaveEsistente(popupNome) : chiaveDi(popupNome, '');
      },
      function () {
        if (popupOpzioni) {
          apriSceltaVariante(popupNome, popupOpzioni, popupWrap, popupPiccante);
        } else {
          aggiungi(popupNome, popupPrezzo, '', popupPiccante);
          chiudiPopup();
        }
      },
      'cart-btn-wrap cart-btn-wrap--popup'
    );
    info.appendChild(popupWrap);

    // menu-modal.js segnala quale piatto sta mostrando
    modal.addEventListener('piatto-aperto', function (e) {
      popupNome = e.detail.nome;
      popupPrezzo = leggiPrezzo(e.detail.prezzo);

      // Le opzioni si ricavano dalla card di origine, che porta sia il
      // prezzo sia l'eventuale data-varianti
      var nodoPrezzo = e.detail.card
        ? e.detail.card.querySelector('.dish-card-sm__price')
        : null;
      popupOpzioni = nodoPrezzo ? opzioniDi(popupNome, nodoPrezzo) : null;
      popupPiccante = e.detail.card ? piccanteDiPartenza(e.detail.card, popupNome) : null;

      // Avvisa che il livello mostrato non e fisso, altrimenti sembra
      // un dato della scheda e non una scelta possibile
      var nota = modal.querySelector('.dish-modal__spice-mod');
      if (nota) nota.hidden = popupPiccante === null;

      popupWrap.classList.toggle('cart-btn-wrap--varianti', !!popupOpzioni);
      aggiornaTutto();
    });
  }

  /* =========================================================
     PULSANTE FLOTTANTE
     ========================================================= */

  var fab;

  function creaFab() {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'cart-fab';
    fab.hidden = true;
    fab.setAttribute('aria-label', 'Apri il carrello');
    // SVG in linea come le altre icone del sito: scala con il testo,
    // prende il colore da currentColor e non aggiunge una richiesta di rete.
    // Il conteggio sta sull'angolo dell'icona, non di fianco: e il modo
    // in cui i carrelli vengono letti a colpo d'occhio.
    fab.innerHTML =
      '<span class="cart-fab__icona">' +
        '<svg class="cart-fab__i" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
             'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<circle cx="9" cy="21" r="1"></circle>' +
          '<circle cx="20" cy="21" r="1"></circle>' +
          '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>' +
        '</svg>' +
        '<span class="cart-fab__n"></span>' +
      '</span>' +
      '<span class="cart-fab__t"></span>';
    fab.addEventListener('click', apriPannello);
    document.body.appendChild(fab);
    posizionaFab();
    SCHERMO_PICCOLO.addEventListener('change', posizionaFab);
  }

  /* Da telefono il carrello sta dentro la barra in alto, accanto al menu:
     e il posto dove viene cercato. Da computer resta flottante in alto a
     destra, dove non copre niente. Stessa soglia dei 900px del CSS. */
  var SCHERMO_PICCOLO = window.matchMedia('(max-width: 768px)');

  function posizionaFab() {
    if (!fab) return;
    var barra = document.querySelector('.v3-header__inner');

    if (SCHERMO_PICCOLO.matches && barra) {
      // Prima dell'hamburger, che resta l'ultimo elemento a destra
      var burger = barra.querySelector('.v3-header__burger');
      if (fab.parentNode !== barra) barra.insertBefore(fab, burger);
      fab.classList.add('cart-fab--nav');
    } else {
      if (fab.parentNode !== document.body) document.body.appendChild(fab);
      fab.classList.remove('cart-fab--nav');
    }
    aggiornaFab();
  }

  function aggiornaFab() {
    if (!fab) return;
    var n = numeroArticoli();
    var nellaBarra = fab.classList.contains('cart-fab--nav');
    // Nella barra il carrello c'e sempre, anche vuoto: e un punto fisso
    // dell'interfaccia. Flottante invece comparirebbe sopra i contenuti,
    // quindi si mostra solo quando serve.
    fab.hidden = !nellaBarra && n === 0;

    var conteggio = fab.querySelector('.cart-fab__n');
    conteggio.textContent = n;
    conteggio.hidden = n === 0;

    // Subtotale e non totale: qui si mostra quello che si e aggiunto.
    // La consegna compare nel pannello, dove si conclude l'ordine.
    fab.querySelector('.cart-fab__t').textContent = formatta(subtotale());
  }

  /* =========================================================
     PANNELLO CARRELLO
     ========================================================= */

  var pannello, elenco, totaleEl, form;

  function creaPannello() {
    pannello = document.createElement('div');
    pannello.className = 'cart-panel';
    pannello.setAttribute('aria-hidden', 'true');
    pannello.innerHTML =
      '<div class="cart-panel__overlay"></div>' +
      '<div class="cart-panel__box" role="dialog" aria-label="Il tuo ordine">' +
        '<button type="button" class="cart-panel__close" aria-label="Chiudi">✕</button>' +
        '<h2 class="cart-panel__title">Il tuo ordine</h2>' +
        // Le condizioni in cima, prima dell'elenco: scoprire il costo di
        // consegna dopo aver scelto i piatti e una sorpresa sgradita.
        // Il testo si costruisce dalle costanti, cosi non puo divergere.
        '<p class="cart-panel__condizioni">' +
          'Ordine minimo ' + formatta(ORDINE_MINIMO) + ' · ' +
          'Consegna ' + formatta(COSTO_CONSEGNA) + ' • ' +
          'Gratuita per ordini superiori a ' + formatta(CONSEGNA_GRATIS_DA) +
        '</p>' +
        '<div class="cart-panel__list"></div>' +
        '<p class="cart-panel__vuoto">Il carrello è vuoto.</p>' +
        '<button type="button" class="cart-panel__svuota">Svuota carrello</button>' +
        '<div class="cart-conti">' +
          '<div class="cart-conti__r"><span>Totale piatti</span><span class="cart-conti__sub"></span></div>' +
          '<div class="cart-conti__r"><span>Consegna</span><span class="cart-conti__cons"></span></div>' +
          '<div class="cart-panel__tot"><span>Totale</span><strong></strong></div>' +
          '<p class="cart-conti__minimo" hidden></p>' +
        '</div>' +
        '<form class="cart-form" novalidate>' +
          '<p class="cart-form__intro">Consegna a domicilio — compila i tuoi dati</p>' +
          // Sempre visibile, non solo quando si digita la citta: chi e di
          // quelle zone deve saperlo prima di compilare tutto il form.
          '<p class="cart-form__zone">' +
            'Le sedi di ' +
            CITTA_SEPARATE.map(function (z) {
              return '<strong>' + z.nome + '</strong> ' +
                     '(<a href="tel:' + z.telefono.replace(/\s/g, '') + '">' + z.telefono + '</a>)';
            }).join(' e ') +
            ' non prendono ordinazioni su WhatsApp, ma solo per telefono.' +
          '</p>' +
          campo('nome', 'Nome', 'text') +
          campo('cognome', 'Cognome', 'text') +
          campo('telefono', 'Telefono', 'tel') +
          campo('indirizzo', 'Indirizzo', 'text', 'Via e numero civico') +
          campo('citta', 'Città', 'text', 'Es. Torino') +
          '<div class="cart-form__coppia">' +
            campo('cap', 'CAP', 'text', '10121') +
            campo('provincia', 'Prov.', 'text', 'TO') +
          '</div>' +
          '<div class="cart-form__nota" hidden></div>' +
          '<label class="cart-form__row">' +
            '<span class="cart-form__label">Note <em>(facoltativo)</em></span>' +
            '<textarea name="note" rows="2" class="cart-form__input"></textarea>' +
          '</label>' +
          '<p class="cart-form__allergie">' +
            '<strong>Allergie o intolleranze?</strong> Chiama il ristorante prima di ordinare: ' +
            'una nota scritta qui potrebbe non essere notata in tempo.' +
          '</p>' +
          '<p class="cart-form__avviso" hidden></p>' +
          '<button type="submit" class="cart-form__invia">Ordina su WhatsApp</button>' +
          '<a class="cart-form__chiama" hidden></a>' +
        '</form>' +
      '</div>';

    document.body.appendChild(pannello);

    elenco = pannello.querySelector('.cart-panel__list');
    totaleEl = pannello.querySelector('.cart-panel__tot strong');
    form = pannello.querySelector('.cart-form');

    pannello.querySelector('.cart-panel__close').addEventListener('click', chiudiPannello);
    pannello.querySelector('.cart-panel__overlay').addEventListener('click', chiudiPannello);

    // Conferma prima di cancellare: un tocco distratto farebbe perdere
    // tutto l'ordine, e non c'e modo di annullare.
    pannello.querySelector('.cart-panel__svuota').addEventListener('click', function () {
      if (confirm('Vuoi svuotare il carrello? L\'ordine verrà cancellato.')) {
        carrello = {};
        salva();
        aggiornaTutto();
      }
    });
    form.addEventListener('submit', inviaOrdine);
    // L'avviso si aggancia alla citta digitata, non piu a un menu a tendina
    form.elements.citta.addEventListener('input', aggiornaNotaSede);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pannello.classList.contains('is-open')) chiudiPannello();
    });

    ripristinaDati();
    // Se la sede ripristinata e una di quelle solo-telefono, l'avviso
    // deve esserci gia all'apertura
    aggiornaNotaSede();
  }

  function campo(nome, etichetta, tipo, suggerimento) {
    return '<label class="cart-form__row">' +
      '<span class="cart-form__label">' + etichetta + '</span>' +
      '<input type="' + tipo + '" name="' + nome + '" class="cart-form__input" autocomplete="on"' +
        (suggerimento ? ' placeholder="' + suggerimento + '"' : '') + '>' +
      '<span class="cart-form__err"></span>' +
    '</label>';
  }

  function apriPannello() {
    pannello.classList.add('is-open');
    pannello.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    disegnaElenco();
  }

  function chiudiPannello() {
    pannello.classList.remove('is-open');
    pannello.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function disegnaElenco() {
    if (!elenco) return;
    elenco.innerHTML = '';
    var chiavi = Object.keys(carrello);

    var vuoto = chiavi.length === 0;
    pannello.querySelector('.cart-panel__vuoto').hidden = !vuoto;
    form.hidden = vuoto;
    pannello.querySelector('.cart-conti').hidden = vuoto;
    pannello.querySelector('.cart-panel__svuota').hidden = vuoto;

    chiavi.forEach(function (k) {
      var v = carrello[k];
      var riga = document.createElement('div');
      riga.className = 'cart-riga';
      riga.innerHTML =
        '<div class="cart-riga__alto">' +
          '<div class="cart-riga__testo">' +
            '<span class="cart-riga__nome">' + v.nome + '</span>' +
            (v.variante ? '<span class="cart-riga__var">' + v.variante + '</span>' : '') +
          '</div>' +
          '<div class="cart-qta cart-qta--riga">' +
            '<button type="button" class="cart-qta__btn" data-a="meno" aria-label="Togli uno">−</button>' +
            '<span class="cart-qta__n">' + v.qta + '</span>' +
            '<button type="button" class="cart-qta__btn" data-a="piu" aria-label="Aggiungi uno">+</button>' +
          '</div>' +
          '<span class="cart-riga__prezzo">' + formatta(v.prezzo * v.qta) + '</span>' +
          '<button type="button" class="cart-riga__x" aria-label="Rimuovi">✕</button>' +
        '</div>' +
        (v.piccante === null ? '' :
          '<div class="cart-picc">' +
            '<span class="cart-picc__l">Piccantezza</span>' +
            [0, 1, 2, 3].map(function (n) {
              return '<button type="button" class="cart-picc__b' +
                     (n === v.piccante ? ' is-scelto' : '') + '" data-p="' + n + '" ' +
                     'aria-label="Piccantezza ' + n + ' su 3">' + n + '</button>';
            }).join('') +
          '</div>') +
        '<input type="text" class="cart-riga__nota" maxlength="120" ' +
               'placeholder="Richieste per questo piatto (es. senza aglio)" ' +
               'aria-label="Richieste per ' + v.nome + '">';

      riga.querySelector('[data-a="meno"]').addEventListener('click', function () { cambiaQta(k, -1); });
      riga.querySelector('[data-a="piu"]').addEventListener('click', function () { cambiaQta(k, 1, true); });
      riga.querySelector('.cart-riga__x').addEventListener('click', function () { rimuovi(k); });

      // Piccantezza: aggiorno solo l'evidenziazione dei pulsanti, senza
      // ridisegnare l'elenco. Non cambia totali ne conteggi, e un
      // redisegno farebbe perdere il fuoco alla nota se era in scrittura.
      riga.querySelectorAll('.cart-picc__b').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!carrello[k]) return;
          carrello[k].piccante = +b.dataset.p;
          salva();
          riga.querySelectorAll('.cart-picc__b').forEach(function (x) {
            x.classList.toggle('is-scelto', x === b);
          });
        });
      });

      // La nota si salva senza ridisegnare l'elenco: un redisegno a ogni
      // tasto premuto farebbe perdere il fuoco dal campo mentre si scrive.
      var campoNota = riga.querySelector('.cart-riga__nota');
      campoNota.value = v.nota || '';
      campoNota.addEventListener('input', function () {
        if (carrello[k]) {
          carrello[k].nota = campoNota.value;
          salva();
        }
      });

      elenco.appendChild(riga);
    });

    pannello.querySelector('.cart-conti__sub').textContent = formatta(subtotale());

    var cons = pannello.querySelector('.cart-conti__cons');
    cons.textContent = consegnaGratis() ? 'Gratuita' : formatta(costoConsegna());
    cons.classList.toggle('is-gratis', consegnaGratis());

    totaleEl.textContent = formatta(totale());

    // Sotto il minimo: dico quanto manca, non solo che non si puo ordinare.
    // E disattivo l'invio, cosi non si compila tutto per poi essere respinti.
    var manca = mancaAlMinimo();
    var avvisoMin = pannello.querySelector('.cart-conti__minimo');
    var inviaBtn = form.querySelector('.cart-form__invia');

    avvisoMin.hidden = manca === 0 || vuoto;
    if (manca > 0) {
      avvisoMin.textContent = 'Ordine minimo ' + formatta(ORDINE_MINIMO) +
                              ': aggiungi ancora ' + formatta(manca) + ' di piatti.';
    }
    inviaBtn.disabled = manca > 0;
    inviaBtn.classList.toggle('is-disattivo', manca > 0);
  }

  /* =========================================================
     FORM: memoria, validazione, invio
     ========================================================= */

  // I dati del cliente restano salvati: chi riordina non li riscrive.
  function ripristinaDati() {
    try {
      var d = JSON.parse(localStorage.getItem(CHIAVE_DATI)) || {};
      ['nome', 'cognome', 'telefono', 'indirizzo', 'citta', 'cap', 'provincia', 'note'].forEach(function (c) {
        if (d[c] && form.elements[c]) form.elements[c].value = d[c];
      });
    } catch (e) { /* silenzioso */ }
  }

  function salvaDati(d) {
    try {
      localStorage.setItem(CHIAVE_DATI, JSON.stringify(d));
    } catch (e) { /* silenzioso */ }
  }

  /* ---------- Zone gestite separatamente ----------
     L'avviso compare mentre si scrive la citta, non all'invio: scoprirlo
     dopo aver compilato tutto il form sarebbe frustrante. Al posto del
     pulsante WhatsApp compare quello per chiamare. */

  // "Mondovì", "mondovi", "MONDOVI'" devono valere tutti: tolgo accenti,
  // apostrofi e maiuscole prima di confrontare.
  function normalizza(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .trim();
  }

  function zonaSeparata() {
    var c = normalizza(form.elements.citta.value);
    if (!c) return null;
    return CITTA_SEPARATE.filter(function (z) { return c === z.citta; })[0] || null;
  }

  function aggiornaNotaSede() {
    var nota = form.querySelector('.cart-form__nota');
    var inviaBtn = form.querySelector('.cart-form__invia');
    var chiamaBtn = form.querySelector('.cart-form__chiama');
    var z = zonaSeparata();

    if (z) {
      var tel = z.telefono.replace(/\s/g, '');
      nota.innerHTML =
        '<strong>Gli ordini per ' + z.nome + ' non passano dal sito.</strong> ' +
        'Quella sede è gestita separatamente: per ordinare chiama direttamente ' +
        'il ristorante al <a href="tel:' + tel + '">' + z.telefono + '</a>.';
      nota.hidden = false;

      chiamaBtn.textContent = 'Chiama ' + z.nome + ' — ' + z.telefono;
      chiamaBtn.href = 'tel:' + tel;
      chiamaBtn.hidden = false;
      inviaBtn.hidden = true;
    } else {
      nota.hidden = true;
      chiamaBtn.hidden = true;
      inviaBtn.hidden = false;
    }
  }

  function mostraErrore(campo, messaggio) {
    var riga = form.elements[campo].closest('.cart-form__row');
    riga.classList.add('is-errore');
    riga.querySelector('.cart-form__err').textContent = messaggio;
  }

  function puliciErrori() {
    form.querySelectorAll('.cart-form__row').forEach(function (r) {
      r.classList.remove('is-errore');
      var e = r.querySelector('.cart-form__err');
      if (e) e.textContent = '';
    });
    var avviso = form.querySelector('.cart-form__avviso');
    avviso.hidden = true;
    avviso.textContent = '';
  }

  function valida(d) {
    var errori = [];
    if (!d.nome) errori.push(['nome', 'Inserisci il tuo nome']);
    if (!d.cognome) errori.push(['cognome', 'Inserisci il tuo cognome']);

    if (!d.telefono) {
      errori.push(['telefono', 'Inserisci un numero di telefono']);
    } else if (d.telefono.replace(/[^\d]/g, '').length < 8) {
      errori.push(['telefono', 'Il numero sembra incompleto']);
    }

    if (!d.indirizzo) {
      errori.push(['indirizzo', 'Inserisci via e numero civico']);
    } else if (!/\d/.test(d.indirizzo)) {
      // Senza un numero l'indirizzo e quasi sempre incompleto
      errori.push(['indirizzo', 'Manca il numero civico']);
    }

    if (!d.citta) errori.push(['citta', 'Inserisci la città']);

    if (!d.cap) {
      errori.push(['cap', 'Inserisci il CAP']);
    } else if (!/^\d{5}$/.test(d.cap)) {
      errori.push(['cap', 'Il CAP è di 5 cifre']);
    }

    if (!d.provincia) {
      errori.push(['provincia', 'Inserisci la provincia']);
    } else if (!/^[A-Za-z]{2}$/.test(d.provincia)) {
      errori.push(['provincia', 'Due lettere (es. TO)']);
    }

    return errori;
  }

  /* ---------- Messaggio WhatsApp ----------
     encodeURIComponent gestisce accenti, simbolo € e a capo. */

  function componiMessaggio(d) {
    var righe = [];
    righe.push('Ciao Mai Thai! Vorrei fare un ordine 🍜');
    righe.push('Modalità: Consegna a domicilio');
    righe.push('');

    // La variante va fra parentesi: usando il trattino si confonderebbe
    // con quello che separa il prezzo. La nota va sotto, rientrata, cosi
    // in cucina si vede subito a quale piatto appartiene.
    Object.keys(carrello).forEach(function (k) {
      var v = carrello[k];
      var etichetta = v.variante ? v.nome + ' (' + v.variante + ')' : v.nome;
      // La scala "/3" evita che il numero da solo resti ambiguo in cucina
      if (v.piccante !== null && v.piccante !== undefined) {
        etichetta += ' · piccantezza ' + v.piccante + '/3';
      }
      righe.push(v.qta + 'x ' + etichetta + ' – ' + formatta(v.prezzo * v.qta));
      if (v.nota) righe.push('   ↳ ' + v.nota);
    });

    righe.push('');
    righe.push('Totale piatti: ' + formatta(subtotale()));
    righe.push('Consegna: ' + (consegnaGratis() ? 'Gratuita' : formatta(costoConsegna())));
    righe.push('TOTALE: ' + formatta(totale()));
    righe.push('');
    righe.push('Nome: ' + d.nome + ' ' + d.cognome);
    righe.push('Telefono: ' + d.telefono);
    // Indirizzo su una riga sola, nel formato italiano abituale
    righe.push('Indirizzo: ' + d.indirizzo + ', ' + d.cap + ' ' + d.citta + ' (' + d.provincia + ')');
    if (d.note) righe.push('Note: ' + d.note);

    return righe.join('\n');
  }

  function inviaOrdine(e) {
    e.preventDefault();
    puliciErrori();

    var d = {
      nome: form.elements.nome.value.trim(),
      cognome: form.elements.cognome.value.trim(),
      telefono: form.elements.telefono.value.trim(),
      indirizzo: form.elements.indirizzo.value.trim(),
      citta: form.elements.citta.value.trim(),
      cap: form.elements.cap.value.trim(),
      provincia: form.elements.provincia.value.trim().toUpperCase(),
      note: form.elements.note.value.trim()
    };

    if (Object.keys(carrello).length === 0) {
      avvisa('Il carrello è vuoto: aggiungi almeno un piatto.');
      return;
    }

    // Secondo controllo oltre al pulsante disattivato: quello e solo
    // l'interfaccia, questo e la regola.
    var manca = mancaAlMinimo();
    if (manca > 0) {
      avvisa('L\'ordine minimo è ' + formatta(ORDINE_MINIMO) +
             ': mancano ancora ' + formatta(manca) + ' di piatti.');
      return;
    }

    var errori = valida(d);
    if (errori.length) {
      errori.forEach(function (x) { mostraErrore(x[0], x[1]); });
      form.elements[errori[0][0]].focus();
      return;
    }

    // Zona servita da una sede gestita separatamente: li l'ordine si fa
    // al telefono, non da qui
    var z = zonaSeparata();
    if (z) {
      avvisa('Gli ordini per ' + z.nome + ' non passano dal sito: chiama il ' + z.telefono + '.');
      return;
    }

    if (!ORDINI_A) {
      avvisa('Il servizio di ordinazione non è ancora attivo. Chiama il ristorante per ordinare.');
      return;
    }

    salvaDati(d);
    var url = 'https://wa.me/' + ORDINI_A + '?text=' + encodeURIComponent(componiMessaggio(d));
    window.open(url, '_blank');
  }

  function avvisa(testo) {
    var a = form.querySelector('.cart-form__avviso');
    a.textContent = testo;
    a.hidden = false;
  }

  /* =========================================================
     AVVIO
     ========================================================= */

  function aggiornaTutto() {
    controlli.forEach(function (c) { c.aggiorna(); });
    aggiornaFab();
    if (pannello && pannello.classList.contains('is-open')) disegnaElenco();
  }

  carica();
  montaSulleCard();
  montaSulleBevande();
  montaSulPopup();
  creaFab();
  creaPannello();
  aggiornaTutto();

  window.MaiThaiCarrello = {
    stato: function () { return carrello; },
    totale: totale,
    formatta: formatta,
    componiMessaggio: componiMessaggio,
    svuota: function () { carrello = {}; salva(); aggiornaTutto(); }
  };
})();
