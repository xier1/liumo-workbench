const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/root/.codebuddy/artifact/fresh/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

let pass = 0, fail = 0;
function check(n, c) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n); } }
function $(s) { return window.document.querySelector(s); }
function $all(s) { return Array.from(window.document.querySelectorAll(s)); }

// 准备数据：两条商品（旧数据，无 needWarn 字段，按 warn>0 推断需要预警）
window.localStorage.setItem('liumo_inventory_items', JSON.stringify([
  { id: 'i1', name: '芙蓉王(硬)', category: 'cigarette', price: 220, stock: 5, warn: 10, createdAt: 1, updatedAt: 1 },
  { id: 'i2', name: '茅台', category: 'liquor', price: 1499, stock: 20, warn: 3, createdAt: 1, updatedAt: 1 }
]));
window.localStorage.setItem('liumo_inventory_logs', JSON.stringify([
  { id: 'l1', itemId: 'i1', itemName: '芙蓉王(硬)', category: 'cigarette', type: 'in', qty: 5, note: '进货', createdAt: 1 }
]));

window.eval("currentModule='inventory'; renderContent();");

// 1) 模块与统计卡（旧数据：芙蓉王香烟 5件*220=1100 预警，茅台酒水 20件*1499=29980 不预警）
check('模块标题', $('.page-title') && $('.page-title').textContent.includes('库存管理'));
check('统计卡含香烟库存数 5 条', $('#ivStats').textContent.includes('香烟库存数') && $('#ivStats').textContent.includes('5 条'));
check('统计卡含香烟库存金额 1,100 元', $('#ivStats').textContent.includes('香烟库存金额') && $('#ivStats').textContent.includes('1,100 元'));
check('统计卡含酒水库存数 20 件', $('#ivStats').textContent.includes('酒水库存数') && $('#ivStats').textContent.includes('20 件'));
check('统计卡含酒水库存金额 29,980 元', $('#ivStats').textContent.includes('酒水库存金额') && $('#ivStats').textContent.includes('29,980 元'));
check('统计卡含库存预警 1 种', $('#ivStats').textContent.includes('库存预警') && $('#ivStats').textContent.includes('1 种'));

// 1.x) 默认折叠 + 新 UI 结构
check('商品信息卡片默认折叠', $('#ivFormCard').classList.contains('co-collapsed'));
check('商品列表卡片默认折叠', $('#ivListCard').classList.contains('co-collapsed'));
check('存在搜索框', !!$('#ivSearch'));
check('存在分类筛选下拉', !!$('#ivCatFilter'));
check('分类下拉含 3 个选项', $('#ivCatFilter').options.length === 3);
check('库存预警统计卡可点击', !!$('.iv-warn-card'));

// 2) 列表两条 + 不显示分类/进价 + 预警标红
const items = $all('#ivList .iv-item');
check('列表渲染 2 个商品', items.length === 2);
check('列表项不显示分类标签(iv-tag)', $all('#ivList .iv-item .iv-tag').length === 0);
check('列表项不显示进价文案', !$('#ivList').textContent.includes('进价'));
check('芙蓉王库存预警标红', items[0].querySelector('.iv-item-stock.iv-warn'));
check('芙蓉王副文案含预警阈值', items[0].textContent.includes('预警 ≤ 10'));

// 3) 筛选：下拉选“酒水”只剩茅台
const catSel = $('#ivCatFilter');
catSel.value = 'liquor';
catSel.dispatchEvent(new window.Event('change', { bubbles: true }));
check('筛选酒水后只剩 1 个', $all('#ivList .iv-item').length === 1);
check('筛选结果含茅台', $('#ivList').textContent.includes('茅台'));
catSel.value = 'all';
catSel.dispatchEvent(new window.Event('change', { bubbles: true }));
check('回到全部为 2 个', $all('#ivList .iv-item').length === 2);

