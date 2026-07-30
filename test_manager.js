// 学做店长 功能测试
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
    window.Image = class { constructor() { this.onload = null; this.width = 2000; this.height = 1000; } set src(v) { if (this.onload) setTimeout(() => this.onload(), 0); } };
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
    // 1. MODULES 含 manager 且启用
    const m = evalIn('MODULES.find(x => x.id === "manager")');
    check('MODULES 含 manager 且 enabled', m && m.enabled === true);
    check('manager 名称与图标正确', m && m.name === '学做店长' && /<svg/.test(m.icon));

    // 2. 渲染模块
    window.localStorage.clear();
    evalIn('currentModule = "manager"; renderContent();');
    check('页面标题为学做店长', document.querySelector('.page-title') && document.querySelector('.page-title').textContent === '学做店长');
    check('渲染知识地图 6 张卡片', document.querySelectorAll('.mg-knowledge .mg-kcard').length === 6);
    check('三块硬功夫渲染', document.querySelectorAll('.mg-skills .mg-skill').length === 3);
    check('30–90 天任务渲染 3 条', document.querySelectorAll('.mg-tasks .mg-task').length === 3);
    check('工具区渲染 3 条', document.querySelectorAll('.mg-tools .mg-tool').length === 3);

    // 3. 优先级标记
    check('含第一/二/三优先级卡片', document.querySelectorAll('.mg-kcard.mg-first').length === 2 && document.querySelectorAll('.mg-kcard.mg-second').length === 2 && document.querySelectorAll('.mg-kcard.mg-third').length === 2);

    // 4. 打卡交互 + 进度 + 持久化
    const tasks = [...document.querySelectorAll('.mg-task')];
    const first = tasks[0];
    const txt = first.dataset.task;
    check('初始进度 0/3', document.querySelector('#mgProgressLabel').textContent.indexOf('0/3') !== -1);
    first.click();
    check('点击后任务标记 done', first.classList.contains('done'));
    check('点击后进度 1/3', document.querySelector('#mgProgressLabel').textContent.indexOf('1/3') !== -1);
    check('打卡状态持久化', JSON.parse(window.localStorage.getItem('liumo_manager_done'))[txt] === true);
    // 再点取消
    first.click();
    check('再次点击取消打卡', !first.classList.contains('done') && document.querySelector('#mgProgressLabel').textContent.indexOf('0/3') !== -1);

    // 5. 全部打卡 -> 进度 3/3
    tasks.forEach(t => { if (!t.classList.contains('done')) t.click(); });
    check('全部打卡后进度 3/3', document.querySelector('#mgProgressLabel').textContent.indexOf('3/3') !== -1);
    check('进度条宽度 100%', document.querySelector('#mgProgressFill').style.width === '100%');

    const failed = results.filter(r => !r.pass);
    console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`);
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error('测试异常:', e);
    process.exit(2);
  }
}, 200);
