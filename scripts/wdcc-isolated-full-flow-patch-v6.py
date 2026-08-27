from pathlib import Path

p=Path('scripts/wdcc-isolated-full-flow-e2e-v2.mjs')
s=p.read_text()
marker="    const page=await context.newPage();const name=`Flow ${kind} ${tag}`;\n"
approval=r'''    if(kind==='approval'){
      await page.goto(`${BASE}${path}?source=${encodeURIComponent(source)}`,{waitUntil:'domcontentloaded',timeout:30000});
      const info=page.locator('section[data-stage="info"]');
      await info.waitFor({state:'visible',timeout:30000});
      const infoInputs=info.locator('input');
      await infoInputs.nth(0).fill(name);
      await infoInputs.nth(1).fill('813-555-0147');
      await infoInputs.nth(2).fill(`approval-${tag}@wdcc-e2e.test`);
      await infoInputs.nth(3).fill('5200');
      await page.getByRole('button',{name:'Continue'}).click();
      const vehicleStage=page.locator('section[data-stage="vehicle"]');
      await vehicleStage.waitFor({state:'visible',timeout:10000});
      const vehicleInputs=vehicleStage.locator('input');
      await vehicleInputs.nth(0).fill('1500');
      await vehicleInputs.nth(1).fill('2021 Toyota Camry');
      await vehicleStage.locator('select').selectOption({label:'Google'});
      await page.getByRole('button',{name:'Continue'}).click();
      const review=page.locator('section[data-stage="review"]');
      await review.waitFor({state:'visible',timeout:10000});
      await review.locator('input[type="checkbox"]').check();
      const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/leads')&&r.request().method()==='POST',{timeout:30000});
      await page.getByRole('button',{name:'SEND PRE-APPROVAL REQUEST'}).click();
      const response=await responsePromise;
      const payload=await response.json();
      if(response.status()!==201||payload?.ok!==true||payload?.persisted!==true)fail('LEAD_approval_SUBMIT',{status:response.status(),payload});
      if(payload?.item?.kind!=='approval'||payload?.item?.source!==source)fail('LEAD_approval_ROUTE',payload?.item);
      if(payload?.sync?.upstream!=='synced')fail('LEAD_approval_UPSTREAM',payload?.sync);
      if(payload?.notifications?.webhook!=='sent')fail('LEAD_approval_WEBHOOK',payload?.notifications);
      await page.getByRole('status').waitFor({state:'visible',timeout:10000});
      await page.screenshot({path:`${SCREENS}/lead-approval.png`,fullPage:true});
      await page.close();
      return {id:payload.item.id,name,kind:'approval',source,upstream:payload.sync.upstream,webhook:payload.notifications.webhook};
    }
'''
if marker not in s:
    raise SystemExit('leadFlow marker not found')
s=s.replace(marker,marker+approval,1)
replacements={
    "page.getByLabel('Name')":"page.locator('input[name=\"name\"]')",
    "page.getByLabel('Phone')":"page.locator('input[name=\"phone\"]')",
    "page.getByLabel('Email')":"page.locator('input[name=\"email\"]')",
    "page.getByLabel('Vehicle of interest')":"page.locator('input[name=\"vehicleInterest\"]')",
    "page.getByLabel('Preferred date or time')":"page.locator('input[name=\"preferredTime\"]')",
    "page.getByLabel('Message')":"page.locator('textarea[name=\"message\"]')",
}
for old,new in replacements.items():
    s=s.replace(old,new)
p.write_text(s)
