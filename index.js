const html="<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Omar Mosque Prayer Times</title><style>body{margin:0;background:#10233a;color:#f8f0e4;font:16px system-ui}.w{max-width:860px;margin:auto;padding:24px}nav{display:flex;gap:8px}button{padding:11px;border:0;border-radius:8px;font-weight:bold}button:first-child{background:#e7b14d}section{margin-top:26px}.hide{display:none}.next{padding:22px;border-radius:18px;background:#e7b14d;color:#10233a}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:16px}.card{padding:12px;border:1px solid #ffffff44;border-radius:12px}.card b{font-size:1.25rem}iframe{width:100%;height:80vh;border:0;border-radius:14px;background:white}@media(max-width:600px){.w{padding:16px}.cards{grid-template-columns:repeat(3,1fr)}h1{font-size:2rem}}</style><main class=\"w\"><nav><button onclick=\"show('today')\">Today</button><button onclick=\"show('monthly')\">Monthly timetable</button></nav><section id=\"today\"><p id=\"date\">Loading…</p><h1>Omar Mosque · Berlin</h1><div class=\"next\"><small>NEXT PRAYER</small><h2 id=\"next\">Loading…</h2><b id=\"count\">Loading…</b><p>Berlin time: <span id=\"clock\"></span></p></div><div id=\"cards\" class=\"cards\"></div><p id=\"note\">Reading the mosque’s official timetable…</p><p><a style=\"color:#f8f0e4\" href=\"https://ivwp.de/ivwp/omar-moschee/\" target=\"_blank\" rel=\"noreferrer\">Official source</a></p></section><section id=\"monthly\" class=\"hide\"><h1>Official monthly timetable</h1><p id=\"status\">Refreshing from Omar Mosque…</p><iframe id=\"pdf\" title=\"Official monthly timetable\"></iframe></section></main><script>const zone = 'Europe/Berlin';\nconst prayers = [['Fajr','الفجر',0],['Dhuhr','الظهر',2],['Asr','العصر',3],['Maghrib','المغرب',4],['Isha','العشاء',5]];\nconst $ = id => document.getElementById(id);\nconst format = (d, opts) => new Intl.DateTimeFormat('en-GB',{timeZone:zone,...opts}).format(d);\nfunction dateKey(date) {\n  const p = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);\n  return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');\n}\nfunction shiftDay(key) { const d = new Date(key+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }\nfunction instant(key,time) {\n  const offset = new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(key+'T12:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','');\n  return new Date(key+'T'+time+':00'+offset);\n}\nfunction validateRows(rows, month) {\n  const [year,m] = month.split('-').map(Number), count = new Date(Date.UTC(year,m,0)).getUTCDate();\n  if (rows.length!==count) throw Error('Incomplete timetable');\n  rows.forEach(row=>{\n    if(row.length!==6 || row.some(t=>!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(t))) throw Error('Unreadable times');\n    if(row.some((t,i)=>i>0 && t<=row[i-1])) throw Error('Invalid prayer order');\n  });\n  return Object.fromEntries(rows.map((r,i)=>[month+'-'+String(i+1).padStart(2,'0'),r]));\n}\nlet timetable = {}, busy = false, activeVersion = null, pdfURL = null;\nfunction nextPrayer(now, rows) {\n  const key = dateKey(now);\n  for(const day of [key,shiftDay(key)]) {\n    if(!rows[day]) continue;\n    for(const [name,ar,col] of prayers) { const at=instant(day,rows[day][col]); if(at>=now) return {name,ar,at,time:rows[day][col]}; }\n  }\n  return null;\n}\nfunction tick() {\n  const now=new Date(), key=dateKey(now), values=timetable[key];\n  $('date').textContent=format(now,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);\n  $('clock').textContent=format(now,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});\n  $('cards').innerHTML=prayers.map(([n,a,c])=>'<div class=\"card\"><span dir=\"rtl\">'+a+'</span><br>'+n+'<br><b>'+(values?values[c]:'—')+'</b></div>').join('');\n  const next=nextPrayer(now,timetable);\n  if(!next) { $('next').textContent=busy?'Reading official timetable…':'Official times unavailable'; $('count').textContent=busy?'Please wait':'Please check the monthly timetable'; return; }\n  $('next').textContent=next.name+' · '+next.ar+' · '+next.time;\n  const s=Math.max(0,Math.ceil((next.at-now)/1000));\n  $('count').textContent=s===0?'Prayer time now':'in '+Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m '+String(s%60).padStart(2,'0')+'s';\n}\nfunction show(view) { $('today').classList.toggle('hide',view!=='today'); $('monthly').classList.toggle('hide',view!=='monthly'); }\nfunction script(url) { return new Promise((resolve,reject)=>{ const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=reject;document.head.append(s); }); }\nasync function readPdf(bytes, month) {\n  if(!window.pdfjsLib) await script('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');\n  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';\n  const doc=await pdfjsLib.getDocument({data:bytes}).promise;\n  let worker;\n  try {\n    const page=await doc.getPage(1), base=page.getViewport({scale:1}), v=page.getViewport({scale:2400/base.height});\n    const full=document.createElement('canvas');full.width=v.width;full.height=v.height;\n    await page.render({canvasContext:full.getContext('2d'),viewport:v}).promise;\n    // The published Berlin layout has six numeric columns between 24% and 80% of the page width.\n    // Require the complete month's rows; never shift a partial OCR result onto dates.\n    const crop=document.createElement('canvas');crop.width=Math.round(full.width*.56);crop.height=full.height;\n    crop.getContext('2d').drawImage(full,full.width*.24,0,full.width*.56,full.height,0,0,crop.width,crop.height);\n    if(!window.Tesseract) await script('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');\n    worker=await Tesseract.createWorker('eng');\n    await worker.setParameters({tessedit_pageseg_mode:'6'});\n    const result=await worker.recognize(crop);\n    const rows=result.data.text.split('\\n').map(line=>line.match(/\\b(?:[01]?\\d|2[0-3]):[0-5]\\d\\b/g)||[]).filter(row=>row.length>0);\n    return validateRows(rows.map(r=>r.map(t=>t.padStart(5,'0'))),month);\n  } finally { if(worker) await worker.terminate(); await doc.destroy(); }\n}\nasync function refresh() {\n  if(busy) return; busy=true; tick();\n  try {\n    const response=await fetch('/api/schedule',{cache:'no-store'}); if(!response.ok) throw Error('Source unavailable');\n    const info=await response.json();\n    if(activeVersion!==info.version) {\n      timetable={}; tick();\n      const pdf=await fetch('/api/schedule-pdf?v='+info.version,{cache:'no-store'});if(!pdf.ok) throw Error('PDF unavailable');\n      const bytes=await pdf.arrayBuffer();\n      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');\n      if(digest!==info.version) throw Error('Timetable changed; retrying');\n      if(pdfURL) URL.revokeObjectURL(pdfURL);\n      pdfURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('pdf').src=pdfURL;\n      if(info.rows) timetable=validateRows(info.rows,info.month);\n      else {\n        let saved;try{saved=JSON.parse(localStorage.getItem('official-'+digest));}catch{}\n        if(saved) timetable=validateRows(saved,info.month);\n        else {\n          $('status').textContent='Reading the new official timetable. This can take a minute…';\n          timetable=await readPdf(bytes,info.month);\n          try{localStorage.setItem('official-'+digest,JSON.stringify(Object.values(timetable)));}catch{}\n        }\n      }\n      activeVersion=info.version;\n    }\n    $('status').textContent='Official '+info.month+' timetable · checked '+format(new Date(info.checkedAt),{hour:'2-digit',minute:'2-digit'});\n    $('note').textContent=timetable[dateKey(new Date())]?'Times from the mosque’s official timetable. Hijri date is calendar-calculated.':'The published timetable does not cover today. No estimated times are substituted.';\n  } catch(error) {\n    $('status').textContent='Could not read the official timetable. Please open the source link or retry.';\n    $('note').textContent=Object.keys(timetable).length?'Showing the previously loaded official timetable; refresh failed.':'Official times unavailable. No estimated times are substituted.';\n  } finally { busy=false;tick(); }\n}\ntick();refresh();setInterval(tick,1000);setInterval(refresh,300000);\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});\n</script>";
const SOURCE='https://ivwp.de/ivwp/omar-moschee/';
const VERIFIED_HASH='4e1d8a3afd1a26f68ad861eafca1eb47a176f5a17f233f1696774b551a4f161e';
// Visually checked against the official October 2026 PDF, used only when its bytes match.
const VERIFIED_ROWS=`05:27 07:06 12:59 16:04 18:46 20:26
05:28 07:08 12:58 16:02 18:43 20:23
05:30 07:10 12:58 16:00 18:41 20:21
05:32 07:11 12:58 15:59 18:39 20:19
05:33 07:13 12:57 15:57 18:37 20:17
05:35 07:15 12:57 15:55 18:34 20:15
05:37 07:17 12:57 15:53 18:32 20:13
05:38 07:18 12:56 15:52 18:30 20:11
05:40 07:20 12:56 15:50 18:27 20:08
05:41 07:22 12:56 15:48 18:25 20:05
05:43 07:23 12:56 15:46 18:23 20:03
05:45 07:25 12:55 15:45 18:21 20:01
05:46 07:27 12:55 15:43 18:18 19:58
05:48 07:29 12:55 15:41 18:17 19:57
05:49 07:31 12:55 15:39 18:14 19:54
05:51 07:32 12:55 15:38 18:12 19:52
05:53 07:34 12:54 15:36 18:09 19:49
05:54 07:36 12:54 15:34 18:07 19:48
05:56 07:38 12:54 15:32 18:05 19:46
05:57 07:39 12:54 15:31 18:03 19:44
05:59 07:41 12:54 15:29 18:01 19:42
06:01 07:43 12:53 15:27 17:59 19:40
06:02 07:45 12:53 15:26 17:57 19:38
06:04 07:47 12:53 15:24 17:55 19:36
05:05 06:48 11:53 14:22 16:53 18:34
05:07 06:50 11:53 14:21 16:51 18:32
05:09 06:52 11:53 14:19 16:49 18:30
05:10 06:54 11:53 14:18 16:47 18:29
05:12 06:56 11:53 14:16 16:45 18:27
05:13 06:58 11:53 14:14 16:43 18:25
05:15 06:59 11:53 14:13 16:41 18:24`.split('\n').map(r=>r.split(' '));
let cache, pending;
async function schedule() {
  if(cache && Date.now()-cache.checkedAt<300000) return cache;
  if(pending) return pending;
  pending=(async()=>{
    const response=await fetch(SOURCE);if(!response.ok)throw Error('Source unavailable');
    const text=await response.text(), candidates=[...text.matchAll(/href=["']([^"']*Berlin-(\d{2})(\d{2})\.pdf[^"']*)["']/gi)];
    if(!candidates.length)throw Error('PDF not found');
    candidates.sort((a,b)=>Number(b[3]+b[2])-Number(a[3]+a[2]));
    const match=candidates[0],url=new URL(match[1].replace(/&amp;/g,'&'),SOURCE);url.protocol='https:';
    if(url.hostname!=='ivwp.de' && url.hostname!=='www.ivwp.de')throw Error('Unexpected source');
    const pdf=await fetch(url.href);if(!pdf.ok)throw Error('PDF unavailable');
    const bytes=await pdf.arrayBuffer(),version=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    return cache={pdf:url.href,bytes,version,month:'20'+match[3]+'-'+match[2],checkedAt:Date.now()};
  })();
  try{return await pending;}finally{pending=null;}
}
export default {async fetch(request){
  const url=new URL(request.url), headers={'cache-control':'no-store'};
  try {
    if(url.pathname==='/api/schedule') {
      const s=await schedule();
      return Response.json({pdf:s.pdf,sourcePage:SOURCE,month:s.month,version:s.version,checkedAt:new Date(s.checkedAt).toISOString(),rows:s.version===VERIFIED_HASH?VERIFIED_ROWS:null},{headers});
    }
    if(url.pathname==='/api/schedule-pdf') {
      const s=await schedule();
      if(url.searchParams.has('v') && url.searchParams.get('v')!==s.version)return new Response('Timetable changed; refresh',{status:409,headers});
      return new Response(s.bytes,{headers:{...headers,'content-type':'application/pdf'}});
    }
    return new Response(html,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
  } catch {return Response.json({error:'Official timetable unavailable'},{status:502,headers});}
}};
