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
