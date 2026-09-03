const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/root/.codebuddy/artifact/fresh/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

let pass = 0, fail = 0;
function check(n, c) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n); } }
function $(s) { return window.document.querySelector(s); }
function $all(s) { return Array.from(window.document.querySelectorAll(s)); }
window.confirm = () => true;

function clickTab(name) {
  const t = $all('.df-tab').find(b => b.textContent.trim() === name);
  if (!t) throw new Error('tab not found: ' + name);
  t.click();
}

window.localStorage.clear();
window.eval("currentModule='bakery'; renderContent();");

// 1) 模块与页签
check('模块标题含 面包房利润分析', $('.page-title') && $('.page-title').textContent.includes('面包房利润分析'));
check('页签共 5 个', $all('.df-tab').length === 5);
check('默认页签=每月工资', $('.df-tab.on') && $('.df-tab.on').textContent.trim() === '每月工资');

// 2) 每月工资：新增 + 同月更新
clickTab('每月工资');
$('#bakeSAmt').value = '18000';
$('#bakeSSave').click();
check('工资记录已添加(列表含 18,000)', $('#bakeSList').textContent.includes('18,000'));
let sal = JSON.parse(window.localStorage.getItem('liumo_bakery_salary'));
check('工资已存 localStorage', sal.length === 1 && sal[0].amount === 18000);
// 同月再保存应更新而非新增
$('#bakeSAmt').value = '19000';
$('#bakeSSave').click();
sal = JSON.parse(window.localStorage.getItem('liumo_bakery_salary'));
check('同月工资再保存为更新(仍 1 条)', sal.length === 1 && sal[0].amount === 19000);
check('列表显示更新后金额 19,000', $('#bakeSList').textContent.includes('19,000'));
// 工资趋势曲线图（按年·每月，标注数据）
check('工资页签含趋势曲线 svg', !!$('#bakeSChart svg'));
check('工资图表含年度图例', $all('#bakeSChart .ce-legend-item').length >= 1);
check('工资曲线标注数值文本', $('#bakeSChart svg').textContent.replace(/\s+/g, '').length > 0);

// 3) 每月工时
clickTab('每月工时');
$('#bakeHAmt').value = '176';
$('#bakeHSave').click();
check('工时记录已添加(列表含 176 h)', $('#bakeHList').textContent.includes('176'));
let hrs = JSON.parse(window.localStorage.getItem('liumo_bakery_hours'));
check('工时已存 localStorage', hrs.length === 1 && Number(hrs[0].hours) === 176);

// 4) 每月营业额
clickTab('每月营业额');
$('#bakeRAmt').value = '120000';
$('#bakeRSave').click();
check('营业额记录已添加(列表含 120,000)', $('#bakeRList').textContent.includes('120,000'));
let rev = JSON.parse(window.localStorage.getItem('liumo_bakery_revenue'));
check('营业额已存 localStorage', rev.length === 1 && rev[0].amount === 120000);
// 营业额趋势曲线图（按年·每月，标注数据）
check('营业额页签含趋势曲线 svg', !!$('#bakeRChart svg'));
check('营业额图表含年度图例', $all('#bakeRChart .ce-legend-item').length >= 1);

// 5) 毛利分析：汇总 + 联动表（默认毛利率 60%）
clickTab('毛利分析');
check('含 总营业额 卡片', $('#bakeBody').textContent.includes('总营业额'));
check('含 总工资 卡片', $('#bakeBody').textContent.includes('总工资'));
check('含 总毛利(60%) 卡片', $('#bakeBody').textContent.includes('总毛利(60%)'));
check('含 总净毛利 卡片', $('#bakeBody').textContent.includes('总净毛利'));
check('含 平均时薪 卡片', $('#bakeBody').textContent.includes('平均时薪'));
check('总营业额=120,000', $('#bakeBody').textContent.includes('120,000'));
check('总工资=19,000', $('#bakeBody').textContent.includes('19,000'));
check('总毛利(60%)=72,000', $('#bakeBody').textContent.includes('72,000'));
check('总净毛利=53,000', $('#bakeBody').textContent.includes('53,000'));
check('按月分析表含 1 个月', $all('#bakeBody table.wt-cat tbody tr').length === 1);
check('分析表含 毛利 列与 人效 列', $('#bakeBody').textContent.includes('毛利') && $('#bakeBody').textContent.includes('人效'));
// 毛利分析趋势图（毛利 vs 工资，按月时间轴，标注数据）
check('毛利分析含趋势图 svg', !!$('#bakeTrendChart svg'));
check('趋势图含 毛利 图例', $('#bakeTrendChart').textContent.includes('毛利'));
check('趋势图含 工资 图例', $('#bakeTrendChart').textContent.includes('工资'));

// 6) 修改毛利率 → 联动重算
$('#bakeMargin').value = '50';
$('#bakeMarginSave').click();
check('毛利率改后卡片标注 50%', $('#bakeBody').textContent.includes('总毛利(50%)'));
check('改率后总毛利=60,000', $('#bakeBody').textContent.includes('60,000'));
check('改率后总净毛利=41,000', $('#bakeBody').textContent.includes('41,000'));
let marginSaved = window.localStorage.getItem('liumo_bakery_margin');
check('毛利率已存 localStorage(0.5)', marginSaved === '0.5');

// 7) 每月电费：按读数自动计算（实际 + 缺月估算）
clickTab('每月电费');
check('电费页签含录入表单', !!$('#bakeMAdd'));
function addMeter(date, deg, note) {
  $('#bakeMDate').value = date;
  $('#bakeMDeg').value = String(deg);
  $('#bakeMNote').value = note || '';
  $('#bakeMAdd').click();
}
addMeter('2025-12-31', 700, '12月抄表');
addMeter('2026-01-31', 1000, '1月抄表');
addMeter('2026-02-28', 1300, '2月抄表');
let meters = JSON.parse(window.localStorage.getItem('liumo_bakery_meter'));
check('电表读数已存 localStorage(3条)', meters.length === 3);
check('读数记录列表含 3 条', $all('#bakeMList tbody tr').length === 3);
check('电费明细含 实际 计算方式', $('#bakeETable').textContent.includes('实际'));
check('1月电费按实际=300', $('#bakeETable').textContent.includes('300'));
check('3月缺读数→显示 估算', $('#bakeETable').textContent.includes('估算'));
check('电费趋势图 svg 渲染', !!$('#bakeEChart svg'));
check('趋势图含年度图例', $all('#bakeEChart .ce-legend-item').length >= 1);
// 删除一条读数后重算
$all('#bakeMList button[data-act="del"]')[0].click();
check('删除后读数剩 2 条', JSON.parse(window.localStorage.getItem('liumo_bakery_meter')).length === 2);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
