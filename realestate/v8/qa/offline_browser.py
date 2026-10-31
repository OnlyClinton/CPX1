import json,re,base64,os
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'tests';out.mkdir(exist_ok=True)
css=(root/'assets/main.css').read_text();js=(root/'assets/main.js').read_text()
for a in (root/'assets').iterdir():
 if a.suffix.lower() in ('.webp','.svg','.jpg','.png'):
  mime={'.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'}[a.suffix]
  data='data:'+mime+';base64,'+base64.b64encode(a.read_bytes()).decode()
  css=css.replace("url('"+a.name+"')","url('"+data+"')")
  js=js.replace('assets/'+a.name,data)
results={};fail=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for name in ['index','marketplace','estateos','hiddenmarket','prive','flexstay','founding-three','interest','compare','economics']:
  for mobile in [False,True]:
   page=browser.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile)
   errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
   doc=BeautifulSoup((root/(name+'.html')).read_text(),'html.parser')
   for item in doc.select('script[src],link[rel="stylesheet"],link[rel="preconnect"]'):item.decompose()
   page.set_content(str(doc),wait_until='domcontentloaded')
   # Navigation query is validated separately in production-route tests
   page.add_style_tag(content=css)
   page.add_script_tag(content=js)
   page.wait_for_timeout(150)
   width=page.evaluate('document.documentElement.scrollWidth-innerWidth')
   imgloss=page.locator('.property-image img').evaluate_all('(imgs)=>imgs.filter(x=>x.complete && x.naturalWidth===0).length') if name=='marketplace' else None
   route=f'{name}_{"mobile" if mobile else "desktop"}'
   page.screenshot(path=str(out/(route+'.png')),full_page=True)
   results[route]={'js_errors':errors,'overflow_px':width,'broken_generated_images':imgloss}
   if width>2 or errors or (imgloss or 0)>0:fail.append({'route':route,'result':results[route]})
   if name=='marketplace' and not mobile:
    try:
     assert page.locator('#marketGrid .property-card').count()==4
     assert page.locator('.property-image img').count()==4
     page.locator('#marketSearch').fill('Miami');assert page.locator('#marketGrid .property-card').count()==1
     page.locator('#marketReset').click();assert page.locator('#marketGrid .property-card').count()==4
     results['marketplace_filter']='PASS'
    except Exception as e:fail.append({'marketplace_filter':str(e)})
   if name=='estateos' and mobile:
    try:
     assert page.locator('#osRows tr').count()==5
     btn=page.locator('#osRows button').first
     assert btn.is_visible() and btn.bounding_box()['width']>=100
     old=page.locator('#osOpen').inner_text();btn.click();assert old!=page.locator('#osOpen').inner_text()
     results['estateos_mobile_review']='PASS'
    except Exception as e:fail.append({'estateos_mobile_review':str(e)})
   if name=='hiddenmarket' and not mobile:
    try:
     page.locator('[data-parcel="1"]').click()
     assert 'Research sample B' in page.locator('#parcelDetails').inner_text()
     results['hiddenmarket_evidence']='PASS'
    except Exception as e:fail.append({'hiddenmarket_evidence':str(e)})
   if name=='interest' and not mobile:
    try:
     assert page.locator('#intentProduct').input_value()=='estateos'
     assert page.locator('#intentEmail').get_attribute('href').startswith('mailto:')
     page.locator('#intentSubmit').click();assert 'required' in page.locator('#intentResult').inner_text().lower() or not page.locator('#intentResult').inner_text().startswith('Your information request')
     results['private_inquiry']='PASS'
    except Exception as e:fail.append({'private_inquiry':str(e)})
   if name=='flexstay' and not mobile:
    try:
     old=page.locator('#yieldRows').inner_text();page.locator('#nightRate').fill('600');assert page.locator('#yieldRows').inner_text()!=old
     results['flexstay_calculator']='PASS'
    except Exception as e:fail.append({'flexstay_calculator':str(e)})
   page.close()
 browser.close()
(out/'test-results.json').write_text(json.dumps({'results':results,'failures':fail},indent=2))
print(json.dumps({'rendered':sum(1 for x in results if x.endswith(('mobile','desktop'))),'failed':fail,'functional':{x:y for x,y in results.items() if not x.endswith(('mobile','desktop'))}},indent=2))