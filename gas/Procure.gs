/**
 * Procure.gs — งานจัดซื้อ (เฟส 2): รายการงาน บันทึกร่าง ยืนยันขั้น ออกเลข ออกเอกสาร ยกเลิก ประวัติ
 *
 * สถานะ: draft (ร่าง) → requested (ขอซื้อแล้ว) → ordered (สั่งซื้อแล้ว) → inspected (ตรวจรับแล้ว) → issued (เบิกแล้ว) | void (ยกเลิก)
 * เลขที่: ขอซื้อ/ใบสั่งซื้อ (Counter PROC) ออกตอนยืนยันขั้น 2, คำสั่งผู้ตรวจรับ (Counter INSPECT_ORDER) ออกตอนยืนยันขั้น 3
 *         เลขคำสั่ง TOR กรอกเอง (ทะเบียนคำสั่งของทั้งโรงเรียน)
 * สิทธิ์: officer/head/admin บันทึกได้; หลังตรวจรับแก้ได้เฉพาะ head/admin; ยกเลิกได้เฉพาะ head/admin; viewer ดูอย่างเดียว
 */

var PROC_STATUS = {
  draft: 'ร่าง', requested: 'ขอซื้อแล้ว', ordered: 'สั่งซื้อแล้ว', inspected: 'ตรวจรับแล้ว', issued: 'เบิกแล้ว', void: 'ยกเลิก'
};
var PROC_STATUS_ORDER = ['draft', 'requested', 'ordered', 'inspected', 'issued'];

/** ขั้นของงาน: เอกสารที่ออก และสถานะหลังยืนยัน */
var PROC_STEPS = [
  { step: 1, key: 'tor', name: 'กำหนด TOR', forms: ['F01', 'F02', 'F03'], confirmTo: null },
  { step: 2, key: 'request', name: 'ขอซื้อ', forms: ['F04', 'F05'], confirmTo: 'requested' },
  { step: 3, key: 'order', name: 'อนุมัติและสั่งซื้อ', forms: ['F06', 'F07', 'F08', 'F09', 'F10'], confirmTo: 'ordered' },
  { step: 4, key: 'inspect', name: 'ตรวจรับ', forms: ['F11'], confirmTo: 'inspected' },
  { step: 5, key: 'issue', name: 'เบิก', forms: ['F12'], confirmTo: 'issued' }
];

/**
 * ช่องที่เอกสารแต่ละแบบต้องมี (ใช้ทั้งหน้าเว็บและเซิร์ฟเวอร์ — หน้าเว็บได้กฎชุดนี้จาก apiProcMeta)
 * รูปแบบ: 'field|ป้าย|ขั้น'  หรือพิเศษ: '@tor3', '@ic3', '@items', '@vendor', '@bg', '@obj', '@spec', '@proc_no', '@inspect_no'
 */
