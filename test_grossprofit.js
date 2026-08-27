const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/root/.codebuddy/artifact/fresh/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

let pass = 0, fail = 0;
function check(n, c) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n); } }
function $(s) { return window.document.querySelector(s); }
function $all(s) { return Array.from(window.document.querySelectorAll(s)); }

// 数据：工资管理营业额 + 月度成本管理总成本
window.localStorage.setItem('liumo_salary_logs', JSON.stringify([
  {id:'s1',date:'2026-08',total:9000,revenue:100000,head:3},
  {id:'s2',date:'2026-07',total:8800,revenue:80000,head:3}
]));
window.localStorage.setItem('liumo_monthly_cost_logs', JSON.stringify([
  {id:'m1',month:'2026-08',fixedTotal:14200,entryTotal:1000,salaryTotal:9000,total:24200},
  {id:'m2',month:'2026-07',fixedTotal:14000,entryTotal:1000,salaryTotal:5000,total:20000}
]));

window.eval("currentModule='grossprofit'; renderContent();");

// 1) 模块渲染与默认毛利率
check('模块标题', $('.page-title') && $('.page-title').textContent.includes('净利润分析'));
check('毛利率输入框默认 18', $('#gpMargin').value === '18');
check('当前毛利率显示 18%', $('#gpMarginVal').textContent === '18%');

// 1.5) 年度净利润曲线图（一年一条曲线，曲线上标注数据）
check('净利润曲线图已渲染(svg)', !!$('#gpChart svg'));
check('图表含年份标注(2026年)', $('#gpChart').textContent.includes('2026年'));
check('图例年份前有色块(至少1个色块)', $all('#gpChart .ce-legend-item i').length > 0);
check('图例色块有背景色样式', $all('#gpChart .ce-legend-item i').every(el => el.getAttribute('style').includes('background:')));
check('曲线上已标注净利润数据数值', /\-?[\d]{2,}/.test($('#gpChart svg').textContent));

// 1.6) 净利润分析板块（趋势 / 原因 / 解决方案）
check('净利润分析板块已渲染', !!$('#gpAnalysis') && $('#gpAnalysis').textContent.includes('净利润分析'));
check('分析含三段：原因与解决方案', $('#gpAnalysis').textContent.includes('具体原因') && $('#gpAnalysis').textContent.includes('解决方案'));

// 2) 表格按月份倒序，2 行（2026-08、2026-07）
const rows = $all('#gpTable tbody tr');
check('表格含 2 个月', rows.length === 2);
check('首行为 2026-08', rows[0] && rows[0].textContent.includes('2026-08'));
check('次行为 2026-07', rows[1] && rows[1].textContent.includes('2026-07'));
check('2026-08 营业额 100,000', rows[0] && rows[0].textContent.includes('100,000'));
check('2026-08 总成本 24,200', rows[0] && rows[0].textContent.includes('24,200'));

// 3) 2026-08 净利润 = 100000*0.18 - 24200 = -6200
check('2026-08 净利润 -6,200', rows[0] && rows[0].textContent.includes('-6,200'));
check('亏损行为红字 gp-neg', rows[0] && rows[0].querySelector('.gp-neg'));

// 4) 汇总卡片：总净利润 -11800, 亏损月数 2
const statVals = $all('#gpStats .stat-value').map(e => e.textContent);
check('总净利润 -11,800', statVals.some(v => v.includes('-11,800')));
check('亏损月数=2', statVals.some(v => v.includes('2 个月')));

// 5) 改利润率为 30% 并保存 → 2026-08 净利润 = 30000-24200 = 5800（盈利）
$('#gpMargin').value = '30';
$('#gpMarginSave').click();
check('保存后显示 30%', $('#gpMarginVal').textContent === '30%');
const rows2 = $all('#gpTable tbody tr');
check('改率后 2026-08 净利润 5,800', rows2[0] && rows2[0].textContent.includes('5,800'));
check('盈利行为绿字 gp-pos', rows2[0] && rows2[0].querySelector('.gp-pos'));
const statVals2 = $all('#gpStats .stat-value').map(e => e.textContent);
check('改率后总毛利 9,800', statVals2.some(v => v.includes('9,800')));

// 5.5) 仅有今年数据时，对比板块提示缺去年
check('缺去年时对比提示含 2025', $('#gpCompare').textContent.includes('2025') && $('#gpCompare').textContent.includes('暂无'));

