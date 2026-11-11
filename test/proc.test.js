// ทดสอบเฟส 2 (Procure.gs) แบบจำลอง Apps Script: ชีตในหน่วยความจำ + Drive/zip จำลอง
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process');
const SRC=path.join(__dirname,'..','gas'), TPL=process.argv[2], OUT=process.argv[3];
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const seed=JSON.parse(fs.readFileSync(__dirname+'/seed.json','utf8'));
function makeSheet(name,data){
  let d=data.map(r=>r.slice());
  const width=()=>Math.max(0,...d.map(r=>r.length));
  const pad=()=>{const w=width();d.forEach(r=>{while(r.length<w)r.push('')});};
  const sh={name,
    getDataRange(){pad();return rng(1,1,d.length,width());},
    getLastRow(){let n=d.length;while(n>0&&d[n-1].every(v=>v===''))n--;return n;},
    getLastColumn(){return d.length?d[0].filter(v=>v!=='').length:0;},
    getMaxRows(){return Math.max(1000,d.length);},
    getRange(a,b,c,e){return rng(a,b,c||1,e||1);},
    deleteRows(s,n){d.splice(s-1,n);},
    setFrozenRows(){},setColumnWidth(){},_d:()=>d};
  function rng(r,c,nr,nc){return{
    getValues(){const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){row.push((d[r-1+i]||[])[c-1+j]??'');}o.push(row);}return o;},
    setValues(v){for(let i=0;i<nr;i++){while(d.length<r+i)d.push([]);const row=d[r-1+i];for(let j=0;j<nc;j++){while(row.length<c+j)row.push('');row[c-1+j]=v[i][j];}}return this;},
    setValue(x){return this.setValues([[x]]);},
    clearContent(){return this;},setFontWeight(){return this},setBackground(){return this},setNumberFormat(){return this}};}
  return sh;}
function makeSS(obj){const sheets={};for(const k in obj)sheets[k]=makeSheet(k,obj[k]);return{getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=makeSheet(n,[])),_s:sheets};}
const DB=makeSS(seed.db);
// เทมเพลตจริงในโฟลเดอร์ 03
const tplFiles=fs.readdirSync(TPL).filter(f=>/^F\d\d .*\.docx$/.test(f));
let EMAIL='dev@hongson.ac.th';
global.SpreadsheetApp={openById:id=>id.startsWith('1Utkv')?DB:makeSS({'ข้อสังเกต':[['เรื่อง','ที่พบ','ข้อเสนอ','สถานะ']]})};
global.Session={getActiveUser:()=>({getEmail:()=>EMAIL})};
const props={};global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})};
const cache={};global.CacheService={getScriptCache:()=>({putAll:o=>Object.assign(cache,o),get:k=>cache[k]??null,getAll:ks=>{const o={};ks.forEach(k=>{if(k in cache)o[k]=cache[k]});return o;},put:(k,v)=>{cache[k]=v}})};

// ---- Sheets API จำลอง ----
let DIRTY=false, API_CALLS=0; const API_ERRS=[];
(function(){const S=global.SpreadsheetApp;const orig=S.openById;
  S.flush=()=>{DIRTY=false;};
  S.openById=id=>{const ss=orig(id);if(ss.__wrapped)return ss;ss.__wrapped=true;const g=ss.getSheetByName;ss.getSheetByName=n=>{const sh=g(n);if(sh&&!sh.__w){sh.__w=true;const gr=sh.getRange.bind(sh);sh.getRange=(...a)=>{const r=gr(...a);const sv=r.setValues.bind(r);r.setValues=v=>{DIRTY=true;return sv(v);};return r;};const dr=sh.deleteRows.bind(sh);sh.deleteRows=(...a)=>{DIRTY=true;return dr(...a);};}return sh;};return ss;};
})();
global.Sheets={Spreadsheets:{Values:{batchGet:(id,o)=>{API_CALLS++;
  if(DIRTY){API_ERRS.push('read-before-flush');throw new Error('TEST: อ่านผ่าน API ก่อน flush (ค่าที่เขียนค้างจะหาย)');}
  const ss=global.SpreadsheetApp.openById(id);
  return {valueRanges:o.ranges.map(r=>{const n=r.replace(/^'|'$/g,'');const sh=ss.getSheetByName(n);if(!sh)throw new Error('Unable to parse range: '+r);
    let d=sh._d().map(row=>{row=row.slice();while(row.length&&(row[row.length-1]===''||row[row.length-1]===undefined))row.pop();return row;});
    while(d.length&&!d[d.length-1].length)d.pop();
    d=d.map(row=>row.map(v=>v instanceof Date?(v.getTime()/86400000+25569):v));
    return {range:r,values:d};})};}}}};
