// จำลอง Apps Script (DriveApp/Utilities/ชีต) เพื่อทดสอบ DocGen.gs ทั้งเส้นทาง: เปิดเทมเพลต → เติม → zip → บันทึก → ชุดรวม
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const SRC = path.join(__dirname, '..', 'gas');
const TPL = process.argv[2], OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8')).db;
const rows = (t) => { const [h, ...r] = seed[t]; return r.map((x, i) => Object.assign({ _row: i + 2 }, Object.fromEntries(h.map((k, j) => [k, x[j]])))); };
const tplFiles = fs.readdirSync(TPL).filter(f => f.endsWith('.docx'));
const formRows = rows('FormTemplate').map(t => Object.assign(t, { template_doc_id: 'TPL:' + tplFiles.find(f => f.startsWith(t.form_key + ' ')), step: { F01: 1, F02: 1, F03: 1, F04: 2, F05: 2, F06: 3, F07: 3, F08: 3, F09: 3, F10: 3, F11: 4, F12: 5 }[t.form_key] }));
function Blob(bytes, type, name) { this.bytes = Buffer.from(bytes); this.type = type; this.name = name; }
Blob.prototype = { getBytes() { return this.bytes; }, getName() { return this.name; }, setContentType(t) { this.type = t; return this; },
  getDataAsString() { return this.bytes.toString('utf8'); } };
const py = (code, input) => cp.execFileSync('python3', ['-c', code], { input, maxBuffer: 1 << 28 }).toString();
let saved = [];
function Folder(p) { this.p = p; fs.mkdirSync(p, { recursive: true }); }
Folder.prototype = {
  getFoldersByName(n) { const p = path.join(this.p, n), ok = fs.existsSync(p); let done = !ok; return { hasNext: () => !done, next: () => { done = true; return new Folder(p); } }; },
  createFolder(n) { return new Folder(path.join(this.p, n)); },
  getFilesByName(n) { const p = path.join(this.p, n), ok = fs.existsSync(p); let done = !ok; return { hasNext: () => !done, next: () => { done = true; return new File(p); } }; },
  createFile(b) { const p = path.join(this.p, b.getName()); fs.writeFileSync(p, b.bytes); saved.push(p); return new File(p); },
  getUrl() { return 'file://' + this.p; }, getId() { return 'F:' + this.p; }
};
function File(p) { this.p = p; }
File.prototype = { getId() { return this.p; }, getUrl() { return 'file://' + this.p; }, getLastUpdated() { return new Date(); },
  setName(n) { const np = path.join(path.dirname(this.p), n); fs.renameSync(this.p, np); this.p = np; },
  moveTo(f) { const np = path.join(f.p, path.basename(this.p)); fs.renameSync(this.p, np); this.p = np; },
  getBlob() { return new Blob(fs.readFileSync(path.join(TPL, this.p.slice(4))), 'x', this.p); } };
const g = {
  console, Logger: { log: (s) => console.log(s) },
  DriveApp: { getFileById: (id) => new File(id), getFolderById: () => new Folder(OUT) },
  Utilities: {
    newBlob: (d, t, n) => new Blob(typeof d === 'string' ? Buffer.from(d, 'utf8') : d, t, n),
    unzip: (b) => JSON.parse(py('import sys,zipfile,io,json,base64;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));print(json.dumps([[i.filename,base64.b64encode(z.read(i.filename)).decode()] for i in z.infolist()]))', b.bytes)).map(([n, d]) => new Blob(Buffer.from(d, 'base64'), 'x', n)),
    zip: (blobs, name) => new Blob(Buffer.from(py('import sys,zipfile,io,json,base64\nL=json.load(sys.stdin);o=io.BytesIO()\nwith zipfile.ZipFile(o,"w",zipfile.ZIP_DEFLATED) as z:\n  [z.writestr(n,base64.b64decode(d)) for n,d in L]\nprint(base64.b64encode(o.getvalue()).decode())', JSON.stringify(blobs.map(b => [b.getName(), b.bytes.toString('base64')]))).trim(), 'base64'), 'application/zip', name),
    formatDate: () => '2026-11-10 1200'
  }
};
vm.createContext(g);
for (const f of ['00_App.gs', 'Thai.gs', 'DocxCore.gs', 'DocContext.gs', 'TestData.gs', 'DocGen.gs']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), g, { filename: f });
const cfg = Object.fromEntries(rows('Config').map(r => [r.key, r.value]));
g.readAll_ = (t) => t === 'FormTemplate' ? formRows : rows(t);
g.readConfig_ = () => cfg;
g.currentEmail_ = () => 'test@hongson.ac.th'; g.nowStamp_ = () => '2026-11-10 12:00:00'; g.appendRows_ = () => {};
vm.runInContext('var R1 = testPhase1Docs(); var R2 = testPhase1Docs(); var R3 = testPhase1DocsArabic();', g);
const R1 = g.R1;
if (R1.files.length !== 12) throw new Error('ต้องได้ 12 ไฟล์');
R1.files.forEach(f => { if (f.missing.length) throw new Error(f.form_key + ' missing ' + f.missing); });
console.log('saved', saved.length, 'files'); console.log(R1.files.map(f => f.name).join('\n')); console.log(R1.combined.name);