var PROC_RULES = {
  F01: ['subject|ชื่องาน/พัสดุที่ซื้อ|1', 'tor_memo_date|วันที่บันทึกขอแต่งตั้ง TOR|1', 'project_name|ชื่อโครงการ|1',
    'admin_group|กลุ่มบริหารที่รับผิดชอบ|1', 'budget_amount|วงเงินงบประมาณ|1', '@tor3'],
  F02: ['subject|ชื่องาน/พัสดุที่ซื้อ|1', 'tor_order_no|เลขที่คำสั่งแต่งตั้ง TOR|1', '@tor3'],
  F03: ['subject|ชื่องาน/พัสดุที่ซื้อ|1', 'project_name|ชื่อโครงการ|1', '@bg', '@obj', '@spec', 'price_validity_days|ยืนราคา (วัน)|1',
    'delivery_days|กำหนดส่งมอบ (วัน)|1', 'warranty_years|รับประกัน (ปี)|1', 'repair_days|ซ่อมแซมภายใน (วัน)|1',
    'budget_source|แหล่งงบประมาณ|1', 'budget_year|ปีงบประมาณของแหล่งเงิน|1', 'price_source|ที่มาของราคากลาง|1',
    'responsible_unit|หน่วยงานรับผิดชอบ|1', 'admin_group|กลุ่มบริหารที่รับผิดชอบ|1', '@tor3'],
  F04: ['@proc_no', 'request_date|วันที่รายงานขอซื้อ|2', 'reason|เหตุผลความจำเป็น|1', '@items', 'budget_source|แหล่งงบประมาณ|1',
    'delivery_days|กำหนดส่งมอบ (วัน)|1'],
  F05: ['@proc_no', 'request_date|วันที่รายงานขอซื้อ|2', '@items'],
  F06: ['@proc_no', 'result_date|วันที่รายงานผลการพิจารณา|3', '@vendor', '@items'],
  F07: ['@inspect_no', 'inspect_order_date|วันที่คำสั่งผู้ตรวจรับ|3', '@ic3'],
  F08: ['@proc_no', 'announce_date|วันที่ประกาศผู้ชนะ|3', '@vendor'],
  F09: ['@proc_no', 'contract_notice_date|วันที่หนังสือแจ้งทำสัญญา|3', 'contract_sign_days|ให้มาทำสัญญาภายใน (วัน)|3', '@vendor'],
  F10: ['@proc_no', 'po_date|วันที่ใบสั่งซื้อ|3', '@vendor', 'delivery_days|กำหนดส่งมอบ (วัน)|1', 'warranty_years|รับประกัน (ปี)|1',
    'egp_project_no|เลขที่โครงการ e-GP|3'],
  F11: ['@proc_no', 'inspection_date|วันที่ตรวจรับ|4', 'po_date|วันที่ใบสั่งซื้อ|3', '@ic3', '@vendor'],
  F12: ['issue_date|วันที่เบิก|5', 'requester_id|ผู้เบิก|5', 'dept|กลุ่มงาน/กลุ่มสาระที่เบิก|5', '@items']
};
var PROC_SPECIAL = {
  '@tor3': ['กรรมการกำหนด TOR ครบ 3 คน', 1], '@ic3': ['กรรมการตรวจรับครบ 3 คน', 3], '@items': ['รายการพัสดุอย่างน้อย 1 รายการ (มีจำนวนและราคา)', 2],
  '@vendor': ['ผู้ขาย', 2], '@bg': ['ความเป็นมา (TOR) อย่างน้อย 1 ย่อหน้า', 1], '@obj': ['วัตถุประสงค์ (TOR) อย่างน้อย 1 ข้อ', 1],
  '@spec': ['รายละเอียดคุณลักษณะ (TOR) อย่างน้อย 1 บรรทัด', 1], '@proc_no': ['เลขที่ขอซื้อ (ได้เมื่อกด "ยืนยันขอซื้อ" ในขั้นที่ 2)', 2],
  '@inspect_no': ['เลขที่คำสั่งผู้ตรวจรับ (ได้เมื่อกด "ยืนยันสั่งซื้อ" ในขั้นที่ 3)', 3]
};

/** ฟิลด์ที่ระบบจัดการเอง (หน้าเว็บส่งมาก็ไม่รับ) */
var PROC_SYSTEM_FIELDS = ['proc_id', 'fiscal_year', 'proc_no', 'status', 'inspect_order_no', 'folder_id', 'created_by', 'created_at',
  'updated_by', 'updated_at', 'void_reason', 'total_amount', 'due_date', 'rev'];

// ------------------------------------------------------------------ ตรวจความพร้อม (pure)

function procNonEmpty_(v) { return !(v === null || v === undefined || String(v).trim() === ''); }

/** คืนรายการช่องที่ขาดของแบบฟอร์ม [{form, key, label, step}] */
function procMissing_(data, forms) {
  var P = data.proc || {};
  var out = [], seen = {};
  var cmte = function (kind) {
    var ids = {};
    (data.committees || []).forEach(function (c) { if (c.kind === kind && procNonEmpty_(c.person_id)) ids[c.seq] = 1; });
    return ids[1] && ids[2] && ids[3];
  };
  var spec = function (s) { return (data.specs || []).some(function (x) { return x.section === s && procNonEmpty_(x.text); }); };
  var special = {
    '@tor3': function () { return cmte('TOR'); },
    '@ic3': function () { return cmte('INSPECT'); },
    '@items': function () {
      var it = data.items || [];
      return it.length && it.every(function (i) { return procNonEmpty_(i.description) && Number(i.qty) > 0 && Number(i.unit_price) >= 0 && procNonEmpty_(i.unit); });
    },
    '@vendor': function () { return procNonEmpty_(P.vendor_id) && data.vendor && procNonEmpty_(data.vendor.vendor_name); },
    '@bg': function () { return spec('background'); }, '@obj': function () { return spec('objective'); }, '@spec': function () { return spec('spec'); },
    '@proc_no': function () { return procNonEmpty_(P.proc_no); },
    '@inspect_no': function () { return procNonEmpty_(P.inspect_order_no); }
  };
  forms.forEach(function (f) {
    (PROC_RULES[f] || []).forEach(function (r) {
      var ok, key, label, step;
      if (r.charAt(0) === '@') { ok = special[r](); key = r; label = PROC_SPECIAL[r][0]; step = PROC_SPECIAL[r][1]; }
      else { var p = r.split('|'); key = p[0]; label = p[1]; step = Number(p[2]); ok = procNonEmpty_(P[key]); }
      if (!ok && !seen[key]) { seen[key] = 1; out.push({ form: f, key: key, label: label, step: step }); }
    });
  });
  return out;
}