global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
global.Logger={log:()=>{}};
global.HtmlService={};
function Blob(b,t,n){this.bytes=Buffer.from(b);this.type=t;this.name=n;}
Blob.prototype={getBytes(){return this.bytes},getName(){return this.name},setContentType(t){this.type=t;return this},getDataAsString(){return this.bytes.toString('utf8')}};
const py=(code,input)=>cp.execFileSync('python3',['-c',code],{input,maxBuffer:1<<28}).toString();
let ids=0; const byId={};
function Folder(p){this.p=p;fs.mkdirSync(p,{recursive:true});this.id='F'+(++ids);byId[this.id]=this;}
Folder.prototype={
  getFoldersByName(n){const p=path.join(this.p,n),ok=fs.existsSync(p);let done=!ok;return{hasNext:()=>!done,next:()=>{done=true;return folderAt(p);}};},
  createFolder(n){return folderAt(path.join(this.p,n));},
  getFilesByName(n){const p=path.join(this.p,n),ok=fs.existsSync(p);let done=!ok;return{hasNext:()=>!done,next:()=>{done=true;return new File(p);}};},
  getFiles(){const fl=fs.readdirSync(this.p).filter(f=>f.endsWith('.docx')).map(f=>new File(path.join(this.p,f)));let i=0;return{hasNext:()=>i<fl.length,next:()=>fl[i++]};},
  createFile(b){const p=path.join(this.p,b.getName());fs.writeFileSync(p,b.bytes);return new File(p);},
  getUrl(){return 'file://'+this.p},getId(){return this.id},getName(){return path.basename(this.p)},isTrashed(){return false},
  setName(n){const np=path.join(path.dirname(this.p),n);fs.renameSync(this.p,np);for(const k in pathMap)if(pathMap[k]===this)delete pathMap[k];this.p=np;pathMap[np]=this;}
};
const pathMap={}; function folderAt(p){if(!pathMap[p])pathMap[p]=new Folder(p);return pathMap[p];}
function File(p){this.p=p;}
File.prototype={getId(){return 'file:'+this.p},getUrl(){return 'file://'+this.p},getName(){return path.basename(this.p)},getLastUpdated(){return new Date()},
  setName(n){const np=path.join(path.dirname(this.p),n);fs.renameSync(this.p,np);this.p=np;},moveTo(f){const np=path.join(f.p,path.basename(this.p));fs.renameSync(this.p,np);this.p=np;},
  getBlob(){return new Blob(fs.readFileSync(this.p),'x',this.getName());}};
