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
