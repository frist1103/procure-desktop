const fs=require('fs'),assert=require('assert');
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
    getRange(a,b,c,e){if(typeof a==='string'){return rng(8,2,1,1);}return rng(a,b,c||1,e||1);},
    setFrozenRows(){},_d:()=>d};
  function rng(r,c,nr,nc){return{
    getValues(){const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){row.push((d[r-1+i]||[])[c-1+j]??'');}o.push(row);}return o;},
    setValues(v){for(let i=0;i<nr;i++){while(d.length<r+i)d.push([]);const row=d[r-1+i];for(let j=0;j<nc;j++){while(row.length<c+j)row.push('');row[c-1+j]=v[i][j];}}return this;},
    setValue(x){return this.setValues([[x]]);},
    clearContent(){for(let i=0;i<nr;i++){const row=d[r-1+i];if(!row)continue;for(let j=0;j<nc;j++)if(row.length>=c+j)row[c-1+j]='';}return this;},
    setFontWeight(){return this},setBackground(){return this},setNumberFormat(){return this}};}
  return sh;}
function makeSS(obj){const sheets={};for(const k in obj)sheets[k]=makeSheet(k,obj[k]);return{getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=makeSheet(n,[])),_s:sheets};}
const DB=makeSS(seed.db), TV=makeSS(seed.tv);
const LEG=makeSS({Category:[['cat_code','cat_name','type'],[101,'วัสดุสำนักงาน','วัสดุ'],[201,'ครุภัณฑ์การศึกษา','ครุภัณฑ์']],
  Item:[['item_code','cat_code','item_name','unit','note'],['101-001',101,'กระดาษ A4 80 แกรม','รีม',''],['201-002',201,'โปรเจคเตอร์','เครื่อง','']],
  Vendor:[['vendor_name'],['ร้านตัวอย่างหนึ่ง'],['บริษัท ตัวอย่างสอง จำกัด'],['นางทดลอง ใจดี']]});
let EMAIL='dev@hongson.ac.th';
global.SpreadsheetApp={openById:id=>id.startsWith('1Utkv')?DB:id.startsWith('1bWMo')?TV:id.startsWith('1X7E6')?LEG:null};
global.Session={getActiveUser:()=>({getEmail:()=>EMAIL})};
const props={};global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})};
const cache={};global.CacheService={getScriptCache:()=>({putAll:o=>Object.assign(cache,o),get:k=>cache[k]??null,getAll:ks=>{const o={};ks.forEach(k=>{if(k in cache)o[k]=cache[k]});return o;},put:(k,v)=>{cache[k]=v}})};
global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
global.Utilities={formatDate:(d,tz,f)=>d.toISOString().replace('T',' ').slice(0,f.length>10?19:10)};
global.Logger={log:()=>{}};
global.ScriptApp={getProjectTriggers:()=>[],newTrigger:()=>{const t={timeBased:()=>t,everyDays:()=>t,atHour:()=>t,inTimezone:()=>t,onWeekDay:()=>t,create:()=>t};return t;},deleteTrigger(){},WeekDay:{SUNDAY:7}};
global.HtmlService={};
eval(fs.readFileSync(__dirname+'/all.js','utf8')+';global.__api={setupPhase0,apiBootstrap,apiAdminSaveUser,apiAdminListUsers,apiAdminSaveSigner,apiAdminSetConfig,apiPreviewFormats,apiAdminImportLegacy,healthCheck,reset:()=>{__user=null;__tableCache={};}}');
const A=global.__api;
const log=A.setupPhase0(); console.log(log.join('\n'));
let b=A.apiBootstrap(''); assert(b.ok,b.error); assert.strictEqual(b.data.user.isDev,true); assert.deepStrictEqual(b.data.user.roles,['admin','officer','head','finance','viewer']);
console.log('user',b.data.user.name,b.data.user.positionTitle,'level',b.data.key.split(':')[1],'items',b.data.ref.items.rows.length,'vendors',b.data.ref.vendors.rows.length,'personnel',b.data.ref.personnel.rows.length,'size',JSON.stringify(b.data.ref).length);
A.reset(); let b2=A.apiBootstrap(b.data.key); assert(b2.data.notModified,'should be notModified');
// setup again is idempotent
A.reset(); A.setupPhase0(); A.reset(); assert.strictEqual(A.apiBootstrap('').data.ref.items.rows.length,2);
// save user
A.reset(); let r=A.apiAdminSaveUser({email:'Test@hongson.ac.th',person_id:'P066',roles:['officer'],active:true}); assert(r.ok,r.error); assert.strictEqual(r.data.result,'insert');
A.reset(); r=A.apiAdminSaveUser({email:'x@gmail.com',roles:['viewer']}); assert(!r.ok); console.log('reject gmail:',r.error);
// officer login
EMAIL='test@hongson.ac.th'; A.reset(); b=A.apiBootstrap(''); assert.deepStrictEqual(b.data.user.roles,['officer']); assert.strictEqual(b.data.user.name,'นางสมหญิง5 คำแก้ว'); assert(b.data.ref.vendors.cols.includes('tax_id'));
A.reset(); r=A.apiAdminListUsers(); assert(!r.ok); console.log('officer blocked from admin:',r.error);
// unknown domain teacher = viewer, pub snapshot
EMAIL='someone@hongson.ac.th'; A.reset(); b=A.apiBootstrap(''); assert.deepStrictEqual(b.data.user.roles,['viewer']); assert(!b.data.ref.vendors.cols.includes('tax_id'));
// outsider denied
EMAIL='evil@gmail.com'; A.reset(); b=A.apiBootstrap(''); assert(b.data.denied);
// admin changes signer + config → version bump
EMAIL='dev@hongson.ac.th'; A.reset(); const v1=props.DATA_VERSION;
r=A.apiAdminSaveSigner({sign_key:'supply_officer',person_id:'P090'}); assert(r.ok,r.error);
r=A.apiAdminSetConfig('number_style','arabic'); assert(r.ok,r.error); r=A.apiAdminSetConfig('legacy_db_id','x'); assert(!r.ok);
r=A.apiAdminSetConfig('default_delivery_days','abc'); assert(!r.ok);
r=A.apiPreviewFormats('thai'); assert(r.ok); console.log('preview',JSON.stringify(r.data));
const tvp=TV._s['บุคลากร']._d(); console.log('teacher view rows',tvp.length-1, tvp[1]);
assert(!JSON.stringify(TV._s['บุคลากร']._d()).includes('@'));
const vend=DB._s['Vendor']._d(); console.log(vend.slice(1));
console.log('ALL MOCK TESTS PASS');
