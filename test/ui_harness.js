// สร้างหน้าเว็บทดสอบ: โค้ด GAS ทั้งหมดรันในเบราว์เซอร์กับชีตจำลอง + google.script.run จำลอง
const fs=require('fs'),path=require('path');
const SRC=path.join(__dirname,'..','gas'), OUT=process.argv[2];
const seed=JSON.parse(fs.readFileSync(__dirname+'/seed.json','utf8')).db;
seed.Category=[['cat_code','cat_name','type'],['101','วัสดุสำนักงาน','วัสดุ'],['201','ครุภัณฑ์คอมพิวเตอร์','ครุภัณฑ์']];
seed.Item=[['item_code','cat_code','item_name','unit','note'],['101-001','101','กระดาษ A4 80 แกรม','รีม',''],['101-002','101','ตลับหมึกเครื่องพิมพ์เลเซอร์','กล่อง',''],['201-001','201','เครื่องพิมพ์เลเซอร์','เครื่อง',''],['201-002','201','โปรเจคเตอร์','เครื่อง','']];
seed.Project=[seed.Project[0],['PJ001','2570','พัฒนาสื่อการเรียนการสอนสำหรับห้องเรียนเตรียมวิศวะ','วิชาการ','งานห้องเรียนพิเศษวิทยาศาสตร์ คอมพิวเตอร์ (เตรียมวิศวะ)','P041',50000,'เงินนอกงบประมาณ','เงินบำรุงการศึกษา (ห้องเรียนวิทย์คอม)','','TRUE','']];
const files=['00_App.gs'].concat(fs.readdirSync(SRC).filter(f=>f.endsWith('.gs')&&f!=='00_App.gs'));
const gas=files.map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n;\n');
let index=fs.readFileSync(path.join(SRC,'Index.html'),'utf8');
index=index.replace(/<\?!= include\('(\w+)'\) \?>/g,(m,n)=>fs.readFileSync(path.join(SRC,n+'.html'),'utf8')).replace('<?= appVersion ?>','0.3.0');
const mock=`<script>
var SEED=${JSON.stringify(seed)};
function makeSheet(name,data){var d=data.map(function(r){return r.slice()});
 function width(){return Math.max.apply(null,[0].concat(d.map(function(r){return r.length})));}
 function pad(){var w=width();d.forEach(function(r){while(r.length<w)r.push('')});}
 function rng(r,c,nr,nc){return{getValues:function(){var o=[];for(var i=0;i<nr;i++){var row=[];for(var j=0;j<nc;j++){var v=(d[r-1+i]||[])[c-1+j];row.push(v===undefined?'':v);}o.push(row);}return o;},
  setValues:function(v){for(var i=0;i<nr;i++){while(d.length<r+i)d.push([]);var row=d[r-1+i];for(var j=0;j<nc;j++){while(row.length<c+j)row.push('');row[c-1+j]=v[i][j];}}return this;},
  setValue:function(x){return this.setValues([[x]]);},clearContent:function(){return this},setFontWeight:function(){return this},setBackground:function(){return this},setNumberFormat:function(){return this}};}
 return{getDataRange:function(){pad();return rng(1,1,d.length,width());},getLastRow:function(){var n=d.length;while(n>0&&d[n-1].every(function(v){return v===''}))n--;return n;},
  getLastColumn:function(){return d.length?d[0].filter(function(v){return v!==''}).length:0;},getMaxRows:function(){return 1000},getRange:function(a,b,c,e){return rng(a,b,c||1,e||1);},
  deleteRows:function(s,n){d.splice(s-1,n)},setFrozenRows:function(){},setColumnWidth:function(){}};}
var SHEETS={};Object.keys(SEED).forEach(function(k){SHEETS[k]=makeSheet(k,SEED[k])});
var SpreadsheetApp={openById:function(){return{getSheetByName:function(n){return SHEETS[n]||null},insertSheet:function(n){return SHEETS[n]=makeSheet(n,[])}}}};
var Session={getActiveUser:function(){return{getEmail:function(){return window.__EMAIL||'dev@hongson.ac.th'}}}};
var __props={};var PropertiesService={getScriptProperties:function(){return{getProperty:function(k){return __props[k]||null},setProperty:function(k,v){__props[k]=v}}}};
var CacheService={getScriptCache:function(){return{putAll:function(){},get:function(){return null},getAll:function(){return{}}}}};
var LockService={getScriptLock:function(){return{waitLock:function(){},releaseLock:function(){}}}};
var Logger={log:function(){}};var HtmlService={};
function pad2(n){return ('0'+n).slice(-2)}
var Utilities={formatDate:function(d,tz,f){var s=d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());if(f==='yyyy-MM-dd')return s;return s+' '+pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());}};
</script><script>${gas.replace(/<\/script/g,'<\\/script')}
// ออกเอกสารในหน้าทดสอบ: จำลองผลลัพธ์ (ไม่สร้างไฟล์จริง)
generateDocs_=function(data,opt){return{folderUrl:'#folder',folderId:'FOLDER1',style:'thai',combined:opt.combined?{name:'ชุดรวม.docx',url:'#c'}:null,
 files:opt.forms.map(function(f){return{form_key:f,name:f+'.docx',id:'id-'+f,url:'#'+f,missing:[],rev:'r'}})};};
</script><script>
var __u={user:null};
var google={script:{get run(){var h={};var p=new Proxy({},{get:function(t,k){
 if(k==='withSuccessHandler')return function(f){h.s=f;return p;};if(k==='withFailureHandler')return function(f){h.f=f;return p;};
 return function(){var a=Array.prototype.slice.call(arguments);(window.__calls=window.__calls||[]).push(k);setTimeout(function(){try{__user=null;__tableCache={};var r=window[k].apply(null,JSON.parse(JSON.stringify(a)));h.s&&h.s(JSON.parse(JSON.stringify(r)));}catch(e){console.error(e);h.f&&h.f(e);}},(window.__DELAY&&window.__DELAY[k])||window.__DELAYALL||60);};}});return p;}}};
setupPhase2();__user=null;__tableCache={};
</script>`;
index=index.replace('<head>','<head>'+mock);
// ฟอนต์ภายนอกไม่จำเป็นในการทดสอบ
index=index.replace(/<link[^>]*fonts[^>]*>/g,'');
fs.writeFileSync(OUT,index);
console.log('harness',OUT,index.length);
