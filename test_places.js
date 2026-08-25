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
function fireDrag(el, type) {
  const ev = new window.Event(type, { bubbles: true, cancelable: true });
  ev.dataTransfer = { effectAllowed: '', dropEffect: '' };
  el.dispatchEvent(ev);
  return ev;
}

// 初始化：清空数据 + 空分类(完全自定义)
window.eval("places=[]; placeCats=[]; savePlaceCats(); placeCatFilter='all'; placeSortMode='custom'; currentModule='places'; renderContent();");

// 1) 基础结构
check('渲染出统计区', !!$('#plStats'));
check('渲染出添加表单', !!$('#plName') && !!$('#plAddBtn'));
check('空列表提示', $('#plList').textContent.includes('还没有收藏'));
check('分类是下拉框(非文本输入)', !!$('#plCat') && $('#plCat').tagName === 'SELECT');
check('想去程度已移除', !$('#plPrio'));
check('旧的「分类筛选」下拉已移除', !$('#plCatFilter'));
check('有「＋」新建分类按钮', !!$('#plAddCatBtn'));
check('有「管理分类」按钮', !!$('#plManageCatsBtn'));
check('空分类时 chips 只有「全部」', $all('[data-pcat]').length === 1 && $('#plCatChips').querySelector('[data-pcat="all"]'));
check('默认无内置分类(placeCats 为空)', window.eval("placeCats.length") === 0);

function addPlace(name, cat, note) {
  setVal($('#plName'), name);
  if (cat !== undefined) setVal($('#plCat'), cat);
  if (note !== undefined) setVal($('#plNote'), note);
  $('#plAddBtn').click();
}
function addCatFromForm(name) {
  $('#plAddCatBtn').click();
  setVal($('#plNewCatInput'), name);
  $('#plNewCatOk').click();
}
function ids() { return $all('#plList .pl-item').map(e => e.dataset.id); }

// 2) 先新增三个自定义分类
addCatFromForm('国内');
addCatFromForm('国外');
addCatFromForm('美食');
check('自定义分类写入 placeCats', window.eval("JSON.stringify(placeCats)") === JSON.stringify(['国内','国外','美食']));
check('分类出现在表单下拉', $all('#plCat option').filter(o => ['国内','国外','美食'].includes(o.value)).length === 3);
check('分类出现在筛选 chips', $all('[data-pcat]').length === 4);
check('重复自定义分类被拦', (function(){ addCatFromForm('国内'); return window.eval("placeCats.filter(c=>c==='国内').length")===1; })());

// 3) 添加地点(用自定义分类)
addPlace('洪崖洞', '国内', '夜景好看');
addPlace('浅草寺', '国外');
addPlace('西湖', '国内', '春天去');
check('添加 3 个地点', window.eval("places.length") === 3);
check('列表渲染 3 项', $all('#plList .pl-item').length === 3);
check('名称正确渲染', $('#plList').textContent.includes('洪崖洞'));
check('分类 chip 渲染', $('#plList').textContent.includes('国内'));
check('备注渲染', $('#plList').textContent.includes('夜景好看'));

// 4) 重复拦截(同名同分类)
addPlace('洪崖洞', '国内');
check('重复地点被拦截', window.eval("places.length") === 3);

// 5) 修改地点
const firstId = ids()[0];
$('#plList .pl-item[data-id="' + firstId + '"] [data-action="pl-edit"]').click();
check('编辑载入名称', $('#plName').value === '洪崖洞');
check('编辑载入分类', $('#plCat').value === '国内');
check('编辑按钮变「更新地点」', $('#plAddBtn').textContent.includes('更新'));
setVal($('#plName'), '洪崖洞(升级版)');
setVal($('#plCat'), '美食');
$('#plAddBtn').click();
check('修改后名称更新', window.eval("places.find(p=>p.id==='" + firstId + "').name") === '洪崖洞(升级版)');
check('修改后分类更新', window.eval("places.find(p=>p.id==='" + firstId + "').category") === '美食');
check('修改后回到添加态', $('#plAddBtn').textContent.includes('添加'));