/** ฟอร์มของขั้น */
function procStepForms_(step) {
  var s = PROC_STEPS.filter(function (x) { return x.step === step; })[0];
  if (!s) throw new Error('ไม่รู้จักขั้นที่ ' + step);
  return s.forms;
}

// ------------------------------------------------------------------ อ่าน/เขียนข้อมูล

/** ลบแถวลูกของงาน (ลบจากล่างขึ้นบน เป็นช่วงต่อเนื่อง) */
function procDeleteChildren_(table, procId) {
  var rows = readAll_(table).filter(function (r) { return r.proc_id === procId; }).map(function (r) { return r._row; })
    .sort(function (a, b) { return b - a; });
  if (!rows.length) return;
  var sh = sheet_(table);
  var i = 0;
  while (i < rows.length) {
    var end = rows[i], start = end;
    while (i + 1 < rows.length && rows[i + 1] === start - 1) { start--; i++; }
    sh.deleteRows(start, end - start + 1);
    i++;
  }
  invalidateTable_(table);
}

function procClean_(o) { var x = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') x[k] = o[k]; }); return x; }

/** โหลดงาน 1 งาน (ข้อมูลดิบ ไม่ตรวจสิทธิ์) */
function procLoad_(procId) {
  var by = function (t) { return readAll_(t).filter(function (r) { return r.proc_id === procId; }).map(procClean_); };
  var row = readAll_('Procurement').filter(function (r) { return r.proc_id === procId; })[0];
  if (!row) throw new Error('ไม่พบงานจัดซื้อรหัส ' + procId);
  var proc = procClean_(row);
  var vendor = proc.vendor_id ? (readAll_('Vendor').filter(function (v) { return v.vendor_id === proc.vendor_id; }).map(procClean_)[0] || null) : null;
  return {
    proc: proc, items: by('ProcItem'), specs: by('ProcSpec'), committees: by('ProcCommittee'), quotes: by('ProcQuote'),
    vendor: vendor, _row: row._row
  };
}

/** ข้อมูลสำหรับออกเอกสาร (เพิ่มบุคลากร ผู้ลงนาม ค่าระบบ) */
function procDocData_(procId) {
  var d = procLoad_(procId);
  var ps = docPeopleAndSigners_();
  d.people = ps.people; d.signers = ps.signers; d.config = readConfig_();
  return d;
}

function procLog_(procId, action, fromStatus, toStatus, note) {
  appendRows_('ProcLog', [{
    log_id: 'L' + new Date().getTime() + ('00' + Math.floor(Math.random() * 1000)).slice(-3), proc_id: procId, at: nowStamp_(), by_email: currentEmail_(),
    action: action, from_status: fromStatus || '', to_status: toStatus || '', note: String(note || '').substring(0, 500)
  }]);
}

/** ออกเลขถัดไปจาก Counter (เรียกภายใน withLock_ เท่านั้น) */
function procNextNumber_(key, fy) {
  var row = readAll_('Counter').filter(function (c) { return c.counter_key === key && String(c.fiscal_year) === String(fy); })[0];
  if (!row) {
    appendRows_('Counter', [{ counter_key: key, fiscal_year: fy, last_no: 1, prefix: key === 'INSPECT_ORDER' ? 'พ' : '', note: 'สร้างอัตโนมัติ' }]);
    return 1;
  }
  var n = Number(row.last_no || 0) + 1;
  updateRow_('Counter', row._row, { last_no: n });
  return n;
}

function procCanEdit_(user, status) {
  if (status === 'void') return hasRole_(user, ['admin']);
  if (status === 'inspected' || status === 'issued') return hasRole_(user, ['head', 'admin']);
  return hasRole_(user, ['officer', 'head', 'admin']);
}

// ------------------------------------------------------------------ API

/** กฎและค่าคงที่สำหรับหน้าเว็บ */
function apiProcMeta() {
  return api_(function () {
    requireRole_(APP.ROLES);
    return procMeta_();
  });
}

function procMeta_() {
  return { version: APP.VERSION, status: PROC_STATUS, statusOrder: PROC_STATUS_ORDER, steps: PROC_STEPS, rules: PROC_RULES, special: PROC_SPECIAL };
}

/** รายการงานจัดซื้อ (ทุกบทบาทดูได้) */
var PROC_TABLES = ['Procurement', 'Vendor', 'ProcItem', 'ProcSpec', 'ProcCommittee', 'ProcQuote'];

function apiProcList(fy, opt) {
  return api_(function () {
    opt = opt || {};
    prefetch_(['Procurement', 'Vendor']);
    var me = requireRole_(APP.ROLES);
    var vendors = {};
    readAll_('Vendor').forEach(function (v) { vendors[v.vendor_id] = v.vendor_name + (v.branch ? ' สาขา ' + v.branch : ''); });
    var rows = readAll_('Procurement').filter(function (p) { return !fy || String(p.fiscal_year) === String(fy) || !p.proc_no; });
    return {
      canCreate: hasRole_(me, ['officer', 'head', 'admin']),
      rows: rows.map(function (p) {
        return {
          proc_id: p.proc_id, fiscal_year: p.fiscal_year, proc_no: p.proc_no, status: p.status, subject: p.subject,
          vendor: vendors[p.vendor_id] || '', total_amount: p.total_amount, request_date: p.request_date, tor_memo_date: p.tor_memo_date,
          updated_at: p.updated_at, updated_by: p.updated_by, folder_id: p.folder_id
        };
      }).sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); }),
      meta: opt.meta ? procMeta_() : undefined
    };
  });
}

