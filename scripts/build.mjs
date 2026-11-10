// Builds the site into dist/: copies the hand-made pages, then turns every
// essay in content/essays/*.md into its own page plus the Essays list
// (newest first). Netlify runs this on every change pushed to GitHub.
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import yaml from 'js-yaml';

marked.use(markedFootnote({ description: 'Notes' }));

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://losttribesinstitute.com';
const SKIP = new Set(['dist', 'node_modules', 'content', 'scripts', '.git', '.github', 'package.json', 'package-lock.json', 'netlify.toml', '.gitignore', 'README.md']);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 1. Copy the static site
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

// 2. Read essays
const dir = path.join(ROOT, 'content', 'essays');
const essays = [];
const redirects = [];
for (const file of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
  if (!file.endsWith('.md')) continue;
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = m ? (yaml.load(m[1]) || {}) : {};
  const body = m ? m[2] : raw;
  if (data.draft) continue;
  const date = data.date ? new Date(data.date) : null;
  if (!data.title || !date || isNaN(date)) { console.warn(`Skipping ${file}: needs a title and a date`); continue; }
  const fileSlug = file.replace(/\.md$/, '');
  // Web-safe address: no apostrophes, accents or other characters that break links on X and other sites
  const slug = fileSlug.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug !== fileSlug) redirects.push(`/essays/${encodeURI(fileSlug)}  /essays/${slug}  301`, `/essays/${encodeURI(fileSlug)}.html  /essays/${slug}  301`);
  essays.push({ slug, title: String(data.title), date, author: data.author || 'Richard Hewitt (Risbek)', summary: data.summary || '', layout: data.layout || '', html: marked.parse(body) });
}
essays.sort((a, b) => b.date - a.date || a.title.localeCompare(b.title));

// 3. Page shell taken from library.html so header and footer always match the rest of the site
const lib = fs.readFileSync(path.join(ROOT, 'library.html'), 'utf8');
const abs = s => s.replace(/(href|src)="(?!https?:|mailto:|#|\/)([^"]+)"/g, '$1="/$2"');
const topbar = abs(lib.match(/<div class="topbar">[\s\S]*?<\/nav><\/div><\/div>/)[0])
  .replace(' aria-current="page"', '')
  .replace('<a href="/essays.html">', '<a href="/essays.html" aria-current="page">');
const footer = abs(lib.match(/<footer class="foot">[\s\S]*?<\/footer>/)[0]);
const fmt = d => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const iso = d => d.toISOString().slice(0, 10);

