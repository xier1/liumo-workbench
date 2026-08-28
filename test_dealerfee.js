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
window.eval("currentModule='dealerfee'; renderContent();");

// 1) 模块与页签
check('模块标题含 经销商费用', $('.page-title') && $('.page-title').textContent.includes('经销商费用'));
check('页签共 4 个', $all('.df-tab').length === 4);
check('默认页签=费用管理', $('.df-tab.on') && $('.df-tab.on').textContent.trim() === '费用管理');

// 2) 经销商管理：新增两个经销商
clickTab('经销商管理');
$('#dfDName').value = '旺旺食品';
$('#dfDContact').value = '13800000000';
$('#dfDSave').click();
$('#dfDName').value = '停用经销';
$('#dfDSave').click();
check('列表含 旺旺食品', $('#dfDList').textContent.includes('旺旺食品'));
check('列表含 停用经销', $('#dfDList').textContent.includes('停用经销'));
check('默认均为启用', (function () {
  const ons = $all('#dfDList .df-status.on').length;
  return ons === 2;
})());

// 禁用 停用经销（验证禁用语义）
(function () {
  const row = $all('#dfDList tbody tr').find(r => r.textContent.includes('停用经销'));
  row.querySelector('button[data-act="toggle"]').click();
})();
check('停用经销变为 禁用', (function () {
  const row = $all('#dfDList tbody tr').find(r => r.textContent.includes('停用经销'));
  return /禁用/.test(row.textContent) && !/启用/.test(row.querySelector('.df-status').textContent);
})());

// 3) 费用设置：仅启用经销商可选，禁用不可见
clickTab('费用设置');
check('费用设置含 旺旺食品', $('#dfSetList').textContent.includes('旺旺食品'));
check('费用设置不含 停用经销(禁用不可选)', !$('#dfSetList').textContent.includes('停用经销'));
(function () {
  const row = $all('#dfSetList tbody tr').find(r => r.textContent.includes('旺旺食品'));
  row.querySelector('.df-set-amt').value = '2000';
  row.querySelector('.df-set-save').click();
})();
const setDid = (function () {
  const row = $all('#dfSetList tbody tr').find(r => r.textContent.includes('旺旺食品'));
  return row.getAttribute('data-did');
})();
const settings = JSON.parse(window.localStorage.getItem('liumo_dealerfee_settings'));
check('费用设置金额存储=2000', settings[setDid] === 2000);

// 4) 费用管理：选择经销商自动带出设置金额，可改，添加记录
clickTab('费用管理');
const dealerSel = $('#dfRecDealer');
check('费用管理可选经销商仅启用项(1)', dealerSel && dealerSel.options.length === 1);
dealerSel.value = dealerSel.options[0].value;
dealerSel.dispatchEvent(new window.Event('change', { bubbles: true }));
check('选择经销商后自动带出金额 2000', $('#dfRecAmount').value === '2000');
check('带出后有提示说明', $('#dfRecHint').textContent.includes('费用设置'));
// 修改金额再保存
$('#dfRecAmount').value = '2200';
$('#dfRecSave').click();
check('费用记录已添加', $('#dfRecList').textContent.includes('旺旺食品'));
const recs = JSON.parse(window.localStorage.getItem('liumo_dealerfee_records'));
check('记录金额=2200(已修改)', recs.length === 1 && recs[0].amount === 2200);
check('记录月份为当前月', recs[0] && recs[0].month === (new Date().getMonth() + 1));

// 4b) 第二个启用经销商 + 登记费用，让柱状图呈现「启用蓝 + 禁用灰」两根柱
clickTab('经销商管理');
$('#dfDName').value = '乐乐便利';
$('#dfDSave').click();
clickTab('费用管理');
const sel2 = $('#dfRecDealer');
const leOpt = Array.from(sel2.options).find(o => o.textContent.includes('乐乐便利'));
sel2.value = leOpt.value;
sel2.dispatchEvent(new window.Event('change', { bubbles: true }));
$('#dfRecAmount').value = '1500';
$('#dfRecSave').click();
check('第二笔费用(乐乐便利)已添加', $('#dfRecList').textContent.includes('乐乐便利'));

// 5) 禁用已登记费用的经销商后：已有费用不受影响，设置中不可选
clickTab('经销商管理');
(function () {
  const row = $all('#dfDList tbody tr').find(r => r.textContent.includes('旺旺食品'));
  row.querySelector('button[data-act="toggle"]').click();
})();
check('旺旺食品已禁用', (function () {
  const row = $all('#dfDList tbody tr').find(r => r.textContent.includes('旺旺食品'));
  return /禁用/.test(row.textContent);
})());
clickTab('费用设置');
check('禁用后设置中不再含 旺旺食品', !$('#dfSetList').textContent.includes('旺旺食品'));
clickTab('费用管理');
check('已有费用记录仍显示(不受影响)', $('#dfRecList').textContent.includes('旺旺食品'));
check('已有记录状态显示 禁用', /禁用/.test($('#dfRecList').textContent));

// 6) 费用统计
clickTab('费用统计');
check('统计含 费用总额 卡片', $('#dfBody').textContent.includes('费用总额'));
check('统计含 记录数 卡片', $('#dfBody').textContent.includes('记录数'));
check('统计含 按经销商汇总', $('#dfBody').textContent.includes('按经销商汇总'));
check('统计含 按年份汇总', $('#dfBody').textContent.includes('按年份汇总'));
check('统计含 按月趋势', $('#dfBody').textContent.includes('按月趋势'));
check('统计仍含 旺旺食品(记录不受影响)', $('#dfBody').textContent.includes('旺旺食品'));
check('统计本年累计含 2,200', $('#dfBody').textContent.includes('2,200'));
// 按经销商柱状图
check('统计含 按经销商费用柱状图 卡片', $('#dfBody').textContent.includes('按经销商费用柱状图'));
check('柱状图 SVG 已渲染', !!$('#dfBody .df-chart-bar'));
const barRects = $all('#dfBody .df-chart-bar rect');
check('柱状图至少 2 根柱(旺旺+乐乐)', barRects.length >= 2);
check('柱状图含启用/禁用图例', $('#dfBody').querySelectorAll('.df-chart-legend').length >= 1);
const disabledBar = $all('#dfBody .df-chart-bar rect').some(r => (r.getAttribute('fill') || '') === '#94a3b8');
check('禁用经销商柱为灰色', disabledBar);
const enabledBar = $all('#dfBody .df-chart-bar rect').some(r => (r.getAttribute('fill') || '') === '#2563eb');
check('启用经销商柱为蓝色', enabledBar);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
