const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/workspace/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

let pass = 0, fail = 0;
function check(n, c) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n); } }
function $(s) { return window.document.querySelector(s); }
function $all(s) { return Array.from(window.document.querySelectorAll(s)); }
function fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); }
function setVal(el, v) { el.value = v; fire(el, 'input'); fire(el, 'change'); }

// 初始化：清空销售数据
window.eval("salesLogs=[]; saveSalesLogs(); currentModule='sales'; renderContent();");

function addSales(month, retail, daily, orders, ticket, note) {
  setVal($('#saMonth'), month);
  setVal($('#saRetail'), retail);
  setVal($('#saDailySales'), daily);
  setVal($('#saDailyOrders'), orders);
  setVal($('#saAvgTicket'), ticket);
  if (note !== undefined) setVal($('#saNote'), note);
  $('#saAddBtn').click();
}

// 1) 基本结构
check('渲染出统计卡片区', !!$('#saStats'));
check('渲染出录入表单', !!$('#saMonth') && !!$('#saRetail') && !!$('#saDailySales') && !!$('#saDailyOrders') && !!$('#saAvgTicket') && !!$('#saAddBtn'));
check('渲染出趋势图容器', !!$('#saCharts'));
check('渲染出一致性分析区', !!$('#saAnalysisTable') && !!$('#saAnalysisSummary'));
check('空列表提示', $('#saList').textContent.includes('暂无记录'));
check('空分析提示', $('#saAnalysisTable').textContent.includes('暂无数据'));

// 2) 添加一条自洽记录 (2026-01 共31天)
//    零售 310000 = 日均10000 × 31天 ; 日均客单价 = 10000 ÷ 320 = 31.25
addSales('2026-01', 310000, 10000, 320, 31.25, '元旦');
check('添加后出现 1 条记录', window.eval("salesLogs.length") === 1);
check('列表显示零售额', $('#saList').textContent.includes('310,000'));
check('已持久化到 localStorage', !!window.localStorage.getItem('liumo_sales_logs'));

// 3) 一致性分析：该记录应判定为“一致”
let a1 = window.eval("analyzeSales(salesLogs.find(l=>l.date==='2026-01'))");
check('推算客单价=31.25', Math.abs(a1.impliedTicket - 31.25) < 1e-6);
check('推算天数=31(与实际一致)', a1.impliedDays === 31 && a1.actualDays === 31);
check('status=一致', a1.status === '一致' && a1.statusClass === 'ok');

// 4) 添加一条“客单价偏差”记录
//    日均10000, 客单量200 → 推算客单价=50, 但录入100 → 偏差100% → 应提示
addSales('2026-02', 280000, 10000, 200, 100);
let a2 = window.eval("analyzeSales(salesLogs.find(l=>l.date==='2026-02'))");
check('客单价偏差: 推算=50 ≠ 录入100', Math.abs(a2.impliedTicket - 50) < 1e-6 && a2.ticketFlag === true);
check('零售÷日均=28天, 2月实际28天 → 天数一致', Math.abs(a2.impliedDays - 28) < 1e-6 && a2.daysFlag === false);
check('status=客单价偏差', a2.status === '客单价偏差');

// 5) 添加一条“天数异常”记录
//    零售 600000, 日均 10000 → 推算 60天, 远超当月 → 天数异常
addSales('2026-03', 600000, 10000, 300, 33.33);
let a3 = window.eval("analyzeSales(salesLogs.find(l=>l.date==='2026-03'))");
check('天数异常: 推算60天≠31天', a3.impliedDays === 60 && a3.daysFlag === true);
check('status=天数异常', a3.status === '天数异常');

// 6) 分析表与汇总 pills
check('分析表含“客单价偏差”字样', $('#saAnalysisTable').textContent.includes('客单价偏差'));
check('分析表含“天数异常”字样', $('#saAnalysisTable').textContent.includes('天数异常'));
check('汇总: 2 条需核对', $('#saAnalysisSummary').textContent.includes('2 条需核对'));
check('汇总: 1 条自洽', $('#saAnalysisSummary').textContent.includes('1 条自洽'));

// 7) “按工作日口径”识别 (零售÷日均≈21天, 落在22天2月的工作日区间)
addSales('2026-04', 220000, 10000, 250, 40);
let a4 = window.eval("analyzeSales(salesLogs.find(l=>l.date==='2026-04'))");
check('按工作日口径: 推算22天≈2月, status=按工作日口径', a4.impliedDays === 22 && a4.status === '按工作日口径' && a4.statusClass === 'ok');

// 8) 重复月份覆盖
addSales('2026-01', 320000, 10500, 330, 31.8);
check('重复月份不新增记录(仍为4条)', window.eval("salesLogs.length") === 4);
check('2026-01 被覆盖为新值', window.eval("salesLogs.find(l=>l.date==='2026-01').retail") === 320000);

// 9) 统计卡片: 累计零售额 = 320000+280000+600000+220000 = 1,420,000
check('统计卡片累计零售额=1,420,000', $('#saStats').textContent.includes('1,420,000'));

// 10) 环比增长 (列表: 2026-04 相对 2026-03 零售 220000 vs 600000 → 下降)
check('列表含环比标记', $('#saList').textContent.includes('▲') || $('#saList').textContent.includes('▼'));

// 11) 编辑记录
$all('[data-action="sa-edit"]').forEach(b => { if (b.dataset.id === window.eval("salesLogs.find(l=>l.date==='2026-04').id")) b.click(); });
check('编辑载入月份', $('#saMonth').value === '2026-04');
setVal($('#saRetail'), 230000);
$('#saAddBtn').click();
check('编辑后零售额更新', window.eval("salesLogs.find(l=>l.date==='2026-04').retail") === 230000);

// 12) 删除记录
const before = window.eval("salesLogs.length");
const delId = window.eval("salesLogs.find(l=>l.date==='2026-03').id");
$all('[data-action="sa-del"]').forEach(b => { if (b.dataset.id === delId) b.click(); });
check('删除后记录数-1', window.eval("salesLogs.length") === before - 1);
check('已删除 2026-03', !window.eval("salesLogs.some(l=>l.date==='2026-03')"));

// 13) 空值拦截
addSales('2026-05', '', '', '', '');
check('全空不写入', !window.eval("salesLogs.some(l=>l.date==='2026-05')"));

// 14) 排序: 列表按月份降序(最新在前)
const dates = window.eval("JSON.stringify(salesDesc().map(l=>l.date))");
check('列表降序: 2026-04 在最前', dates.indexOf('2026-04') < dates.indexOf('2026-01'));

console.log('\n=== test_sales: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail ? 1 : 0);