// Share buttons under each essay
const shareRow = e => {
  const u = encodeURIComponent(`${SITE}/essays/${e.slug}`), t = encodeURIComponent(e.title);
  const links = [
    ['X', `https://x.com/intent/post?text=${t}&url=${u}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['WhatsApp', `https://wa.me/?text=${t}%20${u}`],
    ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`],
    ['Email', `mailto:?subject=${t}&body=${u}`],
  ];
  return `<div class="share" aria-label="Share this essay"><span class="share-h">Share</span>${links.map(([n, h]) => `<a href="${h}"${n === 'Email' ? '' : ' target="_blank" rel="noopener"'}>${n}</a>`).join('')}<button type="button" class="share-copy" data-url="${SITE}/essays/${e.slug}">Copy link</button></div>`;
};
const shareScript = `<script>document.querySelectorAll('.share-copy').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.url);b.textContent='Link copied';}catch(_){prompt('Copy this link:',b.dataset.url);}setTimeout(()=>b.textContent='Copy link',2500);}));</script>`;

const page = ({ title, desc, url, body, type = 'website' }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${url}"><meta property="og:type" content="${type}"><meta property="og:site_name" content="Lost Tribes Institute"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${url}"><meta property="og:image" content="${SITE}/images/brand/lti-banner.jpg"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/images/brand/lti-mark-180.png"><link rel="alternate" type="application/rss+xml" title="Lost Tribes Institute essays" href="/essays.xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/site.css"><style>
.es-list{list-style:none;margin:28px 0 0;padding:0;border-top:2px solid var(--ink)}
.es-item{display:grid;grid-template-columns:minmax(0,11rem) minmax(0,1fr);gap:4px 28px;padding:24px 0;border-bottom:1px solid var(--rule)}
.es-item time{font-family:var(--mono);font-size:12.5px;color:var(--accent);padding-top:6px}
.es-item h2{font-size:1.45rem;margin:0 0 6px}
.es-item h2 a{color:var(--ink);text-decoration:none}
.es-item h2 a:hover{color:var(--accent)}
.es-item p{margin:0;color:var(--ink-2);max-width:66ch}
.es-item .by{font-size:13.5px;color:var(--ink-3);margin-top:6px}
.es-item.latest h2{font-size:1.9rem}
@media (max-width:720px){.es-item{grid-template-columns:1fr}.es-item time{padding-top:0}}
.essay{max-width:44rem;margin:0 auto}
.essay.essay-wide{max-width:60rem}
.essay .dateline{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin:0 0 28px}
.essay .body{font-size:1.08rem;line-height:1.75;overflow-wrap:anywhere}
.essay .body .footnotes{font-size:.95rem;border-top:1px solid var(--rule);margin-top:40px}
.essay .body h2{margin:36px 0 10px}.essay .body h3{margin:28px 0 8px}
.essay .body blockquote{margin:22px 0;padding:4px 0 4px 18px;border-left:3px solid var(--accent);color:var(--ink-2)}
.essay .body img{max-width:100%;height:auto;border-radius:4px;display:block;margin:0 auto 6px}
.essay .body table{border-collapse:collapse;display:block;overflow-x:auto}
.essay .body td,.essay .body th{border:1px solid var(--rule);padding:6px 10px}
.essay .body pre{overflow-x:auto}
.share{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:40px;padding-top:18px;border-top:1px solid var(--rule)}
.share-h{font-family:var(--mono);font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-right:4px}
.share a,.share button{font:inherit;font-size:14px;color:var(--accent);background:none;border:1px solid currentColor;border-radius:999px;padding:4px 12px;text-decoration:none;cursor:pointer}
.share a:hover,.share button:hover{background:var(--accent);color:var(--surface,#fff)}
.share + .pager{margin-top:24px}
.pager{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;border-top:1px solid var(--rule);margin-top:48px;padding-top:18px;font-size:15px}
.empty{color:var(--ink-2);margin-top:28px}
</style></head><body>
<a class="skip" href="#main">Skip to content</a>${topbar}
<main id="main"><div class="wrap">${body}</div></main>
${footer}
${body.includes('share-copy') ? shareScript : ''}
</body></html>
`;

// 4. Essays list
const list = essays.length
  ? `<ol class="es-list" reversed>${essays.map((e, i) => `<li class="es-item${i === 0 ? ' latest' : ''}"><time datetime="${iso(e.date)}">${fmt(e.date)}</time><div><h2><a href="/essays/${e.slug}.html">${esc(e.title)}</a></h2>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}<div class="by">${esc(e.author)}</div></div></li>`).join('')}</ol>`
  : '<p class="empty">The first essay is on its way. Check back soon.</p>';
fs.writeFileSync(path.join(OUT, 'essays.html'), page({
  title: 'Essays — Lost Tribes Institute',
  desc: 'Short essays from the Lost Tribes Institute on peoples who trace their descent to ancient Israel, newest first.',
  url: '/essays',
  body: `<p class="eyebrow">Essays</p><h1>Essays</h1><p class="lead">Short pieces from the Institute's ongoing research, newest first. <a href="/essays.xml">Follow by RSS</a>.</p>${list}`,
}));

