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
    cents(data.baseline_total_cents); cents(data.cash_cents);
    if (data.baseline_total_cents <= 0 || data.cash_cents < 0) throw new Error('基准金额无效');
    cents(data.loss.budget_cents); cents(data.loss.loss_cents, true); cents(data.loss.remaining_cents, true);
    if (data.loss.budget_cents <= 0) throw new Error('亏损预算无效');
    const ids = new Set();
    let total = data.cash_cents;
    data.positions.forEach(function (row) {
      if (!Number.isSafeInteger(row.id) || ids.has(row.id)) throw new Error('持仓标识缺失或重复');
      ids.add(row.id); cents(row.amount_cents); cents(row.profit_cents, true);
      if (row.amount_cents < 0 || typeof row.asset_name !== 'string' || typeof row.account !== 'string') throw new Error('持仓字段异常');
      if (![0, 1].includes(row.include_in_research)) throw new Error('监督范围缺失');
      if (row.include_in_research && (!/^[0-9]{5,6}$/.test(row.code) || !['FUND', 'SH', 'SZ', 'HK'].includes(row.market))) throw new Error('研究持仓代码或市场无效');
      total += row.amount_cents;
    });
    if (!Number.isSafeInteger(total) || total !== data.baseline_total_cents) throw new Error('持仓金额加现金与基准总额不一致');
    return data;
  }
  const api = { validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HoldingsModel = api;
})(typeof window === 'undefined' ? globalThis : window);
