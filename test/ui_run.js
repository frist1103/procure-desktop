const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('file://' + OUT + '/harness.html');
  await pg.waitForSelector('#nav:not([hidden])');
  await pg.click('#nav [data-page="proc"]');
  await pg.waitForSelector('.p-card');
  await pg.screenshot({ path: OUT + '/1-list.png', fullPage: true });
  // เปิดงานโดรน
  await pg.click('.p-card');
  await pg.waitForSelector('#ed-body .sec');
  await pg.screenshot({ path: OUT + '/2-drone-step5.png', fullPage: true });
  for (const s of [1, 2, 3]) { await pg.click(`#ed-steps [data-step="${s}"]`); await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + `/3-drone-step${s}.png`, fullPage: true }); }
  await pg.click('#ed-back'); await pg.waitForSelector('#p-new');
  // งานใหม่
  await pg.click('#p-new'); await pg.waitForSelector('#f-subject');
  await pg.fill('#f-subject', 'เครื่องพิมพ์เลเซอร์ ขาวดำ');
  await pg.click('#f-project_name'); await pg.type('#f-project_name', 'สื่อ'); await pg.waitForSelector('.combo-list [data-i]');
  await pg.screenshot({ path: OUT + '/4-combo.png' });
  await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(150);
  await pg.fill('#f-reason', 'ใช้พิมพ์เอกสารงานธุรการ');
  await pg.click('#f-admin_group'); await pg.type('#f-admin_group', 'ทั่วไป'); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(100);
  await pg.fill('#f-budget_amount', '8500');
  const persons = ['รัตนา3', 'วันเพ็ญ3', 'สุริยา3'];
  for (let i = 0; i < 3; i++) { const sel = `input[data-cm="TOR"][data-i="${i}"]`; await pg.click(sel); await pg.type(sel, persons[i]); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(100); }
  await pg.fill('[data-sp="background"][data-i="0"]', 'เครื่องพิมพ์เดิมชำรุด');
  await pg.fill('[data-sp="objective"][data-i="0"]', 'เพื่อใช้พิมพ์เอกสาร');
  await pg.fill('[data-sp="spec"][data-i="0"]', 'พิมพ์ได้ 30 แผ่นต่อนาที');
  await pg.fill('#f-tor_order_no', '501');
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: OUT + '/5-new-step1.png', fullPage: true });
  await pg.click('#act-save'); await pg.waitForTimeout(600);
  await pg.click('#act-gen'); await pg.waitForSelector('.modal'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/6-gen1.png' });
  await pg.click('.modal .btns .btn'); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: OUT + '/6b-after.png', fullPage: false });
  await pg.click('#act-next'); await pg.waitForTimeout(500); await pg.screenshot({ path: OUT + '/6c-next.png', fullPage: false }); await pg.waitForSelector('.item-desc', { timeout: 5000 });
  await pg.click('.item-desc'); await pg.type('.item-desc', 'เครื่องพิมพ์'); await pg.waitForSelector('.combo-list [data-i]'); await pg.click('.combo-list [data-i="0"]'); await pg.waitForTimeout(200);
  await pg.fill('[data-it="0"][data-ik="unit_price"]', '5500');
  await pg.click('[data-act="additem"]'); await pg.waitForTimeout(150);
  await pg.fill('[data-it="1"][data-ik="description"]', 'ตลับหมึกสำรอง');
  await pg.fill('[data-it="1"][data-ik="qty"]', '2'); await pg.fill('[data-it="1"][data-ik="unit"]', 'กล่อง'); await pg.fill('[data-it="1"][data-ik="unit_price"]', '1500');
  await pg.click('[data-act="newvendor"]'); await pg.waitForSelector('.modal [data-vf="vendor_name"]');
  await pg.fill('[data-vf="vendor_name"]', 'ร้านคอมพิวเตอร์แม่ฮ่องสอน'); await pg.fill('[data-vf="tax_id"]', '1234567890123'); await pg.fill('[data-vf="province"]', 'แม่ฮ่องสอน');
  await pg.screenshot({ path: OUT + '/7-vendor.png' });
  await pg.click('.modal .btns .primary'); await pg.waitForTimeout(700);
  await pg.screenshot({ path: OUT + '/8-new-step2.png', fullPage: true });
  await pg.click('#act-confirm'); await pg.waitForSelector('.modal'); await pg.screenshot({ path: OUT + '/9-confirm.png' });
  await pg.click('.modal .btns .primary'); await pg.waitForTimeout(900);
  await pg.screenshot({ path: OUT + '/10-confirmed.png' });
  const title = await pg.textContent('.modal h3').catch(() => '');
  await pg.click('.modal .btns .btn'); await pg.waitForTimeout(300);
  await pg.click('#act-next'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/11-step3.png', fullPage: true });
  // มือถือ
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/12-mobile.png', fullPage: false });
  await pg.click('#ed-back'); await pg.waitForTimeout(400);
  await pg.screenshot({ path: OUT + '/13-mobile-list.png', fullPage: true });
  console.log('confirm modal:', title);
  console.log('item0:', await pg.evaluate(()=>JSON.stringify(1)));
  console.log('ERRORS:', JSON.stringify(errs, null, 1));
  await b.close();
})();