// 5. One page per essay
fs.mkdirSync(path.join(OUT, 'essays'), { recursive: true });
essays.forEach((e, i) => {
  const newer = essays[i - 1], older = essays[i + 1];
  const pager = `<nav class="pager" aria-label="More essays"><span>${older ? `← <a href="/essays/${older.slug}.html">${esc(older.title)}</a>` : ''}</span><span>${newer ? `<a href="/essays/${newer.slug}.html">${esc(newer.title)}</a> →` : '<a href="/essays.html">All essays</a>'}</span></nav>`;
  fs.writeFileSync(path.join(OUT, 'essays', `${e.slug}.html`), page({
    title: `${e.title} — Lost Tribes Institute`,
    desc: e.summary || e.title,
    url: `/essays/${e.slug}`,
    type: 'article',
    // layout: wide lets an essay (such as a reading list) bring its own full-width header
    body: e.layout === 'wide' ? `<article class="essay essay-wide"><div class="body">${e.html}</div>${shareRow(e)}${pager}</article>` : `<article class="essay"><p class="eyebrow"><a href="/essays.html" style="text-decoration:none">Essays</a></p><h1>${esc(e.title)}</h1><p class="dateline"><time datetime="${iso(e.date)}">${fmt(e.date)}</time> · ${esc(e.author)}</p><div class="body">${e.html}</div>${shareRow(e)}${pager}</article>`,
  }));
});

