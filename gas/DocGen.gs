/**
 * DocGen.gs — ออกเอกสาร Word (.docx) จากเทมเพลตในโฟลเดอร์ "03 เทมเพลต"
 *
 * ที่เก็บไฟล์:  04 เอกสารที่ออก / ปีงบประมาณ 2570 / 013-2570 <ชื่องาน> / 1 กำหนด TOR … 5 เบิก, รวมเล่ม
 * ชื่อไฟล์:     013-2570 F04 บันทึกรายงานขอซื้อ.docx  และ  013-2570 ชุดรวม.docx
 * ออกซ้ำ:       ไฟล์เดิมย้ายไปโฟลเดอร์ "ฉบับก่อนหน้า" (ไม่ลบทิ้ง)
 * PDF:          pdf_mode = manual → เจ้าหน้าที่เปิดใน Word แล้ว Save as PDF
 *               (ภายหลังเปลี่ยนเป็น github เพื่อให้ LibreOffice + ฟอนต์ไทยแปลงอัตโนมัติ — ไม่ต้องแก้เทมเพลต)
 */

var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
var DOC_STEP_FOLDERS = { 1: '1 กำหนด TOR', 2: '2 ขอซื้อ', 3: '3 อนุมัติและสั่งซื้อ', 4: '4 ตรวจรับ', 5: '5 เบิก' };
var DOC_COMBINED_FOLDER = 'รวมเล่ม';
var DOC_PREV_FOLDER = 'ฉบับก่อนหน้า';
var DOC_TEST_FOLDER = '_ทดสอบระบบ (ลบได้)';
var DOC_TEXT_PARTS = ['word/document.xml', 'word/styles.xml', 'word/numbering.xml'];

/** เปิดเทมเพลต → {blobs:[...], text:{path: xml}} */
function docOpenTemplate_(fileId) {
  var src = DriveApp.getFileById(fileId).getBlob();
  var zipBlob = Utilities.newBlob(src.getBytes(), 'application/zip', 'template.zip');
  var blobs = Utilities.unzip(zipBlob);
  var text = {};
  blobs.forEach(function (b) {
    if (DOC_TEXT_PARTS.indexOf(b.getName()) >= 0) text[b.getName()] = b.getDataAsString('UTF-8');
  });
  return { blobs: blobs, text: text };
}

/** สร้างไฟล์ docx ใหม่: ใช้ไฟล์ส่วนอื่นของเทมเพลตเดิมทั้งหมด แทนเฉพาะส่วนที่แก้ */
function docBuildDocx_(tpl, changed, fileName) {
  var blobs = tpl.blobs.map(function (b) {
    var name = b.getName();
    if (changed.hasOwnProperty(name)) return Utilities.newBlob(changed[name], 'application/xml', name);
    return b;
  });
  return Utilities.zip(blobs, fileName).setContentType(DOCX_MIME);
}

function docSubFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** บันทึกไฟล์ ถ้ามีชื่อซ้ำย้ายฉบับเดิมไป "ฉบับก่อนหน้า" */
function docSave_(folder, blob) {
  var name = blob.getName();
  var old = folder.getFilesByName(name);
  while (old.hasNext()) {
    var f = old.next();
    var stamp = Utilities.formatDate(f.getLastUpdated(), APP.TZ, 'yyyy-MM-dd HHmm');
    f.setName(name.replace(/\.docx$/, '') + ' (ฉบับ ' + stamp + ').docx');
    f.moveTo(docSubFolder_(folder, DOC_PREV_FOLDER));
  }
  return folder.createFile(blob);
}

