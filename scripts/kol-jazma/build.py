#!/usr/bin/env python3
"""Build every published form of «Олуя-пайгамбарлардын кол жазмасы» from one master file.

Master:  content/kol-jazma/master.md   (edit only this file)
Output:  kol-jazma/index.html, kol-jazma/book-NN.html, kol-jazma/glossary.html  (web reader)
         kol-jazma/files/  .epub  .docx  .pdf  .md                               (downloads)

Run from the repository root:
    python3 scripts/kol-jazma/build.py            # web reader + EPUB + Word + Markdown
    python3 scripts/kol-jazma/build.py --pdf      # also the PDF (needs LibreOffice; slow)
Needs pandoc 3 on the PATH.
"""
import html, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(ROOT, 'content', 'kol-jazma', 'master.md')
OUT = os.path.join(ROOT, 'kol-jazma')
FILES = os.path.join(OUT, 'files')
BASENAME = 'Oluya-paigambarlardyn-kol-jazmasy'
TITLE = 'Олуя-пайгамбарлардын кол жазмасы'
SITE = 'https://losttribesinstitute.com'
OT_COUNT = 39

esc = lambda s: html.escape(s, quote=True)


def read_master():
    with open(MASTER, encoding='utf-8') as f:
        text = f.read()
    # Proverbs uses raw <sup>N</sup>; pandoc markdown superscript works in every output format.
    return re.sub(r'<sup>([^<]*)</sup>', r'^\1^', text)


def split(text):
    lines = text.split('\n')
    # footnote definitions: "[^id]: ..." blocks at the end of the file
    defs, body = {}, []
    i = 0
    while i < len(lines):
        m = re.match(r'^\[\^([^\]]+)\]:', lines[i])
        if m:
            block = [lines[i]]
            i += 1
            while i < len(lines) and (lines[i].startswith('    ') or (lines[i] == '' and i + 1 < len(lines) and lines[i + 1].startswith('    '))):
                block.append(lines[i]); i += 1
            defs[m.group(1)] = '\n'.join(block)
            continue
        body.append(lines[i]); i += 1
    body = '\n'.join(body)
    parts = re.split(r'^<a id="(book\d+|glossary)"></a>\s*$', body, flags=re.M)
    front = parts[0]
    books, glossary = [], ''
    for key, chunk in zip(parts[1::2], parts[2::2]):
        if key == 'glossary':
            glossary = chunk.strip()
        else:
            books.append((int(key[4:]), chunk.strip()))
    return front.strip(), books, glossary, defs


def with_defs(md, defs):
    used = []
    for ref in re.findall(r'\[\^([^\]]+)\](?!:)', md):
        if ref in defs and ref not in used:
            used.append(ref)
    return md + ('\n\n' + '\n\n'.join(defs[r] for r in used) if used else '')


def pandoc_html(md):
    r = subprocess.run(['pandoc', '-f', 'markdown', '-t', 'html5', '--wrap=none'], input=md, capture_output=True, text=True, check=True)
    return r.stdout


def book_parts(num, chunk):
    title = re.search(r'^# (.+)$', chunk, flags=re.M).group(1).strip()
    chapters, used, n = [], set(), 0

    def tag(m):
        nonlocal n
        n += 1
        label = m.group(1).strip()
        nums = re.findall(r'\d+', label)
        first = int(nums[0]) if nums else n
        cid = f'c{first}'
        while cid in used:
            cid += 'b'
        used.add(cid)
        extra = [int(x) for x in nums[1:2]] if len(nums) > 1 and re.search(r'\d+\s*[-–]\s*\d+', label) else []
        chapters.append((cid, '–'.join(nums[:2]) if extra else str(first), [first] + extra))
        return f'## {label} {{#{cid}}}'
    chunk = re.sub(r'^## (.+)$', tag, chunk, flags=re.M)
    chunk = re.sub(r'^# .+$', '', chunk, count=1, flags=re.M).strip()
    return title, chunk, chapters


def verse_ids(body_html):
    """Give every verse an id like c3-v16 (prose: <p><strong>16</strong>, poetry: <sup>16</sup>)."""
    out, cur = [], 'c0'
    for part in re.split(r'(<h2 id="[^"]+")', body_html):
        m = re.match(r'<h2 id="([^"]+)"', part)
        if m:
            cur = m.group(1); out.append(part); continue
        part = re.sub(r'<p><strong>(\d+)</strong>', lambda v: f'<p id="{cur}-v{v.group(1)}"><strong>{v.group(1)}</strong>', part)
        part = re.sub(r'<sup>(\d+)</sup>', lambda v: f'<sup id="{cur}-v{v.group(1)}">{v.group(1)}</sup>', part)
        out.append(part)
    return ''.join(out)


