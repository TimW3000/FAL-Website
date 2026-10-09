/*
 * fussball.de-Widgets für die Vorschau.
 *
 * 1. Widget-IDs: hier eintragen, je Mannschaft und Art (spielplan / tabelle).
 * 2. Besucher sehen zuerst einen Datenschutz-Hinweis und laden das Widget per Klick.
 *    "Immer laden" merkt sich die Wahl im Browser (localStorage "fal_fd_ok").
 *
 * Ein Platz für ein Widget im HTML: <div class="fal-fd" data-dc-keep data-id="…" data-type="team-matches" data-title="…"></div>
 */
(function () {
  'use strict';

  window.FAL_FD = {
    verein: { spielplan: { id: 'd48ef382-b58d-4732-b141-76d352c8281a', type: 'club-matches' } },
    erste: {
      spielplan: { id: '66e66124-5800-41f1-b90b-bc45a18bf2da', type: 'team-matches' },
      tabelle: { id: 'e204eafe-02ad-4ac9-b2d3-281041282d25', type: 'table' },
      next: { id: 'bf50801d-6396-4823-9e8c-a24694dfa090', type: 'next-match' }
    }
  };

  var KEY = 'fal_fd_ok';
  function allowed() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function allowAlways() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* privat-Modus */ } }

  function rid() {
    var a = new Uint8Array(4);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function mount(box) {
    var id = box.getAttribute('data-id');
    var type = box.getAttribute('data-type') || 'team-matches';
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-z-]+$/.test(type)) { return; }
    box.innerHTML = '';
    var f = document.createElement('iframe');
    f.src = 'https://next.fussball.de/widget/' + type + '/' + id;
    f.name = rid() + '_fussballde_widget-' + id;
    f.title = box.getAttribute('data-title') || 'fussball.de';
    f.loading = 'lazy';
    f.setAttribute('style', 'display:block;width:100%;border:0;background:#ffffff;' + (box.hasAttribute('data-compact') ? 'height:180px' : 'height:520px;border-radius:16px'));
    box.appendChild(f);
    box.setAttribute('data-fd-state', 'loaded');
  }

  function consentCompact(box) {
    box.setAttribute('data-fd-state', 'ask');
    box.innerHTML =
      '<div style="padding:22px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">' +
      '<span style="font-size:13px;line-height:1.45;color:#51607a">Live von fussball.de. Beim Laden werden Daten wie deine IP-Adresse an fussball.de übertragen.</span>' +
      '<span style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">' +
      '<button type="button" data-fd="once" style="border:none;background:#1e3e62;color:#ffffff;font-weight:800;font-size:14px;line-height:1;font-family:inherit;padding:11px 16px;border-radius:9px;cursor:pointer">Laden</button>' +
      '<button type="button" data-fd="always" style="border:2px solid #1e3e62;background:transparent;color:#1e3e62;font-weight:800;font-size:14px;line-height:1;font-family:inherit;padding:9px 14px;border-radius:9px;cursor:pointer">Immer laden</button>' +
      '</span></div>';
  }

  function consent(box) {
    if (box.hasAttribute('data-compact')) { consentCompact(box); return; }
    var title = box.getAttribute('data-title') || 'Spielplan';
    var label = box.getAttribute('data-type') === 'table' ? 'Tabelle laden' : 'Spielplan laden';
    box.setAttribute('data-fd-state', 'ask');
    box.innerHTML =
      '<div style="background:#f2f5f9;border-radius:20px;min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:36px;box-sizing:border-box;text-align:center">' +
      '<span style="font-weight:800;font-size:20px;color:#1e3e62"></span>' +
      '<span style="font-size:15px;line-height:1.5;color:#51607a;max-width:480px">Spiele und Ergebnisse kommen direkt von fussball.de. Beim Laden werden Daten wie deine IP-Adresse an fussball.de übertragen.</span>' +
      '<span style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">' +
      '<button type="button" data-fd="once" style="border:none;background:#1e3e62;color:#ffffff;font-weight:800;font-size:15px;line-height:1;font-family:inherit;padding:14px 22px;border-radius:10px;cursor:pointer">' + label + '</button>' +
      '<button type="button" data-fd="always" style="border:2px solid #1e3e62;background:transparent;color:#1e3e62;font-weight:800;font-size:15px;line-height:1;font-family:inherit;padding:12px 20px;border-radius:10px;cursor:pointer">Immer laden</button>' +
      '</span></div>';
    box.querySelector('span').textContent = title;
  }

  function init(box) {
    if (box.getAttribute('data-fd-state')) { return; }
    /* Noch nicht ausgefüllte Vorlage (enthält {{ … }}) nicht anfassen */
    if (box.closest('x-dc') || (box.getAttribute('data-id') || '').indexOf('{{') >= 0) { return; }
    if (allowed()) { mount(box); } else { consent(box); }
  }
  function scan() { Array.prototype.forEach.call(document.querySelectorAll('.fal-fd'), init); }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-fd]') : null;
    if (!b) { return; }
    if (b.getAttribute('data-fd') === 'always') {
      allowAlways();
      Array.prototype.forEach.call(document.querySelectorAll('.fal-fd[data-fd-state="ask"]'), mount);
    } else {
      mount(b.closest('.fal-fd'));
    }
  });

  /* Höhe anpassen: das Widget meldet seine Höhe per postMessage */
  window.addEventListener('message', function (ev) {
    if (!/^https:\/\/([a-z0-9-]+\.)*fussball\.de$/.test(ev.origin) || !ev.data || ev.data.type !== 'fussballde_widget:resize') { return; }
    Array.prototype.forEach.call(document.querySelectorAll('.fal-fd iframe'), function (f) {
      if (f.name === ev.data.iframeName && ev.data.height) { f.style.height = parseInt(ev.data.height, 10) + 'px'; }
    });
  });

  /* Die Seiten bauen ihre Inhalte dynamisch: neue Widget-Plätze beobachten */
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', scan); } else { scan(); }
})();
