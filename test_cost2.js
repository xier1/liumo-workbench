// 成本核算重做（自定义成本项 + 汇总）功能测试
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
    window.fetch = () => Promise.reject(new Error('no-net-in-test'));
    window.confirm = () => true;
  }
});

const { window } = dom;
const { document } = window;
function evalIn(code) { return window.eval(code); }
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return [...document.querySelectorAll(sel)]; }
function setVal(el, v) { el.value = v; }
function renderCost() { evalIn('currentModule="cost"; renderContent();'); }

const results = [];
function check(name, cond) {
  results.push({ name, pass: !!cond });
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
}

setTimeout(() => {
  try {
    evalIn('costLogs = []; saveCostLogs();');
    renderCost();

    console.log('\n[1] 初始空状态');
    check('统计卡片渲染', $('#coStats') && $('#coStats').children.length > 0);
    check('成本项表单默认一行', $all('.co-item-row').length === 1);
    check('汇总为空提示', $('#coSummary').textContent.includes('暂无数据'));

    console.log('\n[2] 添加一条含自定义成本项的记录 (2026-08)');
    setVal($('#costMonth'), '2026-08');
    setVal($('#costNote'), '总店');
    let rows = $all('.co-item-row');
    setVal(rows[0].querySelector('.co-item-name'), '房租');
    setVal(rows[0].querySelector('.co-item-amount'), '8000');
    $('#costAddItemBtn').click();
    rows = $all('.co-item-row');
    setVal(rows[1].querySelector('.co-item-name'), '人工');
    setVal(rows[1].querySelector('.co-item-amount'), '12000');
    $('#costAddItemBtn').click();
    rows = $all('.co-item-row');
    setVal(rows[2].querySelector('.co-item-name'), '进货');
    setVal(rows[2].querySelector('.co-item-amount'), '50000');
    $('#costAddBtn').click();

    check('记录后总支出=70,000', $('#coStats').textContent.includes('70,000'));
    check('记录月份=1', $('#coStats').textContent.includes('1 个月'));
    check('成本项种类=3', $('#coStats').textContent.includes('3 类'));
    check('汇总含“房租”', $('#coSummary').textContent.includes('房租'));
    check('汇总含“人工”', $('#coSummary').textContent.includes('人工'));
    check('汇总合计行=70,000 元', $('#coSummary').textContent.includes('70,000 元'));
    check('矩阵含月份 2026-08', $('#coMatrix').textContent.includes('2026-08'));
    check('矩阵合计列=70,000', $('#coMatrix').textContent.includes('70,000'));
    check('列表含 3 项', $('#coList').textContent.includes('共 3 项'));

    console.log('\n[3] 同月再记录 → 覆盖(upsert)，不新增月份');
    setVal($('#costMonth'), '2026-08');
    rows = $all('.co-item-row');
    setVal(rows[0].querySelector('.co-item-name'), '房租');
    setVal(rows[0].querySelector('.co-item-amount'), '9000');
    $('#costAddItemBtn').click();
    rows = $all('.co-item-row');
    setVal(rows[1].querySelector('.co-item-name'), '水电');
    setVal(rows[1].querySelector('.co-item-amount'), '3000');
    $('#costAddBtn').click();
    check('覆盖后月份仍=1', $('#coStats').textContent.includes('1 个月'));
    check('覆盖后总支出=12,000', $('#coStats').textContent.includes('12,000'));
    check('汇总不再含“人工”', !$('#coSummary').textContent.includes('人工'));
    check('汇总含“水电”', $('#coSummary').textContent.includes('水电'));

    console.log('\n[4] 添加第二个月 (2026-09)');
    setVal($('#costMonth'), '2026-09');
    rows = $all('.co-item-row');
    setVal(rows[0].querySelector('.co-item-name'), '房租');
    setVal(rows[0].querySelector('.co-item-amount'), '8000');
    $('#costAddItemBtn').click();
    rows = $all('.co-item-row');
    setVal(rows[1].querySelector('.co-item-name'), '进货');
    setVal(rows[1].querySelector('.co-item-amount'), '60000');
    $('#costAddBtn').click();
    check('月份=2', $('#coStats').textContent.includes('2 个月'));
    check('总支出=80,000', $('#coStats').textContent.includes('80,000'));
    const sumTxt = $('#coSummary').textContent;
    const idx = sumTxt.indexOf('房租');
    check('“房租”跨月汇总=17,000', idx >= 0 && /\b17,000\b/.test(sumTxt.slice(idx, idx + 40)));

    console.log('\n[5] 编辑载入');
    $('#coList [data-action="co-edit"]').click();
    check('编辑载入后月份=2026-09', $('#costMonth').value === '2026-09');
    check('编辑载入后成本项行数=2', $all('.co-item-row').length === 2);

    console.log('\n[6] 删除一条记录');
    $('#coList [data-action="co-del"]').click();
    check('删除后月份=1', $('#coStats').textContent.includes('1 个月'));

    console.log('\n[7] 旧版数据兼容(迁移)');
    evalIn('localStorage.setItem("liumo_cost_logs", JSON.stringify([{id:"x1",date:"2026-05",category:"生鲜",cost:40000,sale:90000,loss:2000}])); loadCost();');
    renderCost();
    check('旧数据迁移后月份=1', $('#coStats').textContent.includes('1 个月'));
    check('旧数据“生鲜”转为成本项', $('#coSummary').textContent.includes('生鲜'));
    check('旧数据“损耗”转为成本项', $('#coSummary').textContent.includes('损耗'));
    check('旧数据总支出=42,000(进货40000+损耗2000)', $('#coStats').textContent.includes('42,000'));

  } catch (e) {
    check('测试执行未抛异常: ' + e.message, false);
    console.log(e.stack);
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n结果: ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}, 400);