def nice(title):
    """Title-case book names written in capitals, keeping the rest as written."""
    def fix(w):
        return w[:1] + w[1:].lower() if len(w) > 1 and w.isupper() else w
    return ' '.join(fix(w) for w in title.split(' '))


TOPBAR = ('<a class="skip" href="#main">Skip to content</a><div class="topbar"><div class="in"><a class="brand" href="/index.html">'
          '<img src="/images/brand/lti-mark-64.png" alt="" width="34" height="34"><b>Lost Tribes Institute</b><span>Est. 2024</span></a>'
          '<nav class="nav" aria-label="Main"><a href="/index.html">Home</a><a href="/map.html">Map</a><a href="/library.html" aria-current="page">Library</a>'
          '<a href="/essays.html">Essays</a><a href="/symposiums.html">Symposiums</a><a href="/books.html">Books</a><a href="/videos.html">Videos</a>'
          '<a href="/contact.html">Contact</a></nav></div></div>')

FOOTER = '''<footer class="foot"><div class="in">
  <div><p><b style="font-family:var(--display);font-weight:400;font-size:1.1rem;color:var(--ink)">Lost Tribes Institute</b></p>
  <p>A network of scholars connecting indigenous nations and others who say they descend from Israel's northern tribes. Lost Tribes Institute Corp. is a California nonprofit corporation founded June 24, 2024.</p>
  <p><a href="mailto:Richard@LostTribesInstitute.com">Richard@LostTribesInstitute.com</a></p></div>
  <div><h4>Explore</h4><ul><li><a href="/map.html">World map</a></li><li><a href="/library.html">Library</a></li><li><a href="/library.html?lang=ky">Kyrgyz works</a></li><li><a href="/essays.html">Essays</a></li><li><a href="/symposiums.html">Symposiums</a></li></ul></div>
  <div><h4>Elsewhere</h4><ul><li><a href="https://www.youtube.com/@LostTribesInstitute" rel="noopener">YouTube</a></li><li><a href="https://www.amazon.com/author/richardhewitt" rel="noopener">Books on Amazon</a></li></ul></div>
</div></footer>'''

