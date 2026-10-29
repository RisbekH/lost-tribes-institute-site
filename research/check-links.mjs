import fs from 'node:fs';
const urls = JSON.parse(fs.readFileSync('research/urls.json','utf8'));
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const out = [];
for (const u of urls) {
  let st = 'err', fin = '';
  try { const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow' }); st = r.status; fin = r.url;
    if (/wikipedia\.org\/wiki\//.test(u)) { const t = await r.text(); if (/does not have an article with this exact name/.test(t)) st = 'NOARTICLE'; } }
  catch (e) { st = 'err ' + e.message; }
  out.push([st, u, fin === u ? '' : fin]);
  await new Promise(s => setTimeout(s, 150));
}
fs.writeFileSync('research/links.json', JSON.stringify(out, null, 0));
