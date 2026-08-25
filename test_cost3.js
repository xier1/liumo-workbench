// 成本核算（全局固定成本项：大表单增删改 + 按月逐项填金额 + 汇总）
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: () => () => {} }); };
    window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,FAKE'; };
    window.Image = class { constructor() { this.onload = null; this.onerror = null; this.width = 2000; this.height = 1000; this._src = ''; } set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); } get src() { return this._src; } };
    window.fetch = () => Promise.reject(new Error('no-net'));
    window.confirm = () => true;
  }
});

const { window } = dom;
const { document } = window;
const evalIn = code => window.eval(code);
const results = [];
function check(name, cond) { results.push({ name, pass: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name); }
function $(s) { return document.querySelector(s); }
function $all(s) { return [...document.querySelectorAll(s)]; }
function fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); }
function renderCost() { evalIn('currentModule="cost"; renderContent();'); }
function adminRows() { return $all('#coItemList .co-admin-row'); }
function formRows() { return $all('#costFormItems .co-form-row'); }
function fillItem(name, amount) { const r = formRows().find(x => x.querySelector('.co-form-amt').dataset.item === name); if (r) r.querySelector('.co-form-amt').value = amount; }

setTimeout(() => {
  try {
    // 初始化默认成本项
    evalIn('costItems=[]; costLogs=[]; loadCostItems();');
    renderCost();
    check('成本项管理大表单存在(coItemList)', !!$('#coItemList'));
    check('默认加载6个固定成本项', adminRows().length === 6);
    check('默认含「房租」', evalIn('costItems.map(i=>i.name).join(",")').includes('房租'));
    check('录入区按成本项生成6行表单', formRows().length === 6);
    check('添加成本项按钮存在(coItemAddBtn)', !!$('#coItemAddBtn'));

    // 添加成本项
    $('#coItemAddBtn').click();
    check('添加后变为7项', adminRows().length === 7);
    check('新项默认名为「新成本项」', adminRows()[6].querySelector('.co-admin-name').value === '新成本项');
    check('录入表单同步为7行', formRows().length === 7);

    // 改名第一个为「物业费」
    const firstInp = adminRows()[0].querySelector('.co-admin-name');
    firstInp.value = '物业费';
    fire(firstInp, 'change');
    check('改名后 costItems[0]=物业费', evalIn('costItems[0].name') === '物业费');
    check('录入表单标签同步为物业费', formRows()[0].querySelector('.co-form-name').textContent === '物业费');

    // 删除成本项会清理历史金额：先造一条含「人工」的历史
    evalIn('costLogs=[{id:uid(),date:"2026-07",items:[{name:"人工",amount:1000},{name:"房租",amount:5000}],note:"",createdAt:Date.now(),updatedAt:Date.now()}]; saveCostLogs();');
    const before = adminRows().length;
    $all('#coItemList .co-admin-del')[1].click(); // 删第2项「人工」
    check('删除成本项后项数减1', adminRows().length === before - 1);
    check('历史中该成本项金额被清理(仅剩房租)', evalIn('JSON.stringify(costLogs.find(r=>r.date==="2026-07").items)') === '[{"name":"房租","amount":5000}]');

    // 清空历史，开始录入测试
    evalIn('costLogs=[]; saveCostLogs();');
    renderCost();
    fillItem('物业费', 3000);
    fillItem('进货成本', 20000);
    fillItem('水电', 800);
    $('#costAddBtn').click();
    check('记录后 costLogs 有1条', evalIn('costLogs.length') === 1);
    check('2026-08 总支出=23800', evalIn('costRecTotal(costLogs[0])') === 23800);
    check('成本汇总含「物业费」', $('#coSummary').textContent.includes('物业费'));
    check('成本汇总含「进货成本」', $('#coSummary').textContent.includes('进货成本'));

    // 同月覆盖
    renderCost();
    fillItem('物业费', 3500);
    fillItem('损耗', 500);
    $('#costAddBtn').click();
    check('同月覆盖后仍1条', evalIn('costLogs.length') === 1);
    check('覆盖后总支出=4000', evalIn('costRecTotal(costLogs[0])') === 4000);

    // 月度矩阵列顺序按成本项清单
    const ths = $all('#coMatrix thead th').map(t => t.textContent);
    check('矩阵首列=月份', ths[0] === '月份');
    check('矩阵含「物业费」列', ths.includes('物业费'));
    check('矩阵含「损耗」列', ths.includes('损耗'));
    check('物业费列排在损耗列之前(按清单顺序)', ths.indexOf('物业费') < ths.indexOf('损耗'));

    // 编辑载入
    $('[data-action="co-edit"]').click();
    check('编辑载入月份=2026-08', $('#costMonth').value === '2026-08');
    check('编辑载入物业费回填3500', formRows().find(r => r.querySelector('.co-form-amt').dataset.item === '物业费').querySelector('.co-form-amt').value === '3500');

    // 删除记录
    $('[data-action="co-del"]').click();
    check('删除记录后 costLogs 为空', evalIn('costLogs.length') === 0);

    // 旧格式迁移
    evalIn('localStorage.setItem("liumo_cost_logs", JSON.stringify([{id:"x",date:"2026-06",category:"生鲜",cost:40000,loss:2000,sale:80000}])); loadCost();');
    check('旧格式(category/cost/loss)迁移为成本项', evalIn('JSON.stringify(costLogs[0].items)') === '[{"name":"生鲜","amount":40000},{"name":"损耗","amount":2000}]');

  } catch (e) {
    check('测试执行未抛异常: ' + e.message, false);
    console.log(e.stack);
  }
  const passed = results.filter(r => r.pass).length;
  console.log(`\n结果: ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}, 300);
