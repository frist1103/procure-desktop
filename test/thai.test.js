const fs=require('fs'); eval(fs.readFileSync(__dirname+'/../gas/Thai.gs','utf8'));
const assert=require('assert');
const cases=[[19650,'หนึ่งหมื่นเก้าพันหกร้อยห้าสิบบาทถ้วน'],[18364.49,'หนึ่งหมื่นแปดพันสามร้อยหกสิบสี่บาทสี่สิบเก้าสตางค์'],[1285.51,'หนึ่งพันสองร้อยแปดสิบห้าบาทห้าสิบเอ็ดสตางค์'],[11,'สิบเอ็ดบาทถ้วน'],[21,'ยี่สิบเอ็ดบาทถ้วน'],[101,'หนึ่งร้อยเอ็ดบาทถ้วน'],[1,'หนึ่งบาทถ้วน'],[10,'สิบบาทถ้วน'],[1000000,'หนึ่งล้านบาทถ้วน'],[1000001,'หนึ่งล้านเอ็ดบาทถ้วน'],[21000000,'ยี่สิบเอ็ดล้านบาทถ้วน'],[0.5,'ห้าสิบสตางค์'],[250000.25,'สองแสนห้าหมื่นบาทยี่สิบห้าสตางค์']];
for(const [n,t] of cases){assert.strictEqual(bahtText(n),t,n+' => '+bahtText(n));}
const v=splitVat(19650); assert.deepStrictEqual(v,{total:19650,beforeVat:18364.49,vat:1285.51});
for(let i=1;i<3000;i+=7.37){const s=splitVat(i);assert.strictEqual(Math.round((s.beforeVat+s.vat)*100),Math.round(round2(i)*100));}
assert.strictEqual(formatMoney(19650),'19,650.00'); assert.strictEqual(formatMoney(1285.505),'1,285.51');
assert.strictEqual(toThaiDigits('19,650.00'),'๑๙,๖๕๐.๐๐'); assert.strictEqual(toArabicDigits('๑9,65๐.๐๐'),'19,650.00');
assert.strictEqual(applyNumberStyle('13/๒๕70','thai'),'๑๓/๒๕๗๐'); assert.strictEqual(applyNumberStyle('13/๒๕70','arabic'),'13/2570');
assert.strictEqual(thaiDate('2026-11-03','D1'),'3 พฤศจิกายน 2569');
assert.strictEqual(thaiDate('2026-11-04','D2'),'4 พฤศจิกายน พ.ศ. 2569');
assert.strictEqual(thaiDate('2026-11-02','D3'),'2 เดือน พฤศจิกายน พ.ศ. 2569');
assert.strictEqual(thaiDate('2026-11-12','D4'),'12/พฤศจิกายน/2569');
assert.strictEqual(fiscalYearBE('2026-11-03'),2570); assert.strictEqual(fiscalYearBE('2026-09-30'),2569); assert.strictEqual(fiscalYearBE('2026-10-01'),2570);
assert.strictEqual(fiscalQuarter('2026-11-12'),1); assert.strictEqual(fiscalQuarter('2027-02-01'),2); assert.strictEqual(fiscalQuarter('2027-09-30'),4);
assert.strictEqual(addDaysIso('2026-11-05',15),'2026-11-20'); assert.strictEqual(addDaysIso('2026-12-25',10),'2027-01-04');
assert.strictEqual(positionTitleFromRank('ครู คศ.3'),'ครูชำนาญการพิเศษ');
console.log('THAI TESTS PASS', cases.length+' baht cases');
