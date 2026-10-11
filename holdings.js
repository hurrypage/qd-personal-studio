(function () {
  'use strict';
  let data = null, generation = 0, masked = false, type = '', focusKey = '';
  const $ = id => document.getElementById(id);
  const text = (id, value) => { $(id).textContent = value == null ? '' : String(value); };
  const plain = value => value == null ? '数据不足' : (value / 100).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2});
  const yuan = value => masked ? '••••••' : plain(value);
  const pct = value => masked ? '•••' : (value * 100).toFixed(2) + '%';
  // Free-text explanations can also contain amounts; conceal them in shoulder-surfing mode.
  const narrative = value => masked ? '已隐藏。显示金额后可查看完整说明。' : (value || '数据不足，暂不判断');
  const create = (tag, value, cls) => { const node = document.createElement(tag); if (value != null) node.textContent = String(value); if (cls) node.className = cls; return node; };
  const tone = value => masked || value == null || value === 0 ? '' : value > 0 ? 'positive' : 'negative';
  const badge = direction => create('span', direction, 'badge' + (/减持|关注/.test(direction) ? ' warning' : /暂不|核算/.test(direction) ? ' neutral' : ''));
  const accountGroups = () => HoldingsModel.accounts(data);
  function displayTime(value) {
    if (!value) return '未提供';
    const time = new Date(value);
    return Number.isNaN(time.getTime()) ? String(value) : time.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
  }
  function resetFields() {
    $('search').value = ''; $('scope').value = ''; $('account').value = ''; $('sort').value = 'amount-desc'; type = ''; focusKey = '';
  }
  function clear() {
    generation++; data = null; masked = false; resetFields();
    $('report').hidden = true; $('welcome').hidden = false; $('fileInput').value = '';
    ['positions','priorities','issues','allocation'].forEach(id => $(id).replaceChildren());
    ['meta','runStatus','baseline','budget','loss','remaining','lossStatus','riskChange','scenario','dataNote','plan','count','lossNote','budgetLabel','cashNote','filterSummary','issueCount'].forEach(id => text(id, ''));
    $('budgetMeter').value = 0; $('budgetMeter').hidden = true;
    $('account').replaceChildren(new Option('全部账户', ''));
    $('clear').disabled = true; $('mask').disabled = true; $('mask').setAttribute('aria-pressed', 'false'); text('mask','隐藏金额');
    document.querySelectorAll('details').forEach(node => { node.open = false; });
    $('message').className = ''; text('message','已清除本页数据。重新选择本地文件即可查看。');
    updateTypeButtons();
  }
  function updateTypeButtons() {
    $('types').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === type)));
  }
  function scrollToList() {
    $('positionsSection').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  }
  function allocation() {
    $('allocation').replaceChildren();
    accountGroups().forEach(group => {
      const button = create('button', null, 'account-row'); button.type = 'button';
      button.setAttribute('aria-pressed', String($('account').value === group.account));
      const line = create('span'); line.append(create('span',group.label), create('span',pct(group.amount_cents / data.baseline_total_cents)));
      const meter = create('meter'); meter.min = 0; meter.max = 100; meter.value = masked ? 0 : group.amount_cents / data.baseline_total_cents * 100;
      meter.hidden = masked; meter.setAttribute('aria-label',group.label + '占基准资产比例');
      button.append(line,create('small',yuan(group.amount_cents) + ' 元 · ' + group.count + ' 笔'),meter);
      button.addEventListener('click', () => { focusKey = ''; $('account').value = $('account').value === group.account ? '' : group.account; renderRows(); scrollToList(); });
      $('allocation').append(button);
    });
    text('cashNote', '另计证券可用现金 ' + yuan(data.cash_cents) + ' 元，不混入持仓分布。');
  }
  function renderRows() {
    if (!data) return;
    const openIds = new Set([...$('positions').querySelectorAll('details[open]')].map(node => Number(node.dataset.id)));
    const rows = HoldingsModel.selectRows(data, {search:$('search').value, account:$('account').value, scope:$('scope').value, sort:$('sort').value, type:type, key:focusKey});
    const actions = new Map(data.actions.map(row => [row.market + ':' + row.code, row]));
    $('positions').replaceChildren();
    rows.forEach(row => {
      const key = row.market + ':' + row.code, action = actions.get(key);
      const direction = action ? action.direction : row.include_in_research ? '数据不足，暂不判断' : '暂不操作（仅核算）';
      const item = create('details',null,'asset-card'); item.dataset.id = row.id; item.open = openIds.has(row.id);
      const summary = create('summary');
      const name = create('span'); name.append(create('span',row.canonical_name || row.asset_name,'asset-name'));
      const meta = create('span', (row.code ? row.market + ' ' + row.code : '代码未核验') + ' · ' + (row.platform || row.account),'asset-meta'); meta.append(badge(direction)); name.append(meta);
      const values = create('span',null,'asset-values'); values.append(create('strong',yuan(row.amount_cents) + ' 元'),create('small',(row.profit_cents > 0 && !masked ? '+' : '') + yuan(row.profit_cents) + ' 持仓收益',tone(row.profit_cents)));
      summary.append(name,values);
      const detail = create('div',null,'asset-detail'), decision = create('div'), facts = create('div');
      decision.append(create('h3','监督判断'),badge(direction),create('p',narrative(action ? action.reason : row.exclusion_reason)),create('p','数据依据：' + narrative(action ? action.basis : '仅纳入资产总额，不参与研究。'),'detail-note'),create('p','正式行情日期：' + (action && action.data_date || '数据不足'),'detail-note'));
      const dl = create('dl');
      const same = row.code ? data.positions.filter(other => other.code === row.code && other.market === row.market) : [row];
      const combined = same.reduce((sum, other) => sum + other.amount_cents,0);
      const factsList = [['账户',row.platform || row.account],['该笔基准占比',pct(row.amount_cents / data.baseline_total_cents)],['同产品跨账户',same.length + ' 笔 · ' + yuan(combined) + ' 元 · ' + pct(combined / data.baseline_total_cents)],['数量 / 份额',row.quantity == null ? '未提供' : masked ? '••••' : row.quantity],['持仓收益',yuan(row.profit_cents) + ' 元'],['累计收益（另计）',row.cumulative_profit_cents == null ? '未提供，不补零' : yuan(row.cumulative_profit_cents) + ' 元'],['监督范围',row.include_in_research ? '参与监督' : '仅核算，不参与研究']];
      factsList.forEach(pair => dl.append(create('dt',pair[0]),create('dd',pair[1])));
      facts.append(create('h3','持仓口径'),dl); detail.append(decision,facts); item.append(summary,detail); $('positions').append(item);
    });
    text('count',rows.length + ' / ' + data.positions.length + ' 笔'); $('empty').hidden = rows.length !== 0;
    text('filterSummary','当前筛选基准金额 ' + yuan(rows.reduce((sum,row) => sum + row.amount_cents,0)) + ' 元，占全部基准 ' + pct(rows.reduce((sum,row) => sum + row.amount_cents,0) / data.baseline_total_cents) + '。' + (focusKey ? '已定位优先事项，选择“恢复全部”返回。' : ''));
    updateTypeButtons(); allocation();
  }
  function render() {
    const statuses = {ok:'运行正常',success:'运行正常',partial:'部分成功 · 有待核验项',error:'运行异常',failed:'运行异常'};
    text('meta','持仓基准 ' + (data.snapshot_date || '未提供') + ' · 监督生成 ' + displayTime(data.generated_at));
    text('runStatus',statuses[data.pipeline.status] || '状态待核验'); $('runStatus').className = 'status-tag' + (/partial|error|failed/.test(data.pipeline.status) ? ' warning' : '');
    text('baseline',yuan(data.baseline_total_cents)); text('budget',yuan(data.loss.budget_cents)); text('loss',yuan(data.loss.loss_cents)); text('remaining',yuan(data.loss.remaining_cents));
    text('lossStatus',data.loss.loss_cents == null ? '缺当日确认余额，暂不判断' : '确认余额日期 ' + (data.loss.valuation_date || '未提供'));
    text('lossNote',narrative(data.loss.note)); text('riskChange',narrative(data.risk_change)); text('dataNote',narrative(data.data_note)); text('plan',narrative(data.daily_plan));
    const used = data.loss.loss_cents == null ? null : Math.max(0,data.loss.loss_cents) / data.loss.budget_cents * 100;
    $('budgetMeter').hidden = masked || used == null; $('budgetMeter').value = Math.min(100, used || 0);
    text('budgetLabel',masked ? '亏损预算已隐藏' : used == null ? '亏损预算使用比例：数据不足' : '亏损预算已使用 ' + used.toFixed(1) + '%' + (used > 100 ? ' · 已超过边界' : ''));
    text('scenario',masked ? narrative('') : data.scenario ? data.scenario.label + '占' + pct(data.scenario.weight) + '；该组下跌' + data.scenario.assumed_decline_pct + '%的算术情景亏损' + yuan(data.scenario.scenario_loss_cents) + '元。' + data.scenario.note : '未提供压力情景。');
    $('priorities').replaceChildren();
    data.priority_actions.slice(0,3).forEach((row,index) => {
      const item = create('article',null,'priority'), head = create('div',null,'priority-head'), button = create('button'); button.type = 'button';
      const number = create('span',String(index + 1).padStart(2,'0') + ' '); number.setAttribute('aria-hidden','true');
      button.append(number,create('span',row.code + ' ' + row.name));
      button.addEventListener('click', () => { resetFields(); focusKey = row.market + ':' + row.code; renderRows(); $('positions').querySelectorAll('details').forEach(node => { node.open = true; }); scrollToList(); });
      head.append(button,badge(row.direction)); item.append(head,create('p',narrative(row.reason))); $('priorities').append(item);
    });
    if (!data.priority_actions.length) text('priorities','暂无足够交易证据，暂不操作。');
    const issues = Array.isArray(data.pipeline.errors) ? data.pipeline.errors : [];
    text('issueCount',issues.length ? '· ' + issues.length + ' 项' : ''); $('issues').replaceChildren();
    (issues.length ? issues : [{detail:'本次未发现明显抓取异常；仍需人工确认持仓与交易条件。'}]).forEach(row => $('issues').append(create('li',narrative([row.stage,row.product,row.detail || row.note || row.status].filter(Boolean).join(' · ')))));
    $('report').hidden = false; $('welcome').hidden = true; $('mask').disabled = false; $('clear').disabled = false; renderRows();
  }
  function resetFilters() { resetFields(); renderRows(); }
  $('fileInput').addEventListener('change',async function () {
    const file = this.files[0]; if (!file) return;
    clear(); const token = generation; text('message','正在校验本地文件…');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('文件超过5MB，请检查是否选错文件');
      const parsed = JSON.parse(await file.text()); if (token !== generation) return;
      data = HoldingsModel.validate(parsed);
      $('account').replaceChildren(new Option('全部账户',''));
      accountGroups().forEach(group => $('account').append(new Option(group.label,group.account)));
      render(); text('message','已导入 · 仅本页内存中查看，未上传。隐藏金额仅防旁观，不是加密。');
    } catch (error) {
      if (token !== generation) return;
      clear(); $('message').className = 'error'; text('message','导入失败：' + error.message + '。未沿用之前的数据。');
    }
  });
  $('mask').addEventListener('click', () => { if (!data) return; masked = !masked; $('mask').setAttribute('aria-pressed',String(masked)); text('mask',masked ? '显示金额' : '隐藏金额'); render(); });
  $('clear').addEventListener('click',clear);
  $('search').addEventListener('input', () => { focusKey = ''; renderRows(); });
  $('search').addEventListener('keydown',event => { if (event.key === 'Escape') { $('search').value = ''; focusKey = ''; renderRows(); } });
  ['account','scope','sort'].forEach(id => $(id).addEventListener('change', () => { focusKey = ''; renderRows(); }));
  $('types').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { type = button.dataset.type; focusKey = ''; renderRows(); }));
  $('resetFilters').addEventListener('click',resetFilters); $('emptyReset').addEventListener('click',resetFilters);
})();
