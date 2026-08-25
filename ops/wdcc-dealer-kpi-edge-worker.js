const PRIMARY = "https://wdcc-cpx-launch-qhcvflfih-cpxagency.vercel.app";
const FALLBACK = "https://wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app";
const HOTFIX_MARKER = "WDCC_KPI_EDGE_V1";

function targetUrl(request, base) {
  const incoming = new URL(request.url);
  const target = new URL(base);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  return target;
}

function dealerEnhancementScript() {
  return `<script data-wdcc-edge="${HOTFIX_MARKER}">
(()=>{
  if(window.__wdccKpiEdgeV1)return;
  window.__wdccKpiEdgeV1=true;

  const routes=[
    '/dealer/leads?view=new-today',
    '/dealer/leads?view=hot',
    '/dealer/leads?view=appointments',
    '/dealer/inventory?view=published',
    '/dealer/leads?view=sold'
  ];
  const viewLabel={hot:'Hot',appointments:'Appointments',sold:'Sold',all:'All',published:'Published'};
  const photoOf=v=>v&&(v.primaryPhotoPathname||v.primaryPhoto||v.photoPathname||(v.photos&&v.photos[0]&&(v.photos[0].pathname||v.photos[0])))||'';
  const photoUrl=p=>!p?'':/^https?:\/\//i.test(String(p))?String(p):'/api/media?p='+encodeURIComponent(String(p));

  function wireKpis(){
    const cards=[...document.querySelectorAll('.crmKpis article')];
    cards.slice(0,5).forEach((card,i)=>{
      if(card.dataset.wdccDrilldown)return;
      card.dataset.wdccDrilldown=routes[i];
      card.setAttribute('role','link');
      card.setAttribute('aria-label','Open '+((card.querySelector('span')||{}).textContent||'dashboard list'));
      card.tabIndex=0;
      card.style.cursor='pointer';
      card.style.position='relative';
      const arrow=document.createElement('span');
      arrow.textContent='›';
      arrow.setAttribute('aria-hidden','true');
      Object.assign(arrow.style,{position:'absolute',right:'14px',top:'10px',fontSize:'20px',color:'#8293a3',fontWeight:'700'});
      card.appendChild(arrow);
      const go=()=>{location.href=routes[i]};
      card.addEventListener('click',e=>{if(e.target.closest('a,button,input,select,textarea'))return;go()});
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
    });
  }

  async function addInventoryThumbs(){
    const list=document.querySelector('.inventoryPulseList');
    if(!list||list.dataset.wdccThumbs)return;
    list.dataset.wdccThumbs='loading';
    try{
      const r=await fetch('/api/crm/dashboard',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok){delete list.dataset.wdccThumbs;return}
      const j=await r.json();
      const inv=j.inventory||[];
      const links=[...list.querySelectorAll('a')];
      links.forEach((a,i)=>{
        if(a.querySelector('[data-wdcc-thumb]')||!inv[i])return;
        const p=photoUrl(photoOf(inv[i]));
        let el;
        if(p){
          el=document.createElement('img');
          el.src=p;
          el.alt=((inv[i].year||'')+' '+(inv[i].make||'')+' '+(inv[i].model||'')).trim();
        }else{
          el=document.createElement('span');
          el.textContent='NO PHOTO';
          Object.assign(el.style,{fontSize:'7px',color:'#748698',fontWeight:'800',display:'grid',placeItems:'center'});
        }
        el.dataset.wdccThumb='1';
        Object.assign(el.style,{width:'58px',height:'44px',objectFit:'cover',borderRadius:'8px',flex:'0 0 auto',background:'#0b1824',border:'1px solid #22394c'});
        Object.assign(a.style,{display:'grid',gridTemplateColumns:'58px minmax(0,1fr) auto',alignItems:'center',gap:'10px'});
        a.insertBefore(el,a.firstChild);
      });
      list.dataset.wdccThumbs='1';
    }catch{delete list.dataset.wdccThumbs}
  }

  function clickRequestedTab(){
    const u=new URL(location.href);
    const view=u.searchParams.get('view');
    if(!view)return;
    if(view==='new-today'){
      const all=[...document.querySelectorAll('.leadInboxTabs button')].find(b=>/^All\b/i.test(b.textContent||''));
      if(all&&!all.dataset.wdccClicked){all.dataset.wdccClicked='1';all.click();setTimeout(filterToday,100)}
      return;
    }
    const label=viewLabel[view];
    if(!label)return;
    const btn=[...document.querySelectorAll('.leadInboxTabs button')].find(b=>(b.textContent||'').trim().toLowerCase().startsWith(label.toLowerCase()));
    if(btn&&!btn.dataset.wdccClicked){btn.dataset.wdccClicked='1';btn.click()}
  }

  async function filterToday(){
    if(!location.search.includes('view=new-today')||window.__wdccTodayFilterBusy)return;
    const cards=[...document.querySelectorAll('.leadCards .leadCardPro')];
    if(!cards.length)return;
    window.__wdccTodayFilterBusy=true;
    try{
      const r=await fetch('/api/crm/dashboard',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return;
      const j=await r.json();
      const today=new Date().toDateString();
      const ids=new Set((j.leads||[]).filter(x=>{const d=new Date(x.createdAt||x.created_at||0);return !Number.isNaN(d.getTime())&&d.toDateString()===today}).map(x=>String(x.id)));
      cards.forEach(card=>{const t=card.textContent||'';const match=[...ids].some(id=>t.includes('Lead ID: '+id));card.style.display=match?'':'none'});
      document.querySelector('[data-wdcc-today-empty]')?.remove();
      if(!ids.size){const box=document.createElement('div');box.className='crmEmpty';box.dataset.wdccTodayEmpty='1';box.textContent='No new leads today.';document.querySelector('.leadCards')?.appendChild(box)}
    }catch{}finally{window.__wdccTodayFilterBusy=false}
  }

  function apply(){
    wireKpis();
    addInventoryThumbs();
    clickRequestedTab();
    if(location.search.includes('view=new-today'))filterToday();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  const mo=new MutationObserver(apply);
  mo.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>mo.disconnect(),12000);
})();
</script>`;
}