/**
 * งาน 1 งาน + เอกสารที่ออกแล้ว (+ ตัวเลือก)
 * opt.log = false → ไม่ส่งประวัติ (หน้าเว็บโหลดเมื่อกดปุ่ม "ประวัติ") · opt.hist → ราคาล่าสุด · opt.meta → กฎของระบบ
 */
function apiProcGet(procId, opt) {
  return api_(function () {
    opt = opt || {};
    prefetch_(PROC_TABLES.concat(['DocOutput'], opt.log !== false ? ['ProcLog'] : []));
    var me = requireRole_(APP.ROLES);
    var d = procLoad_(procId);
    delete d._row;
    var docs = {};
    readAll_('DocOutput').filter(function (o) { return o.proc_id === procId; }).forEach(function (o) {
      if (!docs[o.form_key] || String(o.created_at) > String(docs[o.form_key].created_at)) {
        docs[o.form_key] = { form_key: o.form_key, file_id: o.file_id, created_at: o.created_at, created_by: o.created_by };
      }
    });
    d.docs = docs;
    if (opt.log !== false) d.log = procLogOf_(procId);
    if (opt.hist) d.hist = procPriceHistory_();
    if (opt.meta) d.meta = procMeta_();
    d.canEdit = procCanEdit_(me, d.proc.status);
    d.canVoid = hasRole_(me, ['head', 'admin']) && d.proc.status !== 'void';
    d.folderUrl = d.proc.folder_id ? 'https://drive.google.com/drive/folders/' + d.proc.folder_id : '';
    return d;
  });
}

function procLogOf_(procId) {
  return readAll_('ProcLog').filter(function (l) { return l.proc_id === procId; }).map(procClean_)
    .sort(function (a, b) { return String(b.log_id).localeCompare(String(a.log_id)); }).slice(0, 50);
}

/** ประวัติของงาน (โหลดเมื่อกดปุ่ม "ประวัติ") */
function apiProcLog(procId) {
  return api_(function () {
    requireRole_(APP.ROLES);
    return procLogOf_(procId);
  });
}

/**
 * บันทึก (สร้างใหม่ถ้าไม่มี proc_id)
 * payload = {proc:{...}, items:[], specs:[], committees:[], quotes:[], baseUpdatedAt}
 */
function apiProcSave(payload) {
  return api_(function () {
    var me = requireRole_(['officer', 'head', 'admin']);
    return withLock_(function () { return procSave_(me, payload, 'บันทึก'); });
  });
}

