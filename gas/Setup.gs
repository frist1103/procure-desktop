/**
 * Setup.gs — ติดตั้ง นำเข้า ซิงค์ สำรอง
 * ★ รันจากหน้า Apps Script: เลือกฟังก์ชัน setupPhase0 แล้วกด Run (ครั้งแรกจะขออนุญาตสิทธิ์) ★
 * รันซ้ำได้ปลอดภัย: ไม่ลบข้อมูล ไม่เขียนทับรายการที่มีอยู่แล้ว
 */
function setupPhase0() {
  var log = [];
  log = log.concat(ensureSchema_());
  writeConfig_('teacher_view_id', APP.TEACHER_VIEW_ID, 'ไฟล์มุมมองครู');
  var imp = importLegacy_('setupPhase0');
  log.push('นำเข้าจากระบบเดิม: ' + JSON.stringify(imp));
  log.push('มุมมองครู: ' + JSON.stringify(syncTeacherView_()));
  installTriggers_();
  log.push('ติดตั้งทริกเกอร์: ซิงค์มุมมองครูทุกคืน 02:xx, สำรองฐานข้อมูลทุกวันอาทิตย์');
  bumpDataVersion_();
  log.push('DATA_VERSION = ' + getDataVersion_());
  Logger.log(log.join('\n'));
  return log;
}

/**
 * นำเข้าหมวด รายการพัสดุ และผู้ขาย จากระบบบัญชีรับ-จ่ายเดิม (อ่านอย่างเดียว)
 * เพิ่มเฉพาะรายการที่ยังไม่มี — รหัสพัสดุเดิมคงไว้ทุกตัวเพื่อเชื่อมกับบัญชีเดิมได้ในอนาคต
 */
function importLegacy_(byEmail) {
  var legacy = SpreadsheetApp.openById(APP.LEGACY_ID);
  var read = function (name) {
    var sh = legacy.getSheetByName(name);
    if (!sh) return [];
    var v = sh.getDataRange().getValues();
    var h = v.shift().map(String);
    return v.map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
  };
  var result = {};

  // หมวด
  var haveCat = {};
  readAll_('Category').forEach(function (c) { haveCat[String(c.cat_code)] = true; });
  var newCat = read('Category').filter(function (c) { return c.cat_code !== '' && !haveCat[String(c.cat_code)]; })
    .map(function (c) { return { cat_code: String(c.cat_code), cat_name: String(c.cat_name || ''), type: String(c.type || '') }; });
  appendRows_('Category', newCat); result.category = newCat.length;

  // รายการพัสดุ
  var haveItem = {};
  readAll_('Item').forEach(function (i) { haveItem[String(i.item_code)] = true; });
  var newItem = read('Item').filter(function (i) { return i.item_code !== '' && !haveItem[String(i.item_code)]; })
    .map(function (i) {
      return { item_code: String(i.item_code), cat_code: String(i.cat_code), item_name: String(i.item_name || '').trim(),
        unit: String(i.unit || '').trim(), note: String(i.note || '') };
    });
  appendRows_('Item', newItem); result.item = newItem.length;

  // ผู้ขาย (ระบบเดิมมีแค่ชื่อ — ที่อยู่/เลขผู้เสียภาษีเติมภายหลังผ่านหน้าเว็บ)
  var vendors = readAll_('Vendor');
  var haveV = {};
  vendors.forEach(function (v) { haveV[String(v.legacy_name || v.vendor_name).trim()] = true; });
  var newV = [];
  read('Vendor').forEach(function (v) {
    var name = String(v.vendor_name || '').trim();
    if (!name || haveV[name]) return;
    haveV[name] = true;
    var id = nextCode_(vendors.concat(newV), 'vendor_id', 'V', 4);
    newV.push({ vendor_id: id, vendor_name: name, branch: '', vendor_type: guessVendorType_(name), tax_id: '', address: '',
      subdistrict: '', district: '', province: '', postcode: '', phone: '', note: 'นำเข้าจากระบบเดิม', active: 'TRUE', legacy_name: name });
  });
  appendRows_('Vendor', newV); result.vendor = newV.length;

  var logs = readAll_('ImportLog');
  appendRows_('ImportLog', [{ run_id: nextCode_(logs, 'run_id', 'IMP-', 4), at: nowStamp_(), by_email: byEmail || '',
    source: 'ระบบบัญชีรับ-จ่ายพัสดุเดิม ' + APP.LEGACY_ID, target: 'Category/Item/Vendor',
    rows: result.category + result.item + result.vendor, note: JSON.stringify(result) }]);
  return result;
}

function guessVendorType_(name) {
  return /บริษัท|ห้างหุ้นส่วน|หจก|จำกัด|มหาชน|ศูนย์|สำนักงาน/.test(name) ? 'นิติบุคคล' : (/^(นาย|นาง|นางสาว)/.test(name) ? 'บุคคลธรรมดา' : 'ร้านค้า');
}

