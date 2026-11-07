import fs from 'node:fs';
const Q = JSON.parse(fs.readFileSync('research/ia-queries.json','utf8'));
const UA = 'LostTribesInstitute-library-check/1.0 (https://losttribesinstitute.com)';
const clean = s => (s||'').replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim();
async function search(q){
  const u = 'https://archive.org/advancedsearch.php?' + new URLSearchParams({q, 'fl[]':'identifier', rows:'8', output:'json', 'sort[]':'downloads desc'})
    + '&fl[]=title&fl[]=creator&fl[]=date&fl[]=mediatype&fl[]=downloads&fl[]=language';
  const r = await fetch(u,{headers:{'User-Agent':UA}}); if(!r.ok) return {err:r.status};
  return (await r.json()).response.docs;
}
const out=[];
for (const x of Q){
  const t = clean(x.title).split(' ').slice(0,8).join(' ');
  const a = clean(x.author).split(' ').filter(w=>w.length>2).slice(-1)[0]||'';
  const tries = [
    `title:(${t}) AND creator:(${a}) AND mediatype:texts`,
    `title:(${t}) AND mediatype:texts`,
    `(${clean(x.q)}) AND mediatype:texts`];
  const res={};
  for (const q of tries){ try{ res[q]=await search(q);}catch(e){res[q]={err:String(e)};} await new Promise(s=>setTimeout(s,400)); }
  out.push({...x,res});
}
fs.writeFileSync('research/ia-results.json', JSON.stringify(out,null,1));