const TPLF=folderAt(TPL), OUTF=folderAt(OUT);
global.DriveApp={getFileById:id=>new File(id.replace(/^file:/,'')),getFolderById:id=>id==='1VrfArzjGP5YZW2UG2Hs2C_4UH-RpVyiy'?TPLF:(id==='1wAlIn_zelnOeR8JjcTs29ATWXrQzJdJ9'?OUTF:byId[id])};
global.Utilities={
  formatDate:(d,tz,f)=>{const s=new Date(d.getTime()+7*3600e3).toISOString().replace('T',' ');return f==='yyyy-MM-dd'?s.slice(0,10):(f==='yyyy-MM-dd HHmm'?s.slice(0,16).replace(':',''):s.slice(0,19));},
  newBlob:(d,t,n)=>new Blob(typeof d==='string'?Buffer.from(d,'utf8'):d,t,n),
  unzip:b=>JSON.parse(py('import sys,zipfile,io,json,base64;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));print(json.dumps([[i.filename,base64.b64encode(z.read(i.filename)).decode()] for i in z.infolist()]))',b.bytes)).map(([n,d])=>new Blob(Buffer.from(d,'base64'),'x',n)),
  zip:(bl,name)=>new Blob(Buffer.from(py('import sys,zipfile,io,json,base64\nL=json.load(sys.stdin);o=io.BytesIO()\nwith zipfile.ZipFile(o,"w",zipfile.ZIP_DEFLATED) as z:\n  [z.writestr(n,base64.b64decode(d)) for n,d in L]\nprint(base64.b64encode(o.getvalue()).decode())',JSON.stringify(bl.map(b=>[b.getName(),b.bytes.toString('base64')]))).trim(),'base64'),'application/zip',name)
};
const files=['00_App.gs'].concat(fs.readdirSync(SRC).filter(f=>f.endsWith('.gs')&&f!=='00_App.gs'));
const all=files.map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n;\n');
fs.writeFileSync(__dirname+'/all.js',all);
eval(all+';global.__g={setupPhase0,setupPhase1,setupPhase2,apiProcMeta,apiProcList,apiProcGet,apiProcSave,apiProcConfirm,apiProcGenerate,apiProcVoid,apiProcSaveVendor,procMissing_,reset:()=>{__user=null;__tableCache={};__db=null;__apiOff=false;DIRTY=false;}}');
const G=global.__g;
const ok=(r)=>{assert(r.ok,r.error);G.reset();return r.data;};
const L=(...a)=>console.log(...a);
// ติดตั้ง
L(G.setupPhase1().filter(x=>/เทมเพลต|ไม่พบ/.test(x)).length+' template lines'); G.reset();
L(G.setupPhase2().slice(-1)[0]); G.reset();
L('again:',G.setupPhase2().slice(-1)[0]); G.reset();
const meta=ok(G.apiProcMeta()); assert.strictEqual(meta.steps.length,5);
let list=ok(G.apiProcList('')); L('list',list.rows.map(r=>r.proc_id+' '+r.status+' '+r.proc_no+'/'+r.fiscal_year+' '+r.vendor));
const drone=list.rows[0].proc_id;
// งานโดรน: ความพร้อมทุกฟอร์ม
let d=ok(G.apiProcGet(drone)); const miss=G.procMissing_(Object.assign(d,{}),['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12']);
L('drone missing:',JSON.stringify(miss)); assert.strictEqual(miss.length,0);
// ออกทั้งชุด
let g=ok(G.apiProcGenerate(drone,'all')); L('drone gen',g.files.length,'files',g.combined&&g.combined.name, g.files.filter(f=>f.missing.length).map(f=>f.form_key+':'+f.missing));
assert.strictEqual(g.files.length,12);
// งานใหม่: บันทึกร่าง
const base={proc:{subject:'เครื่องพิมพ์เลเซอร์',reason:'ใช้ในงานธุรการ',project_name:'พัฒนางานสำนักงาน',admin_group:'กลุ่มบริหารทั่วไป',responsible_unit:'งานสารบรรณ',
  budget_type:'เงินนอกงบประมาณ',budget_source:'เงินอุดหนุน',budget_year:'2570',budget_amount:'8500',price_source:'การสืบราคาจากท้องตลาด /จากเว็บไซต์',
  delivery_days:'7',price_validity_days:'15',warranty_years:'1',repair_days:'7',contract_sign_days:'7',tor_memo_date:'2026-11-16',tor_order_no:'501',tor_order_date:'2026-11-16',
  request_date:'2026-11-17',result_date:'2026-11-18',inspect_order_date:'2026-11-18',announce_date:'2026-11-18',contract_notice_date:'2026-11-18',po_date:'2026-11-19',
  inspection_date:'2026-11-26',issue_date:'2026-11-26',item_mode:'split',proc_no:'999',status:'issued'},
  items:[{description:'เครื่องพิมพ์เลเซอร์ ขาวดำ',qty:'1',unit:'เครื่อง',unit_price:'5500'},{description:'ตลับหมึก',qty:'2',unit:'กล่อง',unit_price:'1500',post_to_ledger:'Y'}],
  specs:[{section:'background',text:'เครื่องพิมพ์เดิมชำรุด'},{section:'objective',text:'เพื่อใช้พิมพ์เอกสาร'},{section:'spec',text:'พิมพ์ได้ 30 แผ่นต่อนาที'}],
  committees:[{kind:'TOR',seq:1,person_id:'P044'},{kind:'TOR',seq:2,person_id:'P046'}],quotes:[]};
