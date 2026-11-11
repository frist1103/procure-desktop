/**
 * 00_App.gs — ค่าคงที่ของระบบจัดซื้อพัสดุและครุภัณฑ์ (ระบบใหม่ แยกจากระบบบัญชีรับ-จ่ายเดิม)
 * ไฟล์และโฟลเดอร์สร้างไว้แล้วในโฟลเดอร์ Drive "ระบบจัดซื้อพัสดุและครุภัณฑ์"
 */
var APP = {
  VERSION: '0.3.3 (เฟส 2.2a+)',
  DB_ID: '1Utkv36C3yXSUJhioou2xeHcceCozI-oq2cp7u3M0ItQ',
  TEACHER_VIEW_ID: '1bWMoPnrpvJnXQ-AU2LHGO8I_x5Y9RIwLL5toSY3ABEg',
  LEGACY_ID: '1X7E6_mhuA-B4r_-6OxSzo6m0cmDvfnoVowCr7sJqebs', // ระบบเดิม: อ่านอย่างเดียว ห้ามเขียน
  VARDICT_ID: '1Mw08ZiTkTHqgBX6pmYrgWFCEsSj_aXBiZatoiwtw4P8',
  FOLDERS: {
    root: '10zF-DMlizNGzzm9GTRQkbKaYqqgXc-EN',
    db: '10r_v58J9T8Ujn8PoZOmQti9hK_huOdEP',
    teacher: '15lxM1TWjSm9OhJPryNlHpwNF27F5LLLC',
    templates: '1VrfArzjGP5YZW2UG2Hs2C_4UH-RpVyiy',
    output: '1wAlIn_zelnOeR8JjcTs29ATWXrQzJdJ9',
    backup: '1nk1nGhsdecRt6SKJRdlRhdHKM2jSRXqR'
  },
  TZ: 'Asia/Bangkok',
  DOMAIN: 'hongson.ac.th',
  ROLES: ['admin', 'officer', 'head', 'finance', 'viewer'],
  STAFF_ROLES: ['admin', 'officer', 'head', 'finance'],
  BACKUP_KEEP: 8
};

/** โครงสร้างตาราง: เพิ่มคอลัมน์ใหม่ต่อท้ายได้เสมอ ห้ามลบหรือสลับลำดับ */
var SCHEMA = {
  Config: ['key', 'value', 'note'],
  Users: ['email', 'person_id', 'display_name', 'roles', 'active', 'note', 'updated_at', 'updated_by'],
  Roles: ['role_key', 'role_name', 'description'],
  Signers: ['sign_key', 'sign_label', 'person_id', 'title_override', 'start_date', 'end_date', 'active', 'note'],
  Personnel: ['person_id', 'prefix', 'first_name', 'last_name', 'full_name', 'staff_type', 'position', 'position_title', 'dept', 'status', 'email', 'note', 'source', 'updated_at'],
  Department: ['dept_id', 'dept_name', 'dept_type', 'active', 'note', 'added_by', 'added_at'],
  Category: ['cat_code', 'cat_name', 'type'],
  Item: ['item_code', 'cat_code', 'item_name', 'unit', 'note'],
  Vendor: ['vendor_id', 'vendor_name', 'branch', 'vendor_type', 'tax_id', 'address', 'subdistrict', 'district', 'province', 'postcode', 'phone', 'note', 'active', 'legacy_name'],
  Project: ['project_id', 'fiscal_year', 'project_name', 'dept', 'responsible_unit', 'owner_person_id', 'budget_amount', 'budget_type', 'budget_source', 'note', 'active', 'source'],
  Procurement: ['proc_id', 'fiscal_year', 'proc_no', 'status', 'method', 'subject', 'subject_short', 'reason', 'project_id', 'project_name', 'admin_group', 'responsible_unit', 'dept', 'requester_id', 'budget_type', 'budget_source', 'budget_year', 'budget_amount', 'ref_price', 'price_source', 'total_amount', 'vat_mode', 'vendor_id', 'delivery_days', 'price_validity_days', 'contract_sign_days', 'warranty_years', 'warranty_months', 'repair_days', 'penalty_rate', 'number_style', 'egp_project_no', 'egp_project_name', 'egp_contract_no', 'egp_inspect_no', 'tor_memo_no', 'tor_memo_date', 'tor_order_no', 'tor_order_date', 'request_date', 'result_date', 'inspect_order_no', 'inspect_order_date', 'announce_date', 'contract_notice_date', 'po_date', 'due_date', 'inspection_date', 'issue_date', 'issue_doc_no', 'receive_doc_no', 'folder_id', 'created_by', 'created_at', 'updated_by', 'updated_at', 'void_reason',
    'item_mode', 'po_line_desc', 'po_line_qty', 'po_line_unit', 'issue_quarter', 'rev'],
  ProcItem: ['proc_id', 'line_no', 'item_code', 'description', 'qty', 'unit', 'unit_price', 'std_price', 'amount', 'post_to_ledger', 'is_asset', 'note',
    'brand', 'model', 'buy_note'],
  ProcSpec: ['proc_id', 'section', 'line_no', 'text'],
  ProcCommittee: ['proc_id', 'kind', 'seq', 'person_id', 'role_label'],
  ProcQuote: ['proc_id', 'seq', 'vendor_id', 'offered_price', 'agreed_price'],
  ProcLog: ['log_id', 'proc_id', 'at', 'by_email', 'action', 'from_status', 'to_status', 'note'],
  DocOutput: ['out_id', 'proc_id', 'form_key', 'file_id', 'pdf_id', 'created_at', 'created_by', 'template_rev', 'number_style', 'note'],
  Counter: ['counter_key', 'fiscal_year', 'last_no', 'prefix', 'note'],
  FormTemplate: ['form_key', 'form_name', 'seq', 'template_doc_id', 'active', 'note', 'step', 'template_rev'],
  ImportLog: ['run_id', 'at', 'by_email', 'source', 'target', 'rows', 'note']
};

/**
 * วันที่: เก็บเป็นข้อความ "yyyy-MM-dd" เสมอ (ไม่ให้ชีตแปลงเป็นค่าวันที่ ซึ่งผูกกับเขตเวลาของชีต)
 * เวลาบันทึก: เก็บเป็นข้อความ "yyyy-MM-dd HH:mm:ss" เวลาไทย
 */
var DATE_COLUMNS = ['tor_memo_date', 'tor_order_date', 'request_date', 'result_date', 'inspect_order_date', 'announce_date',
  'contract_notice_date', 'po_date', 'due_date', 'inspection_date', 'issue_date', 'start_date', 'end_date'];
var DATETIME_COLUMNS = ['created_at', 'updated_at', 'at', 'added_at'];

/** คอลัมน์ที่ต้องเก็บเป็นข้อความเสมอ (กันเลขศูนย์นำหน้าหาย และกันชีตแปลงวันที่) */
var TEXT_COLUMNS = ['tax_id', 'phone', 'postcode', 'item_code', 'cat_code', 'value', 'egp_project_no', 'egp_contract_no', 'egp_inspect_no', 'proc_no', 'branch',
  'inspect_order_no', 'tor_order_no', 'tor_memo_no', 'issue_doc_no', 'receive_doc_no', 'po_line_qty', 'issue_quarter'].concat(DATE_COLUMNS, DATETIME_COLUMNS);

/** ค่า Config ที่ผู้ดูแลแก้ผ่านหน้าเว็บได้ */
var EDITABLE_CONFIG = ['number_style', 'fiscal_year_current', 'default_delivery_days', 'default_price_validity_days',
  'default_contract_sign_days', 'default_repair_days', 'default_penalty_rate', 'default_inspect_committee_size',
  'school_name', 'school_address', 'school_district_text', 'area_office', 'moe_code', 'phone_supply', 'fax_supply',
  'phone_office', 'supply_unit_name', 'budget_group_name', 'dev_mode'];

;
/**
 * Api.gs — ฟังก์ชันที่หน้าเว็บเรียกผ่าน google.script.run
 * ทุกฟังก์ชันคืน { ok:true, data } หรือ { ok:false, error } และตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์
 */
function api_(fn) {
  var t0 = Date.now();
  __perf = { reads: 0, readMs: 0, writes: 0 };
  var out;
  try { out = { ok: true, data: fn() }; }
  catch (e) { out = { ok: false, error: String(e && e.message ? e.message : e) }; }
  // เขียนลงชีตให้เสร็จก่อนจับเวลา (ไม่งั้นเวลาเขียนจริงไปตกหลังส่งผลลัพธ์)
  if (__perf.writes) { var tf = Date.now(); try { SpreadsheetApp.flush(); } catch (e2) { /* ไม่เป็นไร */ } __perf.flushMs = Date.now() - tf; }
  out.ms = Date.now() - t0;
  out.perf = __perf;
  return out;
}

