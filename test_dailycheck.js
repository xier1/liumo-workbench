// 每日检查（果然鲜 · 二级类目，原「其他」）功能测试
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

setTimeout(() => {
  try {
    const freshMod = evalIn('MODULES.find(m => m.id === "fresh")');
    check('fresh 模块存在且有 children', freshMod && Array.isArray(freshMod.children) && freshMod.children.length === 2);
    check('子分类含「每日检查」(id=dailycheck)', freshMod.children.some(c => c.id === 'dailycheck' && c.name === '每日检查'));
    check('原「其他」子分类已移除', !freshMod.children.some(c => c.id === 'other'));

    window.localStorage.clear();
    evalIn('currentSub = "dailycheck"; renderFreshModule(document.getElementById("content"), MODULES.find(m=>m.id==="fresh"));');

    check('页面标题为「每日检查」', document.querySelector('.page-title') && document.querySelector('.page-title').textContent === '每日检查');
    const items0 = [...document.querySelectorAll('#dcList .dc-item')];
    check('默认渲染 8 条检查项', items0.length === 8);
    check('进度文本为 已完成 0/8', document.getElementById('dcProgressText') && document.getElementById('dcProgressText').textContent === '已完成 0/8');
    check('进度条宽度为 0%', document.getElementById('dcFill') && document.getElementById('dcFill').style.width === '0%');

    // 勾选第一条
    items0[0].querySelector('[data-act="toggle"]').click();
    check('勾选后进度文本 已完成 1/8', document.getElementById('dcProgressText').textContent === '已完成 1/8');
    check('勾选后首条标记 done', document.querySelector('#dcList .dc-item').classList.contains('done'));
    check('localStorage 已持久化 done', JSON.parse(window.localStorage.getItem('liumo_dailycheck'))[0].done === true);

    // 删除第二条
    const before = document.querySelectorAll('#dcList .dc-item').length;
    document.querySelectorAll('#dcList .dc-item')[1].querySelector('[data-act="del"]').click();
    check('删除后少一条', document.querySelectorAll('#dcList .dc-item').length === before - 1);

    // 添加检查项
    document.getElementById('dcAdd').click();
    check('点击添加后出现输入行', !document.getElementById('dcAddRow').hidden);
    document.getElementById('dcInput').value = '测试新增项';
    document.getElementById('dcAddConfirm').click();
    const texts = [...document.querySelectorAll('#dcList .dc-text')].map(e => e.textContent);
    check('新增项出现在列表中', texts.includes('测试新增项'));
    check('新增后输入行重新隐藏', document.getElementById('dcAddRow').hidden === true);

    // 重置今日
    document.getElementById('dcReset').click();
    check('重置后无 done 项', [...document.querySelectorAll('#dcList .dc-item')].every(li => !li.classList.contains('done')));
    check('重置后进度回到 已完成 0/', document.getElementById('dcProgressText').textContent.indexOf('已完成 0/') === 0);

    // 死代码已清理
    check('已移除 renderFreshOther', evalIn('typeof renderFreshOther') === 'undefined');
    check('已移除 fetchFreshWeather', evalIn('typeof fetchFreshWeather') === 'undefined');
    check('已移除 fetchFreshHistory', evalIn('typeof fetchFreshHistory') === 'undefined');

  } catch (e) {
    check('测试过程未抛异常: ' + e.message, false);
    console.error(e);
  }
  const pass = results.filter(r => r.pass).length;
  console.log('\n结果: ' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
}, 100);
