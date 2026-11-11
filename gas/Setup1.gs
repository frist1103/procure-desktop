/**
 * Setup1.gs — ติดตั้งเฟส 1 (กด Run ครั้งเดียว ทำซ้ำได้ไม่เสียหาย)
 * 1) เพิ่มคอลัมน์ใหม่ในฐานข้อมูล  2) แก้นามสกุลบุคลากร (ทำแล้ว)  3) ลงผลตัดสินข้อสังเกต 14 ข้อในพจนานุกรมตัวแปร
 * 4) ลงทะเบียนเทมเพลต .docx ในโฟลเดอร์ "03 เทมเพลต" กับชีต FormTemplate  5) ค่า pdf_mode
 */
var PHASE1_TEMPLATE_REV = 'r7 (2569-11-11) รายชื่อผู้กำหนด TOR เป็นตารางไม่มีเส้น (ชื่อยาวไม่ดันตำแหน่ง), F02 ลบข้อความงานโดรนที่ค้าง, F01 ดำเนินการซื้อ; r6 ชุดลงชื่อไม่แยกหน้า; r5 รายละเอียดงานขึ้นหน้าใหม่; r4 TOR จัดชิดขอบ';

var FORM_STEPS = { F01: 1, F02: 1, F03: 1, F04: 2, F05: 2, F06: 3, F07: 3, F08: 3, F09: 3, F10: 3, F11: 4, F12: 5 };

/** ผลตัดสินของผู้ใช้ เรียงตามแถวในชีต "ข้อสังเกต" (ข้อ 1–14) */
var ISSUE_DECISIONS = [
  'ตกลง: ใช้ delivery_days ค่าเดียวทุกเอกสาร วันครบกำหนดคำนวณอัตโนมัติ',
  'ตกลง: ใช้ po_date ค่าเดียว (หัวใบสั่งซื้อ ช่องลงนาม และใบตรวจรับ)',
  'ตกลง: subject ทุกที่ + subject_short สำหรับคำสั่ง/TOR (ว่าง = ใช้ subject)',
  'ตกลง: เติมแหล่งเงิน (budget_source) ในบันทึกขอซื้อ',
  'ตกลง: เลือกได้ต่องาน ว่าใบสั่งซื้อ/ใบเบิก "แยกรายการ" หรือ "รวมเป็นชุด" (item_mode)',
  'ตกลง: แก้อัตโนมัติ — ดึงชื่อจากฐานข้อมูลบุคลากรทุกที่',
  'ตกลง: ใช้ตำแหน่งตามทะเบียนบุคลากร',
  'ตกลง: แยก fiscal_year (คำนวณจากวันที่) กับ budget_year (กรอกเอง)',
  'ตกลง: เก็บสองเบอร์ใน Config ใช้ตามตำแหน่งเดิม',
  'คงตามต้นฉบับไปก่อน — เก็บข้อสังเกตไว้เผื่อแก้ในอนาคต',
  'เว้นว่างไว้ก่อน — เก็บข้อสังเกตไว้เผื่อเติมเลขในอนาคต',
  'ตกลง: เว้นว่างให้ผู้ขายเขียนเอง',
  'ตกลง: คำนวณจากวันเบิก แต่แก้เองได้ (issue_quarter)',
  'ตกลง: ใช้รูปแบบเดียวทั้งเอกสาร เลือก thai/arabic ได้'
];

function setupPhase1() {
  var log = [];
  log = log.concat(ensureSchema_());

  // 2) แก้นามสกุลบุคลากร 1 ราย — ทำไปแล้วเมื่อ 10 พ.ย. 2569 (ตัดออกจากโค้ดสาธารณะ)

  // 3) ผลตัดสินข้อสังเกต
  try {
    var sh = SpreadsheetApp.openById(APP.VARDICT_ID).getSheetByName('ข้อสังเกต');
    var lastCol = sh.getLastColumn();
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    var col = head.indexOf('ผลตัดสิน (ผู้ใช้)') + 1;
    if (!col) { col = lastCol + 1; sh.getRange(1, col).setValue('ผลตัดสิน (ผู้ใช้)').setFontWeight('bold'); }
    var n = Math.min(ISSUE_DECISIONS.length, sh.getLastRow() - 1);
    sh.getRange(2, col, n, 1).setValues(ISSUE_DECISIONS.slice(0, n).map(function (d) { return [d]; }));
    sh.setColumnWidth(col, 380);
    log.push('ลงผลตัดสินข้อสังเกต ' + n + ' ข้อ');
  } catch (e) { log.push('ข้ามการลงผลตัดสิน: ' + e.message); }

  // 4) ลงทะเบียนเทมเพลต
  var files = {};
  var it = DriveApp.getFolderById(APP.FOLDERS.templates).getFiles();
  while (it.hasNext()) {
    var f = it.next(), m = f.getName().match(/^(F\d\d) .*\.docx$/);
    if (m) files[m[1]] = f;
  }
  readAll_('FormTemplate').forEach(function (t) {
    var f = files[t.form_key];
    if (!f) { log.push('ไม่พบไฟล์เทมเพลต ' + t.form_key); return; }
    updateRow_('FormTemplate', t._row, { template_doc_id: f.getId(), step: FORM_STEPS[t.form_key] || '', template_rev: PHASE1_TEMPLATE_REV, active: true });
    log.push('เทมเพลต ' + t.form_key + ' = ' + f.getName());
  });

  // 5) ค่าระบบ
  if (!readConfig_().pdf_mode) writeConfig_('pdf_mode', 'manual', 'manual = เปิดใน Word แล้ว Save as PDF | github = แปลงอัตโนมัติ (อนาคต)');
  bumpDataVersion_();
  Logger.log(log.join('\n'));
  return log;
}