/** เขียนไฟล์มุมมองครู (หัวตารางภาษาไทย ไม่มีข้อมูลส่วนบุคคลที่ไม่จำเป็น) */
function syncTeacherView_() {
  var tv = SpreadsheetApp.openById(APP.TEACHER_VIEW_ID);
  var get = function (name) { return tv.getSheetByName(name) || tv.insertSheet(name); };
  var cat = {};
  readAll_('Category').forEach(function (c) { cat[String(c.cat_code)] = c.cat_name; });
  var people = {};
  readAll_('Personnel').forEach(function (p) { people[p.person_id] = p.full_name; });
  var vendorName = {};
  readAll_('Vendor').forEach(function (v) { vendorName[v.vendor_id] = v.vendor_name + (v.branch ? ' สาขา ' + v.branch : ''); });

  var sets = {
    'บุคลากร': [['รหัส', 'ชื่อ-สกุล', 'ประเภท', 'ตำแหน่ง', 'กลุ่มสาระ/งาน', 'สถานะ'],
      readAll_('Personnel').map(function (p) { return [p.person_id, p.full_name, p.staff_type, p.position_title, p.dept, p.status === 'active' ? 'ปฏิบัติงาน' : p.status]; })],
    'รายการพัสดุ': [['รหัสพัสดุ', 'หมวด', 'ชื่อพัสดุ', 'หน่วยนับ'],
      readAll_('Item').map(function (i) { return [i.item_code, cat[String(i.cat_code)] || i.cat_code, i.item_name, i.unit]; })],
    'ผู้ขาย': [['รหัส', 'ชื่อผู้ขาย', 'สาขา', 'จังหวัด'],
      readAll_('Vendor').filter(function (v) { return String(v.active).toUpperCase() !== 'FALSE'; })
        .map(function (v) { return [v.vendor_id, v.vendor_name, v.branch, v.province]; })],
    'โครงการ': [['ปีงบประมาณ', 'รหัส', 'ชื่อโครงการ', 'กลุ่มงาน', 'ผู้รับผิดชอบ', 'งบประมาณ (บาท)', 'แหล่งเงิน'],
      readAll_('Project').map(function (p) { return [p.fiscal_year, p.project_id, p.project_name, p.dept, people[p.owner_person_id] || '', p.budget_amount, p.budget_source]; })],
    'งานจัดซื้อ': [['ปีงบประมาณ', 'เลขที่', 'วันที่ขอซื้อ', 'ชื่องาน', 'โครงการ', 'ผู้ขาย', 'จำนวนเงิน (บาท)', 'สถานะ', 'ผู้ขอ'],
      readAll_('Procurement').filter(function (p) { return p.status !== 'void'; }).map(function (p) {
        return [p.fiscal_year, p.proc_no ? p.proc_no + '/' + p.fiscal_year : '', p.request_date, p.subject, p.project_name,
          vendorName[p.vendor_id] || '', p.total_amount, p.status, people[p.requester_id] || ''];
      })]
  };
  var counts = {};
  Object.keys(sets).forEach(function (name) {
    var sh = get(name), h = sets[name][0], rows = sets[name][1];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#E8EEF7');
    replaceSheetBody_(sh, h, rows);
    counts[name] = rows.length;
  });
  var info = get('อ่านก่อน');
  info.getRange('B8').setValue(nowStamp_());
  return counts;
}

/** ทริกเกอร์: ซิงค์มุมมองครูทุกคืน + สำรองฐานข้อมูลทุกวันอาทิตย์ */
function installTriggers_() {
  var want = { nightlySync: true, weeklyBackup: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (want[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nightlySync').timeBased().everyDays(1).atHour(2).inTimezone(APP.TZ).create();
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone(APP.TZ).create();
}

function nightlySync() { syncTeacherView_(); }

/** สำรองไฟล์ฐานข้อมูลไปโฟลเดอร์ "05 สำรอง" เก็บล่าสุด APP.BACKUP_KEEP ชุด (ชุดเก่าย้ายลงถังขยะ กู้คืนได้ 30 วัน) */
function weeklyBackup() {
  var folder = DriveApp.getFolderById(APP.FOLDERS.backup);
  var src = DriveApp.getFileById(APP.DB_ID);
  src.makeCopy('สำรอง DB ' + Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd_HHmm'), folder);
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf('สำรอง DB ') === 0) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(APP.BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
}

/**
 * ★ รันเองเมื่อพร้อมเปิดให้ครูดู ★ แชร์ไฟล์มุมมองครูให้ทุกคนในโดเมนโรงเรียน "ดูได้อย่างเดียว"
 * (ไม่ได้รันอัตโนมัติ เพราะเป็นการเปลี่ยนสิทธิ์การแชร์)
 */
function shareTeacherViewToDomain() {
  DriveApp.getFileById(APP.TEACHER_VIEW_ID).setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('แชร์มุมมองครูให้ @' + APP.DOMAIN + ' ดูได้แล้ว: https://docs.google.com/spreadsheets/d/' + APP.TEACHER_VIEW_ID);
}

/** ตรวจสุขภาพระบบแบบเร็ว (รันจาก editor ได้) */
function healthCheck() {
  var out = {};
  Object.keys(SCHEMA).forEach(function (n) { out[n] = readAll_(n).length; });
  out.dataVersion = getDataVersion_();
  out.thai = { baht: bahtText(19650), vat: splitVat(19650), d: thaiDate('2026-11-03', 'D1'), fy: fiscalYearBE('2026-11-03') };
  Logger.log(JSON.stringify(out, null, 1));
  return out;
}
