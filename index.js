const html="<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta charset=\"utf-8\"><meta name=\"theme-color\" content=\"#10233a\"><link rel=\"manifest\" href=\"/manifest.webmanifest\"><meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><title>Omar Mosque Prayer Times</title><style>body{margin:0;background:#10233a;color:#f8f0e4;font:16px system-ui}.w{max-width:860px;margin:auto;padding:24px}nav{display:flex;gap:8px}button{padding:11px;border:0;border-radius:8px;font-weight:bold}button:first-child{background:#e7b14d}section{margin-top:26px}.hide{display:none}.next{padding:22px;border-radius:18px;background:#e7b14d;color:#10233a}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:16px}.card{padding:12px;border:1px solid #ffffff44;border-radius:12px}.card b{font-size:1.25rem}iframe{width:100%;height:80vh;border:0;border-radius:14px;background:white}@media(max-width:600px){.w{padding:16px}.cards{grid-template-columns:repeat(3,1fr)}h1{font-size:2rem}}</style><main class=\"w\"><nav><button onclick=\"show('today')\">Today</button><button onclick=\"show('monthly')\">Monthly timetable</button></nav><section id=\"today\"><p id=\"date\">Loading…</p><h1>Omar Mosque · Berlin</h1><div class=\"next\"><small>NEXT PRAYER</small><h2 id=\"next\">Loading…</h2><b id=\"count\">Loading…</b><p>Berlin time: <span id=\"clock\"></span></p></div><div id=\"cards\" class=\"cards\"></div><aside style=\"margin-top:24px;padding:16px;border:1px solid #ffffff44;border-radius:12px\"><h3>Prayer reminders</h3><p id=\"pushStatus\" role=\"status\">Optional reminders 10 minutes before prayer.</p><button id=\"enablePush\">Enable prayer reminders</button> <button id=\"testPush\" hidden>Send test notification</button> <button id=\"disablePush\" hidden>Disable reminders</button><p style=\"font-size:12px\">Enabling saves this device’s push subscription and prayer schedule on the server. Disable anytime.</p></aside><p id=\"offline\" style=\"font-size:13px;color:#e7b14d\" role=\"status\"></p><p id=\"note\">Reading the mosque’s official timetable…</p><p><a style=\"color:#f8f0e4\" href=\"https://ivwp.de/ivwp/omar-moschee/\" target=\"_blank\" rel=\"noreferrer\">Official source</a></p></section><section id=\"monthly\" class=\"hide\"><h1>Official monthly timetable</h1><p id=\"status\">Refreshing from Omar Mosque…</p><iframe id=\"pdf\" title=\"Official monthly timetable\"></iframe></section></main><script>const zone = 'Europe/Berlin';\nconst prayers = [['Fajr','الفجر',0],['Dhuhr','الظهر',2],['Asr','العصر',3],['Maghrib','المغرب',4],['Isha','العشاء',5]];\nconst $ = id => document.getElementById(id);\nconst format = (d, opts) => new Intl.DateTimeFormat('en-GB',{timeZone:zone,...opts}).format(d);\nfunction dateKey(date) {\n  const p = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);\n  return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');\n}\nfunction shiftDay(key) { const d = new Date(key+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }\nfunction instant(key,time) {\n  const offset = new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(key+'T12:00:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','');\n  return new Date(key+'T'+time+':00'+offset);\n}\nfunction validateRows(rows, month) {\n  const [year,m] = month.split('-').map(Number), count = new Date(Date.UTC(year,m,0)).getUTCDate();\n  if (rows.length!==count) throw Error('Incomplete timetable');\n  rows.forEach(row=>{\n    if(row.length!==6 || row.some(t=>!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(t))) throw Error('Unreadable times');\n    if(row.some((t,i)=>i>0 && t<=row[i-1])) throw Error('Invalid prayer order');\n  });\n  return Object.fromEntries(rows.map((r,i)=>[month+'-'+String(i+1).padStart(2,'0'),r]));\n}\nlet timetable = {}, busy = false, activeVersion = null, pdfURL = null;\nconst SAVED_KEY='omar-official-months-v1';\nlet savedMonths={}, offlineShellReady=false;\nfunction restoreSaved() {\n  try {\n    const saved=JSON.parse(localStorage.getItem(SAVED_KEY)||'{}');\n    for(const [month,entry] of Object.entries(saved)) {\n      if(!/^20\\d{2}-(0[1-9]|1[0-2])$/.test(month)||!entry||!/^[a-f0-9]{64}$/.test(entry.version))continue;\n      try {Object.assign(timetable,validateRows(entry.rows,month));savedMonths[month]=entry;}catch{}\n    }\n  }catch{}\n}\nfunction persistMonth(info,rows) {\n  const updated={...savedMonths,[info.month]:{rows:Object.values(rows),version:info.version,checkedAt:info.checkedAt}};\n  const keys=Object.keys(updated).sort().slice(-3);\n  const trimmed=Object.fromEntries(keys.map(k=>[k,updated[k]]));\n  localStorage.setItem(SAVED_KEY,JSON.stringify(trimmed));\n  savedMonths=trimmed;\n}\nfunction offlineStatus() {\n  const entry=savedMonths[dateKey(new Date()).slice(0,7)];\n  $('offline').textContent=entry&&offlineShellReady?'Saved for offline use through '+Object.keys(validateRows(entry.rows,dateKey(new Date()).slice(0,7))).pop()+'.':entry?'Prayer times saved. Preparing offline opening…':'Connect to save this month’s official times for offline use.';\n}\nasync function prepareOffline() {\n  if(!('serviceWorker' in navigator))return;\n  try {\n    await navigator.serviceWorker.register('/sw.js');\n    await navigator.serviceWorker.ready;\n    offlineShellReady=true;offlineStatus();\n    if(navigator.storage && navigator.storage.persist)navigator.storage.persist().catch(()=>{});\n  }catch{$('offline').textContent='Offline page storage could not be enabled. Keep this page open or retry online.';}\n}\nasync function storedPdf(version) {\n  try {return await (await caches.open('omar-pdfs-v1')).match('/api/schedule-pdf?v='+version);}catch{return null;}\n}\nfunction displayPdf(bytes) {\n  if(pdfURL)URL.revokeObjectURL(pdfURL);\n  pdfURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('pdf').src=pdfURL;\n}\nasync function restorePdf() {\n  const current=savedMonths[dateKey(new Date()).slice(0,7)];\n  if(!current)return;\n  const response=await storedPdf(current.version);\n  if(response&&!pdfURL)displayPdf(await response.arrayBuffer());\n}\nfunction nextPrayer(now, rows) {\n  const key = dateKey(now);\n  for(const day of [key,shiftDay(key)]) {\n    if(!rows[day]) continue;\n    for(const [name,ar,col] of prayers) { const at=instant(day,rows[day][col]); if(at>=now) return {name,ar,at,time:rows[day][col]}; }\n  }\n  return null;\n}\nfunction tick() {\n  const now=new Date(), key=dateKey(now), values=timetable[key];\n  $('date').textContent=format(now,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);\n  $('clock').textContent=format(now,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});\n  $('cards').innerHTML=prayers.map(([n,a,c])=>'<div class=\"card\"><span dir=\"rtl\">'+a+'</span><br>'+n+'<br><b>'+(values?values[c]:'—')+'</b></div>').join('');\n  const next=nextPrayer(now,timetable);\n  if(!next) { $('next').textContent=busy?'Reading official timetable…':'Official times unavailable'; $('count').textContent=busy?'Please wait':'Please check the monthly timetable'; return; }\n  $('next').textContent=next.name+' · '+next.ar+' · '+next.time;\n  const s=Math.max(0,Math.ceil((next.at-now)/1000));\n  $('count').textContent=s===0?'Prayer time now':'in '+Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m '+String(s%60).padStart(2,'0')+'s';\n}\nfunction show(view) { $('today').classList.toggle('hide',view!=='today'); $('monthly').classList.toggle('hide',view!=='monthly'); }\nfunction script(url) { return new Promise((resolve,reject)=>{ const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=reject;document.head.append(s); }); }\nasync function readPdf(bytes, month) {\n  if(!window.pdfjsLib) await script('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');\n  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';\n  const doc=await pdfjsLib.getDocument({data:bytes}).promise;\n  let worker;\n  try {\n    const page=await doc.getPage(1), base=page.getViewport({scale:1}), v=page.getViewport({scale:2400/base.height});\n    const full=document.createElement('canvas');full.width=v.width;full.height=v.height;\n    await page.render({canvasContext:full.getContext('2d'),viewport:v}).promise;\n    // The published Berlin layout has six numeric columns between 24% and 80% of the page width.\n    // Require the complete month's rows; never shift a partial OCR result onto dates.\n    const crop=document.createElement('canvas');crop.width=Math.round(full.width*.56);crop.height=full.height;\n    crop.getContext('2d').drawImage(full,full.width*.24,0,full.width*.56,full.height,0,0,crop.width,crop.height);\n    if(!window.Tesseract) await script('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');\n    worker=await Tesseract.createWorker('eng');\n    await worker.setParameters({tessedit_pageseg_mode:'6'});\n    const result=await worker.recognize(crop);\n    const rows=result.data.text.split('\\n').map(line=>line.match(/\\b(?:[01]?\\d|2[0-3]):[0-5]\\d\\b/g)||[]).filter(row=>row.length>0);\n    return validateRows(rows.map(r=>r.map(t=>t.padStart(5,'0'))),month);\n  } finally { if(worker) await worker.terminate(); await doc.destroy(); }\n}\nasync function refresh() {\n  if(busy) return;\n  if(!navigator.onLine){$('note').textContent=timetable[dateKey(new Date())]?'Offline · using saved official times.':'Offline · no saved official timetable for today. Connect to update.';$('status').textContent='Offline · showing the saved timetable, if available.';offlineStatus();return;}\n  busy=true; tick();\n  try {\n    const response=await fetch('/api/schedule',{cache:'no-store'}); if(!response.ok) throw Error('Source unavailable');\n    const info=await response.json();\n    if(activeVersion!==info.version) {\n      let nextRows=info.rows?validateRows(info.rows,info.month):null;\n      if(!nextRows && savedMonths[info.month]?.version===info.version)nextRows=validateRows(savedMonths[info.month].rows,info.month);\n      // Show official server rows immediately; a PDF download must not hold up the countdown.\n      if(nextRows){Object.assign(timetable,nextRows);tick();}\n      const pdf=await storedPdf(info.version)||await fetch('/api/schedule-pdf?v='+info.version,{cache:'no-store'});if(!pdf.ok) throw Error('PDF unavailable');\n      const bytes=await pdf.arrayBuffer();\n      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');\n      if(digest!==info.version) throw Error('Timetable changed; retrying');\n      displayPdf(bytes);\n      if(!nextRows) {\n          $('status').textContent='Reading the new official timetable. This can take a minute…';\n          nextRows=await readPdf(bytes.slice(0),info.month);\n      }\n      Object.assign(timetable,nextRows);\n      try{persistMonth(info,nextRows);}catch{$('offline').textContent='Storage is full or unavailable. Offline times could not be saved.';}\n      try{await(await caches.open('omar-pdfs-v1')).put('/api/schedule-pdf?v='+digest,new Response(bytes,{headers:{'content-type':'application/pdf'}}));}catch{}\n      activeVersion=info.version;\n      syncPushSchedule().catch(e=>pushText(e.message));\n    }\n    $('status').textContent='Official '+info.month+' timetable · checked '+format(new Date(info.checkedAt),{hour:'2-digit',minute:'2-digit'});\n    $('note').textContent=timetable[dateKey(new Date())]?'Times from the mosque’s official timetable. Hijri date is calendar-calculated.':'The published timetable does not cover today. No estimated times are substituted.';\n  } catch(error) {\n    $('status').textContent='Could not read the official timetable. Please open the source link or retry.';\n    $('note').textContent=Object.keys(timetable).length?'Showing the previously loaded official timetable; refresh failed.':'Official times unavailable. No estimated times are substituted.';\n  } finally { busy=false;tick();offlineStatus(); }\n}\nrestoreSaved();tick();offlineStatus();restorePdf();prepareOffline();refresh();setInterval(tick,1000);setInterval(refresh,300000);\ndocument.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});\nwindow.addEventListener('online',refresh);window.addEventListener('offline',refresh);\nconst pushTokenKey='omar-push-token-v1';\nlet pushRegistration, pushPublicKey, pushBusy=false;\nfunction pushText(text){$('pushStatus').textContent=text;}\nfunction pushToken(create=false){let t=localStorage.getItem(pushTokenKey);if(!t&&create){t=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(pushTokenKey,t);}return t;}\nfunction pushButtons(enabled){$('enablePush').hidden=enabled;$('disablePush').hidden=!enabled;$('testPush').hidden=!enabled;}\nasync function pushAPI(action,payload){\n  const r=await fetch('/api/push/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});\n  const data=await r.json();if(!r.ok)throw Error(data.error||'Reminder service unavailable');return data;\n}\nasync function pushSetup(){\n  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){\n    pushText('On iPhone, open this site from its Home Screen icon to enable notifications.');$('enablePush').disabled=true;return;\n  }\n  try{\n    pushRegistration=await navigator.serviceWorker.ready;\n    const r=await fetch('/api/push/key',{cache:'no-store'});if(!r.ok)throw Error('Reminder setup is not available yet. Try again online shortly.');pushPublicKey=(await r.json()).publicKey;\n    const sub=await pushRegistration.pushManager.getSubscription(),token=pushToken();\n    if(sub&&token){const s=await pushAPI('status',{subscription:sub.toJSON(),token});pushButtons(s.enabled);if(s.enabled)pushText('Reminders saved'+(s.until?' through '+format(new Date(s.until),{day:'numeric',month:'long'}):'')+'. Open online when the new timetable is published.'+(s.lastError?' '+s.lastError:''));}\n    else pushText('Optional: a notification 10 minutes before each prayer. Internet is needed for delivery.');\n  }catch(e){pushText(e.message);}\n}\nasync function syncPushSchedule(){\n  if(!pushRegistration||!pushToken()||Notification.permission!=='granted')return;\n  const sub=await pushRegistration.pushManager.getSubscription();if(!sub)return;\n  const month=Object.keys(savedMonths).sort().pop(),entry=savedMonths[month];if(!entry)throw Error('Wait until the official timetable is saved, then try again.');\n  const result=await pushAPI('save',{subscription:sub.toJSON(),token:pushToken(),month,version:entry.version,rows:entry.rows});\n  pushButtons(true);pushText(result.until?'Reminders enabled · saved through '+format(new Date(result.until),{day:'numeric',month:'long'})+'. Open online for the next month’s timetable.':'No future times are saved. Open online when the new timetable is published.');\n}\nasync function enablePush(){\n  if(pushBusy)return;pushBusy=true;$('enablePush').disabled=true;\n  try{\n    // Permission must be requested from this user tap, never automatically.\n    if(await Notification.requestPermission()!=='granted')throw Error('Notifications are not allowed. Enable them in iPhone Settings → Notifications for this app.');\n    if(!navigator.onLine)throw Error('Connect to the internet to enable reminders.');\n    if(!pushPublicKey||!pushRegistration)await pushSetup();\n    if(!pushPublicKey||!pushRegistration)throw Error('Reminder service is not ready. Try again shortly.');\n    let sub=await pushRegistration.pushManager.getSubscription();\n    if(sub&&!pushToken()){await sub.unsubscribe();sub=null;}\n    pushToken(true);\n    if(!sub){const key=Uint8Array.from(atob(pushPublicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));sub=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});}\n    await syncPushSchedule();\n  }catch(e){pushText(e.message);}finally{pushBusy=false;$('enablePush').disabled=false;}\n}\nasync function disablePush(){\n  if(pushBusy)return;pushBusy=true;\n  try{const sub=await pushRegistration?.pushManager.getSubscription();if(sub){if(navigator.onLine)await pushAPI('remove',{subscription:sub.toJSON(),token:pushToken()});await sub.unsubscribe();}localStorage.removeItem(pushTokenKey);pushButtons(false);pushText('Prayer reminders disabled.');}catch(e){pushText(e.message);}finally{pushBusy=false;}\n}\nasync function testPush(){\n  if(pushBusy)return;pushBusy=true;\n  try{const sub=await pushRegistration?.pushManager.getSubscription();if(!sub)throw Error('Enable reminders first.');await pushAPI('test',{subscription:sub.toJSON(),token:pushToken()});pushText('Test sent. If no alert appears, check notification permissions and Focus settings.');}catch(e){pushText(e.message);}finally{pushBusy=false;}\n}\n$('enablePush').addEventListener('click',enablePush);$('disablePush').addEventListener('click',disablePush);$('testPush').addEventListener('click',testPush);\npushSetup();\n</script>";
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
export default {async fetch(request,env){
  const url=new URL(request.url), headers={'cache-control':'no-store'};
  try {
    if(url.pathname==='/sw.js')return new Response("const SHELL='omar-shell-v2';\nself.addEventListener('install',event=>event.waitUntil((async()=>{\n  const cache=await caches.open(SHELL);\n  const response=await fetch('/',{cache:'reload'});\n  if(!response.ok)throw Error('Could not save app');\n  await cache.put('/',response);\n  await self.skipWaiting();\n})()));\nself.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));\nself.addEventListener('fetch',event=>{\n  const url=new URL(event.request.url);\n  if(url.origin!==self.location.origin||event.request.method!=='GET'||event.request.mode!=='navigate'||url.pathname!=='/')return;\n  // Show the saved page immediately, while replacing it in the background for next opening.\n  const update=fetch(event.request).then(async response=>{\n    if(response.ok&&(response.headers.get('content-type')||'').includes('text/html'))await(await caches.open(SHELL)).put('/',response.clone());\n    return response;\n  });\n  event.waitUntil(update.catch(()=>{}));\n  event.respondWith((async()=>{\n    const saved=await(await caches.open(SHELL)).match('/');\n    if(saved)return saved;\n    try{return await update;}catch{return new Response('Please open online once to save this app.',{status:503,headers:{'content-type':'text/plain'}});}\n  })());\n});\n\nself.addEventListener('push',event=>{\n  let data={};try{data=event.data?.json()||{};}catch{}\n  event.waitUntil(self.registration.showNotification(data.title||'Prayer reminder',{body:data.body||'Open Omar Mosque Prayer Times.',tag:data.tag||'omar-reminder',data:{url:'/'}}));\n});\nself.addEventListener('notificationclick',event=>{\n  event.notification.close();\n  event.waitUntil((async()=>{for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){if(new URL(client.url).origin===self.location.origin){await client.focus();return;}}await self.clients.openWindow('/');})());\n});\n",{headers:{...headers,'content-type':'application/javascript','service-worker-allowed':'/'}});
    if(url.pathname==='/manifest.webmanifest')return Response.json({"id":"/","name":"Omar Mosque Prayer Times","short_name":"Prayer Times","start_url":"/","scope":"/","display":"standalone","background_color":"#10233a","theme_color":"#10233a"},{headers:{...headers,'content-type':'application/manifest+json'}});
    if(url.pathname.startsWith('/api/push/')) {
      if(!env?.PRAYER_PUSH)return Response.json({error:'Reminder service is deploying. Try again shortly.'},{status:503,headers});
      if(url.pathname!=='/api/push/key'){
        if(request.method!=='POST'||request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});
        if(Number(request.headers.get('Content-Length'))>25000)return new Response('Too large',{status:413});
        const text=await request.text();if(text.length>25000)return new Response('Too large',{status:413});
        let data;try{data=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
        if(url.pathname==='/api/push/save'){
          const s=await schedule();if(s.month!==data.month||s.version!==data.version)return Response.json({error:'Refresh the official timetable before enabling reminders.'},{status:409,headers});
          if(s.version===VERIFIED_HASH)data.rows=VERIFIED_ROWS;
        }
        request=new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      }else if(request.method!=='GET')return new Response('Method not allowed',{status:405});
      const response=await env.PRAYER_PUSH.get(env.PRAYER_PUSH.idFromName('omar-reminders-v1')).fetch(request);
      return new Response(response.body,{status:response.status,headers:{'content-type':'application/json',...headers}});
    }
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



// RFC 8291 payload encryption and RFC 8292 VAPID, using Workers Web Crypto.
const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function join(...parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0));let pos=0;for(const p of parts){out.set(new Uint8Array(p),pos);pos+=p.byteLength;}return out;}
async function hkdf(ikm,salt,info,length){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,length*8));}
async function encryptPush(subscription,message){
  const ua=unb64(subscription.keys.p256dh), auth=unb64(subscription.keys.auth);
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const pub=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const peer=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret=await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256);
  const ikm=await hkdf(secret,auth,join(enc.encode('WebPush: info\0'),ua,pub),32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),12);
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const plaintext=join(enc.encode(JSON.stringify(message)),new Uint8Array([2]));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,plaintext);
  const header=new Uint8Array(5);new DataView(header.buffer).setUint32(0,4096);header[4]=65;
  return join(salt,header,pub,ciphertext);
}
async function sendPush(subscription,message,keys){
  const unsigned=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64(enc.encode(JSON.stringify({aud:new URL(subscription.endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'https://omar-berlin-prayer-times.khalil93ayoub.workers.dev'})));
  const key=await crypto.subtle.importKey('jwk',keys.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned));
  const response=await fetch(subscription.endpoint,{method:'POST',redirect:'error',headers:{Authorization:'vapid t='+unsigned+'.'+b64(sig)+', k='+keys.publicKey,TTL:'120',Urgency:'high','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'},body:await encryptPush(subscription,message)});
  return response.status;
}
function validSubscription(s){
  if(!s || typeof s.endpoint!=='string'||s.endpoint.length>2048)return false;
  try{const u=new URL(s.endpoint);if(u.protocol!=='https:'||u.username||u.password||u.port||!(u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'))return false;
    return unb64(s.keys.p256dh).length===65&&unb64(s.keys.auth).length===16;
  }catch{return false;}
}
function prayerAlerts(month,rows,now=Date.now()){
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid month');
  const [y,m]=month.split('-').map(Number),days=new Date(Date.UTC(y,m,0)).getUTCDate();
  if(!Array.isArray(rows)||rows.length!==days)throw Error('Incomplete month');
  const events=[];
  rows.forEach((row,index)=>{
    if(!Array.isArray(row)||row.length!==6||row.some((t,i)=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)||(i>0&&t<=row[i-1])))throw Error('Invalid times');
    const day=month+'-'+String(index+1).padStart(2,'0');
    const offset=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Berlin',timeZoneName:'longOffset'}).formatToParts(new Date(day+'T12:00Z')).find(p=>p.type==='timeZoneName').value.replace('GMT','');
    for(const [name,col] of [['Fajr',0],['Dhuhr',2],['Asr',3],['Maghrib',4],['Isha',5]]){
      const prayerAt=Date.parse(day+'T'+row[col]+':00'+offset),at=prayerAt-600000;
      if(at>now&&at<now+93*86400000)events.push({at,prayerAt,name,time:row[col],tag:'omar-'+day+'-'+name});
    }
  });return events;
}
export class PrayerPush {
  constructor(state){this.state=state;this.store=state.storage;this.queue=Promise.resolve();
    state.blockConcurrencyWhile(async()=>{this.keys=await this.store.get('keys');if(!this.keys){const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);this.keys={publicKey:b64(await crypto.subtle.exportKey('raw',key.publicKey)),privateKey:await crypto.subtle.exportKey('jwk',key.privateKey)};await this.store.put('keys',this.keys);}});
  }
  serial(fn){const job=this.queue.then(fn);this.queue=job.catch(()=>{});return job;}
  fetch(request){return this.serial(()=>this.handle(request));}
  async handle(request){
    const path=new URL(request.url).pathname;
    if(path==='/api/push/key'){
      if(new URL(request.url).searchParams.get('check')==='crypto'){
        let stage='VAPID signing';
        try{
          const key=await crypto.subtle.importKey('jwk',this.keys.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
          await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode('self-test'));
          stage='Push encryption';
          const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
          await encryptPush({keys:{p256dh:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}},{title:'Self-test'});
          return Response.json({ok:true});
        }catch(e){return Response.json({ok:false,stage,error:String(e.message).slice(0,180)});}
      }
      return Response.json({publicKey:this.keys.publicKey});
    }
    try{
      const data=await request.json();
      if(!validSubscription(data.subscription)||!/^[a-f0-9]{64}$/.test(data.token))return Response.json({error:'Invalid subscription'},{status:400});
      const id=b64(await crypto.subtle.digest('SHA-256',enc.encode(data.subscription.endpoint)));
      const key='sub:'+id,old=await this.store.get(key);
      if(old&&old.token!==data.token)return Response.json({error:'Subscription belongs to another installation. Disable and re-enable notifications.'},{status:403});
      if(path==='/api/push/remove'){if(old)await this.store.delete(key);await this.rearm();return Response.json({ok:true});}
      if(path==='/api/push/status')return Response.json({enabled:!!old,until:old?.until,lastError:old?.lastError||null});
      if(path==='/api/push/test'){
        if(!old)return Response.json({error:'Enable reminders first'},{status:400});
        if(Date.now()-(old.testAt||0)<60000)return Response.json({error:'Wait one minute before another test'},{status:429});
        // Apply cooldown only after a successful send, so a failed test can be retried.
        let status;
        try{status=await sendPush(old.subscription,{title:'Prayer reminders enabled',body:'You will receive a reminder 10 minutes before each saved prayer time.',tag:'omar-test',url:'/'},this.keys);}
        catch(e){return Response.json({error:'Notification sending failed: '+String(e.message).slice(0,180)},{status:502});}
        if(status<200||status>=300)return Response.json({error:'Push service rejected the test ('+status+'). Try disabling and enabling reminders again.'},{status:502});
        old.testAt=Date.now();await this.store.put(key,old);
        return Response.json({ok:true});
      }
      if(path!=='/api/push/save')return new Response('Not found',{status:404});
      if(!old&&(await this.store.list({prefix:'sub:',limit:101})).size>=100)return Response.json({error:'Reminder service is full'},{status:429});
      const events=prayerAlerts(data.month,data.rows);
      const previous=(old?.events||[]).filter(e=>!e.tag.startsWith('omar-'+data.month)&&e.at>Date.now());
      const combined=[...previous,...events].sort((a,b)=>a.at-b.at).slice(0,465);
      const until=combined.length?new Date(combined[combined.length-1].prayerAt).toISOString():null;
      await this.store.put(key,{subscription:data.subscription,token:data.token,events:combined,until,testAt:old?.testAt||0,lastError:null});
      await this.rearm();return Response.json({ok:true,until});
    }catch{return Response.json({error:'Could not save reminders. Please retry.'},{status:400});}
  }
  async rearm(){
    const subs=await this.store.list({prefix:'sub:'});let next=Infinity;
    for(const s of subs.values())if(s.events.length)next=Math.min(next,s.events[0].at);
    if(Number.isFinite(next))await this.store.setAlarm(Math.max(Date.now()+1000,next));else await this.store.deleteAlarm();
  }
  alarm(){return this.serial(async()=>{
    const subs=await this.store.list({prefix:'sub:'}),now=Date.now();
    for(const [key,s] of subs){let deleted=false;
      while(s.events.length&&s.events[0].at<=now){
        const e=s.events.shift();
        if(now-e.at>120000)continue; // Do not send a late reminder after a service outage.
        let status=0;try{status=await sendPush(s.subscription,{title:e.name+' in 10 minutes',body:e.name+' at '+e.time+' · Berlin · Omar Mosque',tag:e.tag,url:'/'},this.keys);}catch{}
        if(status===404||status===410){await this.store.delete(key);deleted=true;break;}
        if(status<200||status>=300){s.lastError='Push delivery failed ('+status+').';if((e.retries||0)<2){s.events.unshift({...e,at:now+30000,retries:(e.retries||0)+1});}break;}
        s.lastError=null;
      }
      if(!deleted){if(!s.events.length&&s.until&&Date.parse(s.until)<now-7*86400000)await this.store.delete(key);else await this.store.put(key,s);}
    }
    await this.rearm();
  });}
}