// 3.1) 库存预警快捷筛选（点击顶部统计卡）
check('存在库存预警统计卡', !!$('.iv-warn-card'));
check('预警统计卡显示 1 种', $('#ivStats').textContent.includes('库存预警') && $('#ivStats').textContent.includes('1 种'));
$('.iv-warn-card').click();
check('点击顶部预警卡后自动展开商品列表', !$('#ivListCard').classList.contains('co-collapsed'));
check('点击顶部预警卡后只剩预警商品', $all('#ivList .iv-item').length === 1);
check('预警筛选结果含芙蓉王', $('#ivList').textContent.includes('芙蓉王'));
check('预警筛选不含茅台', !$('#ivList').textContent.includes('茅台'));
check('预警视图下显示全部商品按钮', $('#ivBackAll').style.display !== 'none');
$('#ivBackAll').click();
check('点击全部商品按钮后恢复 2 个', $all('#ivList .iv-item').length === 2);
check('全部商品按钮在普通视图下隐藏', $('#ivBackAll').style.display === 'none');

// 3.2) 按名称搜索 + 分组显示
check('存在按名称搜索框', !!$('#ivSearch'));
check('全部视图含 2 个分组标题', $all('#ivList .iv-group-title').length === 2);
check('分组标题含“香烟”', Array.from($all('#ivList .iv-group-title')).some(e => e.textContent.includes('香烟')));
check('分组标题含“酒水”', Array.from($all('#ivList .iv-group-title')).some(e => e.textContent.includes('酒水')));
$('#ivSearch').value = '茅台';
$('#ivSearch').dispatchEvent(new window.Event('input', { bubbles: true }));
check('搜索“茅台”后只剩 1 个', $all('#ivList .iv-item').length === 1);
check('搜索结果含茅台', $('#ivList').textContent.includes('茅台'));
$('#ivSearch').value = '不存在的商品XYZ';
$('#ivSearch').dispatchEvent(new window.Event('input', { bubbles: true }));
check('无匹配时显示空提示', $('#ivList').textContent.includes('未找到匹配'));
$('#ivSearch').value = '';
$('#ivSearch').dispatchEvent(new window.Event('input', { bubbles: true }));
check('清空搜索后恢复 2 个', $all('#ivList .iv-item').length === 2);

// 4) 新增商品（勾选需要预警，阈值默认 2）
check('新增表单默认勾选需要预警', $('#ivNeedWarn').checked === true);
check('勾选时阈值输入框可填', $('#ivWarn').disabled === false);
$('#ivName').value = '五粮液';
$('#ivCat').value = 'liquor';
$('#ivPrice').value = '900';
$('#ivStock').value = '8';
$('#ivWarn').value = '2';
$('#ivSaveBtn').click();
check('新增后列表 3 个', $all('#ivList .iv-item').length === 3);
check('新增商品已保存', window.eval("inventoryItems.length") === 3);
check('新增商品进价已保存', window.eval("inventoryItems.find(i=>i.name==='五粮液').price") === 900);
check('新增商品 needWarn=true', window.eval("inventoryItems.find(i=>i.name==='五粮液').needWarn") === true);
check('新增商品 warn 默认 2', window.eval("inventoryItems.find(i=>i.name==='五粮液').warn") === 2);
check('表单已重置', $('#ivName').value === '');

// 5) 新增商品不勾选预警 -> needWarn=false, warn=0, 列表显示不预警
$('#ivName').value = '黄鹤楼';
$('#ivCat').value = 'cigarette';
$('#ivPrice').value = '180';
$('#ivStock').value = '3';
$('#ivNeedWarn').checked = false;
// 触发 change 以禁用阈值框
$('#ivNeedWarn').dispatchEvent(new window.Event('change', { bubbles: true }));
check('取消勾选后阈值输入框被禁用', $('#ivWarn').disabled === true);
$('#ivWarn').value = '99'; // 即便填了也不应保存
$('#ivSaveBtn').click();
check('不预警商品已保存', window.eval("inventoryItems.length") === 4);
const hh = window.eval("inventoryItems.find(i=>i.name==='黄鹤楼')");
check('不预警 needWarn=false', hh.needWarn === false);
check('不预警 warn=0（忽略填入的99）', hh.warn === 0);
check('不预警列表显示“不预警”', $('#ivList').textContent.includes('不预警'));
check('不预警商品库存 3 不会标红', !$all('#ivList .iv-item').find(el => el.textContent.includes('黄鹤楼') && el.querySelector('.iv-item-stock.iv-warn')));
check('库存预警统计仍为 1 种', $('#ivStats').textContent.includes('1 种'));

