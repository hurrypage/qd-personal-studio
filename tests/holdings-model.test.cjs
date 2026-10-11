const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validate} = require('../holdings-model.js');
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
