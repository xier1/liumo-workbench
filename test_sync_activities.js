// 验证「活动列表」数据已纳入通用云端同步（GitHub Gist）范围
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.com/',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, { get: () => () => {} });
    };
    window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,FAKE'; };
    window.Image = class { constructor() { this.onload = null; this.width = 10; this.height = 10; this._s = ''; } set src(v) { this._s = v; if (this.onload) setTimeout(() => this.onload(), 0); } get src() { return this._s; } };
    window.fetch = () => Promise.reject(new Error('no-net'));
    window.confirm = () => true;
  }
});
const { window } = dom;
const { document } = window;
const evalIn = (c) => window.eval(c);

const results = [];
const check = (n, c) => { results.push({ n, p: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n); };
function finishSyncTests() {
  const passed = results.filter(r => r.p).length;
  console.log(`\n==== ${passed}/${results.length} 通过 ====`);
  process.exit(passed === results.length ? 0 : 1);
}

setTimeout(() => {
  try {
    window.localStorage.clear();

    // 本地写入一条活动 + 一个无关的非同步键 + 本地已配置的同步 token
    window.localStorage.setItem('liumo_activities_fresh', JSON.stringify([
      { id: 'a1', title: '本地活动', category: 'daily', detail: '', images: ['data:image/jpeg;base64,LOC'], createdAt: 1, updatedAt: 1 }
    ]));
    window.localStorage.setItem('some_other_key', 'x');
    window.localStorage.setItem('liumo_sync_token', 'tok123'); // 本地已存在的同步凭证

    // 1) gatherLocal 应包含活动键
    const gathered = evalIn('gatherLocal()');
    check('gatherLocal 已收集活动键 liumo_activities_fresh', !!gathered['liumo_activities_fresh']);
    check('gatherLocal 不含 SYNC_ 配置键', !Object.keys(gathered).some(k => k.indexOf('liumo_sync_') === 0));

    // 2) 模拟一次跨设备恢复：云端快照里是另一条活动（不含同步凭证，凭证应保持本地）
    const snap = {
      updatedAt: '2026-07-30T00:00:00Z',
      data: {
        'liumo_activities_fresh': JSON.stringify([
          { id: 'a2', title: '云端活动', category: 'festival', detail: '来自云端', images: ['data:image/jpeg;base64,REM'], createdAt: 2, updatedAt: 2 }
        ])
      }
    };
    evalIn('applyCloudSnapshot(' + JSON.stringify(snap) + ', { setLastPush: true })');

    setTimeout(() => {
      const acts = JSON.parse(window.localStorage.getItem('liumo_activities_fresh') || '[]');
      check('恢复后活动为云端版本（标题=云端活动）', acts.length === 1 && acts[0].title === '云端活动');
      check('恢复后类别/图片一并还原', acts[0].category === 'festival' && acts[0].images[0].indexOf('data:image') === 0);
      check('本地 SYNC token 在恢复时被保留（云端不覆盖凭证）', window.localStorage.getItem('liumo_sync_token') === 'tok123');
      check('快照未包含的本地非同步键被清理', window.localStorage.getItem('some_other_key') === null);
      check('readActivities 能读到恢复后的活动', evalIn('readActivities()').length === 1 && evalIn('readActivities()')[0].title === '云端活动');

      // 3) 重新渲染活动列表不应报错，且能展示恢复的数据（活动为节日类，切到对应页签）
      evalIn('currentSub = "activities"; actTab = "festival"; renderFreshActivities(document.getElementById("content"), MODULES.find(m=>m.id==="fresh"));');
      const cards = [...document.querySelectorAll('#act-list .act-card')];
      check('恢复后列表渲染出云端活动卡片', cards.some(c => c.querySelector('.act-card-title').textContent === '云端活动'));

      // 4) 数据过大降级：活动图片过多导致 payload 超限时，应跳过图片后仍发起同步
      window.localStorage.clear();
      window.localStorage.setItem('liumo_sync_token', 'tok');
      window.localStorage.setItem('liumo_sync_gist', 'g1');
      window.__fc = 0; window.__lastBody = null;
      window.fetch = (url, opts) => { window.__fc++; window.__lastBody = opts && opts.body; return Promise.reject(new Error('no-net')); };
      window.localStorage.setItem('liumo_activities_fresh', JSON.stringify([
        { id: 'big', title: '大图', category: 'daily', detail: '文字保留', images: ['data:image/jpeg;base64,' + 'A'.repeat(1200000)], createdAt: 1, updatedAt: 1 }
      ]));
      evalIn('syncPushNow(true, { force: true })');
      setTimeout(() => {
        check('超大 payload 时降级同步仍发起请求（跳过图片）', window.__fc === 1);
        let pushed = null;
        try { const p = JSON.parse(window.__lastBody); pushed = JSON.parse(p.files['liumo-workbench-data.json'].content); } catch (e) {}
        const acts = pushed && pushed.data && JSON.parse(pushed.data['liumo_activities_fresh'] || '[]');
        check('降级后活动图片被剥离、文字保留', !!acts && acts.length === 1 && !('images' in acts[0] && acts[0].images) && acts[0].title === '大图' && acts[0].detail === '文字保留');
        finishSyncTests();
      }, 40);
    }, 80);
  } catch (e) {
    console.error('TEST ERROR:', e);
    process.exit(2);
  }
}, 100);
