const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validate,category,selectRows,accounts} = require('../holdings-model.js');
function sample() {
  return {format:'qd-private-holdings', version:1, baseline_total_cents:11000, cash_cents:1000,
    loss:{budget_cents:1000,loss_cents:null,remaining_cents:null}, pipeline:{status:'partial'},
    actions:[],priority_actions:[],positions:[{id:1,asset_name:'Example <img onerror="bad()">',account:'example',
      amount_cents:10000,profit_cents:null,include_in_research:1,market:'SH',code:'600000'}]};
}
test('valid private snapshot; user strings remain inert text', () => assert.equal(validate(sample()).positions.length, 1));
test('invalid or mismatched amounts rejected', () => {
  const data=sample(); data.positions[0].amount_cents=NaN; assert.throws(() => validate(data));
  const other=sample(); other.cash_cents=0; assert.throws(() => validate(other));
});
test('duplicate positions and invalid identity rejected', () => {
  const data=sample(); data.positions.push({...data.positions[0]}); assert.throws(() => validate(data));
  const other=sample(); other.positions[0].market='arbitrary'; assert.throws(() => validate(other));
});
test('cashlike excluded products retained in accounting', () => {
  const data=sample(); data.positions[0].include_in_research=0; data.positions[0].code=null;
  assert.equal(validate(data).baseline_total_cents, 11000);
});
test('viewer has no upload, persistence or parent messaging API', () => {
  const root=path.join(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'holdings.js'),'utf8');
  assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|postMessage|innerHTML)\b/);
  const html=fs.readFileSync(path.join(root,'holdings.html'),'utf8');
  assert.match(html,/connect-src 'none'/);
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(index,/sandbox="allow-scripts"/);
  assert.doesNotMatch(index,/allow-same-origin/);
});

test('asset categories distinguish fund links, listed ETFs and excluded rows', () => {
  assert.equal(category({market:'FUND',code:'002611',include_in_research:1}),'gold');
  assert.equal(category({market:'FUND',code:'000001',include_in_research:1}),'fund');
  assert.equal(category({market:'SH',asset_type:'exchange_traded_fund',include_in_research:1}),'etf');
  assert.equal(category({market:'SH',include_in_research:0}),'other');
});
function rows() {
  return {positions:[
    {id:1,asset_name:'Alpha',account:'a',platform:'First',code:'600000',market:'SH',include_in_research:1,amount_cents:300,profit_cents:null},
    {id:2,asset_name:'Beta',account:'b',platform:'Second',code:'600000',market:'SH',include_in_research:1,amount_cents:100,profit_cents:-10},
    {id:3,asset_name:'Cash',account:'a',platform:'First',include_in_research:0,amount_cents:200,profit_cents:20}
  ]};
}
test('search, account, type, scope and exact priority identity compose', () => {
  assert.deepEqual(selectRows(rows(),{search:'second',type:'stock',scope:'research'}).map(row=>row.id),[2]);
  assert.deepEqual(selectRows(rows(),{key:'SH:600000'}).map(row=>row.id),[1,2]);
  assert.deepEqual(selectRows(rows(),{account:'a',scope:'excluded'}).map(row=>row.id),[3]);
  assert.equal(selectRows(rows(),{search:'not-present'}).length,0);
});
test('sort is deterministic and missing profits remain last in both directions', () => {
  assert.deepEqual(selectRows(rows(),{sort:'profit-asc'}).map(row=>row.id),[2,3,1]);
  assert.deepEqual(selectRows(rows(),{sort:'profit-desc'}).map(row=>row.id),[3,2,1]);
  assert.deepEqual(selectRows(rows(),{sort:'amount-asc'}).map(row=>row.id),[2,3,1]);
  assert.deepEqual(rows().positions.map(row=>row.id),[1,2,3]);
});
test('account distribution retains excluded accounting and does not include separate cash', () => {
  assert.deepEqual(accounts(rows()).map(row=>[row.account,row.amount_cents,row.count]),[['a',500,2],['b',100,1]]);
});

test('malformed suggestions, cumulative profit and scenarios are not rendered as data', () => {
  const data=sample(); data.actions=[{}]; assert.throws(()=>validate(data));
  const profit=sample(); profit.positions[0].cumulative_profit_cents='unknown'; assert.throws(()=>validate(profit));
  const scenario=sample(); scenario.scenario={weight:NaN,assumed_decline_pct:30,scenario_loss_cents:10}; assert.throws(()=>validate(scenario));
});