// 6) 无数据时空态
window.localStorage.removeItem('liumo_salary_logs');
window.localStorage.removeItem('liumo_monthly_cost_logs');
window.eval("currentModule='grossprofit'; renderContent();");
check('无数据时显示空态', $('#gpTable').textContent.includes('还没有可用数据'));

// 7) 今年 vs 去年 对比分析（两年数据）
window.localStorage.setItem('liumo_salary_logs', JSON.stringify([
  {id:'s1',date:'2026-08',total:9000,revenue:100000,head:3},
  {id:'s2',date:'2026-07',total:8800,revenue:80000,head:3},
  {id:'s3',date:'2025-08',total:8500,revenue:70000,head:3},
  {id:'s4',date:'2025-07',total:8400,revenue:60000,head:3}
]));
window.localStorage.setItem('liumo_monthly_cost_logs', JSON.stringify([
  {id:'m1',month:'2026-08',fixedTotal:14200,entryTotal:1000,salaryTotal:9000,total:24200},
  {id:'m2',month:'2026-07',fixedTotal:14000,entryTotal:1000,salaryTotal:5000,total:20000},
  {id:'m3',month:'2025-08',fixedTotal:12000,entryTotal:1000,salaryTotal:8500,total:21500},
  {id:'m4',month:'2025-07',fixedTotal:11000,entryTotal:1000,salaryTotal:8400,total:20400}
]));
// 先把利润率重置回 18%（step5 改成了 30% 且已保存）
window.document.getElementById('gpMargin').value = '18';
window.document.getElementById('gpMarginSave').click();
window.eval("currentModule='grossprofit'; renderContent();");

check('对比卡片已渲染 #gpCompare', !!$('#gpCompare'));
check('对比含同区间同比增长卡片', $('#gpCompare').textContent.includes('同区间同比增长'));
check('对比含同区间年度关键指标表', $('#gpCompare').textContent.includes('年度关键指标同比'));
check('同区间概览标注口径', $('#gpCompare').textContent.includes('同区间口径'));
check('对比含 2025 口径', $('#gpCompare').textContent.includes('2025'));
check('对比含 2026 口径', $('#gpCompare').textContent.includes('2026'));
check('逐月对比含 08月', $('#gpCompare').textContent.includes('08月'));
check('对比含变化原因段', $('#gpCompare').textContent.includes('同比变化原因'));
check('对比含改进方案段', $('#gpCompare').textContent.includes('今年改进方案'));
// 2026-08 净利润=100000*0.18-24200=-6200；2026-07=-5600 → 今年同区间(1–8月)合计 -11,800
// 2025-08=70000*0.18-21500=-8900；2025-07=-9600 → 去年同区间合计 -18,500；同比 +6,700（+36.2%）
check('主口径卡片含 1–8月净利润', $('#gpCompare').textContent.includes('1–8月净利润'));
check('同区间今年净利润 -11,800', $('#gpCompare').textContent.includes('-11,800'));
check('同区间去年净利润 -18,500', $('#gpCompare').textContent.includes('-18,500'));
check('同区间同比增长 +6,700', $('#gpCompare').textContent.includes('6,700'));
check('含净利润变化拆解表', $('#gpCompare').textContent.includes('净利润变化拆解'));
check('拆解含营业额维度', $('#gpCompare').textContent.includes('营业额'));
check('拆解含录入成本维度', $('#gpCompare').textContent.includes('录入成本'));
check('拆解含工资维度', $('#gpCompare').textContent.includes('工资'));
check('原因含营业额角度', $('#gpCompare').textContent.includes('营业额角度'));
check('原因含录入成本角度', $('#gpCompare').textContent.includes('录入成本角度'));
check('原因含工资角度', $('#gpCompare').textContent.includes('工资角度'));
check('分组柱状图已渲染 svg.gp-grp-bar', !!$('#gpCompare svg.gp-grp-bar'));
check('柱状图含副标题', $('#gpCompare').textContent.includes('分组柱状图'));
check('柱状图含4个维度标签', ['营业额', '录入成本', '工资', '固定成本'].every(t => $('#gpCompare svg.gp-grp-bar').textContent.includes(t)));
check('柱状图含今年图例', $('#gpCompare').textContent.includes('今年 2026') || $('#gpCompare').textContent.includes('今年 2025'));
check('柱状图含今年/去年柱(rect≥8)', $('#gpCompare svg.gp-grp-bar').querySelectorAll('rect').length >= 8);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