function procSave_(me, payload, action) {
  prefetch_(PROC_TABLES); // อ่านในล็อก ทุกตารางในคำขอเดียว
  var src = payload.proc || {};
  var now = nowStamp_();
  var isNew = !src.proc_id;
  var cur = null, fromStatus = 'draft';
  if (!isNew) {
    cur = procLoad_(src.proc_id);
    fromStatus = cur.proc.status;
    if (!procCanEdit_(me, fromStatus)) throw new Error('งานสถานะ "' + PROC_STATUS[fromStatus] + '" แก้ได้เฉพาะหัวหน้าเจ้าหน้าที่หรือผู้ดูแลระบบ');
    // กันเขียนทับกัน: รุ่นข้อมูล (rev) ต้องตรงกับที่หน้าเว็บเปิดไว้
    if (payload.baseRev !== undefined && payload.baseRev !== '' && Number(cur.proc.rev || 0) !== Number(payload.baseRev)) {
      throw new Error('งานนี้ถูกแก้โดย ' + (cur.proc.updated_by || 'ผู้ใช้อื่น') + ' เมื่อ ' + cur.proc.updated_at + ' — กด "โหลดใหม่" แล้วแก้อีกครั้ง');
    }
  }
  var headers = readTable_('Procurement').headers;
  var proc = {};
  headers.forEach(function (h) {
    if (PROC_SYSTEM_FIELDS.indexOf(h) >= 0) return;
    if (src.hasOwnProperty(h)) proc[h] = src[h] === null || src[h] === undefined ? '' : src[h];
  });
  // ข้อความ: ตัดช่องว่างหัวท้าย
  Object.keys(proc).forEach(function (k) { if (typeof proc[k] === 'string') proc[k] = proc[k].trim(); });

  // รายการ + ยอดรวม
  var items = (payload.items || []).filter(function (i) { return procNonEmpty_(i.description); }).map(function (i, n) {
    var qty = Number(i.qty) || 0, up = Number(i.unit_price) || 0;
    return {
      line_no: n + 1, item_code: String(i.item_code || ''), description: String(i.description).trim(), qty: qty, unit: String(i.unit || '').trim(),
      unit_price: up, std_price: i.std_price === '' || i.std_price === null || i.std_price === undefined ? '' : Number(i.std_price),
      amount: round2(qty * up), post_to_ledger: i.post_to_ledger === false || i.post_to_ledger === 'N' ? 'N' : 'Y',
      is_asset: i.is_asset === true || i.is_asset === 'Y' ? 'Y' : 'N', note: String(i.note || ''),
      // ข้อมูลสำหรับผู้ไปซื้อ (ไม่ลงเอกสารราชการ)
      brand: String(i.brand || '').trim(), model: String(i.model || '').trim(), buy_note: String(i.buy_note || '').trim()
    };
  });
  proc.total_amount = round2(items.reduce(function (s, i) { return s + i.amount; }, 0));
  var poDate = proc.po_date !== undefined ? proc.po_date : (cur ? cur.proc.po_date : '');
  var dd = proc.delivery_days !== undefined ? proc.delivery_days : (cur ? cur.proc.delivery_days : '');
  proc.due_date = poDate && procNonEmpty_(dd) ? addDaysIso(poDate, Number(dd)) : '';
  // ปีงบ: ถ้ายังไม่มีเลขที่ คำนวณจากวันรายงานขอซื้อ (หรือวันบันทึก TOR)
  var hasNo = cur && procNonEmpty_(cur.proc.proc_no);
  if (!hasNo) {
    var basis = proc.request_date || proc.tor_memo_date || todayIso_();
    proc.fiscal_year = fiscalYearBE(basis);
  }
  proc.updated_by = me.email; proc.updated_at = now;
  proc.rev = (cur ? Number(cur.proc.rev || 0) : 0) + 1;

  var procId;
  if (isNew) {
    procId = nextCode_(readAll_('Procurement'), 'proc_id', 'PR', 5);
    proc.proc_id = procId; proc.status = 'draft'; proc.created_by = me.email; proc.created_at = now;
    appendRows_('Procurement', [proc]);
  } else {
    procId = src.proc_id;
    updateRow_('Procurement', cur._row, proc);
  }

  // ตารางลูก: แทนชุดเดิมของงานนี้ (ส่วนที่ไม่ได้แก้ ระบบข้าม ไม่เขียนซ้ำ)
  replaceChildRows_('ProcItem', 'proc_id', procId, items);
  replaceChildRows_('ProcSpec', 'proc_id', procId, (payload.specs || []).filter(function (s) { return procNonEmpty_(s.text); }).map(function (s, n) {
    return { section: s.section, line_no: Number(s.line_no) || n + 1, text: String(s.text).trim() };
  }));
  replaceChildRows_('ProcCommittee', 'proc_id', procId, (payload.committees || []).filter(function (c) { return procNonEmpty_(c.person_id); }).map(function (c) {
    return { kind: c.kind, seq: Number(c.seq), person_id: c.person_id, role_label: c.role_label || '' };
  }));
  replaceChildRows_('ProcQuote', 'proc_id', procId, (payload.quotes || []).filter(function (q) { return procNonEmpty_(q.vendor_id); }).map(function (q, n) {
    return { seq: Number(q.seq) || n + 1, vendor_id: q.vendor_id, offered_price: Number(q.offered_price) || '', agreed_price: Number(q.agreed_price) || '' };
  }));

  procLog_(procId, isNew ? 'สร้างงาน' : action, fromStatus, isNew ? 'draft' : fromStatus,
    payload.changed && payload.changed.length ? 'แก้: ' + payload.changed.join(', ') : '');
  return procLoad_(procId).proc; // อ่านจากแคชที่อัปเดตตามที่เขียน ไม่อ่านชีตซ้ำ
}

