// ทดสอบเฟส 2.2a: เปิดจากข้อมูลในเครื่อง, บันทึกเบื้องหลัง, ไม่โหลดซ้ำ, ประวัติโหลดเมื่อกด, แผงความเร็ว
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
(async () => {
  // ใช้ http (IndexedDB ต้องมี origin)
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(OUT, 'harness.html'))); }).listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const calls = () => pg.evaluate(() => (window.__calls || []).slice());
  const resetCalls = () => pg.evaluate(() => { window.__calls = []; });
  await pg.goto(url);
  await pg.waitForSelector('#nav:not([hidden])');
  await pg.click('#nav [data-page="proc"]');
  await pg.waitForSelector('.p-card');
  // 1) เปิดงาน: คำสั่งเดียว (งาน+ราคาล่าสุด+กฎ)
  await resetCalls();
  await pg.click('.p-card'); await pg.waitForSelector('#ed-body .sec'); await pg.waitForTimeout(300);
  let c = await calls(); assert(c.length === 1 && c[0] === 'apiProcGet', 'เปิดงานเรียกเซิร์ฟเวอร์ 1 ครั้ง: ' + c.join(','));
  // 2) กลับรายการ: แสดงทันทีจากหน่วยความจำ
  await resetCalls();
  await pg.evaluate(() => { window.__DELAYALL = 1500; });
  await pg.click('#ed-back');
  await pg.waitForTimeout(100);
  assert(await pg.$('.p-card') && !(await pg.$('#proc-list .loading')), 'กลับรายการแสดงทันที (ไม่ต้องรอ)');
  await pg.waitForTimeout(1700);
  // 3) เปิดงานเดิมซ้ำ (ช้า 1.5 วิ): แสดงจากข้อมูลในเครื่องทันที ปุ่มบันทึกล็อกระหว่างตรวจ
  await pg.click('.p-card'); await pg.waitForTimeout(150);
  assert(await pg.$('#ed-body .sec'), 'เปิดงานซ้ำแสดงทันทีจากข้อมูลในเครื่อง');
  const st = await pg.textContent('#act-state'); assert(/ตรวจข้อมูลล่าสุด/.test(st), 'ระหว่างตรวจ: ' + st);
  assert(await pg.$eval('#act-gen', e => e.disabled), 'ปุ่มออกเอกสารล็อกระหว่างตรวจ');
  await pg.waitForTimeout(1700);
  assert(!/ตรวจข้อมูลล่าสุด/.test(await pg.textContent('#act-state')), 'ตรวจเสร็จ ปลดล็อก');
  await pg.evaluate(() => { window.__DELAYALL = 60; });
  await pg.click('#ed-back'); await pg.waitForTimeout(300);
  // 4) งานใหม่ → บันทึกเบื้องหลัง: พิมพ์ต่อระหว่างบันทึก ข้อความไม่หาย โฟกัสไม่หลุด
  await pg.click('#p-new'); await pg.waitForSelector('#f-subject');
  await pg.fill('#f-subject', 'ทดสอบบันทึกเบื้องหลัง');
  await pg.evaluate(() => { window.__DELAY = { apiProcSave: 1500 }; });
  await pg.click('#act-save'); await pg.waitForTimeout(100);
  assert(/กำลังบันทึก/.test(await pg.textContent('#act-state')), 'แสดงสถานะกำลังบันทึก');
  await pg.click('#f-reason'); await pg.type('#f-reason', 'พิมพ์ระหว่างบันทึก');
  await pg.waitForTimeout(1700);
  assert((await pg.inputValue('#f-reason')) === 'พิมพ์ระหว่างบันทึก', 'ข้อความที่พิมพ์ระหว่างบันทึกยังอยู่');
  assert(await pg.evaluate(() => document.activeElement && document.activeElement.id) === 'f-reason', 'โฟกัสยังอยู่ช่องเดิม');
  assert(/ยังไม่บันทึก/.test(await pg.textContent('#act-state')), 'ยังถือว่ามีการแก้ที่ยังไม่บันทึก: ' + await pg.textContent('#act-state'));
  assert(/รหัสงาน PR/.test(await pg.textContent('.ed-title .m')), 'หัวงานได้รหัสงานแล้ว');
  // กดบันทึก 2 ครั้งติด → บันทึกต่ออีกรอบ
  await resetCalls();
  await pg.click('#act-save'); await pg.waitForTimeout(50); await pg.type('#f-reason', ' เพิ่ม'); await pg.click('#act-save');
  await pg.waitForTimeout(3600);
  c = await calls(); assert(c.filter(x => x === 'apiProcSave').length === 2, 'กดซ้ำระหว่างบันทึก → บันทึกรอบสอง: ' + c.join(','));
  assert(/บันทึกแล้ว/.test(await pg.textContent('#act-state')), 'สุดท้ายบันทึกครบ: ' + await pg.textContent('#act-state'));
  const saved = await pg.evaluate(() => { var p = readAll_('Procurement').filter(function (x) { return x.subject === 'ทดสอบบันทึกเบื้องหลัง'; })[0]; return p && p.reason; });
  assert(saved === 'พิมพ์ระหว่างบันทึก เพิ่ม', 'ชีตได้ค่าล่าสุด: ' + saved);
  await pg.evaluate(() => { window.__DELAY = {}; });
  // 5) ประวัติ: โหลดเมื่อกด
  await resetCalls();
  await pg.click('#ed-log'); await pg.waitForSelector('.loglist'); 
  c = await calls(); assert(c.join() === 'apiProcLog', 'ประวัติโหลดเมื่อกด: ' + c.join(','));
  assert(/สร้างงาน/.test(await pg.textContent('.loglist')), 'ประวัติมีรายการ "สร้างงาน"');
  await pg.click('.modal .btns .btn'); await pg.waitForTimeout(200);
  // 6) กลับรายการ: งานใหม่อยู่บนสุดทันที
  await pg.click('#ed-back'); await pg.waitForTimeout(100);
  assert(/ทดสอบบันทึกเบื้องหลัง/.test(await pg.textContent('.p-card .t')), 'งานที่เพิ่งบันทึกขึ้นบนสุดของรายการทันที');
  await pg.waitForTimeout(400);
  // 7) งานถูกแก้จากที่อื่น → เปิดจากเครื่องก่อน แล้วอัปเดตเป็นข้อมูลล่าสุด
  await pg.evaluate(() => {
    var p = readAll_('Procurement').filter(function (x) { return x.subject === 'ทดสอบบันทึกเบื้องหลัง'; })[0];
    __user = null; __tableCache = {};
    updateRow_('Procurement', p._row, { subject: 'ชื่อที่แก้จากเครื่องอื่น', rev: Number(p.rev) + 1 });
    __tableCache = {};
    window.__DELAYALL = 1200;
  });
  await pg.click('.p-card'); await pg.waitForTimeout(150);
  assert(/ทดสอบบันทึกเบื้องหลัง/.test(await pg.textContent('#ed-h')), 'แสดงข้อมูลในเครื่องก่อน');
  await pg.waitForTimeout(1500);
  assert(/ชื่อที่แก้จากเครื่องอื่น/.test(await pg.textContent('#ed-h')), 'อัปเดตเป็นข้อมูลล่าสุดเมื่อเซิร์ฟเวอร์ตอบ');
  await pg.evaluate(() => { window.__DELAYALL = 60; });
  // 8) โหลดหน้าใหม่: รายการแสดงจาก IndexedDB ก่อนเซิร์ฟเวอร์ตอบ
  await pg.reload(); await pg.waitForSelector('#nav:not([hidden])');
  await pg.evaluate(() => { window.__DELAY = { apiProcList: 2000 }; });
  await pg.click('#nav [data-page="proc"]'); await pg.waitForTimeout(250);
  assert(await pg.$('.p-card'), 'หลังโหลดหน้าใหม่ รายการแสดงจากข้อมูลในเครื่องทันที');
  const note = await pg.textContent('#p-note'); assert(/กำลังอัปเดต/.test(note), 'มีป้าย "กำลังอัปเดต…" [' + note + '] calls=' + (await calls()).join(','));
  await pg.waitForTimeout(2200);
  await pg.screenshot({ path: OUT + '/22-list.png', fullPage: true });
  // 9) ล้างข้อมูลในเครื่อง
  await pg.click('#p-clear'); await pg.waitForTimeout(300);
  const left = await pg.evaluate(() => new Promise(r => { var q = indexedDB.open('procure-cache', 1); q.onsuccess = () => { var t = q.result.transaction('kv').objectStore('kv').getAllKeys(); t.onsuccess = () => r(t.result); }; }));
  assert(!left.some(k => /^proc:/.test(k)), 'ล้างข้อมูลงานในเครื่องแล้ว: ' + left.join(','));
  // 10) แผงความเร็ว
  await pg.click('#nav [data-page="settings"]'); await pg.click('#set-tabs [data-tab="tools"]'); await pg.waitForTimeout(200);
  const perf = await pg.textContent('#perf-out');
  assert(/เปิดงาน/.test(perf) && /บันทึก/.test(perf), 'แผงความเร็วแสดงคำสั่ง');
  await pg.screenshot({ path: OUT + '/22-perf.png', fullPage: true });
  console.log('ERRORS:', JSON.stringify(errs));
  await b.close(); srv.close();
})();