/**
 * โหลดตอนเปิดหน้าเว็บ
 * clientKey = "<version>:<level>" ที่เบราว์เซอร์มีอยู่ ถ้าตรงกับเซิร์ฟเวอร์จะไม่ส่งข้อมูลซ้ำ
 */
function apiBootstrap(clientKey) {
  return api_(function () {
    var t0 = Date.now();
    var user = currentUser_();
    if (!user) return { denied: true, email: currentEmail_() };
    var level = user.isStaff ? 'staff' : 'pub';
    var key = getDataVersion_() + ':' + level;
    var out = { user: user, key: key, appVersion: APP.VERSION };
    if (clientKey && clientKey === key) out.notModified = true;
    else out.ref = getRefSnapshot_(level);
    out.serverMs = Date.now() - t0;
    return out;
  });
}

// ---------- ผู้ดูแลระบบ: ผู้ใช้และบทบาท ----------

function apiAdminListUsers() {
  return api_(function () {
    requireRole_(['admin']);
    return {
      users: readAll_('Users').map(function (u) { delete u._row; return u; }),
      roles: readAll_('Roles').map(function (r) { delete r._row; return r; })
    };
  });
}

function apiAdminSaveUser(u) {
  return api_(function () {
    var me = requireRole_(['admin']);
    var email = String(u && u.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('อีเมลไม่ถูกต้อง');
    if (email.split('@')[1] !== APP.DOMAIN) throw new Error('ต้องเป็นอีเมล @' + APP.DOMAIN);
    var roles = (u.roles || []).filter(function (r) { return APP.ROLES.indexOf(r) >= 0; });
    if (!roles.length) throw new Error('เลือกบทบาทอย่างน้อย 1 บทบาท');
    var person = null;
    if (u.person_id) {
      person = readAll_('Personnel').filter(function (p) { return p.person_id === u.person_id; })[0];
      if (!person) throw new Error('ไม่พบรหัสบุคลากร ' + u.person_id);
    }
    // กันผู้ดูแลถอดสิทธิ์ admin ของตัวเองจนไม่มีใครเป็น admin
    if (email === me.email && roles.indexOf('admin') < 0 && !me.isDev) throw new Error('ถอดสิทธิ์ผู้ดูแลของตัวเองไม่ได้');
    return withLock_(function () {
      var res = upsert_('Users', 'email', {
        email: email, person_id: person ? person.person_id : '', display_name: person ? person.full_name : (u.display_name || email),
        roles: roles.join(','), active: u.active === false ? 'FALSE' : 'TRUE', note: String(u.note || ''),
        updated_at: nowStamp_(), updated_by: me.email
      });
      bumpDataVersion_(); // ล้างแคชผู้ใช้ (สิทธิ์ใหม่มีผลทันที)
      return { result: res };
    });
  });
}

// ---------- ผู้ดูแลระบบ: ผู้ลงนามตามบทบาท ----------

function apiAdminSaveSigner(s) {
  return api_(function () {
    var me = requireRole_(['admin', 'head']);
    var key = String(s && s.sign_key || '');
    var row = readAll_('Signers').filter(function (r) { return r.sign_key === key; })[0];
    if (!row) throw new Error('ไม่พบบทบาทผู้ลงนาม ' + key);
    var person = readAll_('Personnel').filter(function (p) { return p.person_id === s.person_id; })[0];
    if (!person) throw new Error('ไม่พบรหัสบุคลากร ' + s.person_id);
    return withLock_(function () {
      updateRow_('Signers', row._row, {
        person_id: person.person_id, title_override: String(s.title_override || ''),
        note: 'แก้โดย ' + me.email + ' ' + nowStamp_()
      });
      bumpDataVersion_();
      return { saved: key };
    });
  });
}

// ---------- ผู้ดูแลระบบ: ค่าระบบ ----------

function apiAdminSetConfig(key, value) {
  return api_(function () {
    requireRole_(['admin']);
    if (EDITABLE_CONFIG.indexOf(key) < 0) throw new Error('แก้ค่านี้ผ่านหน้าเว็บไม่ได้: ' + key);
    if (key === 'number_style' && ['thai', 'arabic'].indexOf(value) < 0) throw new Error('number_style ต้องเป็น thai หรือ arabic');
    if (/^default_/.test(key) && isNaN(Number(value))) throw new Error('ต้องเป็นตัวเลข');
    return withLock_(function () {
      writeConfig_(key, value);
      bumpDataVersion_();
      return { key: key, value: value };
    });
  });
}

// ---------- ผู้ดูแลระบบ: เครื่องมือ ----------

function apiAdminImportLegacy() {
  return api_(function () {
    var me = requireRole_(['admin']);
    return withLock_(function () {
      var r = importLegacy_(me.email);
      bumpDataVersion_();
      return r;
    });
  });
}

function apiAdminSyncTeacherView() {
  return api_(function () {
    requireRole_(['admin', 'officer', 'head']);
    return syncTeacherView_();
  });
}

/** ด่าน 2 เฟส 1: ออกชุดเอกสารทดสอบงานโดรน 13/2570 (ไม่บันทึกงาน ไม่ใช้เลข Counter) */
function apiAdminTestDocs(style) {
  return api_(function () {
    requireRole_(['admin', 'officer']);
    var r = generateDocs_(docTestData_(), { test: true, style: style || '' });
    return { folderUrl: r.folderUrl, style: r.style, count: r.files.length,
      missing: r.files.filter(function (f) { return f.missing.length; }).map(function (f) { return f.form_key + ': ' + f.missing.join(', '); }) };
  });
}

/** ตัวอย่างการแปลงตัวเลข/วันที่ตามค่าระบบ (หน้าแสดงตัวอย่าง) */
function apiPreviewFormats(style) {
  return api_(function () {
    requireRole_(['admin', 'officer', 'head']);
    var vat = splitVat(19650);
    var f = function (s) { return applyNumberStyle(s, style); };
    return {
      money: f(formatMoney(vat.total)), beforeVat: f(formatMoney(vat.beforeVat)), vat: f(formatMoney(vat.vat)),
      text: bahtText(vat.total), d1: f(thaiDate('2026-11-03', 'D1')), d2: f(thaiDate('2026-11-04', 'D2')),
      d3: f(thaiDate('2026-11-02', 'D3')), d4: f(thaiDate('2026-11-12', 'D4')), docNo: f('13/2570')
    };
  });
}

;
/**
 * Auth.gs — ตัวตนผู้ใช้และบทบาท
 * ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกครั้ง (การซ่อนปุ่มบนหน้าเว็บไม่ถือเป็นการป้องกัน)
 */
var __user = null;

function currentEmail_() {
  var e = '';
  try { e = Session.getActiveUser().getEmail() || ''; } catch (err) { e = ''; }
  return String(e).trim().toLowerCase();
}

/** คืนข้อมูลผู้ใช้ปัจจุบัน หรือ null ถ้าไม่มีสิทธิ์เข้า */
function currentUser_() {
  if (__user !== null) return __user;
  var email = currentEmail_();
  if (!email) { __user = null; return null; }
  // แคชเซิร์ฟเวอร์ 10 นาที ผูกกับเลขเวอร์ชันข้อมูล (แก้ผู้ใช้/ค่าระบบผ่านระบบ → เลขเปลี่ยน → อ่านใหม่ทันที)
  var ck = 'user1:' + email + ':' + getDataVersion_();
  try {
    var hit = CacheService.getScriptCache().get(ck);
    if (hit) { __user = JSON.parse(hit); return __user; }
  } catch (e) { /* ไม่มีแคช อ่านจากชีต */ }
  prefetch_(['Config', 'Users', 'Personnel']); // อ่าน 3 ตารางในคำขอเดียว
  var cfg = readConfig_();
  var users = readAll_('Users');
  var row = users.filter(function (u) { return String(u.email).trim().toLowerCase() === email; })[0];
  var person = null;
  var personId = row ? String(row.person_id || '') : '';
  if (personId) {
    person = readAll_('Personnel').filter(function (p) { return p.person_id === personId; })[0] || null;
  }
  var roles = [];
  if (row && String(row.active).toUpperCase() !== 'FALSE') {
    roles = String(row.roles || '').split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return APP.ROLES.indexOf(s) >= 0; });
  }
  var isDev = String(cfg.dev_mode).toUpperCase() === 'TRUE' && email === String(cfg.dev_admin_email || '').toLowerCase();
  if (isDev) roles = APP.ROLES.slice();
  // ผู้ใช้ในโดเมนโรงเรียนที่ยังไม่ได้กำหนดบทบาท = ครูทั่วไป (viewer)
  if (!roles.length && email.split('@')[1] === APP.DOMAIN) roles = ['viewer'];
  if (!roles.length) { __user = null; return null; }
  __user = {
    email: email,
    personId: personId,
    name: person ? person.full_name : (row ? row.display_name : email),
    positionTitle: person ? person.position_title : '',
    roles: roles,
    isDev: isDev,
    isStaff: roles.some(function (r) { return APP.STAFF_ROLES.indexOf(r) >= 0; })
  };
  try { CacheService.getScriptCache().put(ck, JSON.stringify(__user), 600); } catch (e) { /* ไม่เป็นไร */ }
  return __user;
}

