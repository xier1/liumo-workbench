const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/workspace/index.html', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }

function freshDom() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
    beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} }); w.HTMLCanvasElement.prototype.toDataURL = () => 'data:'; w.Image = class { constructor() { this.onload = null; this.onerror = null; this.width = 2000; this.height = 1000; this._src = ''; } set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); } get src() { return this._src; } }; w.fetch = () => Promise.reject(new Error('no')); w.confirm = () => true; } });
  return dom;
}
const R = (w, e) => w.eval(e);

// 旧格式结算数据: 2026-08 结算到 2026-08-15, 没有 ts
const settledRaw = JSON.stringify({ '2026-08': { date: '2026-08-15' } });
// 一条已结算区间内的老记录 + 一条“昨天”(2026-08-16, 晚于截止日) 的记录
const logsRaw = JSON.stringify([
  { id: 'a', date: '2026-08-10', amount: 100, note: '', createdAt: 1000, updatedAt: 1000 },
  { id: 'y', date: '2026-08-16', amount: 29, note: '', createdAt: 2000, updatedAt: 2000 }
]);

console.log('=== 旧格式结算: ts 必须由截止日推导(确定性), 且与加载时间无关 ===');
const dom = freshDom();
const w = dom.window;
w.localStorage.setItem('liumo_scrap_logs', logsRaw);
w.localStorage.setItem('liumo_scrap_settled', settledRaw);
R(w, 'loadScrap();');
const ts1 = R(w, 'scrapSettled["2026-08"].ts');
const expectedTs = R(w, 'tsForCutoffStart("2026-08-15")');
check('ts 由截止日推导(=截止日结束时刻)', ts1 === expectedTs, 'ts=' + ts1 + ' expected=' + expectedTs);
check('ts 不是加载时刻(应远小于 Date.now())', ts1 < Date.now() - 1000, 'ts=' + ts1 + ' now=' + Date.now());

// 昨天(截止日之后)的记录 → 未结算
let p = JSON.parse(R(w, 'JSON.stringify(scrapMonthSettledParts("2026-08"))'));
check('昨天记录(29)算未结算', p.unsettledTotal === 29 && p.unsettledCount === 1, JSON.stringify(p));
// 截止日之前的老记录 → 已结算
check('截止日之前的记录(100)算已结算', p.settledTotal === 100 && p.settledCount === 1, JSON.stringify(p));

console.log('=== 模拟“刷新/重新打开页面”: 再次 loadScrap, ts 必须稳定不漂移 ===');
// 模拟真实刷新: 复用磁盘数据重新 load
const diskSettled = w.localStorage.getItem('liumo_scrap_settled');
const diskLogs = w.localStorage.getItem('liumo_scrap_logs');
const dom2 = freshDom();
const w2 = dom2.window;
w2.localStorage.setItem('liumo_scrap_logs', diskLogs);
w2.localStorage.setItem('liumo_scrap_settled', diskSettled);
R(w2, 'loadScrap();');
const ts2 = R(w2, 'scrapSettled["2026-08"].ts');
check('刷新后 ts 与原值一致(未漂移)', ts2 === ts1, 'ts2=' + ts2 + ' ts1=' + ts1);
const p2 = JSON.parse(R(w2, 'JSON.stringify(scrapMonthSettledParts("2026-08"))'));
check('刷新后昨天记录仍算未结算(29)', p2.unsettledTotal === 29, JSON.stringify(p2));
check('刷新后截止日前记录仍算已结算(100)', p2.settledTotal === 100, JSON.stringify(p2));

console.log('=== 旧 bug: 若 ts 随加载漂移(=Date.now), 刷新后会被误判为已结算 ===');
// 复现修复前的行为以证明该路径已不存在
const dom3 = freshDom();
const w3 = dom3.window;
w3.localStorage.setItem('liumo_scrap_logs', logsRaw);
w3.localStorage.setItem('liumo_scrap_settled', settledRaw);
R(w3, 'loadScrap();');
check('修复后: 再次 load 不会把 ts 写成 Date.now()', R(w3, 'scrapSettled["2026-08"].ts') !== R(w3, 'Date.now()'));

console.log('\n=== 结果: ' + pass + ' 通过, ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);
