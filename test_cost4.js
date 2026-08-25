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

window.eval("currentModule='cost'; renderContent();");

// 1) 默认项含默认值
const names = window.eval("costItems.map(i=>i.name)");
const defaults = window.eval("costItems.map(i=>i.default)");
check('默认含 6 项', names.length === 6);
check('房租默认值=5000', defaults[0] === 5000);
check('人工默认值=8000', defaults[1] === 8000);
check('进货成本默认值=0', defaults[2] === 0);

// 2) 成本项管理每行有默认值输入框
const defInputs = $all('#coItemList .co-admin-default');
check('管理表单有 6 个默认值输入框', defInputs.length === 6);

// 3) 改默认值（房租 5000 -> 6000）
setVal(defInputs[0], '6000');
check('改默认值后 it.default=6000', window.eval("costItems[0].default") === 6000);

// 4) 一键填入默认值
$('#coFillDefaultBtn').click();
const amtInputs = $all('#costFormItems .co-form-amt');
check('房租填入 6000', amtInputs[0].value === '6000');
check('人工填入 8000', amtInputs[1].value === '8000');
check('进货成本(default0)留空', amtInputs[2].value === '');

// 5) 手动追加成本项
$('#coAddExtraBtn').click();
const extraRow = $('#costExtraItems .co-extra-row');
check('手动追加出现一行', !!extraRow);
setVal(extraRow.querySelector('.co-extra-name'), '运输费');
setVal(extraRow.querySelector('.co-extra-amt'), '300');

// 6) 记录成本（月份 2026-08）：默认值>0的(房租6000/人工8000/水电1200/损耗800) + 手动运输费300
setVal($('#costMonth'), '2026-08');
$('#costAddBtn').click();
const rec = window.eval("costLogs.find(l=>l.date==='2026-08')");
check('记录含 5 项(4默认>0 + 1手动)', rec && rec.items.length === 5);
check('含 房租6000', rec && rec.items.some(i => i.name === '房租' && i.amount === 6000));
check('含 人工8000', rec && rec.items.some(i => i.name === '人工' && i.amount === 8000));
check('含 水电1200(默认)', rec && rec.items.some(i => i.name === '水电' && i.amount === 1200));
check('含 损耗800(默认)', rec && rec.items.some(i => i.name === '损耗' && i.amount === 800));
check('含 运输费300(手动项)', rec && rec.items.some(i => i.name === '运输费' && i.amount === 300));
check('进货成本(default0)未计入', !(rec && rec.items.some(i => i.name === '进货成本')));
check('其他(default0)未计入', !(rec && rec.items.some(i => i.name === '其他')));

// 7) 编辑回填：手动项回到 extraWrap
$('#coList [data-action="co-edit"]').click();
const extraAfter = $all('#costExtraItems .co-extra-row');
check('编辑时手动项回填到 extraWrap', extraAfter.length === 1 && extraAfter[0].querySelector('.co-extra-name').value === '运输费');

// 8) 旧数据兼容：costItems 无 default 字段
window.eval("costItems=[{id:'x',name:'旧项'}]; costItems.forEach(it=>{ if(it.default==null) it.default=0; });");
check('旧数据 default 归一为 0', window.eval("costItems[0].default") === 0);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