CSS = '''<style>
.rd{max-width:44rem;margin:0 auto}
.rd-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin:6px 0 4px}
.rd-crumb{font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.rd-crumb a{text-decoration:none}
.rd-size{display:flex;gap:6px}
.rd-size button{font:600 14px var(--body);width:38px;height:34px;border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:4px;cursor:pointer}
.rd h1{font-size:clamp(1.7rem,6vw,2.4rem);line-height:1.15;margin:.3em 0 .4em}
.chaps{display:grid;grid-template-columns:repeat(auto-fill,minmax(3rem,1fr));gap:6px;margin:10px 0 26px;padding:0;list-style:none}
.chaps a{display:block;text-align:center;padding:8px 0;border:1px solid var(--rule);border-radius:4px;background:var(--surface);text-decoration:none;color:var(--ink);font-family:var(--mono);font-size:13.5px}
.chaps a:hover{border-color:var(--accent);color:var(--accent)}
.txt{font-size:calc(1.12rem * var(--rs,1));line-height:1.75}
.txt h2{font-size:1.25em;margin:2em 0 .5em;padding-top:.6em;border-top:1px solid var(--rule);scroll-margin-top:12px}
.txt h2 a.up{float:right;font:400 12px var(--mono);text-decoration:none;color:var(--ink-3);margin-top:.5em}
.txt p{margin:.45em 0}
.txt p strong:first-child{font-family:var(--mono);font-size:.72em;color:var(--accent);font-weight:500;vertical-align:.25em;margin-right:.15em}
.txt sup{color:var(--accent);font-size:.7em}
.txt em{color:var(--ink-2)}
.txt .footnotes{font-size:.85em;color:var(--ink-2);margin-top:3em}
.txt .footnotes hr{border:0;border-top:1px solid var(--rule)}
.pn{display:flex;justify-content:space-between;gap:12px;margin:3em 0 1em;padding-top:16px;border-top:2px solid var(--ink)}
.pn a{text-decoration:none;max-width:48%}
.pn small{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.blist{list-style:none;margin:0;padding:0;columns:2 16rem;column-gap:28px}
.blist li{break-inside:avoid;border-bottom:1px solid var(--rule)}
.blist a{display:flex;gap:10px;padding:9px 0;text-decoration:none;color:var(--ink)}
.blist a:hover{color:var(--accent)}
.blist b{font-family:var(--mono);font-weight:400;font-size:12px;color:var(--ink-3);min-width:1.8em;padding-top:3px}
.dl{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 8px}
.dl a{display:inline-flex;flex-direction:column;border:1px solid var(--rule);background:var(--surface);border-radius:5px;padding:9px 14px;text-decoration:none;color:var(--ink);font-weight:600;font-size:14.5px}
.dl a.main{background:var(--accent);border-color:var(--accent);color:var(--bg)}
.dl a small{font-weight:400;font-size:12px;opacity:.8}
.intro{font-size:1.02rem;color:var(--ink-2)}
.intro h2{font-size:1.25rem;color:var(--ink);margin-top:1.6em}
h2.sect{margin-top:2.2em}
.kj-go{margin:4px 0 14px}
.kj-form{display:flex;gap:6px;flex-wrap:wrap}
.kj-form input{flex:1 1 12rem;min-width:0;font:16px var(--body);color:var(--ink);background:var(--surface);border:1px solid var(--rule);border-radius:4px;padding:9px 11px}
.kj-form button{font:600 14px var(--body);border:1px solid var(--ink);background:var(--ink);color:var(--bg);border-radius:4px;padding:9px 14px;cursor:pointer}
.kj-form .kj-pick{background:var(--surface);color:var(--ink);border-color:var(--rule)}
.kj-msg{font-size:14px;color:var(--accent);margin:6px 0 0}
.kj-dlg{width:min(40rem,94vw);max-height:86vh;border:1px solid var(--rule);border-radius:8px;padding:0;background:var(--bg);color:var(--ink)}
.kj-dlg::backdrop{background:rgba(0,0,0,.45)}
.kj-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--rule);position:sticky;top:0;background:var(--bg)}
.kj-head button{border:0;background:none;font-size:18px;cursor:pointer;color:var(--ink)}
.kj-body{padding:8px 16px 18px}
.kj-body h3{font-size:13px;font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin:14px 0 8px}
.kj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr));gap:6px}
.kj-grid button,.kj-grid a{font:14px var(--body);text-align:left;padding:8px 10px;border:1px solid var(--rule);border-radius:4px;background:var(--surface);color:var(--ink);cursor:pointer;text-decoration:none}
.kj-nums{grid-template-columns:repeat(auto-fill,minmax(3rem,1fr))}
.kj-nums a{text-align:center;font-family:var(--mono)}
.kj-grid button:hover,.kj-grid a:hover{border-color:var(--accent);color:var(--accent)}
.kj-back{border:0;background:none;color:var(--accent);font:500 14px var(--body);cursor:pointer;padding:8px 0}
.txt :target{background:var(--accent-soft);border-radius:3px;box-shadow:0 0 0 4px var(--accent-soft)}
.txt [id^="c"]{scroll-margin-top:16px}
</style>
<script>try{var r=localStorage.getItem('kj-size');if(r)document.documentElement.style.setProperty('--rs',r);}catch(e){}</script>'''

SIZE_JS = '''<script>document.querySelectorAll('[data-rs]').forEach(function(b){b.addEventListener('click',function(){var s=getComputedStyle(document.documentElement).getPropertyValue('--rs')||1;s=Math.min(1.6,Math.max(.8,(parseFloat(s)||1)+parseFloat(b.dataset.rs)));document.documentElement.style.setProperty('--rs',s.toFixed(2));try{localStorage.setItem('kj-size',s.toFixed(2));}catch(e){}});});</script>'''


def page(title, desc, path, body, size_controls=False):
    canon = SITE + '/kol-jazma/' + path.replace('.html', '').replace('index', '')
    return f'''<!doctype html><html lang="ky"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{canon}">
<meta property="og:type" content="book"><meta property="og:site_name" content="Lost Tribes Institute"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canon}"><meta property="og:image" content="{SITE}/images/brand/lti-banner.jpg">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/images/brand/lti-mark-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">{CSS}</head><body>
{TOPBAR}
<main id="main"><div class="wrap"><div class="rd">
<div id="kj-go" class="kj-go"></div>
{body}
</div></div></main>
{FOOTER}
{SIZE_JS if size_controls else ''}
<script src="books.js"></script><script src="nav.js" defer></script>
</body></html>
'''


def size_bar(crumb):
    return (f'<div class="rd-top"><div class="rd-crumb">{crumb}</div>'
            '<div class="rd-size" role="group" aria-label="Текстин өлчөмү"><button type="button" data-rs="-0.1" aria-label="Кичирээк">A−</button>'
            '<button type="button" data-rs="0.1" aria-label="Чоңураак">A+</button></div></div>')