function docSafeName_(s) {
  return String(s || '').replace(/[\\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80);
}

/**
 * โฟลเดอร์ของงาน: ปีงบประมาณ 2570 / 013-2570 ชื่องาน
 * งานที่ยังไม่มีเลขขอซื้อ (ขั้น TOR) ใช้ชื่อ "ร่าง PR00001 ชื่องาน" แล้วเปลี่ยนชื่อเองเมื่อได้เลข (ใช้โฟลเดอร์เดิม ไม่สร้างซ้ำ)
 */
function docProcFolder_(proc, isTest) {
  var want = docPrefix_(proc) + ' ' + docSafeName_(proc.subject);
  if (proc.folder_id && !isTest) {
    try {
      var f = DriveApp.getFolderById(proc.folder_id);
      if (!f.isTrashed()) {
        if (f.getName() !== want) f.setName(want);
        return f;
      }
    } catch (e) { /* โฟลเดอร์ถูกลบ → สร้างใหม่ */ }
  }
  var root = DriveApp.getFolderById(APP.FOLDERS.output);
  if (isTest) root = docSubFolder_(root, DOC_TEST_FOLDER);
  var fy = docSubFolder_(root, 'ปีงบประมาณ ' + proc.fiscal_year);
  return docSubFolder_(fy, want);
}

/** ส่วนหน้าชื่อไฟล์: 013-2570 หรือ "ร่าง PR00001" เมื่อยังไม่มีเลขขอซื้อ */
function docPrefix_(proc) {
  if (!proc.proc_no) return 'ร่าง ' + proc.proc_id;
  return ('000' + String(proc.proc_no)).slice(-3) + '-' + proc.fiscal_year;
}

/** รายการเทมเพลตที่ใช้งาน เรียงตามลำดับเอกสาร */
function docTemplates_() {
  return readAll_('FormTemplate').filter(function (t) {
    return t.template_doc_id && String(t.active).toUpperCase() !== 'FALSE';
  }).sort(function (a, b) { return String(a.form_key) < String(b.form_key) ? -1 : 1; });
}

/** ข้อมูลบุคลากรและผู้ลงนามปัจจุบันจากฐานข้อมูล */
function docPeopleAndSigners_() {
  var people = {};
  readAll_('Personnel').forEach(function (p) { people[p.person_id] = p; });
  var signers = {};
  readAll_('Signers').forEach(function (s) {
    if (String(s.active).toUpperCase() !== 'FALSE') signers[s.sign_key] = s;
  });
  return { people: people, signers: signers };
}

/** อ่านข้อมูลงานจัดซื้อ 1 งานจากชีต (ใช้ตั้งแต่เฟส 2 ที่มีหน้ากรอกงาน) */
function docLoadProc_(procId) {
  var by = function (t) { return readAll_(t).filter(function (r) { return r.proc_id === procId; }); };
  var proc = by('Procurement')[0];
  if (!proc) throw new Error('ไม่พบงานจัดซื้อ ' + procId);
  var vendor = readAll_('Vendor').filter(function (v) { return v.vendor_id === proc.vendor_id; })[0] || {};
  var ps = docPeopleAndSigners_();
  return {
    proc: proc, items: by('ProcItem'), specs: by('ProcSpec'), committees: by('ProcCommittee'),
    quotes: by('ProcQuote'), vendor: vendor, people: ps.people, signers: ps.signers, config: readConfig_()
  };
}

/**
 * ออกเอกสารทั้งชุด (หรือบางแบบฟอร์ม)
 * @param {Object} data  ข้อมูลงาน (ดู DocContext.gs)
 * @param {Object} opt   {forms: ['F04',...] (ว่าง = ทั้งหมด), style: 'thai'|'arabic', test: bool, combined: bool}
 */
function generateDocs_(data, opt) {
  opt = opt || {};
  var cfg = readConfig_();
  var style = opt.style || data.proc.number_style || cfg.number_style || 'thai';
  var ctx = buildDocContext(data);
  var folder = docProcFolder_(data.proc, opt.test);
  var prefix = docPrefix_(data.proc);
  var templates = docTemplates_().filter(function (t) { return !opt.forms || !opt.forms.length || opt.forms.indexOf(t.form_key) >= 0; });
  if (!templates.length) throw new Error('ยังไม่มีเทมเพลตที่ลงทะเบียนในชีต FormTemplate — รัน setupPhase1 ก่อน');

  var results = [], filledBodies = [], firstTpl = null, firstParts = null;
  templates.forEach(function (t) {
    var tpl = docOpenTemplate_(t.template_doc_id);
    var res = docxFillParts(tpl.text, ctx, style);
    var name = prefix + ' ' + t.form_key + ' ' + docSafeName_(t.form_name) + '.docx';
    var step = DOC_STEP_FOLDERS[Number(t.step)] || 'อื่น ๆ';
    var file = docSave_(docSubFolder_(folder, step), docBuildDocx_(tpl, res.parts, name));
    results.push({ form_key: t.form_key, name: name, id: file.getId(), url: file.getUrl(), missing: res.missing, rev: t.template_rev || '' });
    filledBodies.push(res.parts['word/document.xml']);
    if (!firstTpl) { firstTpl = tpl; firstParts = res.parts; }
  });

  var combined = null;
  if (opt.combined !== false && filledBodies.length > 1) {  // งานจริงส่ง combined:true เฉพาะ "รวมเล่ม"
    var parts = {};
    Object.keys(firstParts).forEach(function (k) { parts[k] = firstParts[k]; });
    parts['word/document.xml'] = docxMergeBodies(filledBodies);
    var cname = prefix + ' ชุดรวม.docx';
    var cf = docSave_(docSubFolder_(folder, DOC_COMBINED_FOLDER), docBuildDocx_(firstTpl, parts, cname));
    combined = { name: cname, id: cf.getId(), url: cf.getUrl() };
  }

  if (!opt.test) {
    var by = currentEmail_(), at = nowStamp_();
    appendRows_('DocOutput', results.map(function (r, i) {
      return { out_id: data.proc.proc_id + '-' + r.form_key + '-' + at.replace(/\D/g, ''), proc_id: data.proc.proc_id,
        form_key: r.form_key, file_id: r.id, pdf_id: '', created_at: at, created_by: by, template_rev: r.rev,
        number_style: style, note: r.missing.length ? 'ไม่มีค่า: ' + r.missing.join(', ') : '' };
    }));
  }
  return { folderUrl: folder.getUrl(), folderId: folder.getId(), style: style, files: results, combined: combined,
    pdfMode: cfg.pdf_mode || 'manual' };
}

// ------------------------------------------------------------------ ทดสอบ (กด Run ในหน้า Apps Script)

/** ข้อมูลงานโดรน 13/2570 + บุคลากร/ผู้ลงนามจริงจากฐานข้อมูล (ไม่บันทึกงานลงชีต ไม่ใช้เลข Counter) */
function docTestData_() {
  var data = droneTestData_();
  var ps = docPeopleAndSigners_();
  data.people = ps.people;
  data.signers = ps.signers;
  data.config = readConfig_();
  return data;
}

/** ด่าน 2: ออกชุดเอกสารงานโดรนตามรูปแบบตัวเลขในค่าระบบ → โฟลเดอร์ "_ทดสอบระบบ (ลบได้)" */
function testPhase1Docs() {
  var r = generateDocs_(docTestData_(), { test: true });
  docLogResult_(r);
  return r;
}

/** เหมือน testPhase1Docs แต่บังคับเลขอารบิก (ตรวจการเปลี่ยนฟอนต์) */
function testPhase1DocsArabic() {
  var r = generateDocs_(docTestData_(), { test: true, style: 'arabic' });
  docLogResult_(r);
  return r;
}

function docLogResult_(r) {
  var lines = ['โฟลเดอร์: ' + r.folderUrl, 'รูปแบบตัวเลข: ' + r.style];
  r.files.forEach(function (f) { lines.push(f.name + (f.missing.length ? '  ⚠ ไม่มีค่า: ' + f.missing.join(', ') : '')); });
  if (r.combined) lines.push(r.combined.name);
  Logger.log(lines.join('\n'));
}