/**
 * ยืนยันขั้น (บันทึกก่อน แล้วตรวจความพร้อม ออกเลข เปลี่ยนสถานะ)
 * step: 2 = ขอซื้อ, 3 = สั่งซื้อ, 4 = ตรวจรับ, 5 = เบิก
 */
function apiProcConfirm(payload, step) {
  return api_(function () {
    var me = requireRole_(['officer', 'head', 'admin']);
    return withLock_(function () {
      prefetch_(PROC_TABLES.concat(['Counter'])); // อ่านทุกตารางที่ต้องใช้ก่อนเขียน ในคำขอเดียว
      var saved = procSave_(me, payload, 'บันทึกก่อนยืนยัน');
      var procId = saved.proc_id;
      var stepDef = PROC_STEPS.filter(function (s) { return s.step === Number(step); })[0];
      if (!stepDef || !stepDef.confirmTo) throw new Error('ขั้นนี้ไม่มีการยืนยัน');
      var d = procLoad_(procId);
      var curIdx = PROC_STATUS_ORDER.indexOf(d.proc.status);
      var toIdx = PROC_STATUS_ORDER.indexOf(stepDef.confirmTo);
      if (d.proc.status === 'void') throw new Error('งานนี้ถูกยกเลิกแล้ว');
      if (toIdx - curIdx > 1) return { proc: d.proc, confirmed: false, missing: ['ต้องยืนยันขั้นก่อนหน้าให้เรียบร้อยก่อน'] };
      // ตรวจความพร้อม (ยกเว้นเลขที่ที่จะออกในขั้นนี้)
      var skip = stepDef.step === 2 ? '@proc_no' : (stepDef.step === 3 ? '@inspect_no' : '');
      var miss = procMissing_(d, stepDef.forms).filter(function (m) { return m.key !== skip; });
      // ข้อมูลถูกบันทึกแล้ว แต่ยังยืนยันไม่ได้ → คืนรุ่นข้อมูลใหม่ให้หน้าเว็บ พร้อมรายการที่ขาด
      if (miss.length) return { proc: d.proc, confirmed: false, missing: miss.map(function (m) { return m.label; }) };
      var patch = { status: toIdx > curIdx ? stepDef.confirmTo : d.proc.status, rev: Number(d.proc.rev || 0) + 1 };
      var note = '';
      if (stepDef.step === 2 && !procNonEmpty_(d.proc.proc_no)) {
        var fy = fiscalYearBE(d.proc.request_date);
        patch.fiscal_year = fy;
        patch.proc_no = String(procNextNumber_('PROC', fy));
        note = 'ออกเลขขอซื้อ ' + patch.proc_no + '/' + fy;
      }
      if (stepDef.step === 3 && !procNonEmpty_(d.proc.inspect_order_no)) {
        var fy2 = d.proc.fiscal_year;
        patch.inspect_order_no = procNextNumber_('INSPECT_ORDER', fy2) + '/' + fy2;
        note = 'ออกเลขคำสั่งผู้ตรวจรับ พ ' + patch.inspect_order_no;
      }
      updateRow_('Procurement', d._row, patch);
      procLog_(procId, 'ยืนยัน' + stepDef.name, d.proc.status, patch.status, note);
      return { proc: procLoad_(procId).proc, confirmed: true, missing: [] };
    });
  });
}

