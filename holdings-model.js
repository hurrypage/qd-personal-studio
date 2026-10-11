(function (root) {
  'use strict';
  function cents(value, nullable) {
    if (nullable && value === null) return value;
    if (!Number.isSafeInteger(value)) throw new Error('金额必须是整数分，不能缺失或包含非有限值');
    return value;
  }
  function validate(data) {
    if (!data || data.format !== 'qd-private-holdings' || data.version !== 1) throw new Error('文件不是支持的每日监督格式');
    if (!Array.isArray(data.positions) || !data.positions.length || data.positions.length > 1000) throw new Error('持仓列表缺失或超出范围');
    if (!Array.isArray(data.actions) || !Array.isArray(data.priority_actions) || !data.loss || !data.pipeline) throw new Error('风险或建议字段缺失');
    if (data.actions.length > 1000 || data.priority_actions.length > 1000 ||
      (data.pipeline.errors != null && (!Array.isArray(data.pipeline.errors) || data.pipeline.errors.length > 1000))) throw new Error('建议或异常列表格式不正确');
    [...data.actions, ...data.priority_actions].forEach(function (row) {
      if (!row || typeof row.name !== 'string' || typeof row.direction !== 'string' || typeof row.reason !== 'string' ||
        !/^[0-9]{5,6}$/.test(row.code) || !['FUND','SH','SZ','HK'].includes(row.market)) throw new Error('建议身份或说明字段异常');
    });
    cents(data.baseline_total_cents); cents(data.cash_cents);
    if (data.baseline_total_cents <= 0 || data.cash_cents < 0) throw new Error('基准金额无效');
    cents(data.loss.budget_cents); cents(data.loss.loss_cents, true); cents(data.loss.remaining_cents, true);
    if (data.loss.budget_cents <= 0) throw new Error('亏损预算无效');
    const ids = new Set();
    let total = data.cash_cents;
    data.positions.forEach(function (row) {
      if (!Number.isSafeInteger(row.id) || ids.has(row.id)) throw new Error('持仓标识缺失或重复');
      ids.add(row.id); cents(row.amount_cents); cents(row.profit_cents, true);
      if (row.cumulative_profit_cents != null) cents(row.cumulative_profit_cents);
      if (row.amount_cents < 0 || typeof row.asset_name !== 'string' || typeof row.account !== 'string') throw new Error('持仓字段异常');
      if (![0, 1].includes(row.include_in_research)) throw new Error('监督范围缺失');
      if (row.include_in_research && (!/^[0-9]{5,6}$/.test(row.code) || !['FUND', 'SH', 'SZ', 'HK'].includes(row.market))) throw new Error('研究持仓代码或市场无效');
      total += row.amount_cents;
    });
    if (!Number.isSafeInteger(total) || total !== data.baseline_total_cents) throw new Error('持仓金额加现金与基准总额不一致');
    if (data.scenario && (!Number.isFinite(data.scenario.weight) || data.scenario.weight < 0 || data.scenario.weight > 1 ||
      !Number.isFinite(data.scenario.assumed_decline_pct) || data.scenario.assumed_decline_pct < 0 || data.scenario.assumed_decline_pct > 100)) throw new Error('压力情景比例无效');
    if (data.scenario) cents(data.scenario.scenario_loss_cents);
    return data;
  }
  function category(row) {
    if (row.code === '002611' && row.market === 'FUND') return 'gold';
    if (!row.include_in_research) return 'other';
    if (row.asset_type === 'exchange_traded_fund') return 'etf';
    if (row.market === 'FUND') return 'fund';
    return 'stock';
  }
  function selectRows(data, filters) {
    const query = (filters.search || '').trim().toLocaleLowerCase();
    const rows = data.positions.filter(function (row) {
      const haystack = [row.asset_name, row.canonical_name, row.code, row.account, row.platform].join(' ').toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (!filters.account || row.account === filters.account) &&
        (!filters.scope || Boolean(row.include_in_research) === (filters.scope === 'research')) &&
        (!filters.type || category(row) === filters.type) && (!filters.key || row.market + ':' + row.code === filters.key);
    });
    return rows.sort(function (a, b) {
      const sort = filters.sort || 'amount-desc';
      if (sort === 'name') return (a.canonical_name || a.asset_name).localeCompare(b.canonical_name || b.asset_name, 'zh-CN') || a.id - b.id;
      const field = sort.startsWith('profit') ? 'profit_cents' : 'amount_cents';
      if (a[field] == null && b[field] == null) return a.id - b.id;
      if (a[field] == null) return 1;
      if (b[field] == null) return -1;
      return (sort.endsWith('asc') ? a[field] - b[field] : b[field] - a[field]) || a.id - b.id;
    });
  }
  function accounts(data) {
    const groups = new Map();
    data.positions.forEach(function (row) {
      if (!groups.has(row.account)) groups.set(row.account, {account:row.account, label:row.platform || row.account, amount_cents:0, count:0});
      const group = groups.get(row.account); group.amount_cents += row.amount_cents; group.count++;
    });
    return [...groups.values()].sort((a, b) => b.amount_cents - a.amount_cents);
  }
  const api = { validate: validate, category: category, selectRows: selectRows, accounts: accounts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HoldingsModel = api;
})(typeof window === 'undefined' ? globalThis : window);