// 6) 标记去过(仍可标记,但不再是筛选维度)
const targetId = ids()[1];
$('#plList .pl-item[data-id="' + targetId + '"] [data-action="pl-done"]').click();
check('标记去过后 visited=true', window.eval("places.find(p=>p.id==='" + targetId + "').visited") === true);
check('卡片带 visited 样式', $('#plList .pl-item[data-id="' + targetId + '"]').classList.contains('visited'));
$('#plList .pl-item[data-id="' + targetId + '"] [data-action="pl-done"]').click();
check('再次点击取消去过', window.eval("places.find(p=>p.id==='" + targetId + "').visited") === false);

// 7) 删除地点(保留带「国内」的西湖,供后续重命名测试)
const delId = ids()[1];
$('#plList .pl-item[data-id="' + delId + '"] [data-action="pl-del"]').click();
check('删除后剩 2 个', window.eval("places.length") === 2);

// 8) 重命名分类(同步地点)
window.eval("renamePlaceCat('国内','省内');");
check('重命名后 placeCats 更新', window.eval("placeCats.includes('省内') && !placeCats.includes('国内')"));
check('重命名同步已用该分类的地点', window.eval("places.filter(p=>(p.category||'')==='省内').length>0"));
check('重命名同步到筛选 chips', $all('[data-pcat]').some(b => b.dataset.pcat === '省内'));

// 9) 删除分类(降级为未分类)
const before = window.eval("places.length");
const n = window.eval("deletePlaceCat('美食')");
check('删除分类从清单移除', window.eval("!placeCats.includes('美食')"));
check('删除分类返回受影响地点数>0', n > 0);
check('受影响地点降级为未分类', window.eval("places.filter(p=>!p.category).length") === n);
check('删除分类同步到下拉', !$all('#plCat option').some(o => o.value === '美食'));

// 10) 拖拽排序(自定义顺序)
check('自定义顺序 draggable=true', $('#plList .pl-item').getAttribute('draggable') === 'true');
const ord = ids();
const a = $('#plList .pl-item[data-id="' + ord[1] + '"]');
const b = $('#plList .pl-item[data-id="' + ord[0] + '"]');
fireDrag(a, 'dragstart'); fireDrag(b, 'dragover'); fireDrag(b, 'drop');
check('拖拽后数组顺序改变', ids()[0] === ord[1]);

// 11) 排序:按名称
window.eval("placeSortMode='name'; placeCatFilter='all'; renderPlacesList();");
const byName = window.eval("placesSorted().map(p=>p.name)");
check('按名称排序正确', JSON.stringify(byName) === JSON.stringify([...byName].sort((x,y)=>x.localeCompare(y,'zh'))));
check('非自定义模式不可拖拽', $('#plList .pl-item').getAttribute('draggable') === null);

// 12) 排序:按分类
window.eval("placeSortMode='category'; renderPlacesList();");
const byCat = window.eval("placesSorted().map(p=>p.category||'未分类')");
check('按分类排序正确', JSON.stringify(byCat) === JSON.stringify([...byCat].sort((x,y)=>x.localeCompare(y,'zh'))));

// 13) 排序:按添加时间
window.eval("placeSortMode='time'; renderPlacesList();");
const byTime = window.eval("placesSorted().map(p=>p.createdAt)");
check('按添加时间倒序', byTime.every((v,i,a)=> i===0 || a[i-1] >= v));

// 14) 按分类筛选(点击 chip)
window.eval("placeSortMode='custom'; placeCatFilter='all'; renderPlacesList();");
$('#plCatChips').querySelector('[data-pcat="省内"]').click();
check('点击分类 chip 触发筛选', window.eval("placeCatFilter") === '省内');
check('分类筛选只显示该类', window.eval("placesSorted().every(p=>(p.category||'未分类')==='省内')") && window.eval("placesSorted().length>0"));
check('被点中的 chip 高亮', $('#plCatChips').querySelector('[data-pcat="省内"]').classList.contains('active'));
$('#plCatChips').querySelector('[data-pcat="all"]').click();
check('点「全部」还原', window.eval("placeCatFilter") === 'all');

// 15) 「想去/已去过」筛选已移除
check('不再有 data-pfilter 按钮', $all('[data-pfilter]').length === 0);

// 16) 统计卡片
const statText = $('#plStats').textContent;
check('统计含「收集地点」', statText.includes('收集地点'));
check('统计含「分类数」', statText.includes('分类数'));

// 17) 持久化
window.eval("savePlaces(); savePlaceCats();");
check('已写入 places 存储', !!window.localStorage.getItem('liumo_places'));
check('已写入 cats 存储', !!window.localStorage.getItem('liumo_place_cats'));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