def fmt_size(path):
    n = os.path.getsize(path)
    return f'{n / 1048576:.1f} MB' if n >= 1048576 else f'{max(1, round(n / 1024))} KB'


def build_reader(front, books, glossary, defs):
    os.makedirs(OUT, exist_ok=True)
    info = []
    for num, chunk in books:
        title, md, chapters = book_parts(num, chunk)
        info.append((num, title, md, chapters))
    home = '<a href="index.html">Кол жазма</a>'
    for i, (num, title, md, chapters) in enumerate(info):
        body_html = verse_ids(pandoc_html(with_defs(md, defs)))
        for cid, lbl, nums in chapters:
            for extra in nums[1:]:
                body_html = body_html.replace(f'<h2 id="{cid}">', f'<span id="c{extra}"></span><h2 id="{cid}">', 1)
        body_html = re.sub(r'<h2 id="(c\d+b*)">(.*?)</h2>', r'<h2 id="\1">\2<a class="up" href="#top" aria-label="Башына">↑</a></h2>', body_html)
        chaps = ''
        if len(chapters) > 1:
            chaps = '<ul class="chaps" aria-label="Бөлүмдөр">' + ''.join(f'<li><a href="#{cid}">{esc(lbl)}</a></li>' for cid, lbl, _ in chapters) + '</ul>'
        prev_ = info[i - 1] if i > 0 else None
        next_ = info[i + 1] if i + 1 < len(info) else None
        pn = '<nav class="pn" aria-label="Китептер">'
        pn += f'<a href="book-{prev_[0]:02d}.html"><small>← Мурунку китеп</small>{esc(nice(prev_[1]))}</a>' if prev_ else '<span></span>'
        pn += f'<a href="book-{next_[0]:02d}.html" style="text-align:right"><small>Кийинки китеп →</small>{esc(nice(next_[1]))}</a>' if next_ else '<a href="index.html" style="text-align:right"><small>Мазмуну →</small>Бардык китептер</a>'
        pn += '</nav>'
        testament = 'Байыркы Келишим' if num <= OT_COUNT else 'Жаңы Келишим'
        body = (size_bar(f'{home} · {testament}') + f'<h1 id="top">{esc(nice(title))}</h1>' + chaps
                + f'<div class="txt">{body_html}</div>' + pn)
        write(f'book-{num:02d}.html', page(f'{nice(title)} — {TITLE}', f'{nice(title)}: {TITLE}, кыргызча котормо.', f'book-{num:02d}.html', body, True))
    # glossary
    g = re.sub(r'^# .+$', '', glossary, count=1, flags=re.M)
    body = size_bar(home) + '<h1 id="top">Сөздүк / Негизги терминдер</h1>' + f'<div class="txt">{pandoc_html(g)}</div>'
    write('glossary.html', page(f'Сөздүк — {TITLE}', 'Котормодогу негизги терминдердин түшүндүрмөсү.', 'glossary.html', body, True))
    # index
    intro = re.sub(r'^# .+$', '', front, count=1, flags=re.M)
    intro = re.split(r'^## Мазмуну\s*$', intro, flags=re.M)[0]
    intro = intro.replace('](#glossary)', '](glossary.html)')
    intro = re.sub(r'\]\(#book(\d+)\)', lambda m: f'](book-{int(m.group(1)):02d}.html)', intro)
    lst = lambda rows: '<ol class="blist">' + ''.join(f'<li><a href="book-{n:02d}.html"><b>{n}</b>{esc(nice(t))}</a></li>' for n, t, _, _ in rows) + '</ol>'
    f = lambda ext: f'files/{BASENAME}.{ext}'
    dl = ['<div class="dl">',
          f'<a class="main" href="book-01.html">Онлайн окуу<small>телефон, планшет, компьютер</small></a>']
    for ext, label, note in [('epub', 'EPUB', 'Apple Books, Google Play Books, Kindle'), ('pdf', 'PDF', 'басып чыгаруу үчүн'), ('docx', 'Word', '.docx'), ('md', 'Markdown', '.md')]:
        p = os.path.join(OUT, f(ext))
        if os.path.exists(p):
            dl.append(f'<a href="{f(ext)}" download>{label}<small>{note} · {fmt_size(p)}</small></a>')
    dl.append('</div>')
    body = (f'<p class="eyebrow">Library · Кыргызча</p><h1 id="top">{TITLE}</h1>'
            '<p class="lead">Ыйык Жазуунун кыргызча котормосу: Байыркы Келишим жана Жаңы Келишим, 66 китеп.</p>'
            + ''.join(dl)
            + f'<h2 class="sect">Байыркы Келишим</h2>{lst([x for x in info if x[0] <= OT_COUNT])}'
            + f'<h2 class="sect">Жаңы Келишим</h2>{lst([x for x in info if x[0] > OT_COUNT])}'
            + '<p style="margin-top:1.5em"><a href="glossary.html">Сөздүк / Негизги терминдер →</a></p>'
            + f'<div class="intro">{pandoc_html(intro)}</div>')
    write('index.html', page(TITLE, 'Ыйык Жазуунун кыргызча котормосу: 66 китеп, онлайн окуу жана жүктөп алуу (EPUB, PDF, Word).', 'index.html', body, True))
    rows = [l.split('\t') for l in open(os.path.join(HERE, 'books.tsv'), encoding='utf-8').read().strip().split('\n')]
    data = []
    for (num, title, md, chapters), (grp, short, ky, en) in zip(info, rows):
        nums = sorted({x for _, _, ns in chapters for x in ns})
        aliases = [a.strip() for a in (ky + '|' + en).split('|') if a.strip()]
        data.append({'n': num, 'g': int(grp), 't': short, 'a': aliases, 'c': nums})
    write('books.js', 'window.KJ=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    shutil.copyfile(os.path.join(HERE, 'nav.js'), os.path.join(OUT, 'nav.js'))
    return info


def write(name, content):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(content)


def pandoc_ready(text):
    """Master markdown with the HTML anchors turned into pandoc header ids (for EPUB and Word)."""
    text = re.sub(r'^<a id="(book\d+|glossary)"></a>\s*\n+# (.+)$', r'# \2 {#\1}', text, flags=re.M)
    return text


def build_files(text, pdf):
    os.makedirs(FILES, exist_ok=True)
    shutil.copyfile(MASTER, os.path.join(FILES, BASENAME + '.md'))
    src = pandoc_ready(text)
    # The master's first line is the book title; EPUB/Word take the title from metadata instead.
    src = re.sub(r'^# ОЛУЯ-ПАЙГАМБАРЛАРДЫН КОЛ ЖАЗМАСЫ\s*\n', '', src, count=1)
    with tempfile.TemporaryDirectory() as tmp:
        md = os.path.join(tmp, 'src.md')
        with open(md, 'w', encoding='utf-8') as f:
            f.write(src)
        meta = ['--metadata', f'title={TITLE}', '--metadata', 'lang=ky', '--metadata', 'author=Lost Tribes Institute']
        epub = os.path.join(FILES, BASENAME + '.epub')
        subprocess.run(['pandoc', md, '-f', 'markdown', '-o', epub, '--toc', '--toc-depth=2', '--split-level=1',
                        '--css', os.path.join(HERE, 'epub.css')] + meta, check=True)
        docx = os.path.join(FILES, BASENAME + '.docx')
        subprocess.run(['pandoc', md, '-f', 'markdown', '-t', 'docx', '--reference-doc', os.path.join(HERE, 'ref.docx'), '-o', docx] + meta, check=True)
        subprocess.run([sys.executable, '-I', os.path.join(HERE, 'fix_docx.py'), docx], check=True)
        if pdf:
            subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmp, docx], check=True, capture_output=True)
            shutil.move(os.path.join(tmp, BASENAME + '.pdf'), os.path.join(FILES, BASENAME + '.pdf'))


def update_sitemap(info):
    p = os.path.join(ROOT, 'sitemap.xml')
    with open(p, encoding='utf-8') as f:
        sm = f.read()
    sm = re.sub(r'\n  <url><loc>[^<]*/kol-jazma/[^<]*</loc></url>', '', sm)
    urls = [f'{SITE}/kol-jazma/', f'{SITE}/kol-jazma/glossary'] + [f'{SITE}/kol-jazma/book-{n:02d}' for n, _, _, _ in info]
    sm = sm.replace('</urlset>', ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>')
    with open(p, 'w', encoding='utf-8') as f:
        f.write(sm)


if __name__ == '__main__':
    text = read_master()
    front, books, glossary, defs = split(text)
    assert len(books) == 66, f'expected 66 books, found {len(books)}'
    build_files(text, '--pdf' in sys.argv)
    info = build_reader(front, books, glossary, defs)
    update_sitemap(info)
    print(f'Built {len(info)} book pages, glossary, index and downloads in kol-jazma/')
