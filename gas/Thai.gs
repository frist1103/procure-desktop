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
