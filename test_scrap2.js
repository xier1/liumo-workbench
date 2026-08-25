const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/workspace/index.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

function $(sel) { return window.document.querySelector(sel); }
function $all(sel) { return Array.from(window.document.querySelectorAll(sel)); }
function fire(el, type) {
  const ev = new window.Event(type, { bubbles: true });
  el.dispatchEvent(ev);
}
function setVal(el, v) { el.value = v; fire(el, 'input'); fire(el, 'change'); }

// 初始化：进入 scrap 模块
window.eval("currentModule='scrap'; renderContent();");

// 清空旧数据，造测试数据
window.eval("scrapLogs=[]; scrapSettled={}; saveScrapLogs(); saveScrapSettled();");
// 2026-08 两笔 + 2026-07 一笔（用于曲线图）
window.eval(`
scrapLogs = [
  { id: uid(), date: '2026-08-03', amount: 120, note: '纸箱', createdAt: Date.now(), updatedAt: Date.now() },
  { id: uid(), date: '2026-08-15', amount: 80, note: '塑料', createdAt: Date.now(), updatedAt: Date.now() },
  { id: uid(), date: '2026-07-20', amount: 200, note: '旧', createdAt: Date.now(), updatedAt: Date.now() },
];
scrapLogs.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
saveScrapLogs();
`);
// 把“今天”钉在 2026-08，使本月=2026-08
window.eval(`
const _now = new Date(2026, 7, 20);
const _orig = Date;
Date = class extends _orig { constructor(...a){ if(a.length===0) return new _orig(2026,7,20); return new _orig(...a); } static now(){ return new _orig(2026,7,20).getTime(); } };
`);

window.eval("currentModule='scrap'; renderContent();");

// 1) 统计卡片只保留两张
const statCards = $all('#scStats .stat-card');
check('统计卡片恰好 2 张', statCards.length === 2);
const labels = statCards.map(c => c.querySelector('.stat-label').textContent.trim());
check('含「本月金额」', labels.includes('本月金额'));
check('含「未结算金额」', labels.includes('未结算金额'));
check('不再含「近一年总金额」', !labels.includes('近一年总金额'));
check('不再含「已结算金额」', !labels.includes('已结算金额'));

// 2) 本月金额 = 120 + 80 = 200
const curCard = statCards.find(c => c.querySelector('.stat-label').textContent.includes('本月金额'));
check('本月金额 = 200 元', curCard.textContent.includes('200'));

// 3) 未结算金额：8月未结算，7月未结算 => 全部未结算 400
const unCard = statCards.find(c => c.querySelector('.stat-label').textContent.includes('未结算金额'));
check('未结算金额 = 400 元', unCard.textContent.includes('400'));

// 4) 曲线图生成 SVG + 折线点
const svg = $('#scChart svg');
check('曲线图生成了 svg', !!svg);
const poly = $('#scChart polyline');
check('曲线图含 polyline', !!poly);
const dots = $all('#scChart circle');
check('曲线图含数据点(>=12 或含数据月)', dots.length >= 1);

// 5) 结算 7 月后，未结算金额应减少为当月(8月)200
window.eval(`
scrapSettled['2026-07'] = { date: '2026-07-31' };
saveScrapSettled();
currentModule='scrap'; renderContent();
`);
const unCard2 = $all('#scStats .stat-card').find(c => c.querySelector('.stat-label').textContent.includes('未结算金额'));
check('结算 7 月后未结算金额 = 200 元', unCard2.textContent.includes('200'));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