// 5b. Works page: everything by Richard Hewitt (Risbek) in one list, from assets/works.json + library.json + essays
const worksPath = path.join(ROOT, 'assets', 'works.json');
if (fs.existsSync(worksPath)) {
  const works = JSON.parse(fs.readFileSync(worksPath, 'utf8'));
  const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'library.json'), 'utf8'));
  const byId = new Map(library.map(e => [e.id, e]));
  const norm = s => { try { return decodeURIComponent(s).replace(/^\//, ''); } catch { return s.replace(/^\//, ''); } };
  const mine = e => /Hewitt|Risbek/.test(e.author || '');
  const myEssays = essays.filter(mine);
  // essay pages that offer a given PDF, so a paper can link to its readable page
  const essayForFile = new Map();
  for (const e of myEssays) for (const m of e.html.matchAll(/href="(\/papers\/[^"]+)"/g)) essayForFile.set(norm(m[1]), e);
  const host = u => /amazon\./.test(u) ? 'Amazon' : /academia\.edu/.test(u) ? 'Academia.edu' : /scribd\.com/.test(u) ? 'Scribd' : /youtu/.test(u) ? 'YouTube' : 'Link';
  const used = new Set();
  const shownEssays = new Set();
  const row = it => {
    const lib = it.lib ? byId.get(it.lib) : null;
    if (it.lib && !lib) { console.warn(`works.json: no library entry ${it.lib}`); return ''; }
    if (lib) used.add(lib.id);
    const title = it.title || lib.title;
    const year = it.year ?? lib?.year;
    const note = it.note ?? lib?.note ?? '';
    const links = [];
    const essay = lib?.file ? essayForFile.get(norm(lib.file)) : null;
    if (essay) { links.push({ label: 'Read here', url: `/essays/${essay.slug}.html` }); shownEssays.add(essay.slug); }
    if (lib?.file) links.push({ label: 'PDF', url: '/' + lib.file, dl: true });
    if (lib?.url) links.push({ label: host(lib.url), url: lib.url });
    for (const l of it.links || []) if (!links.some(x => x.url === l.url)) links.push(l);
    const main = links[0];
    const author = lib && lib.author && lib.author !== 'Richard Hewitt (Risbek)' ? `<span class="wk-by">${esc(lib.author)}</span>` : '';
    const cover = it.cover ? `<a class="wk-cover" href="${esc(main?.url || '#')}"${main && /^https?:/.test(main.url) ? ' rel="noopener"' : ''} tabindex="-1" aria-hidden="true"><img src="${esc(it.cover)}" alt="" width="64" loading="lazy" decoding="async"></a>` : '';
    return `<li class="wk-item${cover ? ' has-cover' : ''}">${cover}<div class="wk-main"><h3><a href="${esc(main?.url || '#')}"${main && /^https?:/.test(main.url) ? ' rel="noopener"' : ''}>${esc(title)}</a></h3>${year ? `<span class="wk-year">${esc(year)}</span>` : ''}${note ? `<p>${esc(note)}</p>` : ''}${author}</div><div class="wk-links">${links.map(l => `<a href="${esc(l.url)}"${l.dl ? ' download' : /^https?:/.test(l.url) ? ' rel="noopener"' : ''}>${esc(l.label)}</a>`).join('')}</div></li>`;
  };
  // Bookshop cards: books on Amazon (shop) and free downloads (free)
  const splitTitle = t => { const i = t.indexOf(': '); return i > 0 ? [t.slice(0, i), t.slice(i + 2)] : [t, '']; };
  const formatsOf = note => ['Kindle', 'Paperback', 'Hardcover', 'Audiobook'].filter(f => new RegExp(f, 'i').test(note || ''));
  const shopItems = [];
  const card = (it, sec, big = false) => {
    const lib = byId.get(it.lib);
    if (!lib) { console.warn(`works.json: no library entry ${it.lib}`); return ''; }
    used.add(lib.id);
    const [title, sub] = splitTitle(it.title || lib.title);
    const note = it.note ?? lib.note ?? '';
    const formats = formatsOf(note);
    const series = (note.match(/(Jesus in All Nations series|Semetey series|Symposiums of the Lost Tribes Institute, Book \d)/) || [])[1] || '';
    const links = [];
    if (lib.file) links.push({ label: 'Free PDF', url: '/' + lib.file, dl: true });
    if (lib.url) links.push({ label: /amazon\./.test(lib.url) ? 'Buy on Amazon' : host(lib.url), url: lib.url });
    for (const l of it.links || []) if (!links.some(x => x.url === l.url)) links.push(l);
    const main = links[0];
    const ext = u => /^https?:/.test(u) ? ' rel="noopener"' : '';
    const img = it.coverLarge || it.cover;
    const blurb = it.blurb || (sec.free ? note : '');
    if (sec.shop && !big) shopItems.push({ title: it.title || lib.title, url: lib.url, img, blurb });
    return `<li class="bk${big ? ' bk-big' : ''}" data-tags="${esc((it.tags || []).join(' '))}">
<a class="bk-cover" href="${esc(main.url)}"${ext(main.url)} tabindex="-1" aria-hidden="true">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : `<span class="bk-nocover">${esc(title)}</span>`}</a>
<div class="bk-body">${series ? `<span class="kicker">${esc(series)}</span>` : ''}<h3><a href="${esc(main.url)}"${ext(main.url)}>${esc(title)}</a></h3>${sub ? `<p class="bk-sub">${esc(sub)}</p>` : ''}${blurb ? `<p class="bk-blurb">${esc(blurb)}</p>` : ''}
${formats.length ? `<ul class="bk-formats" aria-label="Formats">${formats.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
<div class="bk-buy">${links.map((l, i) => `<a class="${i === 0 ? 'btn primary' : 'bk-alt'}" href="${esc(l.url)}"${l.dl ? ' download' : ext(l.url)}>${esc(l.label)}</a>`).join('')}</div></div></li>`;
  };
  const isCard = (s, it) => (s.shop || s.free) && it.lib && /^book-/.test(it.lib);
  const sections = works.sections.map(s => ({ ...s, html: s.items.filter(it => isCard(s, it)).map(it => card(it, s)).join('') || s.items.map(row).join(''), rows: s.shop || s.free ? s.items.filter(it => !isCard(s, it)).map(row).join('') : '' }));
  const allShop = works.sections.filter(s => s.shop).flatMap(s => s.items.map(it => [it, s]));
  const featured = (works.featured || []).map(id => allShop.find(([it]) => it.lib === id)).filter(Boolean).map(([it, s]) => card(it, s, true)).join('');
  // essays section (all essays by him, newest first)
  const restEssays = myEssays.filter(e => !shownEssays.has(e.slug));
  const essaysHtml = restEssays.map(e => `<li class="wk-item"><div class="wk-main"><h3><a href="/essays/${e.slug}.html">${esc(e.title)}</a></h3><span class="wk-year">${fmt(e.date)}</span>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}</div><div class="wk-links"><a href="/essays/${e.slug}.html">Read here</a></div></li>`).join('');
  sections.splice(sections.findIndex(s => s.id === 'papers') + 1, 0, { id: 'essays', title: 'Essays', intro: 'Written for this site, newest first. Papers that can be read here are listed above.', html: essaysHtml, items: restEssays });
  const missing = library.filter(e => mine(e) && !used.has(e.id));
  if (missing.length) console.warn('works.json does not list:', missing.map(e => e.id).join(', '));
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const shopSecs = sections.filter(s => s.shop), freeSecs = sections.filter(s => s.free), restSecs = sections.filter(s => !s.shop && !s.free);
  const nBooks = shopSecs.reduce((n, s) => n + s.items.length, 0);
  const shelves = works.shelves || [];
  const filter = shelves.length ? `<div class="bk-filter" role="group" aria-label="Browse by shelf"><button type="button" class="on" data-shelf="">All books</button>${shelves.map(([id, label]) => `<button type="button" data-shelf="${esc(id)}">${esc(label)}</button>`).join('')}</div>` : '';
  const toc = restSecs.map(s => `<a href="#${s.id}">${esc(s.title)} <b>${s.items.length}</b></a>`).join('');
  const body = `<header class="shop-hero"><div><p class="eyebrow">Bookshop</p><h1>Books by Richard Hewitt (Risbek)</h1><p class="lead">History, Scripture and the oral traditions of Asia, written from nineteen years in Kyrgyzstan and from symposiums across the continent. ${nBooks} books in print, Kindle and audio, and a free reading room of books, papers and essays.</p>
<p class="shop-cta"><a class="btn primary" href="#shelves">Browse the shelves</a><a class="btn" href="#kyrgyz-russian">Free reading room</a></p></div></header>
${featured ? `<section class="wk-sec" id="start-here"><div class="section-head"><h2>Start here</h2><span class="muted">Three books that open the subject</span></div><ul class="bk-grid bk-featured">${featured}</ul></section>` : ''}
<section class="wk-sec" id="shelves"><div class="section-head"><h2>The shelves</h2><a href="${esc(works.elsewhere[0].url)}" rel="noopener">Amazon author page →</a></div>
${filter}
${shopSecs.map(s => `<div class="shelf" id="${s.id}"><h3 class="shelf-h">${esc(s.title)}</h3>${s.intro ? `<p class="muted">${esc(s.intro)}</p>` : ''}<ul class="bk-grid">${s.html}</ul></div>`).join('\n')}
<p class="bk-none muted" hidden>No books on this shelf yet.</p>
<p class="muted shop-note">Books are sold and shipped by Amazon, where you will find current prices for each format.</p>
<p class="shop-net"><span><b>More from the LTI network.</b> Books by Howard Ha-Sung Chung, Mikkel S. Kragh, Arimasa Kubo and Susanne Ratcliffe are on the Institute's Books page.</span><a class="btn" href="/books.html#network">Books from the LTI network</a></p></section>
<aside class="shop-band"><div><h2>For classes, libraries and reading groups</h2><p>Teaching a course on biblical history, Central Asia or world religions, or choosing the next book for a study group? Write to Richard about using these books, or about a talk for your class or group.</p></div><a class="btn" href="/contact.html">Write to Richard</a></aside>
${freeSecs.map(s => `<section class="wk-sec" id="${s.id}"><div class="section-head"><h2>Free reading room: ${esc(s.title.replace(/^In /, 'in '))}</h2></div>${s.intro ? `<p class="muted">${esc(s.intro)}</p>` : ''}<ul class="bk-grid bk-free">${s.html}</ul>${s.rows ? `<h3 class="shelf-h" style="margin-top:30px">Shorter pieces</h3><ul class="wk-list">${s.rows}</ul>` : ''}</section>`).join('\n')}
<section class="wk-sec" id="study"><div class="section-head"><h2>From the study</h2></div><p class="muted">Papers, essays, screenplays and talks, free to read and watch.</p><nav class="wk-toc" aria-label="Sections">${toc}</nav></section>
${restSecs.map(s => `<section class="wk-sec" id="${s.id}"><div class="section-head"><h2>${esc(s.title)}</h2></div>${s.intro ? `<p class="muted">${esc(s.intro)}</p>` : ''}<ul class="wk-list">${s.html}</ul></section>`).join('\n')}
<p class="muted" style="margin-top:40px">Also on ${works.elsewhere.map(l => `<a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a>`).join(', ')}.</p>
<script>(function(){var bs=document.querySelectorAll('.bk-filter button');if(!bs.length)return;var none=document.querySelector('.bk-none');bs.forEach(function(b){b.setAttribute('aria-pressed',b.classList.contains('on'));b.addEventListener('click',function(){var t=b.dataset.shelf,n=0;bs.forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});document.querySelectorAll('#shelves .shelf').forEach(function(sh){var v=0;sh.querySelectorAll('.bk').forEach(function(k){var ok=!t||(' '+k.dataset.tags+' ').indexOf(' '+t+' ')>-1;k.hidden=!ok;if(ok)v++});sh.hidden=!v;n+=v});none.hidden=n>0})})})();</script>
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Books by Richard Hewitt (Risbek)', itemListElement: shopItems.map((b, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Book', name: b.title, author: { '@type': 'Person', name: 'Richard Hewitt (Risbek)' }, publisher: { '@type': 'Organization', name: 'Lost Tribes Institute' }, url: b.url, ...(b.img ? { image: SITE + b.img } : {}), ...(b.blurb ? { description: b.blurb } : {}) } })) }).replace(/</g, '\\u003c')}</script>`;
  const css = `<style>
