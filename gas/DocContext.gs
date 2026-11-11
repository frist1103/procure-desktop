/**
 * DocContext.gs — แปลงข้อมูลงานจัดซื้อ 1 งาน เป็นค่าสำหรับเติมป้ายในเทมเพลต
 * ฟังก์ชันบริสุทธิ์ ทดสอบบนเครื่องได้ (ใช้ร่วมกับ Thai.gs)
 *
 * data = {
 *   proc, items[], specs[], committees[], quotes[], vendor,
 *   people: {person_id: Personnel}, signers: {sign_key: Signers}, config
 * }
 */

var SIGN_KEYS = { director: 'director', deputy: 'deputy_budget', head: 'supply_head', officer: 'supply_officer', finance: 'finance_officer' };

function ctxStr_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function ctxNum_(v) { var n = Number(String(v === undefined || v === null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }

/** วันที่แยกส่วน: {k}_d = วัน, {k}_m = ชื่อเดือน, {k}_y = ปี พ.ศ. */
function ctxDate_(ctx, k, iso) {
  if (!iso) { ctx[k + '_d'] = ''; ctx[k + '_m'] = ''; ctx[k + '_y'] = ''; return; }
  var p = _parseIso(iso);
  ctx[k + '_d'] = String(p.d);
  ctx[k + '_m'] = THAI_MONTHS[p.m - 1];
  ctx[k + '_y'] = String(p.y + 543);
}

/** ชื่อแยกส่วน: {k}_first = คำนำหน้า+ชื่อ, {k}_last = นามสกุล, {k}_pos = ตำแหน่ง */
function ctxPerson_(ctx, k, person) {
  person = person || {};
  ctx[k + '_first'] = ctxStr_(person.prefix) + ctxStr_(person.first_name);
  ctx[k + '_last'] = ctxStr_(person.last_name);
  ctx[k + '_pos'] = ctxStr_(person.position_title);
}

/** แยกบาท/สตางค์สำหรับตารางแนบท้าย: 18300 → ["18,300", "-"] */
function ctxBahtSatang_(n) {
  var v = round2(n), b = Math.floor(v), s = Math.round((v - b) * 100);
  return [formatInt(b), s ? ('0' + s).slice(-2) : '-'];
}

/** ประมาณจำนวนบรรทัดของข้อความในช่องแคบ (ใช้คำนวณย่อหน้าเติมความสูงตาราง) */
function ctxLines_(text, perLine) {
  return String(text || '').split('\n').reduce(function (n, line) {
    return n + Math.max(1, Math.ceil(line.length / perLine));
  }, 0);
}

function buildDocContext(data) {
  var P = data.proc || {}, cfg = data.config || {}, people = data.people || {};
  var ctx = {};
  var person = function (id) { return people[id] || {}; };

  // ---------- งาน
  var items = (data.items || []).slice().sort(function (a, b) { return ctxNum_(a.line_no) - ctxNum_(b.line_no); });
  // เอกสารมีคำว่า "ซื้อ" / "โครงการ" นำหน้าช่องเหล่านี้อยู่แล้ว → ตัดคำที่พิมพ์ซ้ำมาออก
  var subject = ctxStripLead_(ctxStr_(P.subject), 'ซื้อ');
  ctx.subject = subject;
  ctx.subject_short = ctxStripLead_(ctxStr_(P.subject_short), 'ซื้อ') || subject;
  ctx.reason = ctxStr_(P.reason);
  ctx.project_name = ctxStripLead_(ctxStr_(P.project_name), 'โครงการ');
  ctx.admin_group = ctxStr_(P.admin_group);
  ctx.responsible_unit = ctxStr_(P.responsible_unit);
  ctx.issue_dept = ctxStr_(P.dept);
  ctx.proc_no = ctxStr_(P.proc_no);
  ctx.doc_no = ctx.proc_no + '/' + ctxStr_(P.fiscal_year);
  ctx.inspect_no = ctxStr_(P.inspect_order_no).replace(/^พ\s*/, '');
  ctx.tor_order_no = ctxStr_(P.tor_order_no);

  // ---------- ยอดเงิน
  var total = round2(items.reduce(function (s, it) {
    var amt = ctxNum_(it.amount) || ctxNum_(it.qty) * ctxNum_(it.unit_price);
    return s + amt;
  }, 0)) || ctxNum_(P.total_amount);
  var vat = splitVat(total, P.vat_mode === 'none' ? 0 : 7);
  ctx.total_amount = formatMoney(total);
  ctx.total_text = bahtText(total);
  ctx.before_vat = formatMoney(vat.beforeVat);
  ctx.vat_amount = formatMoney(vat.vat);
  var tb = ctxBahtSatang_(total); ctx.total_b = tb[0]; ctx.total_s = tb[1];
  var budget = ctxNum_(P.budget_amount) || total, ref = ctxNum_(P.ref_price) || total;
  ctx.budget_amount = formatMoney(budget); ctx.budget_amount_text = bahtText(budget);
  ctx.ref_price = formatMoney(ref); ctx.ref_price_text = bahtText(ref);
  ctx.budget_type = ctxStr_(P.budget_type) || 'เงินนอกงบประมาณ';
  ctx.budget_source = ctxStr_(P.budget_source);
  ctx.budget_year = ctxStr_(P.budget_year);
  ctx.price_source = ctxStr_(P.price_source);
  var std = /มาตรฐาน/.test(ctx.price_source);
  ctx.chk_std = std ? ' / ' : '  ';
  ctx.chk_market = std ? '  ' : ' / ';

  // ---------- เงื่อนไข
  ctx.delivery_days = ctxStr_(P.delivery_days);
  ctx.price_validity_days = ctxStr_(P.price_validity_days);
  ctx.contract_sign_days = ctxStr_(P.contract_sign_days);
  ctx.warranty_years = ctxStr_(P.warranty_years);
  ctx.repair_days = ctxStr_(P.repair_days);

  // ---------- วันที่ (คงรูปแบบของแต่ละจุดไว้ในเทมเพลต)
  var due = P.due_date || (P.po_date && P.delivery_days !== '' ? addDaysIso(P.po_date, ctxNum_(P.delivery_days)) : '');
  ctxDate_(ctx, 'tm', P.tor_memo_date);
  ctxDate_(ctx, 'to', P.tor_order_date || P.tor_memo_date);
  ctxDate_(ctx, 'rq', P.request_date);
  ctxDate_(ctx, 'rs', P.result_date);
  ctxDate_(ctx, 'io', P.inspect_order_date || P.result_date);
  ctxDate_(ctx, 'an', P.announce_date || P.result_date);
  ctxDate_(ctx, 'cn', P.contract_notice_date || P.result_date);
  ctxDate_(ctx, 'po', P.po_date);
  ctxDate_(ctx, 'due', due);
  ctxDate_(ctx, 'ins', P.inspection_date);
  var issueDate = P.issue_date || P.inspection_date;
  ctxDate_(ctx, 'iss', issueDate);
  ctx.issue_fy = issueDate ? String(fiscalYearBE(issueDate)) : '';
  ctx.issue_quarter = ctxStr_(P.issue_quarter) || (issueDate ? String(fiscalQuarter(issueDate)) : '');
  ctx.issue_doc_no = ctxStr_(P.issue_doc_no);
  ctx.po_recv_date = '';

  // ---------- ผู้ขาย
  var V = data.vendor || {};
  ctx.vendor_name_full = ctxStr_(V.vendor_name) + (ctxStr_(V.branch) ? ' สาขา ' + ctxStr_(V.branch) : '');
  ctx.vendor_address = ctxStr_(V.address);
  ctx.vendor_subdistrict = ctxStr_(V.subdistrict);
  ctx.vendor_district = ctxStr_(V.district);
  ctx.vendor_province = ctxStr_(V.province);
  ctx.vendor_postcode = ctxStr_(V.postcode);
  ctx.vendor_phone = ctxStr_(V.phone);
  ctx.vendor_tax_id = ctxStr_(V.tax_id);
  var q1 = (data.quotes || []).filter(function (q) { return ctxNum_(q.seq) === 1; })[0] || {};
  ctx.q_offered = formatMoney(ctxNum_(q1.offered_price) || total);
  ctx.q_agreed = formatMoney(ctxNum_(q1.agreed_price) || total);

  // ---------- รายการ: "แยกรายการ" (split) หรือ "รวมเป็นชุด" (set) สำหรับใบสั่งซื้อ/ใบเบิก
  var setMode = ctxStr_(P.item_mode) !== 'split';
  var lines = items.map(function (it, i) {
    var amt = ctxNum_(it.amount) || ctxNum_(it.qty) * ctxNum_(it.unit_price);
    var up = ctxNum_(it.unit_price), sp = ctxNum_(it.std_price) || up;
    var r = ctxBahtSatang_(sp), u = ctxBahtSatang_(up), a = ctxBahtSatang_(amt);
    return {
      no: String(i + 1), desc: ctxStr_(it.description), qty: ctxStr_(it.qty), unit: ctxStr_(it.unit),
      ref_b: r[0], ref_s: r[1], unit_b: u[0], unit_s: u[1], amt_b: a[0], amt_s: a[1],
      unit_price: formatMoney(up), amount: formatMoney(amt)
    };
  });
  var poLines, issueLines;
  if (setMode) {
    ctx.po_line_desc = ctxStr_(P.po_line_desc) || subject;
    ctx.po_line_qty = ctxStr_(P.po_line_qty) || '1';
    ctx.po_line_unit = ctxStr_(P.po_line_unit) || 'ชุด';
    poLines = [{ no: '1', desc: ctx.po_line_desc, qty: ctx.po_line_qty, unit: ctx.po_line_unit,
      unit_price: formatMoney(total / (ctxNum_(ctx.po_line_qty) || 1)), amount: formatMoney(total) }];
    issueLines = [{ no: '1', desc: lines.map(function (l) { return l.desc; }).join(' และ\n'), qty: ctx.po_line_qty, unit: ctx.po_line_unit }];
  } else {
    poLines = lines;
    issueLines = lines;
    ctx.po_line_desc = ctxStr_(P.po_line_desc) || subject;
    ctx.po_line_qty = String(lines.length);
    ctx.po_line_unit = 'รายการ';
  }
  ctx.item_count = String(poLines.length);
  ctx.egp_project_no = ctxStr_(P.egp_project_no);
  ctx.egp_contract_no = ctxStr_(P.egp_contract_no);
  ctx.egp_inspect_no = ctxStr_(P.egp_inspect_no);
  ctx.egp_project_name = ctxStr_(P.egp_project_name) || ('ซื้อ' + subject + ' จำนวน ' + ctx.item_count + ' รายการ');

  // แถวเติมความสูงตาราง (แนบท้าย/ใบเบิก): ผู้ใช้ให้ตารางสูงพอดีรายการ ไม่เว้นพื้นที่ว่าง → 0 = ไม่มีแถวเติม
  // ถ้าภายหลังอยากให้ตารางสูงเท่าต้นฉบับ: f05 = 17 − บรรทัดรายการ (กว้าง ~26 ตัวอักษร), f12 = 7 − บรรทัดรายการ (~60 ตัวอักษร)
  var fill = cfg.table_filler === 'original';
  ctx.f05_filler = fill ? Math.max(0, 17 - lines.reduce(function (n, l) { return n + ctxLines_(l.desc, 26); }, 0)) : 0;
  ctx.f12_filler = fill ? Math.max(0, 7 - issueLines.reduce(function (n, l) { return n + ctxLines_(l.desc, 60); }, 0)) : 0;

  // ---------- TOR
  var specs = (data.specs || []).slice().sort(function (a, b) { return ctxNum_(a.line_no) - ctxNum_(b.line_no); });
  var sec = function (s) { return specs.filter(function (x) { return x.section === s; }); };
  ctx.spec_title = (sec('spec_title')[0] || {}).text || subject;
  var objs = sec('objective');
  ctx.loops = {
    line: lines,
    po: poLines,
    issue: issueLines,
    // ความเป็นมา: กด Enter ในช่องเดียวกัน = ขึ้นย่อหน้าใหม่ (ย่อหน้าเยื้องเหมือนกัน) และตัดบรรทัดว่างทิ้ง
    // ไม่ใช้ตัวขึ้นบรรทัดใหม่ในย่อหน้า เพราะ Word จะยืดบรรทัดที่ลงท้ายด้วยตัวขึ้นบรรทัดให้เต็มความกว้าง
    bg: sec('background').reduce(function (out, x) {
      ctxStr_(x.text).split(/\r?\n/).forEach(function (t) { t = t.trim(); if (t) out.push({ text: t }); });
      return out;
    }, []),
    obj: objs.map(function (x, i) { return { no: '2.' + (i + 1), text: ctxStr_(x.text) }; }),
    spec: sec('spec').map(function (x) { return { text: ctxStr_(x.text) }; })
  };

  // ---------- คณะกรรมการ (3 ที่นั่ง) และผู้เบิก
  ['TOR', 'INSPECT'].forEach(function (kind) {
    var key = kind === 'TOR' ? 'tor' : 'ic';
    var rows = (data.committees || []).filter(function (c) { return c.kind === kind; });
    for (var i = 1; i <= 3; i++) {
      var c = rows.filter(function (r) { return ctxNum_(r.seq) === i; })[0];
      ctxPerson_(ctx, key + i, c ? person(c.person_id) : null);
    }
  });
  ctxPerson_(ctx, 'req1', person(P.requester_id));
  ctx.req_pos = ctx.req1_pos;

  // ---------- ผู้ลงนามตามบทบาท
  var signers = data.signers || {};
  Object.keys(SIGN_KEYS).forEach(function (k) {
    var s = signers[SIGN_KEYS[k]] || {};
    ctxPerson_(ctx, 'sig_' + k, person(s.person_id));
    ctx['sig_' + k + '_title'] = ctxStr_(s.title_override);
  });

  return ctx;
}

/** ตัดคำนำหน้าที่ซ้ำกับข้อความในเอกสาร เช่น "ซื้อขนมหวาน" → "ขนมหวาน" (ถ้าตัดแล้วว่าง คืนค่าเดิม) */
function ctxStripLead_(s, word) {
  var t = String(s || '').trim();
  if (t.indexOf(word) !== 0) return t;
  var rest = t.substring(word.length).trim();
  return rest || t;
}
