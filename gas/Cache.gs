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
