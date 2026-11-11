const { chromium } = require('playwright');
const OUT = process.argv[2];
const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + OUT + '/harness.html'); await pg.waitForSelector('#nav:not([hidden])');
  await pg.click('#nav [data-page="proc"]'); await pg.waitForSelector('.p-card');
  // ---- งานใหม่ 1
  await pg.click('#p-new'); await pg.waitForSelector('#f-subject');
  await pg.fill('#f-subject', 'กระดาษและโดรนทดสอบ');
  await pg.click('#f-admin_group'); await pg.type('#f-admin_group', 'กลุ่มบริหารงานพิเศษทดสอบ'); await pg.waitForTimeout(150);
  log('unreg visible:', await pg.isVisible('[data-unreg="admin_group"]'));
  await pg.click('[data-act="adddept"][data-k="admin_group"]'); await pg.waitForSelector('#nd-name');
  await pg.screenshot({ path: OUT + '/1-adddept.png' });
  await pg.click('.modal .btns .primary'); await pg.waitForTimeout(500);
  log('after add: unreg visible:', await pg.isVisible('[data-unreg="admin_group"]'), '| toast:', await pg.textContent('#toast'));
  await pg.click('#f-responsible_unit'); await pg.type('#f-responsible_unit', 'ห้องสมุด'); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(100);
  log('responsible_unit:', await pg.inputValue('#f-responsible_unit'), '| unreg:', await pg.isVisible('[data-unreg="responsible_unit"]'));
  await pg.click('#act-save'); await pg.waitForTimeout(700);
  await pg.click('#ed-steps [data-step="2"]'); await pg.waitForSelector('.item-desc');
  // พิมพ์ชื่อเองตรงกับงานโดรน → ราคาล่าสุด
  await pg.fill('[data-it="0"][data-ik="description"]', 'DJI Neo2-Motion Fly More Combo');
  await pg.click('[data-it="0"][data-ik="qty"]'); await pg.waitForTimeout(500);
  log('item0 price:', await pg.inputValue('[data-it="0"][data-ik="unit_price"]'), '| hint:', await pg.textContent('[data-hint="0"]'));
  await pg.click('[data-act="additem"]'); await pg.waitForTimeout(150);
  await pg.click('[data-it="1"][data-ik="description"]'); await pg.type('[data-it="1"][data-ik="description"]', 'กระดาษ A4'); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(250);
  log('item1 (ไม่มีประวัติ):', await pg.inputValue('[data-it="1"][data-ik="unit"]'), JSON.stringify(await pg.inputValue('[data-it="1"][data-ik="unit_price"]')));
  await pg.fill('[data-it="1"][data-ik="unit_price"]', '125'); await pg.fill('[data-it="1"][data-ik="brand"]', 'Double A');
  await pg.fill('[data-it="1"][data-ik="model"]', '80 แกรม 500 แผ่น'); await pg.fill('[data-it="1"][data-ik="buy_note"]', 'ยี่ห้อใดก็ได้ถ้าไม่มี');
  // ผู้ขายใหม่: เลขผู้เสียภาษีผิด → กล่องไม่ปิด
  await pg.click('[data-act="newvendor"]'); await pg.waitForSelector('[data-vf="vendor_name"]');
  await pg.fill('[data-vf="vendor_name"]', 'ร้านทดสอบเครื่องเขียน'); await pg.fill('[data-vf="tax_id"]', '12345'); await pg.fill('[data-vf="phone"]', '053-111111');
  await pg.click('.modal .btns .primary'); await pg.waitForTimeout(300);
  log('vendor bad tax → modal open:', await pg.isVisible('.modal'), '| err:', await pg.textContent('.modal .merr'), '| phone kept:', await pg.inputValue('[data-vf="phone"]'));
  await pg.screenshot({ path: OUT + '/2-vendor-err.png' });
  await pg.mouse.click(5, 5); await pg.waitForTimeout(150); log('click outside → still open:', await pg.isVisible('.modal'));
  await pg.fill('[data-vf="tax_id"]', '1234567890123'); await pg.click('.modal .btns .primary'); await pg.waitForTimeout(600);
  log('vendor saved → modal open:', await pg.isVisible('.modal').catch(() => false), '| vcard:', (await pg.textContent('.vcard')).slice(0, 60));
  // แก้ผู้ขาย
  await pg.click('[data-act="editvendor"]'); await pg.waitForSelector('[data-vf="address"]');
  await pg.fill('[data-vf="address"]', '9 ถนนขุนลุมประพาส'); await pg.click('.modal .btns .primary'); await pg.waitForTimeout(600);
  log('edit vendor → vcard:', (await pg.textContent('.vcard')).slice(0, 90));
  await pg.screenshot({ path: OUT + '/3-step2.png', fullPage: true });
  await pg.click('#act-save'); await pg.waitForTimeout(700);
  log('saved items:', await pg.evaluate(() => JSON.stringify(SHEETS.ProcItem.getDataRange().getValues().slice(-2).map(r => r.slice(3)))));
  // ขั้น 3: กรรมการตรวจรับ = ชุด TOR (ว่าง) → เลือกเอง 1 คน
  await pg.click('#ed-steps [data-step="3"]'); await pg.waitForTimeout(200);
  const sel = 'input[data-cm="INSPECT"][data-i="0"]'; await pg.click(sel); await pg.type(sel, 'รัตนา3'); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(100);
  await pg.click('#ed-steps [data-step="5"]'); await pg.waitForTimeout(300);
  log('step5 requester:', await pg.inputValue('#f-requester'), '| dept:', await pg.inputValue('#f-dept'), '| toast:', await pg.textContent('#toast'));
  await pg.screenshot({ path: OUT + '/4-step5.png', fullPage: true });
  await pg.click('#act-save'); await pg.waitForTimeout(700);
  await pg.click('#ed-back'); await pg.waitForSelector('#p-new');
  // ---- งานใหม่ 2: เลือกกระดาษจากทะเบียน → ราคา/ยี่ห้อจากงานที่ 1
  await pg.click('#p-new'); await pg.waitForSelector('#f-subject'); await pg.fill('#f-subject', 'กระดาษรอบสอง');
  await pg.click('#ed-steps [data-step="2"]'); await pg.waitForSelector('.item-desc');
  await pg.click('.item-desc'); await pg.type('.item-desc', 'กระดาษ A4'); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(300);
  log('job2 item: unit', await pg.inputValue('[data-it="0"][data-ik="unit"]'), 'price', await pg.inputValue('[data-it="0"][data-ik="unit_price"]'), 'brand', await pg.inputValue('[data-it="0"][data-ik="brand"]'), 'model', await pg.inputValue('[data-it="0"][data-ik="model"]'));
  log('job2 hint:', await pg.textContent('[data-hint="0"]'));
  await pg.click('[data-it="0"][data-ik="brand"]'); await pg.waitForTimeout(150);
  log('brand list:', await pg.textContent('.combo-list').catch(() => '-'));
  await pg.screenshot({ path: OUT + '/5-job2.png', fullPage: true });
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/6-mobile.png', fullPage: true });
  log('DEPT:', await pg.evaluate(() => JSON.stringify(SHEETS.Department.getDataRange().getValues().slice(-1))));
  log('ERRORS:', JSON.stringify(errs));
  await b.close();
})();