function hasRole_(user, roles) {
  return !!user && roles.some(function (r) { return user.roles.indexOf(r) >= 0; });
}

/** โยน error ถ้าไม่มีบทบาทที่ต้องการ */
function requireRole_(roles) {
  var u = currentUser_();
  if (!u) throw new Error('ไม่มีสิทธิ์เข้าใช้ระบบ (ต้องใช้บัญชี @' + APP.DOMAIN + ')');
  if (!hasRole_(u, roles)) throw new Error('บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้');
  return u;
}

;
/**
 * Cache.gs — ชั้นข้อมูลเร็ว
 * แนวคิด: Google Sheet = ความจริงที่เดียว / ข้อมูลอ้างอิงถูกทำเป็นสำเนา (snapshot) เก็บใน CacheService
 * และในเบราว์เซอร์ (IndexedDB) โดยมีเลขเวอร์ชันกำกับ ทุกครั้งที่มีการเขียนข้อมูลอ้างอิง → bumpDataVersion_()
 */
var CACHE_TTL = 6 * 60 * 60; // 6 ชั่วโมง (สูงสุดของ CacheService)
var CHUNK = 90000;           // CacheService เก็บได้ไม่เกิน 100KB ต่อคีย์

function getDataVersion_() {
  if (__tableCache['#ver']) return __tableCache['#ver'];
  var p = PropertiesService.getScriptProperties();
  var v = p.getProperty('DATA_VERSION');
  if (!v) { v = String(Date.now()); p.setProperty('DATA_VERSION', v); }
  __tableCache['#ver'] = v;
  return v;
}

function bumpDataVersion_() {
  var v = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('DATA_VERSION', v);
  __tableCache['#ver'] = v;
  delete __tableCache['#cfg'];
  return v;
}

function cachePutJson_(key, obj) {
  var s = JSON.stringify(obj);
  var parts = {};
  var n = Math.ceil(s.length / CHUNK) || 1;
  for (var i = 0; i < n; i++) parts[key + ':' + i] = s.substr(i * CHUNK, CHUNK);
  parts[key + ':n'] = String(n);
  try { CacheService.getScriptCache().putAll(parts, CACHE_TTL); } catch (e) { /* แคชเต็ม/ล้มเหลว ไม่กระทบการทำงาน */ }
}

function cacheGetJson_(key) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get(key + ':n') || 0);
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(key + ':' + i);
  var got = c.getAll(keys);
  var s = '';
  for (var j = 0; j < n; j++) {
    if (got[keys[j]] === undefined) return null;
    s += got[keys[j]];
  }
  try { return JSON.parse(s); } catch (e) { return null; }
}

/** ตารางแบบกะทัดรัด {cols, rows} ลดขนาดข้อมูลที่ส่งไปเบราว์เซอร์ */
function compact_(rows, cols) {
  return { cols: cols, rows: rows.map(function (r) { return cols.map(function (c) { return r[c] === undefined ? '' : r[c]; }); }) };
}

/**
 * สร้างสำเนาข้อมูลอ้างอิง
 * level 'pub' = ครูทั่วไป / 'staff' = เจ้าหน้าที่ (เห็นที่อยู่ เลขผู้เสียภาษี เบอร์ผู้ขาย)
 */
function buildRefSnapshot_(level) {
  prefetch_(['Config', 'Personnel', 'Signers', 'Vendor', 'Department', 'Category', 'Item', 'Project', 'FormTemplate']);
  var cfg = readConfig_();
  var publicCfgKeys = ['app_name', 'school_name', 'fiscal_year_current', 'number_style', 'vat_rate'];
  var staffCfgKeys = publicCfgKeys.concat(EDITABLE_CONFIG);
  var conf = {};
  (level === 'staff' ? staffCfgKeys : publicCfgKeys).forEach(function (k) { conf[k] = cfg[k] === undefined ? '' : cfg[k]; });

  var personnel = readAll_('Personnel');
  var signers = readAll_('Signers').filter(function (s) { return String(s.active).toUpperCase() !== 'FALSE'; });
  var vendors = readAll_('Vendor').filter(function (v) { return String(v.active).toUpperCase() !== 'FALSE'; });
  var vendorCols = level === 'staff'
    ? ['vendor_id', 'vendor_name', 'branch', 'vendor_type', 'tax_id', 'address', 'subdistrict', 'district', 'province', 'postcode', 'phone']
    : ['vendor_id', 'vendor_name', 'branch', 'province'];
  return {
    level: level,
    builtAt: nowStamp_(),
    config: conf,
    personnel: compact_(personnel, ['person_id', 'full_name', 'staff_type', 'position', 'position_title', 'dept', 'status']),
    departments: compact_(readAll_('Department').filter(function (d) { return String(d.active).toUpperCase() !== 'FALSE'; }), ['dept_id', 'dept_name', 'dept_type']),
    signers: compact_(signers, ['sign_key', 'sign_label', 'person_id', 'title_override']),
    categories: compact_(readAll_('Category'), ['cat_code', 'cat_name', 'type']),
    items: compact_(readAll_('Item'), ['item_code', 'cat_code', 'item_name', 'unit']),
    vendors: compact_(vendors, vendorCols),
    projects: compact_(readAll_('Project').filter(function (p) { return String(p.active).toUpperCase() !== 'FALSE'; }),
      ['project_id', 'fiscal_year', 'project_name', 'dept', 'responsible_unit', 'owner_person_id', 'budget_amount', 'budget_source']),
    forms: compact_(readAll_('FormTemplate'), ['form_key', 'form_name', 'seq', 'active'])
  };
}

/** คืนสำเนาข้อมูลอ้างอิงตามเวอร์ชันปัจจุบัน (จากแคช ถ้าไม่มีจึงสร้างใหม่) */
function getRefSnapshot_(level) {
  var v = getDataVersion_();
  var key = 'ref:' + level + ':' + v;
  var snap = cacheGetJson_(key);
  if (snap) { snap.fromCache = true; return snap; }
  snap = buildRefSnapshot_(level);
  cachePutJson_(key, snap);
  snap.fromCache = false;
  return snap;
}

;
/**
 * Code.gs — จุดเข้าเว็บแอพ
 * ไม่เปิด XFrameOptionsMode.ALLOWALL (กันเว็บอื่นฝังหน้าระบบ) — ถ้าภายหลังต้องฝังใน Google Sites ค่อยพิจารณา
 */
function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.appVersion = APP.VERSION;
  return t.evaluate()
    .setTitle('ระบบจัดซื้อพัสดุและครุภัณฑ์')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** ฝังไฟล์ html ย่อย (css/js) */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

;
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

;
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

;
/**
 * DocxCore.gs — เติมข้อมูลลงเทมเพลต Word (.docx) แบบแก้ข้อความ XML โดยตรง
 * ฟังก์ชันบริสุทธิ์ (ไม่แตะ Google API) จึงทดสอบบนเครื่องได้ และไม่ทำให้รูปแบบเอกสารเพี้ยน
 *
 * ป้ายในเทมเพลต (สร้างจากไฟล์ต้นฉบับโดยสคริปต์ build_templates.py — ทุกป้ายอยู่ใน <w:t> เดียว)
 *   {{name}}              แทนด้วยค่า ctx.name
 *   {{name|ข้อความเดิม}}   ถ้า ctx.name ว่าง ใช้ข้อความเดิม
 *   {{loop.field}}        อยู่ในแถวตาราง/ย่อหน้า → ทำซ้ำตาม ctx.loops.loop
 *   {{#filler key}}       ย่อหน้าว่างเติมความสูงตาราง ทำซ้ำ ctx.key ครั้ง
 */

var DOCX_THAI_FONT = 'TH SarabunIT๙';
var DOCX_ARABIC_FONT = 'TH SarabunPSK';

function docxEscape_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** ค่าข้อความ → XML ภายใน <w:t> (ขึ้นบรรทัดใหม่ด้วย \n) */
function docxValue_(v) {
  var s = docxEscape_(v === null || v === undefined ? '' : v);
  return s.replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
}

