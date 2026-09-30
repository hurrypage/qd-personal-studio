/* Fund membership is independent of the general watch list; A/C shares retain their own NAVs. */
var personalCodes = null;
var personalSort = 'default';
function seedPersonalHoldings() {
  var data = window.PERSONAL_DATA;
  if (!data) return;
  personalCodes = lsGet('qd-personal-codes', data.funds.map(function(f) { return f.code; }));
  data.funds.forEach(function(record) {
    if (personalCodes.indexOf(record.code) < 0) return;
    var f = funds.find(function(item) { return item.code === record.code; });
    if (!f) {
      f = {code: record.code, coef: .9, personalOnly: true};
      funds.push(f);
    }
    f.personalHolding = true;
    f.name = record.name;
    f.ftype = record.ftype;
    if (record.holdings && record.holdings.length) {
      f.holdings = record.holdings;
      f.reportDate = record.reportDate;
      f.src = 'personal';
    } else {
      f.holdings = [];
      f.src = 'personal';
      f.reportDate = '';
    }
    f.holdingsCheckedAt = record.holdingsCheckedAt;
    if (record.navDate && (!f.navDate || record.navDate >= f.navDate)) {
      f.nav = record.nav; f.navDate = record.navDate;
    }
    if (record.ytdDate && (!f.ytdDate || record.ytdDate >= f.ytdDate)) {
      f.ytd = record.ytd; f.ytdDate = record.ytdDate;
      f.ytdTs = Date.parse(record.checkedAt) || 0;
    }
    // Index funds use the tracked index as an estimate; disclosed holdings stay visible separately.
    if (/纳斯达克100/.test(record.name)) {
      f.personalProxy = {code:'usNDX', name:'纳斯达克100指数', weight:100, texch:'9'};
    } else if (/恒生科技/.test(record.name)) {
      f.personalProxy = {code:'hkHSTECH', name:'恒生科技指数', weight:100, texch:'9'};
    }
  });
  saveFunds();
}
function removePersonalHolding(code) {
  var f = funds.find(function(item) { return item.code === code; });
  if (!confirm('从个人持仓清单移除 ' + (f ? f.name : code) + '？')) return;
  personalCodes = personalCodes.filter(function(item) { return item !== code; });
  lsSet('qd-personal-codes', personalCodes);
  renderPersonalHoldings();
}
function resetPersonalHoldings() {
  if (!confirm('恢复截图中的 21 只基金清单？')) return;
  try { localStorage.removeItem('qd-personal-codes'); } catch (_) {}
  seedPersonalHoldings(); renderPersonalHoldings(); refreshYtd();
}
function sortPersonalHoldings(value) { personalSort = value; renderPersonalHoldings(); }
function renderPersonalHoldings() {
  var target = document.getElementById('personalList');
  if (!target || !personalCodes) return;
  var term = document.getElementById('personalSearch').value.trim().toLowerCase();
  var rows = personalCodes.map(function(code) { return funds.find(function(f) { return f.code === code; }); }).filter(Boolean);
  var total = rows.length;
  rows = rows.filter(function(f) { return (f.name + ' ' + f.code).toLowerCase().indexOf(term) >= 0; });
  if (personalSort !== 'default') {
    rows.sort(function(a,b) {
      var x = personalSort === 'ytd' ? a.ytd : estimate(a).live;
      var y = personalSort === 'ytd' ? b.ytd : estimate(b).live;
      if (x == null || !isFinite(x)) return y == null || !isFinite(y) ? 0 : 1;
      if (y == null || !isFinite(y)) return -1;
      return y - x;
    });
  }
  document.getElementById('personalCount').textContent = total + ' 只' + (term ? ' · 匹配 ' + rows.length + ' 只' : '');
  target.innerHTML = rows.length ? renderFundCards(rows) : '<div class="quota-empty">没有匹配的持仓基金。</div>';
  target.querySelectorAll('.card').forEach(function(card) {
    card.classList.toggle('expanded',!!expanded[card.dataset.code]);
    card.draggable = false;
    ['ondragstart','ondragover','ondragleave','ondrop','ondragend','ontouchstart','ontouchmove','ontouchend','ontouchcancel','oncontextmenu'].forEach(function(attr) { card.removeAttribute(attr); });
    var f = funds.find(function(item) { return item.code === card.dataset.code; });
    var heading = card.querySelector('.holdings-heading span');
    if(heading && f.reportDate && Date.now()-Date.parse(f.reportDate)>183*86400000) heading.textContent += ' · 较旧披露';
    var fav = card.querySelector('.poke'); if (fav) fav.remove();
    card.querySelectorAll('.f-x,.f-del').forEach(function(button) {
      button.title = '移出个人持仓清单';
      button.setAttribute('onclick', "event.stopPropagation();removePersonalHolding('" + card.dataset.code + "')");
      if (button.classList.contains('f-del')) button.textContent = '移出个人清单';
    });
  });
}