let p=ok(G.apiProcSave(base)); L('new',p.proc_id,p.status,p.proc_no,'fy',p.fiscal_year,'total',p.total_amount,'due',p.due_date);
assert.strictEqual(p.status,'draft'); assert.strictEqual(String(p.proc_no),''); assert.strictEqual(Number(p.total_amount),8500);
// ยืนยันขอซื้อไม่ได้ (ไม่มีผู้ขาย? ขั้น 2 ต้องมีรายการ + วันที่ — F04/F05 ไม่ต้องมีผู้ขาย) → ได้เลข 14
base.proc.proc_id=p.proc_id; base.baseRev=p.rev;
// ขั้น 1 ออกเอกสารไม่ได้เพราะกรรมการ TOR ไม่ครบ
let e1=G.apiProcGenerate(p.proc_id,1); G.reset(); assert(!e1.ok); L('gen1 blocked:',e1.error);
let c2=ok(G.apiProcConfirm(base,2)); assert(c2.confirmed); c2=c2.proc; L('confirm2',c2.status,c2.proc_no+'/'+c2.fiscal_year); assert.strictEqual(String(c2.proc_no),'14');
// แก้พร้อมกัน: base เก่า → ถูกปฏิเสธ
let stale=G.apiProcSave(base); G.reset(); assert(!stale.ok); L('stale:',stale.error);
base.baseRev=c2.rev;
// ยืนยันสั่งซื้อไม่ได้: ไม่มีผู้ขาย/กรรมการตรวจรับ
let bad3=ok(G.apiProcConfirm(base,3)); assert(!bad3.confirmed); L('confirm3 blocked:',bad3.missing.join(', ')); base.baseRev=bad3.proc.rev;
// เพิ่มผู้ขายใหม่
let v=ok(G.apiProcSaveVendor({vendor_name:'ร้านคอมพิวเตอร์แม่ฮ่องสอน',tax_id:'1234567890123',address:'99 ถนนขุนลุมประพาส',subdistrict:'จองคำ',district:'เมืองแม่ฮ่องสอน',province:'แม่ฮ่องสอน',postcode:'58000',phone:'053000000'}));
L('vendor',v.vendor_id); let dupv=G.apiProcSaveVendor({vendor_name:'ร้านคอมพิวเตอร์แม่ฮ่องสอน'}); G.reset(); assert(!dupv.ok);
base.proc.vendor_id=v.vendor_id; base.committees=base.committees.concat([{kind:'TOR',seq:3,person_id:'P047'},{kind:'INSPECT',seq:1,person_id:'P041'},{kind:'INSPECT',seq:2,person_id:'P046'},{kind:'INSPECT',seq:3,person_id:'P047'}]);
base.proc.egp_project_no='69119999999';
let c3=ok(G.apiProcConfirm(base,3)); assert(c3.confirmed); c3=c3.proc; L('confirm3',c3.status,'พ',c3.inspect_order_no); assert.strictEqual(c3.inspect_order_no,'15/2570');
base.baseRev=c3.rev;
let g2=ok(G.apiProcGenerate(p.proc_id,3)); L('gen step3',g2.files.map(f=>f.name).join(' | '));
let g1=ok(G.apiProcGenerate(p.proc_id,1)); L('gen step1',g1.files.length);
// ข้ามขั้น: ยืนยันเบิกก่อนตรวจรับไม่ได้
let skip=ok(G.apiProcConfirm(base,5)); assert(!skip.confirmed); L('skip blocked:',skip.missing); base.baseRev=skip.proc.rev;
base.proc.requester_id='P044'; base.proc.dept='ธุรการ';
let c4=ok(G.apiProcConfirm(base,4)).proc; base.baseRev=c4.rev; assert.strictEqual(c4.status,'inspected');
// เจ้าหน้าที่ (officer) แก้หลังตรวจรับไม่ได้
ok(G.apiProcList('')); // warm
EMAIL='dev@hongson.ac.th';
let c5=ok(G.apiProcConfirm(base,5)).proc; assert.strictEqual(c5.status,'issued');
let ga=ok(G.apiProcGenerate(p.proc_id,'all')); L('gen all',ga.files.length,ga.combined.name);
// ยกเลิก
let vd=G.apiProcVoid(p.proc_id,''); G.reset(); assert(!vd.ok);
vd=ok(G.apiProcVoid(p.proc_id,'ทดสอบยกเลิก')); assert.strictEqual(vd.status,'void');
let gv=G.apiProcGenerate(p.proc_id,1); G.reset(); assert(!gv.ok);
d=ok(G.apiProcGet(p.proc_id)); L('log',d.log.map(l=>l.action).join(' > ')); L('docs',Object.keys(d.docs).join(','));
// สิทธิ์: ครูทั่วไปดูได้ แก้ไม่ได้
EMAIL='someone@hongson.ac.th'; G.reset();
let vl=ok(G.apiProcList('')); assert.strictEqual(vl.canCreate,false); let vs=G.apiProcSave(base); G.reset(); assert(!vs.ok); L('viewer save blocked:',vs.error);
let vgt=ok(G.apiProcGet(drone)); assert.strictEqual(vgt.canEdit,false);
// Counter
L('counter',JSON.stringify(DB._s.Counter._d()));
L('folders:'); L(cp.execSync('find "'+OUT+'" -maxdepth 3 -type d').toString());
console.log('PROC TESTS PASS');
process.on('exit',()=>console.log('API_CALLS used:',API_CALLS,'errors:',JSON.stringify(API_ERRS.slice(0,5)),API_ERRS.length));
