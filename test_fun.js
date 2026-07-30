// 爆笑一下 功能测试
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
    // 1. MODULES 包含 fun 且启用
    const funMod = evalIn('MODULES.find(m => m.id === "fun")');
    check('MODULES 含 fun 且 enabled', funMod && funMod.enabled === true);
    check('fun 有名称与图标', funMod && funMod.name === '爆笑一下' && /<svg/.test(funMod.icon));

    // 2. 渲染信息流
    window.localStorage.clear();
    evalIn('currentModule = "fun"; renderContent();');
    const cards = [...document.querySelectorAll('#funFeed .fun-card')];
    check('渲染出 12 条信息流卡片', cards.length === 12);
    check('页面标题为爆笑一下', document.querySelector('.page-title') && document.querySelector('.page-title').textContent === '爆笑一下');
    check('存在换一批按钮', !!document.getElementById('funRefresh'));
    check('存在数据来源说明横幅', !!document.querySelector('.fun-note') && /抖音/.test(document.querySelector('.fun-note').textContent));

    // 3. 每条卡片含作者/标签/来源链接
    const first = cards[0];
    check('卡片含头像与作者', !!first.querySelector('.fun-avatar') && !!first.querySelector('.fun-name'));
    check('卡片含标签', !!first.querySelector('.fun-tag'));
    check('卡片含来源链接且指向真实 URL', (() => { const a = first.querySelector('.fun-src'); return a && /^https?:\/\//.test(a.href); })());
    check('文本卡片渲染段子正文', !!first.querySelector('.fun-text'));

    // 4. 视频卡片渲染播放块
    const videoCards = [...document.querySelectorAll('#funFeed .fun-video')];
    check('至少 3 条视频卡片(抖音热榜/抖音/抖音搜索)', videoCards.length >= 3);
    check('视频卡片可点击跳转', videoCards.every(a => /^https?:\/\//.test(a.href)));

    // 5. 点赞交互 + 持久化
    const likeBtn = document.querySelector('#funFeed .fun-like');
    const id = likeBtn.dataset.id;
    const before = parseInt(likeBtn.querySelector('.fun-like-cnt').textContent, 10);
    likeBtn.click();
    const after = parseInt(likeBtn.querySelector('.fun-like-cnt').textContent, 10);
    check('点赞后计数 +1', after === before + 1);
    check('点赞后按钮加 liked 类', likeBtn.classList.contains('liked'));
    const saved = JSON.parse(window.localStorage.getItem('liumo_fun_likes') || '{}');
    check('点赞状态持久化到 localStorage', saved[id] === true);
    // 取消点赞
    likeBtn.click();
    check('再次点击取消点赞', !likeBtn.classList.contains('liked') && parseInt(likeBtn.querySelector('.fun-like-cnt').textContent, 10) === before);

    // 6. 换一批: 重排顺序并持久化
    const orderBefore = JSON.parse(window.localStorage.getItem('liumo_fun_order') || '[]');
    check('初始顺序已持久化', Array.isArray(orderBefore) && orderBefore.length === 12);
    // 强制可复现的随机排列
    let seq = 0; const origRandom = window.Math.random; window.Math.random = () => { seq = (seq + 0.37) % 1; return seq; };
    document.getElementById('funRefresh').click();
    window.Math.random = origRandom;
    const orderAfter = JSON.parse(window.localStorage.getItem('liumo_fun_order') || '[]');
    check('换一批后仍为 12 条且顺序变化', orderAfter.length === 12 && JSON.stringify(orderAfter) !== JSON.stringify(orderBefore));
    check('换一批后信息流仍是 12 张卡片', document.querySelectorAll('#funFeed .fun-card').length === 12);

    const failed = results.filter(r => !r.pass);
    console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`);
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error('测试异常:', e);
    process.exit(2);
  }
}, 200);
