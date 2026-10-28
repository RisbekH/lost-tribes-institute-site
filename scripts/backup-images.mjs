// Saves copies of the photos (Wikimedia Commons) and book covers (Amazon) that the
// site shows, into images/backup/, and points the pages at those copies, so the
// pictures stay up even if Wikimedia or Amazon moves or removes them.
// Run by the "Back up pictures" GitHub workflow; safe to run again any time:
// it only fetches pictures it doesn't have yet.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'images', 'backup');
fs.mkdirSync(DIR, { recursive: true });

const FILES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))
  .concat(fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.json')).map(f => path.join('assets', f)));

// Any Wikimedia or Amazon picture address, with or without ?width=…
const RE = /https?:\/\/(?:commons\.wikimedia\.org\/wiki\/Special:FilePath\/[^"'\s)<>?]+|upload\.wikimedia\.org\/[^"'\s)<>?]+|m\.media-amazon\.com\/images\/I\/[^"'\s)<>?]+)(?:\?width=\d+)?/g;

const UA = 'LostTribesInstitute-site-backup/1.0 (https://losttribesinstitute.com; RichardHewitt@LostTribesCafe.com)';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const base = u => u.replace(/\?width=\d+$/, '');
const localName = u => {
  const b = base(u);
  const last = decodeURIComponent(b.split('/').pop());
  const amazon = /media-amazon/.test(b);
  const name = (amazon ? 'cover-' : '') + last.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9.+-]+/g, '_').replace(/_+/g, '_').replace(/^_|_(?=\.)/g, '');
  return name.length > 90 ? name.slice(0, 80) + path.extname(name) : name;
};
const fetchUrl = u => {
  const b = base(u);
  if (/Special:FilePath/.test(b)) return b + '?width=1000';          // a good size, not the full original
  return b;
};

const found = new Set();
for (const f of FILES) for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(RE)) found.add(base(m[0]));

const map = new Map();
let fetched = 0, failed = [];
for (const u of found) {
  const name = localName(u);
  const dest = path.join(DIR, name);
  if (!fs.existsSync(dest)) {
    try {
      const res = await fetch(fetchUrl(u), { headers: { 'User-Agent': /amazon/.test(u) ? BROWSER_UA : UA }, redirect: 'follow' });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      fetched++;
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { failed.push(`${u} (${e.message})`); continue; }
  }
  map.set(u, `/images/backup/${name}`);
}

let changed = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  const s = fs.readFileSync(p, 'utf8');
  const t = s.replace(RE, m => map.get(base(m)) || m);
  if (t !== s) { fs.writeFileSync(p, t); changed++; }
}
console.log(`Pictures found: ${found.size}; newly saved: ${fetched}; pages updated: ${changed}`);
if (failed.length) console.log('Could not save (left pointing at the original):\n' + failed.join('\n'));
