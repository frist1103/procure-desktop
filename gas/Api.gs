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
