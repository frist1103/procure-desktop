/**
 * Setup2.gs — ติดตั้งเฟส 2 (กด Run ครั้งเดียว ทำซ้ำได้ไม่เสียหาย)
 * 1) เพิ่มคอลัมน์/ตั้งรูปแบบข้อความของคอลัมน์เลขที่  2) บันทึกงานโดรน 13/2570 เป็นงานแรก (ใช้เลขเดิม ไม่ออกเลขใหม่)
 */
function setupPhase2() {
  var log = [];
  log = log.concat(ensureSchema_());
  log.push(seedDroneJob_());
  bumpDataVersion_();
  Logger.log(log.join('\n'));
  return log;
}

/** งานโดรน 13/2570 จากข้อมูลทดสอบ → ชีตจริง (ข้ามถ้ามีแล้ว) */
function seedDroneJob_() {
  var t = droneTestData_();
  var exists = readAll_('Procurement').filter(function (p) {
    return String(p.proc_no) === String(t.proc.proc_no) && String(p.fiscal_year) === String(t.proc.fiscal_year);
  })[0];
  if (exists) return 'งานโดรน 13/2570 มีอยู่แล้ว (' + exists.proc_id + ')';
  return withLock_(function () {
    // ผู้ขาย: ใช้รายเดิมถ้าชื่อตรง ไม่งั้นเพิ่มใหม่
    var vendors = readAll_('Vendor');
    var v = vendors.filter(function (x) { return String(x.vendor_name).indexOf('สกาย อินโน') >= 0; })[0];
    var vendorId;
    if (v) {
      vendorId = v.vendor_id;
      var patch = {};
      ['branch', 'tax_id', 'address', 'subdistrict', 'district', 'province', 'postcode', 'phone'].forEach(function (k) {
        if (!String(v[k] || '').trim()) patch[k] = t.vendor[k];
      });
      if (Object.keys(patch).length) updateRow_('Vendor', v._row, patch);
    } else {
      vendorId = nextCode_(vendors, 'vendor_id', 'V', 4);
      var nv = {};
      Object.keys(t.vendor).forEach(function (k) { nv[k] = t.vendor[k]; });
      nv.vendor_id = vendorId; nv.vendor_type = 'นิติบุคคล'; nv.active = 'TRUE'; nv.note = 'จากชุดเอกสารงานโดรน 13/2570';
      appendRows_('Vendor', [nv]);
    }
    var procId = nextCode_(readAll_('Procurement'), 'proc_id', 'PR', 5);
    var now = nowStamp_(), me = currentEmail_() || 'setupPhase2';
    var p = {};
    Object.keys(t.proc).forEach(function (k) { p[k] = t.proc[k]; });
    p.proc_id = procId; p.status = 'issued'; p.vendor_id = vendorId;
    p.total_amount = t.items.reduce(function (s, i) { return s + Number(i.amount); }, 0);
    p.due_date = addDaysIso(p.po_date, Number(p.delivery_days));
    p.created_by = me; p.created_at = now; p.updated_by = me; p.updated_at = now;
    appendRows_('Procurement', [p]);
    appendRows_('ProcItem', t.items.map(function (i) {
      var o = {}; Object.keys(i).forEach(function (k) { o[k] = i[k]; });
      o.proc_id = procId;
      o.post_to_ledger = /Care|ประกัน/i.test(i.description) ? 'N' : 'Y';  // ค่าบริการประกัน ไม่ต้องลงคลัง
      o.is_asset = Number(i.unit_price) >= 10000 ? 'Y' : 'N';
      return o;
    }));
    appendRows_('ProcSpec', t.specs.map(function (s) { return { proc_id: procId, section: s.section, line_no: s.line_no, text: s.text }; }));
    var roles = ['ประธานกรรมการ', 'กรรมการ', 'กรรมการและเลขานุการ'];
    appendRows_('ProcCommittee', t.committees.map(function (c) {
      return { proc_id: procId, kind: c.kind, seq: c.seq, person_id: c.person_id, role_label: roles[c.seq - 1] };
    }));
    appendRows_('ProcQuote', t.quotes.map(function (q) {
      return { proc_id: procId, seq: q.seq, vendor_id: vendorId, offered_price: q.offered_price, agreed_price: q.agreed_price };
    }));
    procLog_(procId, 'นำเข้างานเดิม', '', 'issued', 'งานโดรน 13/2570 จากชุดเอกสารต้นฉบับ (ใช้เลขเดิม ไม่ออกเลขใหม่)');
    return 'บันทึกงานโดรน 13/2570 เป็น ' + procId + ' (ผู้ขาย ' + vendorId + ')';
  });
}