/**
 * ออกเอกสาร
 * which: เลขขั้น (1–5) = เอกสารของขั้นนั้น | 'all' = ทุกแบบที่ข้อมูลพร้อม + ชุดรวม
 */
function apiProcGenerate(procId, which) {
  return api_(function () {
    prefetch_(PROC_TABLES.concat(['Personnel', 'Signers', 'FormTemplate', 'Config']));
    var me = requireRole_(['officer', 'head', 'admin']);
    var data = procDocData_(procId);
    if (data.proc.status === 'void') throw new Error('งานนี้ถูกยกเลิกแล้ว');
    var forms;
    if (which === 'all') {
      forms = [];
      PROC_STEPS.forEach(function (s) { s.forms.forEach(function (f) { if (!procMissing_(data, [f]).length) forms.push(f); }); });
      if (!forms.length) throw new Error('ยังไม่มีเอกสารที่ข้อมูลครบพอจะออกได้');
    } else {
      forms = procStepForms_(Number(which));
      var miss = procMissing_(data, forms);
      if (miss.length) throw new Error('ยังขาดข้อมูล: ' + miss.map(function (m) { return m.label; }).join(', '));
    }
    // ขั้น 1 ออกได้ก่อนมีเลขขอซื้อ: ชื่อโฟลเดอร์/ไฟล์ใช้ "ร่าง PR00001" แทนเลข (ดู docPrefix_)
    var r = generateDocs_(data, { forms: forms, combined: which === 'all', procId: procId });
    var folderId = r.folderId;
    if (folderId && folderId !== data.proc.folder_id) {
      var row = readAll_('Procurement').filter(function (p) { return p.proc_id === procId; })[0];
      if (row) updateRow_('Procurement', row._row, { folder_id: folderId });
    }
    procLog_(procId, 'ออกเอกสาร', data.proc.status, data.proc.status, r.files.map(function (f) { return f.form_key; }).join(', ') + (r.combined ? ' + ชุดรวม' : ''));
    var at = nowStamp_(), by = currentEmail_(), docs = {};
    r.files.forEach(function (f) { docs[f.form_key] = { form_key: f.form_key, file_id: f.id, created_at: at, created_by: by }; });
    return { folderUrl: r.folderUrl, folderId: folderId, files: r.files.map(function (f) { return { form_key: f.form_key, name: f.name, url: f.url, missing: f.missing }; }),
      combined: r.combined, style: r.style, docs: docs };
  });
}

/** ยกเลิกงาน (ไม่ลบข้อมูล เลขที่ที่ออกแล้วไม่นำกลับมาใช้) */
function apiProcVoid(procId, reason) {
  return api_(function () {
    requireRole_(['head', 'admin']);
    if (!procNonEmpty_(reason)) throw new Error('กรุณาระบุเหตุผลที่ยกเลิก');
    return withLock_(function () {
      var d = procLoad_(procId);
      if (d.proc.status === 'void') throw new Error('งานนี้ถูกยกเลิกไปแล้ว');
      updateRow_('Procurement', d._row, { status: 'void', void_reason: String(reason).trim(), updated_by: currentEmail_(), updated_at: nowStamp_(), rev: Number(d.proc.rev || 0) + 1 });
      procLog_(procId, 'ยกเลิกงาน', d.proc.status, 'void', reason);
      return procLoad_(procId).proc;
    });
  });
}

/** เพิ่ม/แก้ผู้ขาย (จากฟอร์มงานจัดซื้อ) */
function apiProcSaveVendor(v) {
  return api_(function () {
    var me = requireRole_(['officer', 'head', 'admin']);
    var name = String(v && v.vendor_name || '').trim();
    if (!name) throw new Error('กรุณากรอกชื่อผู้ขาย');
    var tax = String(v.tax_id || '').replace(/\D/g, '');
    if (tax && tax.length !== 13) throw new Error('เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก');
    return withLock_(function () {
      var all = readAll_('Vendor');
      var row = {
        vendor_name: name, branch: String(v.branch || '').trim(), vendor_type: String(v.vendor_type || guessVendorType_(name)),
        tax_id: tax, address: String(v.address || '').trim(), subdistrict: String(v.subdistrict || '').trim(),
        district: String(v.district || '').trim(), province: String(v.province || '').trim(),
        postcode: String(v.postcode || '').replace(/\D/g, ''), phone: String(v.phone || '').trim(), active: 'TRUE'
      };
      if (v.vendor_id) {
        var cur = all.filter(function (x) { return x.vendor_id === v.vendor_id; })[0];
        if (!cur) throw new Error('ไม่พบผู้ขาย ' + v.vendor_id);
        updateRow_('Vendor', cur._row, row);
        row.vendor_id = v.vendor_id;
      } else {
        var dup = all.filter(function (x) { return String(x.vendor_name).trim() === name && String(x.branch || '') === row.branch; })[0];
        if (dup) throw new Error('มีผู้ขายชื่อนี้แล้ว (' + dup.vendor_id + ') — เลือกจากรายการแทน');
        row.vendor_id = nextCode_(all, 'vendor_id', 'V', 4);
        row.note = 'เพิ่มจากงานจัดซื้อโดย ' + me.email;
        appendRows_('Vendor', [row]);
      }
      bumpDataVersion_();
      return row;
    });
  });
}

