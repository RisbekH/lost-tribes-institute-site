/* Олуя-пайгамбарлардын кол жазмасы — go to a book, chapter and verse ("Жакан 3:16", "1 Петир 2", "John 3:16"),
   plus a book/chapter picker. Book data comes from books.js (window.KJ), written by scripts/kol-jazma/build.py. */
(function () {
  var B = window.KJ || [];
  var box = document.getElementById('kj-go');
  if (!box || !B.length) return;
  var ORD = { 'биринчи': 1, 'экинчи': 2, 'үчүнчү': 3, 'i': 1, 'ii': 2, 'iii': 3 };
  var norm = function (s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/(\d)\s*-\s*(?=[^\d\s])/g, '$1 ')
      .replace(/[^0-9a-zа-яөүң:.,\s]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  var url = function (b, c, v) {
    var h = '';
    if (c) { h = '#c' + c; if (v) h += '-v' + v; }
    return 'book-' + (b.n < 10 ? '0' : '') + b.n + '.html' + h;
  };

  // "1 петир 2:5" -> {book, chapter, verse}
  function parse(raw) {
    var s = norm(raw);
    if (!s) return null;
    var m = s.match(/^(.*?)(?:\s*(\d+)(?:\s*[:.,]\s*(\d+)|\s+(\d+))?)?$/);
    var name = (m[1] || '').trim(), ch = m[2], vs = m[3] || m[4];
    if (!name && ch) { name = ch; ch = null; }           // only a number typed
    var w = name.split(' ');
    if (ORD[w[0]] && w.length > 1) { w[0] = String(ORD[w[0]]); name = w.join(' '); }
    // "1 петир" where the chapter regex took the leading 1: "1 петир" has name "1 петир" already; handle "1петир"
    name = name.replace(/^(\d)(?=[^\d\s])/, '$1 ');
    if (!name) return null;
    var best = null, bestScore = 0;
    B.forEach(function (b) {
      b.a.forEach(function (a) {
        var sc = 0;
        if (a === name) sc = 3;
        else if (a.indexOf(name) === 0 && name.length >= 2) sc = 2;
        else if (name.indexOf(a) === 0) sc = 1;
        if (sc > bestScore) { bestScore = sc; best = b; }
      });
    });
    if (!best) return null;
    var c = ch ? +ch : null, v = vs ? +vs : null;
    // English psalm numbers follow the Hebrew; this edition numbers the Psalms as the Septuagint does.
    if (best.n === 19 && c && /[a-z]/.test(name)) {
      if (c === 10) c = 9;
      else if (c >= 11 && c <= 113) c -= 1;
      else if (c === 114 || c === 115) c = 113;
      else if (c === 116) { c = v && v >= 10 ? 115 : 114; if (v >= 10) v -= 9; }
      else if (c >= 117 && c <= 146) c -= 1;
      else if (c === 147) { c = v && v >= 12 ? 147 : 146; if (v >= 12) v -= 11; }
    }
    return { b: best, c: c, v: v };
  }

  box.innerHTML =
    '<form class="kj-form" role="search" aria-label="Китеп, бөлүм, аят">' +
    '<input type="search" name="r" list="kj-list" autocomplete="off" placeholder="Жакан 3:16 / John 3:16" aria-label="Китеп, бөлүм жана аят">' +
    '<button type="submit">Өтүү</button>' +
    '<button type="button" class="kj-pick" aria-haspopup="dialog">Китептер ▾</button></form>' +
    '<p class="kj-msg" role="status" hidden></p>' +
    '<datalist id="kj-list">' + B.map(function (b) { return '<option value="' + b.t + '">'; }).join('') + '</datalist>' +
    '<dialog class="kj-dlg" aria-label="Китеп тандоо"><div class="kj-head"><b>Китеп тандаңыз</b><button type="button" class="kj-x" aria-label="Жабуу">✕</button></div><div class="kj-body"></div></dialog>';

  var form = box.querySelector('form'), msg = box.querySelector('.kj-msg'), dlg = box.querySelector('dialog'), body = box.querySelector('.kj-body');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = parse(form.r.value);
    if (!r) { msg.hidden = false; msg.textContent = 'Табылган жок. Мисалы: «Жакан 3:16», «1 Петир 2», «Забур 22».'; return; }
    msg.hidden = true;
    var c = r.c;
    if (c && r.b.c.indexOf(c) < 0) { msg.hidden = false; msg.textContent = r.b.t + ' китебинде ' + c + '-бөлүм жок.'; return; }
    location.href = url(r.b, c, c ? r.v : null);
  });

  function books() {
    var g = function (t, k) {
      return '<h3>' + t + '</h3><div class="kj-grid">' + B.filter(function (b) { return b.g === k; })
        .map(function (b) { return '<button type="button" data-b="' + b.n + '">' + b.t + '</button>'; }).join('') + '</div>';
    };
    body.innerHTML = g('Байыркы Келишим', 1) + g('Жаңы Келишим', 2);
    dlg.querySelector('.kj-head b').textContent = 'Китеп тандаңыз';
  }
  function chapters(b) {
    if (b.c.length <= 1) { location.href = url(b); return; }
    dlg.querySelector('.kj-head b').textContent = b.t;
    body.innerHTML = '<button type="button" class="kj-back">← Китептер</button><div class="kj-grid kj-nums">' +
      b.c.map(function (c) { return '<a href="' + url(b, c) + '">' + c + '</a>'; }).join('') + '</div>';
  }
  body.addEventListener('click', function (e) {
    var t = e.target.closest('button,a');
    if (!t) return;
    if (t.dataset.b) chapters(B.filter(function (b) { return b.n == t.dataset.b; })[0]);
    else if (t.classList.contains('kj-back')) books();
    else if (t.tagName === 'A') dlg.close();
  });
  box.querySelector('.kj-pick').addEventListener('click', function () { books(); dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''); });
  box.querySelector('.kj-x').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  // open a reference passed in the address (?r=Жакан+3:16) from other pages
  var q = new URLSearchParams(location.search).get('r');
  if (q) { form.r.value = q; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
})();
