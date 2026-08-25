const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/workspace/index.html', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }

function freshDom(seed) {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:';
      w.Image = class { constructor() { this.onload = null; this.onerror = null; this.width = 2000; this.height = 1000; this._src = ''; } set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); } get src() { return this._src; } };
      w.fetch = () => Promise.reject(new Error('no')); w.confirm = () => true;
      if (seed) { for (const k in seed) w.localStorage.setItem(k, seed[k]); }
    } });
  return dom;
}
const R = (w, e) => w.eval(e);
const M = '2026-08';

console.log('=== 场景A: 结算当月(默认截止日=今天 2026-08-18)后, 新增“昨天 08-17 的 29” ===');
{
  const dom = freshDom({ liumo_scrap_logs: '[]', liumo_scrap_settled: '{}' });
  const w = dom.window;
  R(w, 'currentModule="scrap"; renderContent();');
  // 先登记一笔(08-15, 100), 否则月度表不渲染结算按钮
  w.document.getElementById('scrapDate').value = '2026-08-15';
  w.document.getElementById('scrapAmount').value = '100';
  w.document.getElementById('scrapAddBtn').click();
  R(w, 'currentModule="scrap"; renderContent();');
  // 点结算
  w.document.querySelector('[data-action="sc-settle"][data-month="' + M + '"]').click();
  const defVal = w.document.querySelector('.sc-settle-date[data-month="' + M + '"]').value;
  console.log('  默认截止日 =', defVal);
  w.document.querySelector('[data-action="sc-settle-confirm"][data-month="' + M + '"]').click();
  const settled = JSON.parse(R(w, 'JSON.stringify(scrapSettled["' + M + '"])'));
  console.log('  结算结果 =', JSON.stringify(settled));
  // 新增昨天(08-17)的 29
  w.document.getElementById('scrapDate').value = '2026-08-17';
  w.document.getElementById('scrapAmount').value = '29';
  w.document.getElementById('scrapAddBtn').click();
  const p = JSON.parse(R(w, 'JSON.stringify(scrapMonthSettledParts("' + M + '"))'));
  console.log('  结算拆分 =', JSON.stringify(p));
  check('结算前老记录(100)算已结算', p.settledTotal === 100 && p.settledCount === 1, JSON.stringify(p));
  check('昨天(截止日之前)新增的记录算未结算(29)', p.unsettledTotal === 29 && p.unsettledCount === 1, JSON.stringify(p));
  check('该月仍标记为已结算', p.isSettled === true);
}

console.log('\n=== 场景B: 旧格式数据(无 ts)加载后, 新增“昨天 08-17 的 29” ===');
{
  const dom = freshDom({
    liumo_scrap_logs: JSON.stringify([{ id: 'a', date: '2026-08-15', amount: 100, note: '', createdAt: 1000, updatedAt: 1000 }]),
    liumo_scrap_settled: JSON.stringify({ '2026-08': { date: '2026-08-18' } }) // 当前月默认截止日=今天, 无 ts
  });
  const w = dom.window;
  R(w, 'loadScrap();');
  const ts = R(w, 'scrapSettled["2026-08"].ts');
  console.log('  迁移后 ts =', ts, '(应=2026-08-18 00:00:00 =', R(w, 'tsForCutoffStart("2026-08-18")') + ')');
  check('ts 由截止日当天00:00推导', ts === R(w, 'tsForCutoffStart("2026-08-18")'));
  check('ts 不是加载时刻', ts < R(w, 'Date.now()') - 1000);
  // 新增昨天(08-17)的 29
  R(w, 'scrapLogs.push({id:"y",date:"2026-08-17",amount:29,note:"",createdAt:Date.now(),updatedAt:Date.now()}); saveScrapLogs();');
  const p = JSON.parse(R(w, 'JSON.stringify(scrapMonthSettledParts("2026-08"))'));
  console.log('  结算拆分 =', JSON.stringify(p));
  check('昨天新增(29)算未结算', p.unsettledTotal === 29, JSON.stringify(p));
  check('截止日前老记录(100)算已结算', p.settledTotal === 100, JSON.stringify(p));
}

console.log('\n=== 场景C: 刷新后(重载并复用磁盘) ts 不漂移, 昨天记录仍算未结算 ===');
{
  // 场景B 已 saveScrapSettled (迁移固化). 取出磁盘数据, 新开页面复用
  const domB = freshDom({
    liumo_scrap_logs: JSON.stringify([{ id: 'a', date: '2026-08-15', amount: 100, note: '', createdAt: 1000, updatedAt: 1000 }]),
    liumo_scrap_settled: JSON.stringify({ '2026-08': { date: '2026-08-18' } })
  });
  const wB = domB.window; R(wB, 'loadScrap();');
  const diskSettled = wB.localStorage.getItem('liumo_scrap_settled');
  const diskLogs = wB.localStorage.getItem('liumo_scrap_logs');
  const tsB = R(wB, 'scrapSettled["2026-08"].ts');
  // 新页面
  const domC = freshDom({ liumo_scrap_logs: diskLogs, liumo_scrap_settled: diskSettled });
  const wC = domC.window; R(wC, 'loadScrap();');
  const tsC = R(wC, 'scrapSettled["2026-08"].ts');
  check('刷新后 ts 与原值一致(未漂移)', tsC === tsB, 'tsC=' + tsC + ' tsB=' + tsB);
  R(wC, 'scrapLogs.push({id:"y",date:"2026-08-17",amount:29,note:"",createdAt:Date.now(),updatedAt:Date.now()});');
  const p = JSON.parse(R(wC, 'JSON.stringify(scrapMonthSettledParts("2026-08"))'));
  check('刷新后再新增昨天记录仍算未结算(29)', p.unsettledTotal === 29, JSON.stringify(p));
}

console.log('\n=== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);