// 6) 入库茅台 +6 -> 26，并产生一条流水
$all('#ivList .iv-item').forEach(el => {
  if (el.textContent.includes('茅台')) el.querySelector('[data-act="in"]').click();
});
check('弹窗打开', $('#ivModalMask').style.display === 'flex');
$('#ivModalQty').value = '6';
$('#ivModalNote').value = '补货';
$('#ivModalOk').click();
check('弹窗关闭', $('#ivModalMask').style.display === 'none');
check('茅台库存变 26', window.eval("inventoryItems.find(i=>i.id==='i2').stock") === 26);
check('流水新增为 2 条', window.eval("inventoryLogs.length") === 2);
check('最后流水为入库 6', window.eval("inventoryLogs[inventoryLogs.length-1].qty") === 6);

// 7) 出库超过库存应被拦截
$all('#ivList .iv-item').forEach(el => {
  if (el.textContent.includes('五粮液')) el.querySelector('[data-act="out"]').click();
});
$('#ivModalQty').value = '999';
$('#ivModalOk').click();
check('超量出库被拦截（库存不变 8）', window.eval("inventoryItems.find(i=>i.name==='五粮液').stock") === 8);

// 8) 编辑商品：切换预警开关
$all('#ivList .iv-item').forEach(el => {
  if (el.textContent.includes('黄鹤楼')) el.querySelector('[data-act="edit"]').click();
});
check('进入编辑态(标签变保存修改)', $('#ivSaveLabel').textContent === '保存修改');
check('编辑不预警商品时复选框未勾选', $('#ivNeedWarn').checked === false);
check('编辑不预警商品时阈值框禁用', $('#ivWarn').disabled === true);
$('#ivNeedWarn').checked = true;
$('#ivNeedWarn').dispatchEvent(new window.Event('change', { bubbles: true }));
check('编辑时勾选后阈值框启用且默认 2', $('#ivWarn').disabled === false && $('#ivWarn').value === '2');
$('#ivStock').value = '15';
$('#ivSaveBtn').click();
check('编辑后库存 15', window.eval("inventoryItems.find(i=>i.name==='黄鹤楼').stock") === 15);
check('编辑后 needWarn=true', window.eval("inventoryItems.find(i=>i.name==='黄鹤楼').needWarn") === true);
check('编辑后 warn=2', window.eval("inventoryItems.find(i=>i.name==='黄鹤楼').warn") === 2);

// 9) 删除商品（confirm 返回 true）
window.confirm = () => true;
$all('#ivList .iv-item').forEach(el => {
  if (el.textContent.includes('黄鹤楼')) el.querySelector('[data-act="del"]').click();
});
check('删除后剩 3 个', $all('#ivList .iv-item').length === 3);
check('相关数据已删除', window.eval("inventoryItems.length") === 3);

// 10) 流水默认折叠
check('流水卡片默认折叠', $('#ivLogs').closest('.co-admin-card').classList.contains('co-collapsed'));

// 11) 列表按库存从高到低（同组）
window.eval("inventoryItems=[{id:'c1',name:'A烟',category:'cigarette',price:1,stock:3,warn:0,needWarn:false},{id:'c2',name:'B烟',category:'cigarette',price:1,stock:9,warn:0,needWarn:false},{id:'c3',name:'C烟',category:'cigarette',price:1,stock:5,warn:0,needWarn:false}]; inventoryFilter='all'; inventorySearch=''; renderInventoryList();");
const order = $all('#ivList .iv-item .iv-item-name').map(e => e.textContent);
check('同组库存倒序排列(B9>A5>C3)', order.length === 3 && order[0].includes('B烟') && order[1].includes('C烟') && order[2].includes('A烟'));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
