(function () {
  'use strict';
  let data = null;
  let generation = 0;
  const $ = id => document.getElementById(id);
  const yuan = value => value == null ? '数据不足' : (value / 100).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const text = (id, value) => { $(id).textContent = value == null ? '' : String(value); };
  function clear() {
    generation++; data = null; $('report').hidden = true; $('fileInput').value = '';
    ['positions', 'priorities', 'issues'].forEach(id => $(id).replaceChildren());
    ['meta','baseline','budget','loss','remaining','lossStatus','riskChange','scenario','dataNote','plan','count'].forEach(id => text(id, ''));
    $('search').value = ''; $('scope').value = ''; $('account').replaceChildren(new Option('全部账户', ''));
    text('message', '已清除本页数据。重新选择私有文件即可查看。');
  }
  function cell(parent, primary, secondary) {
    const td = document.createElement('td');
    const strong = document.createElement('strong'); strong.textContent = primary == null ? '' : String(primary); td.appendChild(strong);
    if (secondary != null) { const small = document.createElement('small'); small.textContent = String(secondary); td.appendChild(small); }
    parent.appendChild(td);
  }
  function renderRows() {
    if (!data) return;
    const search = $('search').value.trim().toLowerCase(); const account = $('account').value; const scope = $('scope').value;
    const rows = data.positions.filter(row => (!search || (row.asset_name + ' ' + (row.code || '')).toLowerCase().includes(search)) &&
      (!account || row.account === account) && (!scope || Boolean(row.include_in_research) === (scope === 'research'))).sort((a, b) => b.amount_cents - a.amount_cents);
    const actions = new Map(data.actions.map(row => [row.market + ':' + row.code, row]));
    $('positions').replaceChildren();
    rows.forEach(row => {
      const tr = document.createElement('tr'); const action = actions.get(row.market + ':' + row.code);
      cell(tr, row.canonical_name || row.asset_name, row.code ? row.market + ' ' + row.code : '代码未核验 · 仅资产核算');
      cell(tr, row.platform || row.account, row.include_in_research ? '参与监督' : '仅核算，不参与研究');
      cell(tr, yuan(row.amount_cents), (row.amount_cents / data.baseline_total_cents * 100).toFixed(2) + '%');
      cell(tr, yuan(row.profit_cents), row.cumulative_profit_cents != null ? '累计收益另计 ' + yuan(row.cumulative_profit_cents) : '截图持仓收益');
      cell(tr, action ? action.direction : '暂不操作（排除研究）', action ? (action.data_date || '行情日期不足') + ' · ' + action.reason : row.exclusion_reason);
      $('positions').appendChild(tr);
    });
    text('count', rows.length + ' / ' + data.positions.length + ' 条'); $('empty').hidden = rows.length !== 0;
  }
  function render() {
    text('meta', '持仓基准 ' + data.snapshot_date + ' · 监督生成 ' + data.generated_at + ' · 状态 ' + data.pipeline.status);
    text('baseline', yuan(data.baseline_total_cents)); text('budget', yuan(data.loss.budget_cents));
    text('loss', yuan(data.loss.loss_cents)); text('remaining', yuan(data.loss.remaining_cents));
    text('lossStatus', data.loss.note); text('riskChange', data.risk_change); text('dataNote', data.data_note); text('plan', data.daily_plan);
    text('scenario', data.scenario ? data.scenario.label + '占' + (data.scenario.weight * 100).toFixed(2) + '%；该组下跌' + data.scenario.assumed_decline_pct + '%的算术情景亏损' + yuan(data.scenario.scenario_loss_cents) + '元。' + data.scenario.note : '');
    $('priorities').replaceChildren();
    data.priority_actions.slice(0, 3).forEach(row => {
      const item = document.createElement('article'); item.className = 'priority';
      const title = document.createElement('strong'); title.textContent = row.code + ' ' + row.name + ' · ' + row.direction;
      const reason = document.createElement('p'); reason.textContent = row.reason;
      const basis = document.createElement('small'); basis.textContent = '依据：' + (row.basis || '数据不足');
      item.append(title, reason, basis); $('priorities').appendChild(item);
    });
    if (!data.priority_actions.length) text('priorities', '暂无足够交易证据，暂不操作。');
    $('account').replaceChildren(new Option('全部账户', ''));
    [...new Set(data.positions.map(row => row.account))].forEach(account => $('account').appendChild(new Option(account, account)));
    $('issues').replaceChildren();
    const issues = data.pipeline.errors || [];
    (issues.length ? issues : [{detail: '本次未发现明显抓取异常；仍需人工确认持仓与交易条件。'}]).forEach(row => {
      const li = document.createElement('li'); li.textContent = [row.stage, row.product, row.detail || row.note || row.status].filter(Boolean).join(' · '); $('issues').appendChild(li);
    });
    $('search').value = ''; $('scope').value = ''; $('report').hidden = false; renderRows();
  }
  $('fileInput').addEventListener('change', async function () {
    const file = this.files[0]; if (!file) return;
    clear(); const token = generation;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('文件超过5MB，请检查是否选错文件');
      const parsed = JSON.parse(await file.text());
      if (token !== generation) return;
      data = HoldingsModel.validate(parsed); render(); text('message', '已导入，仅本页可见。刷新或关闭后清除；未上传文件。');
    } catch (error) {
      if (token !== generation) return;
      clear(); text('message', '导入失败：' + error.message + '。未沿用之前的数据。');
    }
  });
  $('clear').addEventListener('click', clear);
  $('search').addEventListener('input', renderRows); $('account').addEventListener('change', renderRows); $('scope').addEventListener('change', renderRows);
})();
