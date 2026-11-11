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
