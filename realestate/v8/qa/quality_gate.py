#!/usr/bin/env python3
"""CPX V8 automated preflight. Offline and deterministic: no production writes."""
from pathlib import Path
from bs4 import BeautifulSoup
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
PAGES=['index','marketplace','estateos','flexstay','hiddenmarket','prive','founding-three','interest','compare','economics']
errors=[];warnings=[];out={}
for name in PAGES:
 p=ROOT/(name+'.html');
 if not p.is_file():errors.append(name+': page missing');continue
 dom=BeautifulSoup(p.read_text(),'html.parser')
 h1=dom.select('main h1'); title=dom.select_one('head title')
 if len(h1)!=1:errors.append(name+': needs exactly one H1')
 if not title or name=='':errors.append(name+': title missing')
 if dom.select('[style],script:not([src])'):errors.append(name+': inline executable/style source prohibited')
 if dom.select('a[href="#"],button:not([type])'):errors.append(name+': dummy link or ambiguous button type')
 if not dom.select_one('a.skip-link'):errors.append(name+': accessibility skip link missing')
 if not dom.select_one('main#main'):errors.append(name+': main landmark missing')
 for a in dom.select('[href]'):
  h=a['href'].split('#',1)[0].split('?',1)[0]
  if not h or h.startswith(('http:','https:','mailto:','tel:','javascript:')):continue
  if not (ROOT/h).is_file():errors.append(name+': broken internal href '+h)
 for a in dom.select('img[src]'):
  if not a.get('alt'):errors.append(name+': image missing alt')
  if a['src'].startswith('assets/') and not (ROOT/a['src']).exists():errors.append(name+': missing image '+a['src'])
 out[name]={'title':title.get_text(' ',strip=True) if title else None,'heading':h1[0].get_text(' ',strip=True) if h1 else None,'links':len(dom.select('a[href]'))}
source=(ROOT/'assets/main.js').read_text()
css=(ROOT/'assets/main.css').read_text()
for item in ['marketGrid','osRows','parcelDetails','yieldRows','leadForm','intentForm']:
 if item not in source:errors.append('missing interactive workflow '+item)
for p,s in [('marketplace','interest.html?product=marketplace'),('hiddenmarket','interest.html?product=hiddenmarket'),('prive','interest.html?product=prive'),('flexstay','interest.html?product=flexstay')]:
 if s not in (ROOT/(p+'.html')).read_text():errors.append(p+': no matching conversion route')
for phrase in ['10M+','195+','70% less manual','SOLD OUT','Only one left','Join 10,000 agents']:
 if any(phrase.lower() in (ROOT/(n+'.html')).read_text().lower() for n in PAGES):errors.append('unsubstantiated claim: '+phrase)
for f in (ROOT/'assets').glob('*.webp'):
 if f.stat().st_size>350_000:errors.append('image budget exceeded: '+f.name)
try:
 conf=json.loads((ROOT/'vercel.json').read_text());csp=next(h['value'] for rule in conf['headers'] for h in rule['headers'] if h['key']=='Content-Security-Policy')
 if "script-src 'self'" not in csp or "'unsafe-inline'" in csp or "style-src 'self'" not in csp:errors.append('CSP must be strict self-only scripts/styles')
except Exception as e:errors.append('CSP config invalid: '+str(e))
if re.search(r'@import\s+url\(["\']?https?://',css):errors.append('third-party CSS import')
for f in ['assets/main.js','api/lead.js','worker/lead-worker.js']:
 r=subprocess.run(['node','--check',str(ROOT/f)],capture_output=True,text=True)
 if r.returncode:errors.append('JS syntax: '+f+': '+r.stderr[:150])
# Product identity: no unrelated primary SaaS CTA on PRIVE/marketplace/HiddenMarket
for p in ['prive','marketplace','hiddenmarket','flexstay']:
 dom=BeautifulSoup((ROOT/(p+'.html')).read_text(),'html.parser'); nav=dom.select_one('header .nav-cta')
 if not nav or 'interest.html?product='+p not in nav.get('href',''):errors.append('misrouted primary CTA '+p)
# Legal/release blocker if backend activated without verification
if 'turnstileToken' not in (ROOT/'worker/lead-worker.js').read_text():errors.append('anti-bot verification required')
report={'pass':len(errors)==0,'errors':errors,'warnings':warnings,'pages':out}
(ROOT/'qa'/'quality-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'pass':report['pass'],'errors':errors,'pages':len(out)},indent=2))
sys.exit(1 if errors else 0)