/** หาแท็กเปิด <w:tag>, <w:tag ...> หรือ <w:tag/> (ไม่ใช่ <w:tagPr>) ที่อยู่ก่อนตำแหน่ง from */
function docxLastOpen_(xml, tag, from) {
  var i = from;
  while (true) {
    i = xml.lastIndexOf('<' + tag, i);
    if (i < 0) return -1;
    var c = xml.charAt(i + tag.length + 1);
    if (c === '>' || c === ' ' || c === '/') return i;
    i--;
  }
}

/** ตำแหน่งท้ายของ element ที่เริ่มที่ start (นับซ้อน) */
function docxElementEnd_(xml, tag, start) {
  var depth = 0, i = start, open = '<' + tag, close = '</' + tag + '>';
  while (i < xml.length) {
    var o = xml.indexOf(open, i), c = xml.indexOf(close, i);
    if (c < 0) return -1;
    if (o >= 0 && o < c) {
      var ch = xml.charAt(o + open.length);
      if (ch === '>' || ch === ' ') {
        var selfClose = xml.charAt(xml.indexOf('>', o) - 1) === '/';
        if (!selfClose) depth++;
      }
      i = o + open.length;
    } else {
      depth--;
      i = c + close.length;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** element ชั้นในสุดชนิด tag ที่ครอบตำแหน่ง pos → {start, end} */
function docxEnclosing_(xml, tag, pos) {
  var from = pos;
  while (true) {
    var s = docxLastOpen_(xml, tag, from);
    if (s < 0) return null;
    var e = docxElementEnd_(xml, tag, s);
    if (e > pos) return { start: s, end: e };
    from = s - 1;
  }
}

/** ทำซ้ำแถว/ย่อหน้าที่มี {{name.xxx}} */
function docxExpandLoop_(xml, name, items) {
  var key = '{{' + name + '.';
  var guard = 0;
  while (xml.indexOf(key) >= 0 && guard++ < 20) {
    var pos = xml.indexOf(key);
    var block = docxEnclosing_(xml, 'w:tr', pos) || docxEnclosing_(xml, 'w:p', pos);
    var tpl = xml.substring(block.start, block.end);
    var out = (items || []).map(function (it) {
      return tpl.replace(new RegExp('\\{\\{' + name + '\\.([A-Za-z0-9_]+)\\}\\}', 'g'), function (m, f) {
        return docxValue_(it[f]);
      });
    }).join('');
    xml = xml.substring(0, block.start) + out + xml.substring(block.end);
  }
  return xml;
}

/** แถวเติมความสูงตาราง: ctx.key = จำนวนบรรทัดว่าง; 0 = ลบทั้งแถว (ตารางสูงพอดีรายการ) */
function docxExpandFillers_(xml, ctx) {
  var re = /\{\{#filler ([A-Za-z0-9_]+)\}\}/;
  var guard = 0, m;
  while ((m = re.exec(xml)) && guard++ < 20) {
    var n = Math.max(0, Math.round(Number(ctx[m[1]]) || 0));
    if (n === 0) {
      var row = docxEnclosing_(xml, 'w:tr', m.index);
      xml = xml.substring(0, row.start) + xml.substring(row.end);
      continue;
    }
    var p = docxEnclosing_(xml, 'w:p', m.index);
    var para = xml.substring(p.start, p.end).replace(m[0], '');
    xml = xml.substring(0, p.start) + new Array(n + 1).join(para) + xml.substring(p.end);
  }
  return xml;
}

/** แปลงตัวเลขในข้อความ (<w:t>) ทั้งเอกสารให้เป็นรูปแบบเดียว */
function docxApplyDigits_(xml, style) {
  return xml.replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, function (m, a, t, b) {
    return a + applyNumberStyle(t, style) + b;
  });
}

/**
 * เติมข้อมูลลง document.xml
 * @return {{xml: string, missing: string[]}} missing = ป้ายที่ไม่มีค่าและไม่มีข้อความเดิม
 */
function docxFillXml(xml, ctx, style) {
  var loops = ctx.loops || {};
  Object.keys(loops).forEach(function (name) { xml = docxExpandLoop_(xml, name, loops[name]); });
  xml = docxExpandFillers_(xml, ctx);
  var missing = {};
  xml = xml.replace(/\{\{([A-Za-z0-9_.]+)(?:\|([^}]*))?\}\}/g, function (m, name, def) {
    var v = ctx[name];
    var empty = v === null || v === undefined || v === '';
    if (empty && def !== undefined) return def;
    if (v === undefined) missing[name] = true;
    return docxValue_(empty ? '' : v);
  });
  xml = docxApplyDigits_(xml, style);
  if (style === 'arabic') xml = docxArabicFont_(xml);
  return { xml: xml, missing: Object.keys(missing) };
}

/**
 * เลขอารบิก: ฟอนต์ TH SarabunIT๙ แสดงเลขอารบิกเป็นรูปเลขไทยเสมอ
 * จึงต้องเปลี่ยนเป็น TH SarabunPSK (ขนาด/ระยะเท่ากัน) — ใช้กับ document.xml, styles.xml, numbering.xml
 */
function docxArabicFont_(xml) {
  return xml.split(DOCX_THAI_FONT).join(DOCX_ARABIC_FONT);
}

/**
 * เติมข้อมูลทั้งไฟล์ (parts = {path: string})
 * ส่งคืน parts ใหม่เฉพาะไฟล์ที่เปลี่ยน + missing
 */
function docxFillParts(parts, ctx, style) {
  var res = docxFillXml(parts['word/document.xml'], ctx, style);
  var out = { 'word/document.xml': res.xml };
  if (style === 'arabic') {
    ['word/styles.xml', 'word/numbering.xml'].forEach(function (p) {
      if (parts[p]) out[p] = docxArabicFont_(parts[p]);
    });
  }
  return { parts: out, missing: res.missing };
}

/**
 * รวมหลายเอกสาร (document.xml ที่เติมแล้ว) เป็นเล่มเดียว — ขึ้นหน้าใหม่ระหว่างแบบฟอร์ม
 * ใช้ส่วนหัว (namespace) และ sectPr ของเอกสารแรก
 * - ตัดย่อหน้าว่างท้ายเอกสาร (กันย่อหน้าว่างล้นไปเป็นหน้าเปล่า เช่น ใบตรวจรับที่ตารางเต็มหน้า)
 * - ขึ้นหน้าใหม่ด้วย "ขึ้นหน้าใหม่ก่อนย่อหน้า" ที่ย่อหน้าแรกของเอกสารถัดไป (ไม่เกิดบรรทัดว่างหัวหน้า)
 *   ถ้าเอกสารถัดไปขึ้นต้นด้วยตาราง ใช้ย่อหน้าสูง 1 พอยต์คั่นแทน
 */
function docxMergeBodies(xmls) {
  var head = null, sect = null, bodies = [];
  xmls.forEach(function (x, i) {
    var bs = x.indexOf('<w:body>') + '<w:body>'.length;
    var be = x.lastIndexOf('</w:body>');
    var inner = x.substring(bs, be);
    var ss = inner.lastIndexOf('<w:sectPr');
    var body = inner.substring(0, ss);
    if (i === 0) { head = x.substring(0, bs); sect = inner.substring(ss); }
    if (i < xmls.length - 1) body = docxTrimTrailingBlank_(body);
    if (i > 0) body = docxStartNewPage_(body);
    bodies.push(body);
  });
  return head + bodies.join('') + sect + '</w:body></w:document>';
}

/** ย่อหน้าว่าง = ไม่มีข้อความ (หรือมีแต่ช่องว่าง) รูป ตัวแบ่ง หรือ section */
function docxIsBlankPara_(p) {
  if (/<w:(drawing|pict|object|br|sectPr|fldChar|instrText|fldSimple)\b/.test(p)) return false;
  var t = '', re = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g, m;
  while ((m = re.exec(p))) t += m[1];
  return !t.replace(/[\s ]|&#160;|&nbsp;/g, '');
}

/** ตัดย่อหน้าว่างระดับบนสุดที่ท้ายเนื้อเอกสาร (เหลือไว้อย่างน้อย 1 element) */
function docxTrimTrailingBlank_(body) {
  var b = body.replace(/\s+$/, '');
  while (true) {
    var start = -1;
    var sc = b.match(/<w:p(?: [^>]*)?\/>$/);
    if (sc) start = b.length - sc[0].length;
    else if (/<\/w:p>$/.test(b)) {
      var i = b.length;
      while (true) {
        i = docxLastOpen_(b, 'w:p', i - 1);
        if (i < 0) break;
        if (docxElementEnd_(b, 'w:p', i) === b.length) { start = i; break; }
      }
    }
    if (start <= 0 || !docxIsBlankPara_(b.substring(start))) return b;
    b = b.substring(0, start).replace(/\s+$/, '');
  }
}

/** ให้เนื้อเอกสารเริ่มหน้าใหม่ */
function docxStartNewPage_(body) {
  var b = body.replace(/^\s+/, '');
  var m = b.match(/^<w:p(?: [^>]*)?(\/?)>/);
  if (!m) {
    return '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>' +
      '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>' + b;
  }
  var open = m[0];
  if (m[1]) return open.replace(/\/>$/, '>') + '<w:pPr><w:pageBreakBefore/></w:pPr></w:p>' + b.substring(open.length);
  var rest = b.substring(open.length);
  if (/^<w:pPr\/>/.test(rest)) return open + '<w:pPr><w:pageBreakBefore/></w:pPr>' + rest.substring(8);
  var pm = rest.match(/^<w:pPr(?: [^>]*)?>/);
  if (!pm) return open + '<w:pPr><w:pageBreakBefore/></w:pPr>' + rest;
  var pEnd = rest.indexOf('</w:pPr>');
  if (rest.substring(0, pEnd).indexOf('<w:pageBreakBefore') >= 0) return b;
  // ลำดับใน pPr: pStyle, keepNext, keepLines, pageBreakBefore, ...
  var lead = rest.substring(pm[0].length).match(/^(?:<w:pStyle\b[^>]*\/>)?(?:<w:keepNext\b[^>]*\/>)?(?:<w:keepLines\b[^>]*\/>)?/)[0];
  var at = pm[0].length + lead.length;
  return open + rest.substring(0, at) + '<w:pageBreakBefore/>' + rest.substring(at);
}

;
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

;
/**
 * Repo.gs — ชั้นอ่าน/เขียน Google Sheets
 * กติกา: อ่าน/เขียนทั้งช่วงครั้งเดียว (getValues/setValues) อ้างคอลัมน์ด้วยชื่อหัวตาราง ไม่ hardcode ตำแหน่ง
 */
var __db = null;
var __tableCache = {};

function db_() {
  if (!__db) { var t0 = Date.now(); __db = SpreadsheetApp.openById(APP.DB_ID); __perf.openMs = Date.now() - t0; }
  return __db;
}

function sheet_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต "' + name + '" ในฐานข้อมูล — ให้รัน setupPhase0() ก่อน');
  return sh;
}

/** เขตเวลาของไฟล์ฐานข้อมูล (ใช้อ่านค่าวันที่ที่ยังค้างเป็นชนิดวันที่ในชีต) */
var __dbTz = null;
function dbTz_() {
  if (!__dbTz) {
    var ss = db_();
    __dbTz = (ss.getSpreadsheetTimeZone && ss.getSpreadsheetTimeZone()) || APP.TZ;
  }
  return __dbTz;
}

/**
 * แปลงค่าจากเซลล์ให้ปลอดภัยกับ JSON
 * ค่าชนิดวันที่ (ถ้ามีคนพิมพ์ลงชีตเอง) อ่านตามเขตเวลาของชีต จึงได้วันที่ตามที่เห็นในชีต; คอลัมน์วันที่ตัดเวลาออก
 */
function cellOut_(v, header) {
  if (v instanceof Date) {
    var tz = dbTz_();
    var full = Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss');
    if (DATE_COLUMNS.indexOf(header) >= 0 || /00:00:00$/.test(full)) return full.substring(0, 10);
    return full;
  }
  if (DATE_COLUMNS.indexOf(header) >= 0 && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.substring(0, 10);
  return v;
}

/** แปลงค่าก่อนเขียนลงเซลล์: วันที่เป็นข้อความ yyyy-MM-dd เสมอ */
function cellIn_(v, header) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) v = Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd HH:mm:ss');
  if (DATE_COLUMNS.indexOf(header) >= 0) {
    var s = String(v).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  }
  return v;
}

/**
 * ตัวนับเวลาในการเรียก 1 ครั้ง (api_ รีเซ็ตทุกครั้ง แล้วส่งกลับให้หน้าเว็บแสดงในแผง "ความเร็วของระบบ")
 * reads = จำนวนครั้งที่อ่านชีต, readMs = เวลาอ่านรวม, writes = จำนวนครั้งที่เขียน
 */
var __perf = { reads: 0, readMs: 0, writes: 0 };

/** อ่านทั้งตาราง → { headers, rows:[{...,_row}] } (แคชภายในการเรียกครั้งเดียว และอัปเดตตามที่เขียน) */
function readTable_(name) {
  if (__tableCache[name]) return __tableCache[name];
  if (sheetsApi_()) { prefetch_([name]); if (__tableCache[name]) return __tableCache[name]; }
  var t0 = Date.now();
  var values = sheet_(name).getDataRange().getValues();
  buildTable_(name, values, false);
  __perf.reads++; __perf.readMs += Date.now() - t0;
  return __tableCache[name];
}

function buildTable_(name, values, fromApi) {
  var headers = values.length ? values[0].map(String) : [];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i] || [];
    var empty = true;
    var o = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      var raw = r[c] === undefined || r[c] === null ? '' : r[c];
      var v = fromApi ? cellApi_(raw, headers[c]) : cellOut_(raw, headers[c]);
      if (v !== '' && v !== null) empty = false;
      o[headers[c]] = v;
    }
    if (!empty) rows.push(o);
  }
  __tableCache[name] = { headers: headers, rows: rows };
  __tableCache['#h:' + name] = headers;
}

