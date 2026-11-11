// ใช้ทดสอบบนเครื่อง: รับ {forms:[{key, parts}], style} ทาง stdin → เติมข้อมูลงานโดรน → ส่ง JSON กลับ
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = path.join(__dirname, '..', 'gas');
const ctxVm = {};
vm.createContext(ctxVm);
for (const f of ['Thai.gs', 'DocxCore.gs', 'DocContext.gs', 'TestData.gs']) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctxVm, { filename: f });
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8')).db;
const rows = (t) => { const [h, ...r] = seed[t]; return r.map(x => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const data = vm.runInContext('droneTestData_()', ctxVm);
if (input.patch) {
  const P = input.patch;
  if (P.items) data.items = P.items;
  if (P.specs) data.specs = data.specs.filter(s => !P.specs.some(x => x.section === s.section)).concat(P.specs);
  if (P.proc) Object.assign(data.proc, P.proc);
  if (P.committees) data.committees = P.committees;
}
data.people = Object.fromEntries(rows('Personnel').map(p => [p.person_id, p]));
data.signers = Object.fromEntries(rows('Signers').map(s => [s.sign_key, s]));
ctxVm.__data = data;
const ctx = vm.runInContext('buildDocContext(__data)', ctxVm);
const out = { forms: [], ctx };
for (const f of input.forms) {
  ctxVm.__parts = f.parts; ctxVm.__ctx = ctx; ctxVm.__style = input.style;
  const r = vm.runInContext('docxFillParts(__parts, __ctx, __style)', ctxVm);
  out.forms.push({ key: f.key, parts: r.parts, missing: r.missing });
}
ctxVm.__xmls = out.forms.map(f => f.parts['word/document.xml']);
out.merged = vm.runInContext('docxMergeBodies(__xmls)', ctxVm);
process.stdout.write(JSON.stringify(out));
