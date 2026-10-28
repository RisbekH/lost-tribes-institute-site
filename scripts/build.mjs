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
  essays.push({ slug, title: String(data.title), date, author: data.author || 'Richard Hewitt (Risbek)', summary: data.summary || '', html: marked.parse(body) });
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

const page = ({ title, desc, url, body, type = 'website' }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${url}"><meta property="og:type" content="${type}"><meta property="og:site_name" content="Lost Tribes Institute"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${url}"><meta name="twitter:card" content="summary"><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/images/brand/lti-mark-180.png"><link rel="alternate" type="application/rss+xml" title="Lost Tribes Institute essays" href="/essays.xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/site.css"><style>
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
.essay .dateline{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin:0 0 28px}
.essay .body{font-size:1.08rem;line-height:1.75;overflow-wrap:anywhere}
.essay .body .footnotes{font-size:.95rem;border-top:1px solid var(--rule);margin-top:40px}
.essay .body h2{margin:36px 0 10px}.essay .body h3{margin:28px 0 8px}
.essay .body blockquote{margin:22px 0;padding:4px 0 4px 18px;border-left:3px solid var(--accent);color:var(--ink-2)}
.essay .body img{max-width:100%;height:auto;border-radius:4px;display:block;margin:0 auto 6px}
.essay .body table{border-collapse:collapse;display:block;overflow-x:auto}
.essay .body td,.essay .body th{border:1px solid var(--rule);padding:6px 10px}
.essay .body pre{overflow-x:auto}
.pager{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;border-top:1px solid var(--rule);margin-top:48px;padding-top:18px;font-size:15px}
.empty{color:var(--ink-2);margin-top:28px}
</style></head><body>
<a class="skip" href="#main">Skip to content</a>${topbar}
<main id="main"><div class="wrap">${body}</div></main>
${footer}
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
    body: `<article class="essay"><p class="eyebrow"><a href="/essays.html" style="text-decoration:none">Essays</a></p><h1>${esc(e.title)}</h1><p class="dateline"><time datetime="${iso(e.date)}">${fmt(e.date)}</time> · ${esc(e.author)}</p><div class="body">${e.html}</div>${pager}</article>`,
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
    return `<li class="wk-item"><div class="wk-main"><h3><a href="${esc(main?.url || '#')}"${main && /^https?:/.test(main.url) ? ' rel="noopener"' : ''}>${esc(title)}</a></h3>${year ? `<span class="wk-year">${esc(year)}</span>` : ''}${note ? `<p>${esc(note)}</p>` : ''}${author}</div><div class="wk-links">${links.map(l => `<a href="${esc(l.url)}"${l.dl ? ' download' : /^https?:/.test(l.url) ? ' rel="noopener"' : ''}>${esc(l.label)}</a>`).join('')}</div></li>`;
  };
  const sections = works.sections.map(s => ({ ...s, html: s.items.map(row).join('') }));
  // essays section (all essays by him, newest first)
  const restEssays = myEssays.filter(e => !shownEssays.has(e.slug));
  const essaysHtml = restEssays.map(e => `<li class="wk-item"><div class="wk-main"><h3><a href="/essays/${e.slug}.html">${esc(e.title)}</a></h3><span class="wk-year">${fmt(e.date)}</span>${e.summary ? `<p>${esc(e.summary)}</p>` : ''}</div><div class="wk-links"><a href="/essays/${e.slug}.html">Read here</a></div></li>`).join('');
  sections.splice(sections.findIndex(s => s.id === 'papers') + 1, 0, { id: 'essays', title: 'Essays', intro: 'Written for this site, newest first. Papers that can be read here are listed above.', html: essaysHtml, items: restEssays });
  const missing = library.filter(e => mine(e) && !used.has(e.id));
  if (missing.length) console.warn('works.json does not list:', missing.map(e => e.id).join(', '));
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const toc = sections.map(s => `<a href="#${s.id}">${esc(s.title)} <b>${s.items.length}</b></a>`).join('');
  const body = `<p class="eyebrow">Works</p><h1>Works by Richard Hewitt (Risbek)</h1><p class="lead">Books, papers, essays, screenplays and videos in one place. Some can be read or downloaded here; the rest link to where they are published.</p>
<nav class="wk-toc" aria-label="Sections">${toc}</nav>
${sections.map(s => `<section class="wk-sec" id="${s.id}"><div class="section-head"><h2>${esc(s.title)}</h2></div>${s.intro ? `<p class="muted">${esc(s.intro)}</p>` : ''}<ul class="wk-list">${s.html}</ul></section>`).join('\n')}
<p class="muted" style="margin-top:40px">Also on ${works.elsewhere.map(l => `<a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a>`).join(', ')}.</p>`;
  const css = `<style>
.wk-toc{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 8px}
.wk-toc a{border:1px solid var(--rule);border-radius:999px;padding:5px 12px;font-size:14px;text-decoration:none;color:var(--ink)}
.wk-toc a b{font-family:var(--mono);font-weight:500;color:var(--accent);margin-left:4px}
.wk-sec{margin-top:44px;scroll-margin-top:80px}
.wk-list{list-style:none;margin:8px 0 0;padding:0}
.wk-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 24px;padding:14px 0;border-bottom:1px solid var(--rule)}
.wk-item h3{display:inline;font-size:1.12rem;margin:0}
.wk-item h3 a{color:var(--ink);text-decoration:none}.wk-item h3 a:hover{color:var(--accent)}
.wk-year{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin-left:10px}
.wk-item p{margin:4px 0 0;color:var(--ink-2);font-size:15px;max-width:66ch}
.wk-by{display:block;font-size:13.5px;color:var(--ink-3);margin-top:3px}
.wk-links{display:flex;flex-wrap:wrap;gap:6px;align-content:start;justify-content:flex-end}
.wk-links a{font-size:13px;border:1px solid currentColor;border-radius:999px;padding:2px 10px;white-space:nowrap}
@media (max-width:720px){.wk-item{grid-template-columns:1fr}.wk-links{justify-content:flex-start}}
</style>`;
  const html = page({ title: 'Works by Richard Hewitt (Risbek) — Lost Tribes Institute', desc: `All ${count} works by Richard Hewitt (Risbek): books, papers, essays, screenplays and videos.`, url: '/risbek', body })
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