/**
 * อ่านหลายตารางพร้อมกันในคำขอเดียวผ่าน Google Sheets API (บริการขั้นสูง "Sheets")
 * เร็วกว่าอ่านทีละชีตมาก และไม่ต้องเปิดไฟล์ฐานข้อมูล — ถ้าใช้ API ไม่ได้ ระบบอ่านทีละชีตแบบเดิมเอง
 */
var __apiOff = false;
function sheetsApi_() {
  if (__apiOff) return null;
  try { return typeof Sheets !== 'undefined' && Sheets.Spreadsheets && Sheets.Spreadsheets.Values ? Sheets : null; } catch (e) { return null; }
}
function prefetch_(names) {
  var need = names.filter(function (n, i) { return !__tableCache[n] && names.indexOf(n) === i; });
  if (!need.length) return;
  var api = sheetsApi_();
  if (api) {
    // เปิดไฟล์ผ่าน SpreadsheetApp ไปแล้ว (อาจมีค่าที่เขียนค้าง) → บันทึกให้เสร็จก่อนอ่านผ่าน API
    if (__db) { try { SpreadsheetApp.flush(); } catch (e) { /* ไม่เป็นไร */ } }
    var t0 = Date.now();
    try {
      var res = api.Spreadsheets.Values.batchGet(APP.DB_ID, {
        ranges: need.map(function (n) { return "'" + n + "'"; }), valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER'
      });
      var vrs = res.valueRanges || [];
      if (vrs.length !== need.length) throw new Error('จำนวนตารางที่ได้ไม่ครบ');
      vrs.forEach(function (vr, i) { buildTable_(need[i], vr.values || [], true); });
      __perf.reads++; __perf.readMs += Date.now() - t0; __perf.api = (__perf.api || 0) + 1;
      return;
    } catch (e) {
      __apiOff = true; // ใช้ API ไม่ได้ในการเรียกนี้ → อ่านทีละชีตแบบเดิม
      __perf.apiErr = String(e && e.message ? e.message : e).slice(0, 160);
    }
  }
  need.forEach(function (n) { readTable_(n); });
}

/** ค่าจาก Sheets API: ค่าชนิดวันที่มาเป็นเลขลำดับวัน → แปลงเป็นข้อความตามที่เห็นในชีต */
function cellApi_(v, header) {
  if (typeof v === 'number' && (DATE_COLUMNS.indexOf(header) >= 0 || DATETIME_COLUMNS.indexOf(header) >= 0)) {
    var full = Utilities.formatDate(new Date(Math.round((v - 25569) * 86400000)), 'UTC', 'yyyy-MM-dd HH:mm:ss');
    return DATE_COLUMNS.indexOf(header) >= 0 || /00:00:00$/.test(full) ? full.substring(0, 10) : full;
  }
  return cellOut_(v, header);
}

function readAll_(name) { return readTable_(name).rows; }

function invalidateTable_(name) { delete __tableCache[name]; }

/** หัวตาราง (จำไว้ในการเรียกครั้งเดียว ไม่ต้องอ่านแถวหัวซ้ำทุกครั้งที่เขียน) */
function headers_(name, sh) {
  var k = '#h:' + name;
  if (!__tableCache[k]) {
    var n = sh.getLastColumn();
    __tableCache[k] = n ? sh.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
  }
  return __tableCache[k];
}

/**
 * ค่าที่ชีตจะคืนมาเมื่ออ่านค่าที่เพิ่งเขียน (ใช้อัปเดตแคชแทนการอ่านชีตซ้ำ)
 * คอลัมน์ข้อความ = ข้อความตามเดิม; คอลัมน์อื่น ชีตแปลงตัวเลขและ TRUE/FALSE ให้เอง
 */
