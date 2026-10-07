/* Source evidence and observed quota history. No preset fee amounts. */
function evidenceEscape(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function evidenceLink(url,label){ return '<a href="'+evidenceEscape(url)+'" target="_blank" rel="noopener noreferrer">'+evidenceEscape(label)+'</a>'; }
function quotaClassState(c){
  if(c.unknown) return '待核验';
  if(/暂停|封闭|认购/.test(c.state||'')) return c.state;
  if(c.max>0) return fmtAmt(c.max);
  return c.unlimited ? '不限额' : '待核验';
}
function updateActualNav(code,series){
  var f=funds.filter(function(x){return x.code===code;})[0];
  var row=series.nav[series.nav.length-1];
  if(!f || !row || (f.navDate && row.d<f.navDate)) return;
  f.actualPct=Number.isFinite(row.pct)?row.pct:null; f.actualDate=row.d;
  if(Number.isFinite(row.nav)){ f.nav=row.nav; f.navDate=row.d; }
}
function actualNavHtml(f){
  var valid=Number.isFinite(f.actualPct) && f.actualDate===f.navDate;
  return '<div class="est-line actual-nav"><span class="est-small '+cls(valid?f.actualPct:null)+'">'+fmtPct(valid?f.actualPct:null)+'</span><span class="est-tag">净值日涨跌</span></div><div class="actual-date">'+evidenceEscape(valid?f.actualDate:'实际涨跌待更新')+'</div>';
}
function fundEvidenceHtml(f){
  var pending=limitNotices.unverified[f.code], notice=pending||limitNotices.limits[f.code];
  var html='<section class="fund-evidence"><h3>申购资料与份额</h3>';
  if(fundHist[f.code] && fundHist[f.code].source) html+='<p>净值来源：'+evidenceEscape(fundHist[f.code].source)+'，较长区间可能缺失。</p>';
  if(notice){
    var safe=/^https:\/\/pdf\.dfcfw\.com\//.test(notice.url||'');
    html+='<p>'+ (safe?evidenceLink(notice.url,notice.title||'查看申购公告'):evidenceEscape(notice.title||'申购公告'))+'</p><p>发布 '+evidenceEscape(notice.date||'未提供')+' · 生效 '+evidenceEscape(notice.effectiveDate||'需核对原文')+' · '+(pending?'最新公告待核验':'公告金额已核实')+'</p>';
    html+='<p>适用份额 '+evidenceEscape((notice.classes||[]).join(' / ')||'需核对原文')+' · '+evidenceEscape(notice.scope||'合并 / 分别计算口径待核验')+' · 快照检查 '+evidenceEscape(limitNotices.checkedAt||'未提供')+'</p>';
  } else html+='<p>暂无已核实公告；接口核对时间 '+evidenceEscape(f.limitTs?new Date(f.limitTs).toLocaleString('zh-CN'):'未成功获取')+'</p>';
  if(f.limitFetchError) html+='<p class="pending">接口更新失败，沿用上次信息。</p>';
  var rows=(f.limitClasses||[]).map(function(c){return Object.assign({currency:'人民币'},c);}).concat(f.extraShares||[]);
  html+='<div class="share-scroll"><table class="hold"><tr><th>份额 / 币种</th><th>代码</th><th>渠道</th><th>单日上限</th><th>费用资料</th></tr>';
  html+=rows.map(function(c){
    return '<tr><td>'+evidenceEscape((c.cls||'—')+' / '+c.currency)+'</td><td>'+evidenceEscape(c.code)+'</td><td>'+evidenceEscape(c.directOnly?'渠道未售 / 直销需核实':c.chan||'接口销售渠道')+'</td><td>'+evidenceEscape(pending?'最新公告待核验':quotaClassState(c))+'</td><td>'+evidenceLink('https://fundf10.eastmoney.com/jjfl_'+encodeURIComponent(c.code)+'.html','查看费率')+'</td></tr>';
  }).join('');
  html+='</table></div><p>费用入口包含申购、管理、托管与销售服务费；实际申购折扣以销售渠道为准。'+evidenceEscape(f.sharesMessage||'')+'</p>';
  if(f.direct && f.direct.max>0) html+='<p>已记录直销上限 '+evidenceEscape(fmtAmt(f.direct.max))+'；渠道与生效日期需核对公告。</p>';
  return html+'</section>';
}
function ensureShareDetails(f){
  if(f.sharesLoading || (f.sharesTs && Date.now()-f.sharesTs<86400000)) return;
  f.sharesLoading=true; f.sharesMessage='正在查找其他份额…';
  var key=shareClassKey(f.name).key.split('|')[0];
  searchFunds(key).then(function(list){
    var existing={}; (f.limitClasses||[]).forEach(function(c){existing[c.code]=true;});
    var seen={}; var extra=list.filter(function(x){return shareClassKey(x.name).key.split('|')[0]===key && !existing[x.code] && !seen[x.code] && (seen[x.code]=true);});
    return Promise.all(extra.map(function(x){
      var currency=(x.name.match(/美元现汇|美元现钞|美元|港币/)||['人民币'])[0];
      var row={code:x.code,cls:shareClassKey(x.name).cls||'—',currency:currency,unknown:true};
      return fetchLimit(x.code).then(function(r){ row.state=r.state;row.max=r.max;row.unlimited=r.unlimited;row.unknown=r.unknown||!r.buy;row.directOnly=!r.buy;return row; }).catch(function(){return row;});
    }));
  }).then(function(rows){f.extraShares=rows;f.sharesTs=Date.now();f.sharesMessage=rows.length?'其他份额按接口核对，币种金额分别显示。':'本次查询未找到其他份额。';})
    .catch(function(){f.sharesMessage='其他份额查询失败，可稍后重新展开重试。';})
    .finally(function(){f.sharesLoading=false;saveFunds();renderHome();if(curView==='mkt')renderPersonalHoldings();});
}
function quotaObservation(f){
  if(f.limitNoticePending || !f.limitSource) return null;
  var classes=(f.limitClasses||[]).filter(function(c){return quotaClassState(c)!=='待核验';});
  if(!classes.length) return null;
  return {name:f.name,scope:f.scopeSrc==='notice'?f.scope:'口径待核验',source:f.limitSource,date:f.limitDate||'',url:/^https:\/\/pdf\.dfcfw\.com\//.test(f.limitUrl||'')?f.limitUrl:'',classes:classes.map(function(c){return {code:c.code,cls:c.cls,text:quotaClassState(c),channel:c.directOnly?'渠道待核验':c.chan||'接口销售渠道'};}).sort(function(a,b){return a.code.localeCompare(b.code);})};
}
function observationSignature(o){return JSON.stringify({scope:o.scope,classes:o.classes});}
function observationText(o){return o.classes.map(function(c){return c.cls+' '+c.text;}).join(' · ')+'（'+o.scope+'）';}
function verifiedQuotaTotal(list){
  var total=0,count=0;
  list.forEach(function(f){
    if(f.limitNoticePending || f.scopeSrc!=='notice' || !/各份额合并计算|各份额分开计算/.test(f.scope||''))return;
    var cs=f.limitClasses||[];
    if(!cs.length || cs.some(function(c){return c.unknown || c.directOnly || c.unlimited || quotaClassState(c)==='待核验';}))return;
    var amounts=cs.filter(function(c){return !/暂停|封闭|认购/.test(c.state||'');}).map(function(c){return c.max;});
    if(!amounts.length)return;
    total+=f.scope==='各份额合并计算'?Math.max.apply(null,amounts):amounts.reduce(function(a,b){return a+b;},0);count++;
  });
  return {total:total,count:count};
}
var quotaEvidenceReady=false;
function recordQuotaHistory(list){
  if(!quotaEvidenceReady)return;
  var history=lsGet('qdp3_quota_history_v1',{last:{},events:[],days:{}}), now=Date.now();
  var day=new Date(now+8*3600000).toISOString().slice(0,10);
  list.forEach(function(f){
    var next=quotaObservation(f); if(!next) return;
    var prev=history.last[f.code];
    // A disappearing/unknown class is not evidence of a quota reduction.
    if(prev){if(next.scope==='口径待核验')next.scope=prev.scope;var known={};next.classes.forEach(function(c){known[c.code]=true;});prev.classes.forEach(function(c){if(!known[c.code])next.classes.push(c);});next.classes.sort(function(a,b){return a.code.localeCompare(b.code);});}
    if(prev && observationSignature(prev)!==observationSignature(next)) history.events.push({code:f.code,name:f.name,at:now,before:observationText(prev),after:observationText(next),url:next.url,source:next.source,date:next.date});
    history.last[f.code]=next;
  });
  history.days[day]=JSON.parse(JSON.stringify(history.last));
  Object.keys(history.days).sort().slice(0,-60).forEach(function(k){delete history.days[k];});
  history.events=history.events.filter(function(e){return now-e.at<60*86400000;}).slice(-500);
  lsSet('qdp3_quota_history_v1',history);
}
function renderQuotaHistory(){
  var list=document.getElementById('quotaList');if(!list)return;
  var panel=document.getElementById('quotaHistory');if(!panel){panel=document.createElement('section');panel.id='quotaHistory';list.parentNode.appendChild(panel);}
  var history=lsGet('qdp3_quota_history_v1',{events:[],days:{}});
  var total=verifiedQuotaTotal(funds);
  panel.innerHTML='<h3>已核实人民币上限合计</h3><p>'+ (total.count?evidenceEscape(fmtAmt(total.total))+' · '+total.count+' 只基金':'暂无满足完整统计条件的基金')+'。仅统计公告已核实计算口径、全部人民币份额上限明确且无渠道疑问的基金；排除待核验、不限额与直销专供，不代表全市场额度或剩余额度。外币份额单列，不换算相加。</p><h3>限额变化记录</h3><p>本浏览器已记录 '+Object.keys(history.days).length+' 天；保留最近 60 个观察日快照与 60 天变化。首次读取只建立基线，未访问期间不会补记。</p>'+(!history.events.length?'<p>尚未观察到已核实限额的变化。</p>':'<details><summary>查看 '+history.events.length+' 条变化</summary>'+history.events.slice().reverse().map(function(e){return '<article><strong>'+evidenceEscape(e.name)+'</strong><p>'+evidenceEscape(e.before)+' → '+evidenceEscape(e.after)+'</p><small>发现 '+evidenceEscape(new Date(e.at).toLocaleString('zh-CN'))+' · 来源 '+evidenceEscape(e.source==='notice'?'公告':'接口')+' · '+evidenceEscape(e.date)+'</small>'+(e.url?evidenceLink(e.url,'公告原文'):'')+'</article>';}).join('')+'</details>');
}
function parseBackupHistory(payload){
  if(!payload || payload.Success===false || !Array.isArray(payload.Datas))throw new Error('备用净值格式异常');
  var nav=payload.Datas.map(function(x){return {d:x.FSRQ,nav:parseFloat(x.DWJZ),cum:parseFloat(x.LJJZ),pct:parseFloat(x.JZZZL)};}).filter(function(x){return /^\d{4}-\d{2}-\d{2}$/.test(x.d) && Number.isFinite(x.nav) && x.nav>0 && Number.isFinite(x.cum) && x.cum>0;}).sort(function(a,b){return a.d.localeCompare(b.d);});
  if(nav.length<2)throw new Error('备用净值不足');
  // Keep the same cumulative-NAV return definition as the primary source.
  var period=fundPeriods(nav.map(function(x){return {t:Date.parse(x.d+'T00:00:00+08:00'),v:x.cum};}));
  period.LN=null; // A truncated history cannot prove the inception return.
  return {nav:nav,period:period,date:nav[nav.length-1].d,ts:Date.now(),source:'备用净值接口（最多1200条）'};
}
var backupHistoryJobs={};
function loadBackupHistory(code){
  if(backupHistoryJobs[code])return backupHistoryJobs[code];
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
  backupHistoryJobs[code]=fetch('https://fundmobapi.eastmoney.com/FundMNewApi/FundMNHisNetList?FCODE='+encodeURIComponent(code)+'&pageIndex=1&pageSize=1200&deviceid=Wap&plat=Wap&product=EFund&version=6.5.5',{signal:controller.signal,credentials:'omit'})
    .then(function(r){if(!r.ok)throw new Error('备用净值请求失败');return r.json();}).then(parseBackupHistory)
    .then(function(r){fundSeriesCache[code]=r;updateActualNav(code,r);return r;})
    .finally(function(){clearTimeout(timer);delete backupHistoryJobs[code];});
  return backupHistoryJobs[code];
}
