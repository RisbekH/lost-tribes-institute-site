// One-off: list freely licensed photos on Wikipedia articles for each map entry.
import fs from 'node:fs';
const UA = 'LostTribesInstitute-site/1.0 (https://losttribesinstitute.com; RichardHewitt@LostTribesCafe.com)';
const T = {
 bhi:["Black_Hebrew_Israelites","African_Hebrew_Israelites_of_Jerusalem"], chart:["Black_Hebrew_Israelites","Israelite_School_of_Universal_Practical_Knowledge"],
 native:["Native_Americans_in_the_United_States","View_of_the_Hebrews"], chickasaw:["Chickasaw","James_Adair_(historian)"], cherokee:["Cherokee","Bat_Creek_inscription","Chota_(Cherokee_town)"],
 choctaw:["Choctaw"], creek:["Muscogee"], catawba:["Catawba_people"], lenape:["Lenape"], massachusett:["Massachusett","John_Eliot_(missionary)"],
 andes:["Bnei_Moshe","Quechua_people"], melungeon:["Melungeon"], rasta:["Twelve_Tribes_of_Israel_(Rastafari)","Rastafari"], brazil:["Bnei_Anusim","Kahal_Zur_Israel_Synagogue"],
 paisa:["Paisa_Region","Antioquia_Department"], bi:["British_Israelism","Stone_of_Scone"], celts:["Celts","Lia_Fáil","Tara,_County_Meath"], nweu:["Brit-Am","Nordic_Israelism"],
 greeks:["Danaans","Spartans"], finno:["Sámi_people","Finns"], pashtun:["Pashtuns","Pashtunwali"], kyrgyz:["Kyrgyz_people"], kurds:["Kurdish_Jews","Yarsanism"],
 persia:["Persian_Jews","Tomb_of_Esther_and_Mordechai"], assyr:["Assyrian_people"], cauc:["Mountain_Jews","Georgian_Jews"], bukh:["Bukharan_Jews"], samar:["Samaritans","Mount_Gerizim"],
 pal:["Palestinians"], bagrat:["Bagrationi_dynasty","Bagratuni_dynasty"], karaim:["Crimean_Karaites","Trakai"], bnm:["Bnei_Menashe","Mizo_people"], karbi:["Karbi_people"],
 kashmir:["Kashmiris","Rozabal"], maliha:["Malihabad"], bephraim:["Bene_Ephraim"], beneisr:["Bene_Israel"], nasrani:["Saint_Thomas_Christians"], naga:["Naga_people"],
 knanaya:["Knanaya"], banuisrail:["Banu_Israil"], japan:["Japanese–Jewish_common_ancestry_theory","Mikoshi"], korea:["Koreans"], qiang:["Qiang_people"], kaifeng:["Kaifeng_Jews"],
 karen:["Karen_people"], phil:["Filipinos"], batak:["Batak"], gogo:["Gogodala_people","Gogodala"], maori:["Māori_people"], poly:["Polynesians","Native_Hawaiians","Tongans"],
 fiji:["Fijians"], malaita:["Malaita"], beta:["Beta_Israel"], lemba:["Lemba_people"], igbo:["Igbo_people","Igbo_Jews"], wafr:["Ashanti_people","Ewe_people","Yoruba_people"],
 cam:["Bamileke_people","Duala_people"], nuer:["Nuer_people"], somali:["Yibir"], ga:["Ga-Adangbe_people","Homowo"], fulani:["Fula_people"], timbuktu:["Timbuktu","History_of_the_Jews_in_Mali"],
 solomonic:["Solomonic_dynasty","Kebra_Nagast","Church_of_Our_Lady_Mary_of_Zion"], falashmura:["Falash_Mura","Gondar"], tutsi:["Tutsi"], maasai:["Maasai_people"], kalenjin:["Kalenjin_people"],
 zulu:["Zulu_people"], mada:["Malagasy_people"]
};
const errs=[]; const get = async u => { for (let i=0;i<4;i++){ try { const r = await fetch(u,{headers:{'User-Agent':UA,'Api-User-Agent':UA}}); if (r.ok) return await r.json(); errs.push(r.status+' '+u.slice(0,160)); } catch(e){ errs.push(e.message+' '+u.slice(0,160)); } await new Promise(s=>setTimeout(s,2500)); } return null; };
const out = {}; const all = new Set();
for (const [id, titles] of Object.entries(T)) {
  out[id] = {};
  for (const t of titles) {
    const j = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages|images&piprop=name&imlimit=80&titles=${encodeURIComponent(t)}`);
    if(!j||!j.query) continue; const p = Object.values(j.query.pages)[0];
    const imgs = (p.images||[]).map(x=>x.title.replace(/^File:/,'')).filter(n=>/\.(jpe?g|png|tif)$/i.test(n) && !/(map|flag|logo|icon|coat|emblem|seal|symbol|locator|svg|location|wikt|commons-logo|edit-clear|question_book)/i.test(n));
    out[id][t] = { pageimage: p.pageimage||null, images: imgs };
    if (p.pageimage) all.add(p.pageimage); imgs.forEach(n=>all.add(n));
    await new Promise(s=>setTimeout(s,150));
  }
}
const meta = {}; const list = [...all];
for (let i=0;i<list.length;i+=40) {
  const batch = list.slice(i,i+40).map(n=>'File:'+n).join('|');
  const j = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|size|url&iiextmetadatafilter=Artist|LicenseShortName|ImageDescription|DateTimeOriginal&titles=${encodeURIComponent(batch)}`);
  if(!j||!j.query) continue; for (const p of Object.values(j.query.pages)) {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) { meta[p.title.replace(/^File:/,'')] = {missing:true}; continue; }
    const m = ii.extmetadata||{}; const strip = s => (s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,220);
    meta[p.title.replace(/^File:/,'')] = { w:ii.width, h:ii.height, lic: m.LicenseShortName?.value||'', artist: strip(m.Artist?.value), desc: strip(m.ImageDescription?.value), date: strip(m.DateTimeOriginal?.value) };
  }
  await new Promise(s=>setTimeout(s,300));
}
fs.mkdirSync('research',{recursive:true});
fs.writeFileSync('research/photos.json', JSON.stringify({errs, pages:out, meta}, null, 1));
console.log('files', list.length);