function cellEcho_(v, header) {
  if (v === '' || v === null || v === undefined) return '';
  if (TEXT_COLUMNS.indexOf(header) >= 0) return cellOut_(String(v), header);
  if (typeof v === 'string') {
    var s = v.trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (/^(true|false)$/i.test(s)) return s.toUpperCase() === 'TRUE';
  }
  return v;
}

/** ชีตมีแถวไม่พอ → เพิ่มแถว (ไม่งั้นเขียนเกินขอบชีตไม่ได้) และตั้งคอลัมน์ข้อความของแถวใหม่ */
function ensureRows_(sh, headers, lastNeeded) {
  var max = sh.getMaxRows();
  if (lastNeeded <= max) return;
  var add = lastNeeded - max + 200;
  sh.insertRowsAfter(max, add);
  headers.forEach(function (h, i) {
    if (TEXT_COLUMNS.indexOf(h) >= 0) sh.getRange(max + 1, i + 1, add, 1).setNumberFormat('@');
  });
}

/** เพิ่มหลายแถวในครั้งเดียว */
function appendRows_(name, objs) {
  if (!objs || !objs.length) return;
  var sh = sheet_(name);
  var headers = headers_(name, sh);
  var data = objs.map(function (o) {
    return headers.map(function (h) { return cellIn_(o[h], h); });
  });
  var start = sh.getLastRow() + 1;
  ensureRows_(sh, headers, start + data.length - 1);
  // คอลัมน์ข้อความ: ตั้งรูปแบบก่อนเขียน (แถวใหม่ที่เกินช่วงเดิมอาจไม่มีรูปแบบข้อความ)
  headers.forEach(function (h, i) {
    if (TEXT_COLUMNS.indexOf(h) >= 0) sh.getRange(start, i + 1, data.length, 1).setNumberFormat('@');
  });
  sh.getRange(start, 1, data.length, headers.length).setValues(data);
  __perf.writes++;
  // แคช: ต่อแถวใหม่ท้ายตาราง (ถ้าแคชครบถึงแถวสุดท้ายจริง) ไม่งั้นทิ้งแคชแล้วอ่านใหม่เมื่อจำเป็น
  var t = __tableCache[name];
  if (t && t.headers.join('\t') === headers.join('\t') && tableLastRow_(t) === start - 1) {
    data.forEach(function (r, i) {
      var o = { _row: start + i };
      headers.forEach(function (h, c) { o[h] = cellEcho_(r[c], h); });
      t.rows.push(o);
    });
  } else invalidateTable_(name);
}

/** เลขแถวสุดท้ายที่มีข้อมูลตามแคช (1 = มีแต่หัวตาราง) */
function tableLastRow_(t) {
  var m = 1;
  t.rows.forEach(function (r) { if (r._row > m) m = r._row; });
  return m;
}

/** แก้แถวเดียวตามเลขแถว (patch เฉพาะคอลัมน์ที่ส่งมา) — ถ้าแถวอยู่ในแคช ไม่ต้องอ่านแถวจากชีตก่อน */
function updateRow_(name, rowNumber, patch) {
  var sh = sheet_(name);
  var headers = headers_(name, sh);
  var t = __tableCache[name];
  var cached = t && t.headers.join('\t') === headers.join('\t') ? t.rows.filter(function (r) { return r._row === rowNumber; })[0] : null;
  var cur = cached ? headers.map(function (h) { return cellIn_(cached[h], h); }) : sh.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  headers.forEach(function (h, i) { if (patch.hasOwnProperty(h)) cur[i] = cellIn_(patch[h], h); });
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([cur]);
  __perf.writes++;
  if (cached) headers.forEach(function (h, i) { if (patch.hasOwnProperty(h)) cached[h] = cellEcho_(cur[i], h); });
  else invalidateTable_(name);
}

/**
 * เขียนชุดแถวลูกของเจ้าของ 1 ราย (เช่น รายการพัสดุของงาน 1 งาน) แทนชุดเดิม
 * - เหมือนเดิมทุกช่อง → ไม่เขียนเลย
 * - เขียนทับแถวเดิมตามลำดับ (ไม่ลบแล้วเพิ่มใหม่) แถวเกินค่อยต่อท้าย แถวเหลือค่อยลบ
 * คืน true ถ้ามีการเขียน
 */
function replaceChildRows_(name, keyField, keyValue, objs) {
  var t = readTable_(name), headers = t.headers;
  var cur = t.rows.filter(function (r) { return String(r[keyField]) === String(keyValue); })
    .sort(function (a, b) { return a._row - b._row; });
  var want = objs.map(function (o) { var x = {}; Object.keys(o).forEach(function (k) { x[k] = o[k]; }); x[keyField] = keyValue; return x; });
  var norm = function (v) { return v === null || v === undefined ? '' : String(v); };
  var same = cur.length === want.length && cur.every(function (c, i) {
    return headers.every(function (h) { return norm(c[h]) === norm(cellEcho_(cellIn_(want[i][h], h), h)); });
  });
  if (same) return false;
  var sh = sheet_(name);
  var n = Math.min(cur.length, want.length);
  for (var i = 0; i < n;) {
    var j = i;
    while (j + 1 < n && cur[j + 1]._row === cur[j]._row + 1) j++;
    var block = want.slice(i, j + 1).map(function (o) { return headers.map(function (h) { return cellIn_(o[h], h); }); });
    sh.getRange(cur[i]._row, 1, block.length, headers.length).setValues(block);
    __perf.writes++;
    for (var k = i; k <= j; k++) headers.forEach(function (h, c) { cur[k][h] = cellEcho_(block[k - i][c], h); });
    i = j + 1;
  }
  if (cur.length > n) {
    // ลบแถวที่เหลือ จากล่างขึ้นบน (เลขแถวอื่นจะเลื่อน → ทิ้งแคชตารางนี้)
    var rows = cur.slice(n).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
    for (var p = 0; p < rows.length;) {
      var end = rows[p], start = end;
      while (p + 1 < rows.length && rows[p + 1] === start - 1) { start--; p++; }
      sh.deleteRows(start, end - start + 1);
      __perf.writes++;
      p++;
    }
    invalidateTable_(name);
  }
  if (want.length > n) appendRows_(name, want.slice(n));
  return true;
}

/** เพิ่มหรือแก้ตามคีย์ (คืน 'insert' | 'update') */
function upsert_(name, keyField, obj) {
  var found = readAll_(name).filter(function (r) { return String(r[keyField]) === String(obj[keyField]); })[0];
  if (found) { updateRow_(name, found._row, obj); return 'update'; }
  appendRows_(name, [obj]);
  return 'insert';
}

/** เขียนทับทั้งตาราง (ใช้กับชีตมุมมอง/สำเนาเท่านั้น) */
function replaceSheetBody_(sh, headers, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), headers.length)).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

