const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage={};
const ctx={console,Date,Number,JSON,Promise,fmtAmt:v=>v+'元',cls:()=>'',fmtPct:v=>v==null?'--':v+'%',lsGet:(k,d)=>storage[k]||d,lsSet:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),funds:[],fundHist:{},fundPeriods:()=>({JN:null}),limitNotices:{limits:{},unverified:{}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../data-tools.js'),'utf8'),ctx);
assert.equal(ctx.quotaClassState({max:0}),'待核验');
assert.equal(ctx.quotaClassState({max:0,unlimited:true}),'不限额');
assert.equal(ctx.quotaClassState({max:100,state:'暂停申购'}),'暂停申购');
ctx.quotaEvidenceReady=true;
const f={code:'100055',name:'测试基金',scope:'各份额分开计算',scopeSrc:'notice',limitSource:'notice',limitDate:'2026-10-08',limitClasses:[{code:'100055',cls:'A',max:10},{code:'022184',cls:'C',max:20}]};
ctx.recordQuotaHistory([f]);assert.equal(storage.qdp3_quota_history_v1.events.length,0);
f.limitClasses[0].max=100;ctx.recordQuotaHistory([f]);assert.equal(storage.qdp3_quota_history_v1.events.length,1);
ctx.recordQuotaHistory([f]);assert.equal(storage.qdp3_quota_history_v1.events.length,1);
f.limitClasses[1].unknown=true;ctx.recordQuotaHistory([f]);assert.equal(storage.qdp3_quota_history_v1.events.length,1,'missing class must not imply decrease');
f.limitNoticePending=true;f.limitClasses[0].max=200;ctx.recordQuotaHistory([f]);assert.equal(storage.qdp3_quota_history_v1.events.length,1,'pending announcement excluded');
ctx.funds=[{code:'1',navDate:'2026-10-08'}];ctx.updateActualNav('1',{nav:[{d:'2026-10-07',nav:1,pct:2}]});assert.equal(ctx.funds[0].actualPct,undefined);
ctx.updateActualNav('1',{nav:[{d:'2026-10-08',nav:1.1,pct:0}]});assert.equal(ctx.funds[0].actualPct,0);assert.match(ctx.actualNavHtml(ctx.funds[0]),/0%/);
assert.match(ctx.fundEvidenceHtml({...f,name:'<script>',limitClasses:[{code:'1',cls:'<script>',max:0}]}),/&lt;script&gt;/);
console.log('PASS: unknown/unlimited, observed changes, pending/missing data, actual NAV dates, escaping');

const a={...f,limitNoticePending:false,limitClasses:[{code:'1',cls:'A',max:10},{code:'2',cls:'C',max:20}]};
assert.equal(ctx.verifiedQuotaTotal([a]).total,30);a.scope='各份额合并计算';assert.equal(ctx.verifiedQuotaTotal([a]).total,20);a.scopeSrc='table';assert.equal(ctx.verifiedQuotaTotal([a]).count,0);
const series=ctx.parseBackupHistory({Datas:[{FSRQ:'2026-10-08',DWJZ:'1.1',LJJZ:'1.2',JZZZL:'0'},{FSRQ:'2026-10-07',DWJZ:'1',LJJZ:'1.1',JZZZL:'--'}]});
assert.equal(series.nav[0].d,'2026-10-07');assert.equal(series.nav[1].pct,0);assert.equal(series.period.JN,null);assert.throws(()=>ctx.parseBackupHistory({Datas:[]}));
console.log('PASS: merged/separate totals, unknown scope exclusions, backup history validation');

a.limitSource='notice';a.scopeSrc='notice';ctx.recordQuotaHistory([a]);const before=storage.qdp3_quota_history_v1.events.length;a.scopeSrc='table';ctx.recordQuotaHistory([a]);assert.equal(storage.qdp3_quota_history_v1.events.length,before,'temporary unknown scope must not create a change');
ctx.quotaEvidenceReady=false;ctx.recordQuotaHistory([{...a,limitClasses:[{code:'1',cls:'A',max:999}]}]);assert.equal(storage.qdp3_quota_history_v1.events.length,before,'initialization must not record stale state');
console.log('PASS: initialization and scope-loading changes are ignored');