async function enhanceDealerHtml(response, incoming) {
  if (incoming.method !== "GET" || !incoming.pathname.startsWith("/dealer")) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  let html = await response.text();
  if (!html.includes(HOTFIX_MARKER)) {
    const script = dealerEnhancementScript();
    html = html.includes("</body>") ? html.replace("</body>", script + "</body>") : html + script;
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  headers.set("cache-control", "private, no-store, max-age=0, must-revalidate");
  headers.set("x-wdcc-kpi-edge", HOTFIX_MARKER);
  return new Response(html, {status: response.status, statusText: response.statusText, headers});
}

async function proxy(request, base) {
  const incoming = new URL(request.url);
  const target = targetUrl(request, base);
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-wdcc-frontdoor", "cloudflare-dealer");
  headers.delete("cf-worker");
  const init = {method: request.method, headers, redirect: "manual"};
  if (!["GET", "HEAD"].includes(request.method)) init.body = request.body;
  const response = await fetch(new Request(target.toString(), init));
  const outHeaders = new Headers(response.headers);
  const location = outHeaders.get("location");
  if (location) {
    try {
      const loc = new URL(location, target);
      if (loc.hostname === new URL(base).hostname) {
        loc.protocol = incoming.protocol;
        loc.hostname = incoming.hostname;
        loc.port = incoming.port;
        outHeaders.set("location", loc.toString());
      }
    } catch {}
  }
  outHeaders.set("x-wdcc-edge", "cloudflare-dealer");
  outHeaders.set("x-wdcc-origin", new URL(base).hostname);
  const proxied = new Response(response.body, {status: response.status, statusText: response.statusText, headers: outHeaders});
  return enhanceDealerHtml(proxied, {method: request.method, pathname: incoming.pathname});
}

export default {
  async fetch(request) {
    try {
      const response = await proxy(request, PRIMARY);
      if (response.status < 500) return response;
    } catch {}
    try {
      return await proxy(request, FALLBACK);
    } catch {
      return new Response("Dealer portal temporarily unavailable", {status: 503, headers: {"cache-control": "no-store"}});
    }
  }
};
