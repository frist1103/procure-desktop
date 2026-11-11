// ทดสอบเฟส 2 (Procure.gs) แบบจำลอง Apps Script: ชีตในหน่วยความจำ + Drive/zip จำลอง
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process');
const SRC=process.argv[4]||path.join(__dirname,'..','gas'), TPL=process.argv[2], OUT=process.argv[3];
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const seed=JSON.parse(fs.readFileSync(__dirname+'/seed.json','utf8'));
const CNT={get:0,set:0,fmt:0,del:0,meta:0};
function makeSheet(name,data){
  let d=data.map(r=>r.slice());
  const width=()=>Math.max(0,...d.map(r=>r.length));
  const pad=()=>{const w=width();d.forEach(r=>{while(r.length<w)r.push('')});};
  const sh={name,
    getDataRange(){pad();return rng(1,1,d.length,width());},
    getLastRow(){CNT.meta++;let n=d.length;while(n>0&&d[n-1].every(v=>v===''))n--;return n;},
    getLastColumn(){CNT.meta++;return d.length?d[0].filter(v=>v!=='').length:0;},
    getMaxRows(){CNT.meta++;return Math.max(1000,d.length);},
    getRange(a,b,c,e){return rng(a,b,c||1,e||1);},
    deleteRows(s,n){CNT.del++;d.splice(s-1,n);},insertRowsAfter(){},
    setFrozenRows(){},setColumnWidth(){},_d:()=>d};
  function rng(r,c,nr,nc){return{
    getValues(){CNT.get++;const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){row.push((d[r-1+i]||[])[c-1+j]??'');}o.push(row);}return o;},
    setValues(v){CNT.set++;for(let i=0;i<nr;i++){while(d.length<r+i)d.push([]);const row=d[r-1+i];for(let j=0;j<nc;j++){while(row.length<c+j)row.push('');row[c-1+j]=v[i][j];}}return this;},
    setValue(x){return this.setValues([[x]]);},
    clearContent(){return this;},setFontWeight(){return this},setBackground(){return this},setNumberFormat(){CNT.fmt++;return this}};}
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
global.SpreadsheetApp.flush=()=>{};

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
eval(all+';global.__g={setupPhase1,setupPhase2,apiProcList,apiProcGet,apiProcSave,apiProcConfirm,apiBootstrap,reset:()=>{__user=null;__tableCache={};__db=null;__apiOff=false;DIRTY=false;},tc:()=>__tableCache,readTable_:n=>readTable_(n)}');
const G=global.__g;
const ok=r=>{assert(r.ok,r.error);return r.data;};
G.setupPhase1();G.reset();G.setupPhase2();G.reset();
const rows=[];
function m(label,f){Object.keys(CNT).forEach(k=>CNT[k]=0);const r=f();G.reset();rows.push([label,CNT.get,CNT.meta,CNT.set,CNT.fmt,CNT.del]);return r;}
// warm user cache once (same as real use: user already opened the page)
m('bootstrap (เปิดหน้าเว็บ)',()=>ok(G.apiBootstrap('')));
const list=m('รายการงาน',()=>ok(G.apiProcList('')));
const drone=list.rows[0].proc_id;
m('เปิดงาน',()=>ok(G.apiProcGet(drone,{log:false,hist:true,meta:true})));
const items=n=>Array.from({length:n},(_,i)=>({description:'รายการ '+i,qty:'1',unit:'ชิ้น',unit_price:String(100+i)}));
const base={proc:{subject:'ทดสอบ',request_date:'2026-11-17',tor_memo_date:'2026-11-16'},items:items(5),
 specs:[{section:'background',text:'ก'},{section:'objective',text:'ข'},{section:'spec',text:'ค'}],committees:[{kind:'TOR',seq:1,person_id:'P044'}],quotes:[]};
let p=m('บันทึกงานใหม่',()=>ok(G.apiProcSave(base)));
base.proc.proc_id=p.proc_id;base.baseRev=p.rev;
base.proc.reason='แก้เหตุผล';
p=m('บันทึก (แก้ 1 ช่อง)',()=>ok(G.apiProcSave(base)));base.baseRev=p.rev;
base.items[2].unit_price='999';
p=m('บันทึก (แก้ราคา 1 รายการ)',()=>ok(G.apiProcSave(base)));base.baseRev=p.rev;
base.items=items(7);
p=m('บันทึก (เพิ่มรายการ)',()=>ok(G.apiProcSave(base)));base.baseRev=p.rev;
let c=m('ยืนยันขอซื้อ',()=>ok(G.apiProcConfirm(base,2)));
console.log('ครั้งที่เรียก getValues | อ่านข้อมูลประกอบ(แถวสุดท้าย/คอลัมน์) | setValues | ตั้งรูปแบบ | ลบแถว');
rows.forEach(r=>console.log(r.join(' | ')));
