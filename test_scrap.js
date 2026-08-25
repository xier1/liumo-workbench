// 废品结算（按月+截止日）功能测试：结算可重复点击、截止日拆分已结算/未结算、取消结算、旧数据兼容
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

const results = [];
function check(name, cond) {
  results.push({ name, pass: !!cond });
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
}

const M = '2026-08';

function renderScrap() { evalIn('currentModule = "scrap"; renderContent();'); }
function addLog(date, amount) {
  evalIn(`scrapLogs.push({id:uid(), date:"${date}", amount:${amount}, note:"", createdAt:Date.now(), updatedAt:Date.now()});`);
}
function monthRow() { return document.querySelector('#scMonth table tbody tr'); }
function cellText(row, i) { return row.cells[i].textContent.trim(); }
function settleBtn() { return document.querySelector('[data-action="sc-settle"][data-month="' + M + '"]'); }
function unsettleBtn() { return document.querySelector('[data-action="sc-unsettle"][data-month="' + M + '"]'); }
function dateInput() { return document.querySelector('.sc-settle-date[data-month="' + M + '"]'); }
function confirmBtn() { return document.querySelector('[data-action="sc-settle-confirm"][data-month="' + M + '"]'); }

setTimeout(() => {
  try {
    // 准备数据: 8/5(100) 8/12(200) 8/20(300)
    evalIn('scrapLogs = []; scrapSettled = {}; scrapSettleMonth = null;');
    addLog('2026-08-05', 100);
    addLog('2026-08-12', 200);
    addLog('2026-08-20', 300);
    renderScrap();

    // 初始: 全部未结算
    let row = monthRow();
    check('初始已结算为 —', cellText(row, 2) === '—');
    check('初始未结算为 600', cellText(row, 3) === '600');
    check('初始结算日显示为 —', cellText(row, 4) === '—');
    check('初始「结算」按钮存在且可点', !!settleBtn() && settleBtn().disabled === false);
    check('初始「取消结算」按钮禁用', unsettleBtn() && unsettleBtn().disabled === true);
    check('月度表外套横向滚动容器(防溢出)', !!document.querySelector('#scMonth .wt-cat-wrap table.wt-cat'));

    // 点击「结算」→ 进入截止日选择(行内日期输入 + 确认/取消), 结算按钮暂时消失
    settleBtn().click();
    check('点击结算后出现行内日期输入', !!dateInput());
    check('点击结算后出现「确认」按钮', !!confirmBtn());
    check('进入选择态后「结算」按钮暂时不可见', !settleBtn());

    // 选截止日 8/15 并确认
    dateInput().value = '2026-08-15';
    confirmBtn().click();
    check('确认后 scrapSettled 记录截止日', evalIn('scrapSettled["' + M + '"].date') === '2026-08-15');
    check('确认后 scrapSettled 含结算快照 ts', typeof evalIn('scrapSettled["' + M + '"].ts') === 'number');
    row = monthRow();
    check('截止8/15: 已结算=300(8/5+8/12)', cellText(row, 2) === '300');
    check('截止8/15: 未结算=300(8/20)', cellText(row, 3) === '300');
    check('结算日列显示 08-15(MM-DD)', cellText(row, 4) === '08-15');

    // 关键修复: 结算后再次点击「结算」应当有响应(此前被 disabled)
    check('结算后「结算」按钮重新出现且可点', !!settleBtn() && settleBtn().disabled === false);
    settleBtn().click();
    check('再次点击结算能重新进入截止日选择', !!dateInput() && !!confirmBtn());

    // 改为截止月末, 全部结清
    dateInput().value = '2026-08-31';
    confirmBtn().click();
    row = monthRow();
    check('截止月末: 已结算=600', cellText(row, 2) === '600');
    check('截止月末: 未结算=—', cellText(row, 3) === '—');
    check('截止月末: 结算日=08-31(MM-DD)', cellText(row, 4) === '08-31');
    check('已结算态下「取消结算」按钮可点', unsettleBtn() && unsettleBtn().disabled === false);

    // 取消结算: 清空
    unsettleBtn().click();
    row = monthRow();
    check('取消结算后无 scrapSettled 记录', evalIn('scrapSettled["' + M + '"]') === undefined);
    check('取消结算后已结算=—', cellText(row, 2) === '—');
    check('取消结算后未结算=600', cellText(row, 3) === '600');
    check('取消结算后「结算」按钮可点 again', settleBtn() && settleBtn().disabled === false);

    // 旧版整月快照兼容: {total,count} 无 date → 归一化为月末
    evalIn('localStorage.setItem("liumo_scrap_settled", JSON.stringify({"2026-07":{total:500,count:3}})); loadScrap();');
    check('旧格式结算归一化为月末截止日', evalIn('scrapSettled["2026-07"].date') === '2026-07-31');

    // 回归: 结算后再添加记录应算「未结算」(修复:新增记录的日期<=截止日却被算成已结算)
    evalIn('scrapLogs = [{id:uid(),date:"2026-08-05",amount:100,note:"",createdAt:1000,updatedAt:1000}]; scrapSettled = {}; scrapSettleMonth = null;');
    renderScrap();
    settleBtn().click();
    dateInput().value = '2026-08-31';
    confirmBtn().click();
    check('结算月末后全部已结算(未结算=—)', cellText(monthRow(), 3) === '—');
    // 结算之后新增一条当月记录(日期 <= 截止日), 应显示为未结算
    evalIn('scrapLogs.push({id:uid(),date:"2026-08-20",amount:50,note:"",createdAt:Date.now(),updatedAt:Date.now()}); saveScrapLogs(); currentModule="scrap"; renderContent();');
    check('结算后新增记录算未结算(未结算=50)', cellText(monthRow(), 3) === '50');


  } catch (e) {
    check('测试执行未抛异常: ' + e.message, false);
    console.log(e.stack);
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n结果: ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}, 300);
