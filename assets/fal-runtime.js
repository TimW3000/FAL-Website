/*
 * Mini-Laufzeit für die Vorschau der SpVgg F.A.L.-Website.
 * Liest die Vorlage aus <x-dc>, füllt {{ … }}, <sc-for> und <sc-if> mit den Werten
 * der Komponente und aktualisiert bei jedem setState nur das, was sich geändert hat
 * (damit Übergänge wie das Aufklappen flüssig bleiben).
 */
(function () {
  'use strict';

  var pending = false;
  var instance = null;
  var host = null;
  var tpl = null;

  window.DCLogic = function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  };
  window.DCLogic.prototype.setState = function (patch) {
    var p = typeof patch === 'function' ? patch(this.state) : patch;
    for (var k in p) { this.state[k] = p[k]; }
    schedule();
  };

  function schedule() {
    if (pending) { return; }
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  }

  /* ---------- Ausdrücke ---------- */
  var ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var ANY = /\{\{\s*([^}]+?)\s*\}\}/g;

  function lookup(expr, scope) {
    if (expr === 'true') { return true; }
    if (expr === 'false') { return false; }
    if (expr === 'null') { return null; }
    if (/^-?\d+(\.\d+)?$/.test(expr)) { return Number(expr); }
    if (/^'.*'$|^".*"$/.test(expr)) { return expr.slice(1, -1); }
    var parts = expr.split('.');
    var v;
    for (var i = scope.length - 1; i >= 0; i--) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) { v = scope[i][parts[0]]; break; }
    }
    for (var j = 1; j < parts.length && v != null; j++) { v = v[parts[j]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(ANY, function (_, e) { var v = lookup(e, scope); return v == null ? '' : String(v); });
  }
  function truthy(v) { return !!v && v !== 'false' && v !== '0'; }

  /* ---------- Vorlage -> neuer DOM-Baum ---------- */
  function build(node, scope, out) {
    if (node.nodeType === 3) {
      out.push(document.createTextNode(node.nodeValue.indexOf('{{') < 0 ? node.nodeValue : interp(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) { return; }
    var tag = node.localName;
    if (tag === 'sc-for') {
      var m = ONLY.exec(node.getAttribute('list') || '');
      var list = m ? lookup(m[1], scope) : null;
      var as = node.getAttribute('as') || 'item';
      (list || []).forEach(function (item, idx) {
        var s = {}; s[as] = item; s.$index = idx;
        kids(node, scope.concat([s]), out);
      });
      return;
    }
    if (tag === 'sc-if') {
      var mm = ONLY.exec(node.getAttribute('value') || '');
      if (truthy(mm ? lookup(mm[1], scope) : node.getAttribute('value'))) { kids(node, scope, out); }
      return;
    }
    var el = node.namespaceURI === 'http://www.w3.org/2000/svg'
      ? document.createElementNS(node.namespaceURI, node.localName)
      : document.createElement(node.localName);
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i];
      if (a.name.indexOf('hint-') === 0) { continue; }
      if (a.name === 'onclick') {
        var hm = ONLY.exec(a.value);
        var fn = hm ? lookup(hm[1], scope) : null;
        if (typeof fn === 'function') { el.__click = fn; }
        continue;
      }
      el.setAttribute(a.name, a.value.indexOf('{{') < 0 ? a.value : interp(a.value, scope));
    }
    var sub = [];
    kids(node, scope, sub);
    sub.forEach(function (c) { el.appendChild(c); });
    out.push(el);
  }
  function kids(node, scope, out) {
    var c = node.content ? node.content.childNodes : node.childNodes;
    for (var i = 0; i < c.length; i++) { build(c[i], scope, out); }
  }

  /* ---------- Abgleich mit dem bestehenden DOM ---------- */
  function same(a, b) {
    return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.localName === b.localName);
  }
  function patchAttrs(cur, next) {
    var i, a;
    for (i = cur.attributes.length - 1; i >= 0; i--) {
      a = cur.attributes[i];
      if (!next.hasAttribute(a.name)) { cur.removeAttribute(a.name); }
    }
    for (i = 0; i < next.attributes.length; i++) {
      a = next.attributes[i];
      if (cur.getAttribute(a.name) !== a.value) { cur.setAttribute(a.name, a.value); }
    }
    cur.__click = next.__click || null;
  }
  function patchChildren(parent, nextList) {
    var cur = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < nextList.length; i++) {
      var n = nextList[i], c = cur[i];
      if (!c) { parent.appendChild(n); continue; }
      if (!same(c, n)) { parent.replaceChild(n, c); continue; }
      if (n.nodeType === 3) { if (c.nodeValue !== n.nodeValue) { c.nodeValue = n.nodeValue; } continue; }
      /* Fremde Inhalte (z. B. fussball.de-Widget) nicht anfassen, solange es derselbe Platz ist */
      if (n.hasAttribute('data-dc-keep')) {
        if (c.hasAttribute('data-dc-keep') && c.getAttribute('data-id') === n.getAttribute('data-id') && c.getAttribute('data-type') === n.getAttribute('data-type')) { continue; }
        parent.replaceChild(n, c); continue;
      }
      if (c.hasAttribute('data-dc-keep')) { parent.replaceChild(n, c); continue; }
      patchAttrs(c, n);
      patchChildren(c, Array.prototype.slice.call(n.childNodes));
    }
    for (var j = cur.length - 1; j >= nextList.length; j--) { parent.removeChild(cur[j]); }
  }

  function render() {
    var vals = instance.renderVals ? instance.renderVals() : {};
    var out = [];
    kids(tpl, [instance.state, vals], out);
    patchChildren(host, out);
  }

  /* ---------- Start ---------- */
  function init() {
    var xdc = document.querySelector('x-dc');
    if (!xdc) { return; }
    var helmet = xdc.querySelector('helmet');
    if (helmet) {
      while (helmet.firstChild) { document.head.appendChild(helmet.firstChild); }
      helmet.parentNode.removeChild(helmet);
    }
    tpl = document.createElement('template');
    tpl.innerHTML = xdc.innerHTML;
    host = document.createElement('div');
    host.className = 'dc-root';
    xdc.parentNode.replaceChild(host, xdc);

    var script = document.querySelector('script[data-dc-script]');
    var props = {};
    if (script) {
      try {
        var def = JSON.parse(script.getAttribute('data-props') || '{}');
        Object.keys(def).forEach(function (k) { if (k.charAt(0) !== '$' && def[k] && 'default' in def[k]) { props[k] = def[k]['default']; } });
      } catch (e) { /* ohne Props weiter */ }
      var Component = new Function(script.textContent + '\n;return Component;')();
      instance = new Component(props);
    } else {
      instance = new window.DCLogic(props);
    }
    /* Startzustand aus der Adresse, z. B. mannschaft.html?team=zweite oder jugend.html?open=b */
    var q = new URLSearchParams(location.search);
    q.forEach(function (v, k) { if (k in instance.state) { instance.state[k] = v; } });

    document.addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== document) {
        if (t.__click) { if (t.localName === 'a' && (t.getAttribute('href') || '#') === '#') { ev.preventDefault(); } t.__click.call(instance, ev); return; }
        t = t.parentNode;
      }
    });
    render();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