/** ตรวจ/สร้างชีตและหัวตารางตาม SCHEMA (ไม่ลบ ไม่สลับคอลัมน์เดิม) */
function ensureSchema_() {
  var ss = db_();
  var report = [];
  Object.keys(SCHEMA).forEach(function (name) {
    var want = SCHEMA[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold').setBackground('#E8EEF7');
      sh.setFrozenRows(1);
      report.push('สร้างชีต ' + name);
    } else {
      var have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
      var missing = want.filter(function (h) { return have.indexOf(h) < 0; });
      if (missing.length) {
        sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#E8EEF7');
        report.push(name + ': เพิ่มคอลัมน์ ' + missing.join(', '));
      }
    }
    // คอลัมน์ข้อความ
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    headers.forEach(function (h, i) {
      if (TEXT_COLUMNS.indexOf(h) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  __tableCache = {};
  return report;
}

/** อ่าน Config เป็น object (จำไว้ในการเรียกครั้งเดียว + แคชเซิร์ฟเวอร์ 10 นาทีตามเลขเวอร์ชันข้อมูล) */
function readConfig_() {
  if (__tableCache['#cfg']) return __tableCache['#cfg'];
  var ck = 'cfg1:' + getDataVersion_(), o = null;
  try { var s = CacheService.getScriptCache().get(ck); if (s) o = JSON.parse(s); } catch (e) { o = null; }
  if (!o) {
    o = {};
    readAll_('Config').forEach(function (r) { o[String(r.key)] = r.value === null ? '' : String(r.value); });
    try { CacheService.getScriptCache().put(ck, JSON.stringify(o), 600); } catch (e) { /* แคชไม่ได้ ไม่เป็นไร */ }
  }
  __tableCache['#cfg'] = o;
  return o;
}

function writeConfig_(key, value, note) {
  var rows = readAll_('Config').filter(function (r) { return r.key === key; });
  if (rows.length) updateRow_('Config', rows[0]._row, { value: String(value) });
  else appendRows_('Config', [{ key: key, value: String(value), note: note || '' }]);
  delete __tableCache['#cfg'];
  bumpDataVersion_(); // ค่าระบบเปลี่ยน → แคชผู้ใช้/ค่าระบบ/ข้อมูลอ้างอิงเดิมใช้ไม่ได้
}

/** ครอบการเขียนด้วย LockService กันข้อมูลชนกัน */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function nowStamp_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm:ss'); }

function todayIso_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }

/** รหัสรันถัดไป เช่น nextCode_('Vendor','vendor_id','V',4) → V0047 */
function nextCode_(rows, field, prefix, digits) {
  var max = 0;
  rows.forEach(function (r) {
    var v = String(r[field] || '');
    if (v.indexOf(prefix) === 0) {
      var n = Number(v.substring(prefix.length));
      if (!isNaN(n) && n > max) max = n;
    }
  });
  var s = String(max + 1);
  while (s.length < digits) s = '0' + s;
  return prefix + s;
}

;
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

;
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

;
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

;
/**
 * TestData.gs — ข้อมูลทดสอบ: งานซื้อโดรน เลขที่ 13/2570 (ตามชุดเอกสารต้นฉบับ)
 * ใช้ในหน่วยความจำเท่านั้น — ไม่บันทึกลงชีตงานจัดซื้อ และไม่ใช้เลขจาก Counter
 * วันที่ใบสั่งซื้อใช้ 5 พ.ย. 2569 ค่าเดียวทุกจุด (ต้นฉบับมีทั้ง 4 และ 5 พ.ย.) และส่งมอบ 15 วันทุกจุด
 */
function droneTestData_() {
  return {
    "proc": {"proc_id": "TEST-013-2570", "fiscal_year": "2570", "proc_no": "13", "status": "test", "method": "เฉพาะเจาะจง", "subject": "อากาศยานซึ่งไม่มีนักบิน (โดรน)", "subject_short": "อากาศยานซึ่งไม่มีนักบิน", "reason": "ใช้ในการจัดการเรียนการสอนสำหรับห้องเรียนเตรียมวิศวะ", "project_name": "พัฒนาสื่อการเรียนการสอนสำหรับห้องเรียนเตรียมวิศวะ", "admin_group": "กลุ่มบริหารงานวิชาการ", "responsible_unit": "งานห้องเรียนพิเศษวิทย์ศาสตร์ คอมพิวเตอร์ (เตรียมวิศวะ)", "dept": "วิชาการ", "requester_id": "P041", "budget_type": "เงินนอกงบประมาณ", "budget_source": "เงินบำรุงการศึกษา (ห้องเรียนวิทย์คอม)", "budget_year": "2569", "budget_amount": 19650, "ref_price": 19650, "price_source": "การสืบราคาจากท้องตลาด /จากเว็บไซต์", "vat_mode": "include", "vendor_id": "TEST-V1", "delivery_days": 15, "price_validity_days": 15, "contract_sign_days": 7, "warranty_years": 2, "repair_days": 7, "egp_project_no": "69119095227", "egp_project_name": "ซื้อชุดโดรน จำนวน 1 รายการ", "egp_contract_no": "691114080067", "egp_inspect_no": "", "tor_memo_date": "2026-11-02", "tor_order_no": "486", "tor_order_date": "2026-11-02", "request_date": "2026-11-03", "result_date": "2026-11-04", "inspect_order_no": "14/2570", "inspect_order_date": "2026-11-04", "announce_date": "2026-11-04", "contract_notice_date": "2026-11-04", "po_date": "2026-11-05", "inspection_date": "2026-11-12", "issue_date": "2026-11-12", "item_mode": "set", "po_line_desc": "อากาศยานซึ่งไม่มีนักบิน (โดรน)", "po_line_qty": "1", "po_line_unit": "ชุด"},
    "items": [{"line_no": 1, "description": "DJI Neo2-Motion Fly More Combo", "qty": 1, "unit": "ชุด", "unit_price": 18300, "std_price": 18300, "amount": 18300}, {"line_no": 2, "description": "DJI Care Refresh 2-Year Plan (DJI Neo2) TH Remark", "qty": 1, "unit": "ชุด", "unit_price": 1350, "std_price": 1350, "amount": 1350}],
    "specs": [{"section": "background", "line_no": 1, "text": "ปัจจุบันโลกของเรามีการพัฒนาอย่างก้าวกระโดด โดยเฉพาะอย่างยิ่งในด้านเทคโนโลยีและนวัตกรรมใหม่ๆ ส่งผลให้การเรียนรู้ต้องปรับตัวให้ทันสมัยและก้าวทันตามไปด้วย เพื่อยกระดับและเพิ่มขีดความสามารถในการแข่งขันในระดับสากล การศึกษาจึงจำเป็นต้องให้ความสำคัญกับการบูรณาการความรู้ทางด้านวิทยาศาสตร์และเทคโนโลยีเข้ามาในหลักสูตร โดยเฉพาะอย่างยิ่งในกลุ่มนักเรียนห้องเรียนเตรียมวิศวะ ซึ่งจำเป็นต้องมีทักษะความรู้ที่เข้มข้นทางด้านวิศวกรรมศาสตร์ในแขนงต่างๆ การพัฒนาสื่อการเรียนการสอนและอุปกรณ์ที่เกี่ยวข้องจึงมีความสำคัญอย่างยิ่งต่อการพัฒนาศักยภาพของนักเรียนให้มีคุณภาพมากยิ่งขึ้น"}, {"section": "background", "line_no": 2, "text": "การปรับปรุงและพัฒนาสื่อการเรียนการสอนสำหรับห้องเรียนเตรียมวิศวะให้มีความทันสมัย สอดคล้องกับวัตถุประสงค์ของโครงการที่ต้องการจะสนับสนุนการเรียนรู้ทางด้านเทคโนโลยี สื่อ และโสตทัศนศึกษา เพื่อส่งเสริมให้นักเรียนสามารถเข้าถึงแหล่งข้อมูลได้อย่างหลากหลายและทันต่อยุคสมัย อีกทั้งยังช่วยปรับปรุงและพัฒนาอุปกรณ์โสตทัศนูปกรณ์ให้มีประสิทธิภาพสูงสุด เพื่อเป็นเครื่องมือสำคัญในการส่งเสริมการจัดการเรียนรู้ของครูผู้สอนให้มีความน่าสนใจและเป็นรูปธรรมมากขึ้น ทั้งยังช่วยให้ผู้เรียนเกิดความเข้าใจในเนื้อหาที่ซับซ้อนได้อย่างรวดเร็วและมีประสิทธิภาพ"}, {"section": "background", "line_no": 3, "text": "การดำเนินโครงการพัฒนาสื่อการเรียนการสอนสำหรับห้องเรียนเตรียมวิศวะนี้ คาดว่าจะส่งผลให้นักเรียนห้องเรียนเตรียมวิศวะได้รับการพัฒนาทักษะและความสามารถทางด้านวิชาการและวิศวกรรมศาสตร์ได้อย่างเต็มศักยภาพ จากอากาศยานซึ่งไม่มีนักบิน (Drone) ส่งผลให้ผู้สอนมีสื่อและเครื่องมือที่ทันสมัยและมีประสิทธิภาพในการจัดการเรียนรู้ อีกทั้งยังเป็นการยกระดับมาตรฐานการเรียนการสอนของโรงเรียนให้ทัดเทียมกับสถาบันการศึกษา ชั้นนำอื่นๆ นอกจากนี้ ยังจะช่วยเสริมสร้างบรรยากาศการเรียนรู้ให้มีความสนุกสนาน น่าสนใจ และกระตุ้นให้นักเรียนเกิดแรงบันดาลใจในการศึกษาต่อในสาขาวิศวกรรมศาสตร์ในอนาคต"}, {"section": "objective", "line_no": 1, "text": "เพื่อจัดหาอากาศยานซึ่งไม่มีนักบิน ที่มีคุณภาพและเหมาะสมสำหรับการผลิตสื่อภาพเคลื่อนไหวมุมสูงของโรงเรียน"}, {"section": "objective", "line_no": 2, "text": "เพื่อสนับสนุนการดำเนินงานโครงการพัฒนาสื่อการเรียนการสอนสำหรับห้องเรียนเตรียมวิศวะและส่งเสริมการผลิตสื่อที่มีความน่าสนใจ ทันสมัย และมีคุณภาพ"}, {"section": "objective", "line_no": 3, "text": "เพื่อส่งเสริมและพัฒนาศักยภาพในการผลิตสื่อสร้างสรรค์ของบุคลากรและนักเรียน ตลอดจนสนับสนุนการประชาสัมพันธ์ภาพลักษณ์และผลงานของโรงเรียนให้เป็นที่รู้จักอย่างกว้างขวาง"}, {"section": "spec_title", "line_no": 1, "text": "อากาศยานซึ่งไม่มีนักบิน (Drone) DJI Neo 2 Motion Fly More Combo"}, {"section": "spec", "line_no": 1, "text": "ความละเอียดวิดีโอ 4K 60 Fps"}, {"section": "spec", "line_no": 2, "text": "ความละเอียดภาพนิ่ง 48 ล้านพิกเซล ใช้เซนเซอร์ CMOS ขนาด 1/2 นิ้ว ความละเอียด 12 ล้านพิกเซล รองรับการถ่ายวิดีโอระดับ 4K/60fps, 4K/100fps Slow Motion และการถ่ายแนวตั้ง 2.7K สำหรับสายโซเชียล พร้อมระบบกันสั่นแบบ 2-Axis Mechanical Gimbal ร่วมกับระบบกันสั่นอิเล็กทรอนิกส์ RockSteady"}, {"section": "spec", "line_no": 3, "text": "บินได้นานถึง 19 นาที / แบตเตอรี่ 1 ก้อน"}, {"section": "spec", "line_no": 4, "text": "มีระบบหลบหลีกสิ่งกีดขวางรอบทิศทาง (Omnidirectional Obstacle Sensing)"}, {"section": "spec", "line_no": 5, "text": "มีมาพร้อมฟังก์ชัน ActiveTrack, SelfieShot และ QuickShots ที่รองรับการเคลื่อนไหวความเร็วสูง (เช่น วิ่งหรือปั่นจักรยาน) โดยจับโฟกัสได้แม่นยำถึง 8 ทิศทาง"}, {"section": "spec", "line_no": 6, "text": "มีการรับประกัน 2 ปี"}],
    "committees": [{"kind": "TOR", "seq": 1, "person_id": "P041"}, {"kind": "TOR", "seq": 2, "person_id": "P046"}, {"kind": "TOR", "seq": 3, "person_id": "P047"}, {"kind": "INSPECT", "seq": 1, "person_id": "P041"}, {"kind": "INSPECT", "seq": 2, "person_id": "P046"}, {"kind": "INSPECT", "seq": 3, "person_id": "P047"}],
    "quotes": [{"seq": 1, "vendor_id": "TEST-V1", "offered_price": 19650, "agreed_price": 19650}],
    "vendor": {"vendor_id": "TEST-V1", "vendor_name": "บริษัท สกาย อินโน เวชั่น เทคโนโลยี จำกัด", "branch": "00006", "tax_id": "0105565019434", "address": "ห้องที่ 99,99/1,99/2 ชั้นที่ 3 หมู่ 4 ถนนซุปเปอร์ไฮเวย์", "subdistrict": "ฟ้าฮ่าม", "district": "เมืองเชียงใหม่", "province": "เชียงใหม่", "postcode": "50000", "phone": "08280262888"}
  };
}

;
/**
 * Thai.gs — ฟังก์ชันภาษาไทยสำหรับเอกสารราชการ (ฟังก์ชันบริสุทธิ์ ไม่แตะ Google API ทดสอบได้)
 */
var THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
var THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function toThaiDigits(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[0-9]/g, function (d) { return THAI_DIGITS[Number(d)]; });
}

function toArabicDigits(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[๐-๙]/g, function (d) { return String(THAI_DIGITS.indexOf(d)); });
}

/** ใช้รูปแบบตัวเลขเดียวทั้งเอกสาร: 'thai' หรือ 'arabic' */
function applyNumberStyle(s, style) {
  return style === 'thai' ? toThaiDigits(s) : toArabicDigits(s);
}

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

/** 19650 → "19,650.00" */
function formatMoney(n) {
  var x = round2(n).toFixed(2).split('.');
  return x[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + x[1];
}

function formatInt(n) { return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

var _TH_NUM = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
var _TH_POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** อ่านจำนวนเต็ม 0..999,999 */
function _readGroup(n, hasHigher) {
  var s = String(n), out = '', len = s.length;
  for (var i = 0; i < len; i++) {
    var d = Number(s.charAt(i)), pos = len - i - 1;
    if (d === 0) continue;
    if (pos === 1 && d === 1) out += 'สิบ';
    else if (pos === 1 && d === 2) out += 'ยี่สิบ';
    else if (pos === 0 && d === 1 && (len > 1 || hasHigher)) out += 'เอ็ด';
    else out += _TH_NUM[d] + _TH_POS[pos];
  }
  return out;
}

/** อ่านจำนวนเต็มใด ๆ (รองรับหลักล้าน) */
function readThaiNumber(n) {
  n = Math.floor(Math.abs(Number(n)));
  if (n === 0) return 'ศูนย์';
  var out = '';
  var millions = Math.floor(n / 1000000), rest = n % 1000000;
  if (millions > 0) out += readThaiNumber(millions) + 'ล้าน';
  if (rest > 0) out += _readGroup(rest, millions > 0);
  return out;
}

/** 19650 → "หนึ่งหมื่นเก้าพันหกร้อยห้าสิบบาทถ้วน", 18364.49 → "...บาทสี่สิบเก้าสตางค์" */
function bahtText(amount) {
  var v = round2(amount);
  if (v < 0) return 'ลบ' + bahtText(-v);
  var baht = Math.floor(v);
  var satang = Math.round((v - baht) * 100);
  var s = '';
  if (baht > 0) s += readThaiNumber(baht) + 'บาท';
  if (satang > 0) s += readThaiNumber(satang) + 'สตางค์';
  else s += (baht > 0 ? 'ถ้วน' : 'ศูนย์บาทถ้วน');
  return s;
}

/** แยกภาษีมูลค่าเพิ่มจากยอดรวม (ราคารวม VAT) ให้ผลบวกตรงกับยอดรวมเสมอ */
function splitVat(total, rate) {
  rate = rate === undefined ? 7 : Number(rate);
  var t = round2(total);
  var before = round2(t * 100 / (100 + rate));
  return { total: t, beforeVat: before, vat: round2(t - before) };
}

/** ISO (yyyy-MM-dd) → {y, m, d} โดยไม่พึ่ง timezone */
function _parseIso(iso) {
  var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error('รูปแบบวันที่ไม่ถูกต้อง: ' + iso);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/**
 * วันที่ไทยตามรูปแบบในเอกสาร
 * D1 "3 พฤศจิกายน 2569" | D2 "4 พฤศจิกายน พ.ศ. 2569" | D3 "2 เดือน พฤศจิกายน พ.ศ. 2569" | D4 "12/พฤศจิกายน/2569"
 */
function thaiDate(iso, fmt) {
  if (!iso) return '';
  var p = _parseIso(iso), be = p.y + 543, mon = THAI_MONTHS[p.m - 1];
  switch (fmt || 'D1') {
    case 'D2': return p.d + ' ' + mon + ' พ.ศ. ' + be;
    case 'D3': return p.d + ' เดือน ' + mon + ' พ.ศ. ' + be;
    case 'D4': return p.d + '/' + mon + '/' + be;
    default: return p.d + ' ' + mon + ' ' + be;
  }
}

/** ปีงบประมาณ พ.ศ. 4 หลัก (1 ต.ค. ขึ้นปีงบใหม่) */
function fiscalYearBE(iso) {
  var p = _parseIso(iso);
  return p.y + 543 + (p.m >= 10 ? 1 : 0);
}

/** ไตรมาสของปีงบประมาณ: ต.ค.–ธ.ค. = 1, ม.ค.–มี.ค. = 2, เม.ย.–มิ.ย. = 3, ก.ค.–ก.ย. = 4 */
function fiscalQuarter(iso) {
  var m = _parseIso(iso).m;
  return m >= 10 ? 1 : (m <= 3 ? 2 : (m <= 6 ? 3 : 4));
}

/** บวกวันแบบปฏิทิน (ไม่ข้ามวันหยุด) */
function addDaysIso(iso, days) {
  var p = _parseIso(iso);
  var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + Number(days)));
  return dt.getUTCFullYear() + '-' + ('0' + (dt.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + dt.getUTCDate()).slice(-2);
}

/** ตำแหน่งเต็มสำหรับเอกสารจากระดับ คศ. */
function positionTitleFromRank(rank) {
  var map = { 'ครู คศ.1': 'ครู', 'ครู คศ.2': 'ครูชำนาญการ', 'ครู คศ.3': 'ครูชำนาญการพิเศษ', 'ครู คศ.4': 'ครูเชี่ยวชาญ', 'ครู คศ.5': 'ครูเชี่ยวชาญพิเศษ', 'ครูผู้ช่วย': 'ครูผู้ช่วย' };
  return map[rank] || rank;
}
