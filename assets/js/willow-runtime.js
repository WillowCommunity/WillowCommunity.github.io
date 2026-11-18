/* Willow Community – mini motor de plantillas (sustituye al runtime del editor) */
(function () {
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g, EXACT = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function get(scope, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = get(scope, p); return v == null ? '' : String(v); });
  }
  function renderChildren(n, scope, out, regions) {
    var kids = n.childNodes;
    for (var i = 0; i < kids.length; i++) renderNode(kids[i], scope, out, regions);
  }
  function renderNode(n, scope, out, regions) {
    if (n.nodeType === 3) {
      out.appendChild(document.createTextNode(n.nodeValue.indexOf('{{') >= 0 ? interp(n.nodeValue, scope) : n.nodeValue));
      return;
    }
    if (n.nodeType === 11) { renderChildren(n, scope, out, regions); return; }
    if (n.nodeType !== 1) return;
    var tag = n.localName;
    if (tag === 'sc-for') {
      var lm = (n.getAttribute('list') || '').match(EXACT);
      var list = lm ? get(scope, lm[1]) : null;
      var as = n.getAttribute('as') || 'item';
      (list || []).forEach(function (item, i) {
        var s = Object.create(scope); s[as] = item; s.$index = i;
        renderChildren(n, s, out, regions);
      });
      return;
    }
    if (tag === 'sc-if') {
      var vm = (n.getAttribute('value') || '').match(EXACT);
      if (vm && get(scope, vm[1])) renderChildren(n, scope, out, regions);
      return;
    }
    var el = n.namespaceURI === SVGNS ? document.createElementNS(SVGNS, n.localName) : document.createElement(n.localName);
    for (var a = 0; a < n.attributes.length; a++) {
      var at = n.attributes[a], name = at.name, val = at.value;
      if (name.indexOf('hint-') === 0) continue;
      var m = val.match(EXACT);
      if (name.slice(0, 2) === 'on' && m) {
        var fn = get(scope, m[1]);
        if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), fn);
        continue;
      }
      if (m) {
        var v = get(scope, m[1]);
        if (v === false || v == null) continue;
        el.setAttribute(name, v === true ? '' : String(v));
        continue;
      }
      el.setAttribute(name, val.indexOf('{{') >= 0 ? interp(val, scope) : val);
    }
    if (regions && n.hasAttribute('data-region')) regions[n.getAttribute('data-region')] = { tpl: n, el: el };
    renderChildren(n.localName === 'template' ? n.content : n, scope, el, regions);
    out.appendChild(el);
  }

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    var prev = Object.assign({}, this.state);
    this.state = Object.assign({}, this.state, typeof p === 'function' ? p(this.state, this.props) : p);
    if (this._update) this._update(prev);
  };
  DCLogic.prototype.forceUpdate = function () { if (this._update) this._update(Object.assign({}, this.state)); };
  window.DCLogic = DCLogic;

  window.mountWillow = function (Component) {
    var comp = new Component({});
    var regions = {};
    var tpl = document.getElementById('tpl').content;
    var app = document.getElementById('app');
    comp._update = function (prevState) {
      var vals = comp.renderVals();
      Object.keys(regions).forEach(function (k) {
        var r = regions[k], frag = document.createDocumentFragment();
        renderNode(r.tpl, vals, frag, null);
        var nel = frag.firstChild;
        r.el.parentNode.replaceChild(nel, r.el);
        r.el = nel;
      });
      if (comp.componentDidUpdate) comp.componentDidUpdate(comp.props, prevState);
    };
    renderChildren(tpl, comp.renderVals(), app, regions);
    if (comp.componentDidMount) comp.componentDidMount();
  };
})();