/**
 * Setup21.gs — ติดตั้งเฟส 2.1 (กด Run ครั้งเดียว ทำซ้ำได้ไม่เสียหาย)
 *
 * แก้ "วันที่เลื่อน": ชีตฐานข้อมูลใช้เขตเวลาอื่นที่ไม่ใช่เวลาไทย ค่าวันที่ที่ชีตแปลงเป็นชนิดวันที่จึงเลื่อนทุกครั้งที่บันทึก
 * 1) อ่านทุกตารางก่อนเปลี่ยนรูปแบบ  2) เพิ่มคอลัมน์ใหม่ + ตั้งคอลัมน์วันที่/เวลาเป็นข้อความ
 * 3) เขียนค่าวันที่เดิมกลับเป็นข้อความ โดยอ่านตามเขตเวลาเดิมของชีต (= ข้อความที่ระบบเคยเขียนลงไป)
 * 4) ตั้งเขตเวลาของชีตเป็นเวลาไทย
 */
function setupPhase2_1() {
  var log = [];
  var ss = db_();
  var oldTz = ss.getSpreadsheetTimeZone();
  log.push('เขตเวลาเดิมของชีตฐานข้อมูล: ' + oldTz);

  // 1) อ่านค่าทุกตารางก่อน (ก่อนเปลี่ยนรูปแบบคอลัมน์)
  var snap = {};
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) snap[name] = sh.getDataRange().getValues();
  });

  // 2) คอลัมน์ใหม่ + รูปแบบข้อความ
  log = log.concat(ensureSchema_());

  // 3) แปลงค่าวันที่เป็นข้อความ (เขียนเฉพาะคอลัมน์ที่มีค่าวันที่)
  Object.keys(snap).forEach(function (name) {
    var vals = snap[name], headers = vals[0].map(String), sh = ss.getSheetByName(name);
    var total = 0;
    headers.forEach(function (h, c) {
      var col = [], n = 0;
      for (var i = 1; i < vals.length; i++) {
        var v = vals[i][c];
        if (v instanceof Date) {
          var full = Utilities.formatDate(v, oldTz, 'yyyy-MM-dd HH:mm:ss');
          v = (DATE_COLUMNS.indexOf(h) >= 0 || /00:00:00$/.test(full)) ? full.substring(0, 10) : full;
          n++;
        } else if (DATE_COLUMNS.indexOf(h) >= 0 && typeof v === 'string' && /^\d{4}-\d{2}-\d{2} /.test(v)) {
          v = v.substring(0, 10); n++;
        }
        col.push([v]);
      }
      if (n) {
        var rng = sh.getRange(2, c + 1, col.length, 1);
        rng.setNumberFormat('@');
        rng.setValues(col);
        total += n;
      }
    });
    if (total) log.push(name + ': แปลงวันที่เป็นข้อความ ' + total + ' ช่อง');
  });

  // 4) เขตเวลาของชีต
  if (oldTz !== APP.TZ) {
    ss.setSpreadsheetTimeZone(APP.TZ);
    log.push('ตั้งเขตเวลาชีตฐานข้อมูล: ' + oldTz + ' → ' + APP.TZ);
  }
  __tableCache = {};
  __dbTz = null;

  // ตรวจผล: วันที่ของงานโดรน 13/2570
  var drone = readAll_('Procurement').filter(function (p) { return String(p.proc_no) === '13' && String(p.fiscal_year) === '2570'; })[0];
  if (drone) {
    log.push('งานโดรน 13/2570: บันทึก TOR ' + drone.tor_memo_date + ', ขอซื้อ ' + drone.request_date + ', รายงานผล ' + drone.result_date +
      ', ใบสั่งซื้อ ' + drone.po_date + ', ตรวจรับ ' + drone.inspection_date + ' (ต้นฉบับ: 2026-11-02, 2026-11-03, 2026-11-04, 2026-11-05, 2026-11-12)');
  }
  bumpDataVersion_();
  Logger.log(log.join('\n'));
  return log;
}

/**
 * ติดตั้งเฟส 2.2a (ความเร็ว) — กด Run ก่อน Deploy เวอร์ชันใหม่ (ทำซ้ำได้ไม่เสียหาย)
 * 1) สำรองไฟล์ฐานข้อมูลไปโฟลเดอร์ "05 สำรอง" ก่อน (รอบนี้เปลี่ยนวิธีบันทึกลงชีต)
 * 2) ตรวจคอลัมน์/รูปแบบข้อความ  3) เปลี่ยนเลขเวอร์ชันข้อมูล (ล้างแคชเก่าทั้งหมด)
 */
function setupPhase2_2() {
  var log = [];
  weeklyBackup();
  log.push('สำรองฐานข้อมูลแล้ว (โฟลเดอร์ 05 สำรอง เก็บล่าสุด ' + APP.BACKUP_KEEP + ' ชุด)');
  log = log.concat(ensureSchema_());
  bumpDataVersion_();
  log.push('ล้างแคชเซิร์ฟเวอร์แล้ว — ระบบรุ่น ' + APP.VERSION);
  Logger.log(log.join('\n'));
  return log;
}