/** เพิ่มหน่วยงานเข้าทะเบียน (ถ้ามีชื่อนี้แล้ว คืนรายการเดิม) */
function apiProcAddDepartment(d) {
  return api_(function () {
    var me = requireRole_(['officer', 'head', 'admin']);
    var name = String(d && d.dept_name || '').replace(/\s+/g, ' ').trim();
    if (!name) throw new Error('กรุณากรอกชื่อหน่วยงาน');
    var type = String(d.dept_type || '').trim() || 'อื่น ๆ';
    return withLock_(function () {
      var all = readAll_('Department');
      var dup = all.filter(function (x) { return String(x.dept_name).trim() === name; })[0];
      if (dup) {
        if (String(dup.active).toUpperCase() === 'FALSE') { updateRow_('Department', dup._row, { active: 'TRUE' }); bumpDataVersion_(); }
        return { dept_id: dup.dept_id, dept_name: dup.dept_name, dept_type: dup.dept_type, active: 'TRUE', existed: true };
      }
      var row = { dept_id: nextCode_(all, 'dept_id', 'D', 2), dept_name: name, dept_type: type, active: 'TRUE',
        note: 'เพิ่มจากหน้างานจัดซื้อ', added_by: me.email, added_at: nowStamp_() };
      appendRows_('Department', [row]);
      bumpDataVersion_();
      return row;
    });
  });
}

/**
 * ประวัติราคา/ยี่ห้อจากงานในระบบใหม่ (ไม่นับงานที่ยกเลิก) — ใช้เติมราคาล่าสุดเมื่อเลือกพัสดุ
 * คืน { "C:<รหัสพัสดุ>" | "N:<ชื่อรายการ>": { price, unit, brand, model, date, job, proc_id, brands:[...] } }
 */
function apiProcPriceHistory() {
  return api_(function () {
    requireRole_(APP.ROLES);
    return procPriceHistory_();
  });
}

function procPriceHistory_() {
  var procs = {};
  readAll_('Procurement').forEach(function (p) { if (p.status !== 'void') procs[p.proc_id] = p; });
  var latest = {}, brands = {};
  readAll_('ProcItem').forEach(function (i) {
    var p = procs[i.proc_id];
    if (!p || !procNonEmpty_(i.description) || !(Number(i.unit_price) > 0)) return;
    var date = String(p.request_date || p.tor_memo_date || p.updated_at || '').substring(0, 10);
    var stamp = date + ' ' + String(p.updated_at || '');
    var rec = { price: Number(i.unit_price), unit: String(i.unit || ''), brand: String(i.brand || ''), model: String(i.model || ''),
      date: date, job: p.proc_no ? p.proc_no + '/' + p.fiscal_year : p.proc_id, proc_id: p.proc_id, stamp: stamp };
    var keys = ['N:' + procItemKey_(i.description)];
    if (procNonEmpty_(i.item_code)) keys.push('C:' + String(i.item_code));
    keys.forEach(function (k) {
      if (!brands[k]) brands[k] = [];
      if (rec.brand && brands[k].indexOf(rec.brand) < 0) brands[k].push(rec.brand);
      if (!latest[k] || rec.stamp > latest[k].stamp) latest[k] = rec;
    });
  });
  var out = {};
  Object.keys(latest).forEach(function (k) {
    var r = latest[k];
    out[k] = { price: r.price, unit: r.unit, brand: r.brand, model: r.model, date: r.date, job: r.job, proc_id: r.proc_id, brands: brands[k] };
  });
  return out;
}

/** คีย์ชื่อรายการ: ตัดช่องว่างซ้ำ ไม่สนตัวพิมพ์ */
function procItemKey_(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