.shop-hero{background:var(--deep);color:var(--on-deep);border-radius:8px;padding:clamp(28px,5vw,56px)}
.shop-hero h1{color:var(--on-deep)}.shop-hero .eyebrow{color:#E59A6B}
.shop-hero .lead{color:var(--on-deep);opacity:.86}
.shop-cta{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 0}
.shop-hero .btn{border-color:var(--on-deep);color:var(--on-deep)}
.shop-hero .btn.primary{background:var(--on-deep);color:var(--deep)}
.shop-hero .btn:hover{background:#E59A6B;border-color:#E59A6B;color:#17232B}
.wk-sec{margin-top:52px;scroll-margin-top:80px}
.shelf{margin-top:30px;scroll-margin-top:80px}
.shelf-h{font-size:1.25rem;margin:0 0 4px}
.shelf>.muted{margin:0;font-size:15px}
.bk-filter{display:flex;flex-wrap:wrap;gap:8px}
.bk-filter button{font:500 14px var(--body);color:var(--ink);background:var(--surface);border:1px solid var(--rule);border-radius:999px;padding:7px 14px;cursor:pointer}
.bk-filter button:hover{border-color:var(--accent)}
.bk-filter button.on{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.bk-grid{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))}
.bk{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:14px;min-width:0}
.bk[hidden]{display:none}
.bk-cover{display:flex;align-items:center;justify-content:center;height:250px;background:var(--bg);border-radius:4px;padding:14px}
.bk-cover img{max-height:100%;max-width:100%;width:auto;height:auto;box-shadow:0 3px 14px rgba(0,0,0,.25);transition:transform .3s ease}
.bk-cover:hover img{transform:translateY(-4px)}
.bk-nocover{font-family:var(--display);text-align:center;color:var(--ink-2)}
.bk-body{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.bk h3{font-size:1.14rem}.bk h3 a{color:var(--ink);text-decoration:none}.bk h3 a:hover{color:var(--accent)}
.bk-sub{margin:0;font-size:14px;color:var(--ink-2);font-style:italic}
.bk-blurb{margin:2px 0 0;font-size:14.5px;color:var(--ink-2)}
.bk-formats{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:5px}
.bk-formats li{font-family:var(--mono);font-size:11px;letter-spacing:.03em;color:var(--ink-2);border:1px solid var(--rule);border-radius:3px;padding:1px 6px}
.bk-buy{margin-top:auto;padding-top:10px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
.bk-buy .btn{padding:9px 14px;font-size:14px}
.bk-alt{font-size:13.5px}
.bk-featured{grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr))}
.bk-big{flex-direction:row;padding:20px;border-color:var(--ink)}
.bk-big .bk-cover{flex:0 0 132px;height:auto;min-height:200px;padding:0;background:none;align-items:flex-start}
.bk-big h3{font-size:1.3rem}
.bk-free .bk-cover{height:190px}
.shop-note{font-size:14px;margin-top:22px}
.shop-net{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 28px;margin:22px 0 0;padding:18px 20px;border:1px solid var(--rule);border-radius:6px;background:var(--surface)}
.shop-net span{max-width:62ch;color:var(--ink-2)}.shop-net b{color:var(--ink)}
.shop-band{margin-top:52px;background:var(--accent-soft);border-radius:8px;padding:clamp(22px,4vw,36px);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px 32px}
.shop-band h2{font-size:1.45rem}.shop-band p{margin:0;max-width:60ch;color:var(--ink-2)}
.shop-band .btn{flex:none}
.wk-toc{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.wk-toc a{border:1px solid var(--rule);border-radius:999px;padding:5px 12px;font-size:14px;text-decoration:none;color:var(--ink)}
.wk-toc a b{font-family:var(--mono);font-weight:500;color:var(--accent);margin-left:4px}
.wk-list{list-style:none;margin:8px 0 0;padding:0}
.wk-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 24px;padding:14px 0;border-bottom:1px solid var(--rule)}
.wk-item.has-cover{grid-template-columns:64px minmax(0,1fr) auto}
.wk-cover{display:block;width:64px;align-self:start}
.wk-cover img{display:block;width:64px;height:auto;max-height:100px;object-fit:cover;object-position:top;border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.18);background:var(--rule)}
.wk-item h3{display:inline;font-size:1.12rem;margin:0}
.wk-item h3 a{color:var(--ink);text-decoration:none}.wk-item h3 a:hover{color:var(--accent)}
.wk-year{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin-left:10px}
.wk-item p{margin:4px 0 0;color:var(--ink-2);font-size:15px;max-width:66ch}
.wk-by{display:block;font-size:13.5px;color:var(--ink-3);margin-top:3px}
.wk-links{display:flex;flex-wrap:wrap;gap:6px;align-content:start;justify-content:flex-end}
.wk-links a{font-size:13px;border:1px solid currentColor;border-radius:999px;padding:2px 10px;white-space:nowrap}
@media (max-width:720px){.wk-item{grid-template-columns:1fr}.wk-item.has-cover{grid-template-columns:52px minmax(0,1fr)}.wk-cover,.wk-cover img{width:52px}.wk-item.has-cover .wk-links{grid-column:2}.wk-links{justify-content:flex-start}.bk-big{flex-direction:column}.bk-big .bk-cover{flex:none;min-height:0;height:220px;align-items:center}}
@media (prefers-reduced-motion:reduce){.bk-cover:hover img{transform:none}}
</style>`;
  const html = page({ title: 'Bookshop: books by Richard Hewitt (Risbek) — Lost Tribes Institute', desc: `Books on history, Scripture and the oral traditions of Asia by Richard Hewitt (Risbek): ${nBooks} books on Amazon, plus free books, papers and essays to read here.`, url: '/risbek', body })
    .replace('</head>', css + '</head>')
    .replace(' aria-current="page"', '');
  fs.writeFileSync(path.join(OUT, 'risbek.html'), html);
  redirects.push('/works  /risbek  301', '/works.html  /risbek  301');
  console.log(`Built works page with ${count} items`);
}

// 6. RSS feed and sitemap
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Lost Tribes Institute — Essays</title><link>${SITE}/essays</link><description>Essays from the Lost Tribes Institute</description>
${essays.slice(0, 50).map(e => `<item><title>${esc(e.title)}</title><link>${SITE}/essays/${e.slug}</link><guid>${SITE}/essays/${e.slug}</guid><pubDate>${e.date.toUTCString()}</pubDate><description>${esc(e.summary)}</description></item>`).join('\n')}
</channel></rss>
`;
fs.writeFileSync(path.join(OUT, 'essays.xml'), rss);

const smPath = path.join(OUT, 'sitemap.xml');
const extra = [`  <url><loc>${SITE}/risbek</loc></url>`, `  <url><loc>${SITE}/essays</loc>${essays[0] ? `<lastmod>${iso(essays[0].date)}</lastmod>` : ''}</url>`,
  ...essays.map(e => `  <url><loc>${SITE}/essays/${e.slug}</loc><lastmod>${iso(e.date)}</lastmod></url>`)].join('\n');
fs.writeFileSync(smPath, fs.readFileSync(smPath, 'utf8').replace('</urlset>', `${extra}\n</urlset>`));

if (redirects.length) fs.appendFileSync(path.join(OUT, '_redirects'), redirects.join('\n') + '\n');

console.log(`Built ${essays.length} essay(s) into dist/`);
