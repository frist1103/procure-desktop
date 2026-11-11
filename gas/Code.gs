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
