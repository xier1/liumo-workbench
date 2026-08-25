const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/workspace/index.html', 'utf8');

function run(label, setup) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,FAKE';
      w.Image = class { constructor() { this.onload = null; this.onerror = null; this.width = 2000; this.height = 1000; this._src = ''; } set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); } get src() { return this._src; } };
      w.fetch = () => Promise.reject(new Error('no'));
      w.confirm = () => true;
    }
  });
  const { window } = dom;
  const R = (expr) => window.eval(expr);
  setup(window, R);
  // 触发一次完整渲染
  R('currentModule="scrap"; renderContent();');
  const parts = R('JSON.stringify(scrapMonthSettledParts("2026-08"))');
  console.log('[' + label + '] parts(2026-08) = ' + parts);
  return JSON.parse(parts);
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }

// 场景1：旧格式结算数据(无 ts)，本次加载后新增昨天的记录
console.log('\n=== 场景1: 旧格式结算 + 加载后新增昨天记录 ===');
const m1 = run('旧格式', (w, R) => {
  // 模拟用户此前用旧代码结算(无 ts)
  w.localStorage.setItem('liumo_scrap_logs', JSON.stringify([
    { id: 'a', date: '2026-08-05', amount: 100, note: '', createdAt: 1000, updatedAt: 1000 }
  ]));
  w.localStorage.setItem('liumo_scrap_settled', JSON.stringify({ '2026-08': { date: '2026-08-15' } }));
  R('loadScrap();');
  // 模拟“新增昨天的29”（createdAt 晚于本次加载）
  R('scrapLogs.push({id:"b",date:"2026-08-16",amount:29,note:"",createdAt:Date.now()+5000,updatedAt:Date.now()+5000}); saveScrapLogs();');
});
check('昨天记录算未结算(未结算金额=29)', m1.unsettledTotal === 29);

// 场景2：旧格式结算数据，跨会话(刷新后 ts 被重置为更晚的加载时刻)再新增
console.log('\n=== 场景2: 旧格式结算 + 模拟“刷新后”再新增(暴露迁移重置 ts 的隐患) ===');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
  beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} }); w.HTMLCanvasElement.prototype.toDataURL = () => 'data:'; w.fetch = () => Promise.reject(new Error('no')); w.confirm = () => true; } });
const { window } = dom; const R = (e) => window.eval(e);
const settledRaw = JSON.stringify({ '2026-08': { date: '2026-08-15' } });
const logsRaw = JSON.stringify([{ id: 'a', date: '2026-08-05', amount: 100, note: '', createdAt: 1000, updatedAt: 1000 }]);
// 会话A：加载(迁移把 ts 重置为 T_load_A)，然后用户“新增昨天记录”
window.localStorage.setItem('liumo_scrap_logs', logsRaw);
window.localStorage.setItem('liumo_scrap_settled', settledRaw);
R('loadScrap();');
R('scrapLogs.push({id:"b",date:"2026-08-16",amount:29,note:"",createdAt:Date.now()+5000,updatedAt:Date.now()+5000}); saveScrapLogs();');
const tsA = R('scrapSettled["2026-08"].ts');
console.log('  会话A结算快照 ts =', tsA);
// 关键：把“迁移后的 ts”持久化回去（模拟任何一次后续 saveScrapSettled，或浏览器实际上会把内存对象写回）
// —— 实际上迁移不写盘，但用户若重新结算/操作会写。这里直接检查：若 ts 来自迁移且晚于真实结算，
// 则“结算前已存在、但结算后才被加载”的记录会被误判。我们用 createdAt 较小的“老记录”测试。
R('scrapSettled["2026-08"] = {date:"2026-08-15", ts: Date.now()}; saveScrapSettled();');
// 会话B：新记录 createdAt 仍晚于 ts(刚写入)
R('scrapLogs.push({id:"c",date:"2026-08-10",amount:15,note:"",createdAt:Date.now()+5000,updatedAt:Date.now()+5000}); saveScrapLogs(); currentModule="scrap"; renderContent();');
const p2 = JSON.parse(R('JSON.stringify(scrapMonthSettledParts("2026-08"))'));
console.log('  会话A/B后 parts =', JSON.stringify(p2));
check('新增记录仍算未结算', p2.unsettledTotal >= 29);

console.log('\n=== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);
