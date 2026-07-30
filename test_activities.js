// 活动列表（果然鲜 · 二级类目）功能测试
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
    window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,FAKE_COMPRESSED'; };
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

// 打开弹窗表单（点击添加按钮）
function openForm() {
  document.getElementById('actAddBtn').click();
  return document.getElementById('actModal').classList.contains('open');
}

setTimeout(() => {
  try {
    const freshMod = evalIn('MODULES.find(m => m.id === "fresh")');
    check('fresh 模块存在且有 children', freshMod && Array.isArray(freshMod.children) && freshMod.children.length === 2);

    window.localStorage.clear();
    evalIn('currentSub = "activities"; renderFreshActivities(document.getElementById("content"), MODULES.find(m=>m.id==="fresh"));');

    // ---- 1. 初始渲染：默认「全部活动」页签，4 个页签，空态，无内联表单 ----
    const tabs0 = [...document.querySelectorAll('#act-tabs .act-tab')];
    check('渲染出 4 个页签（全部/日常/节日/群活动）', tabs0.length === 4 && tabs0.some(t => t.dataset.tab === 'all') && tabs0.some(t => t.dataset.tab === 'daily') && tabs0.some(t => t.dataset.tab === 'festival') && tabs0.some(t => t.dataset.tab === 'group'));
    check('「全部活动」为默认激活页签', document.querySelector('#act-tabs .act-tab.active') && document.querySelector('#act-tabs .act-tab.active').dataset.tab === 'all');
    check('初始计数 全部=0 日常=0 节日=0', document.querySelector('#act-tabs .act-tab[data-tab="all"] .act-count').textContent === '0' && document.querySelector('#act-tabs .act-tab[data-tab="daily"] .act-count').textContent === '0' && document.querySelector('#act-tabs .act-tab[data-tab="festival"] .act-count').textContent === '0');
    check('无数据时显示空态', !!document.querySelector('#act-list .empty-state'));
    check('内联表单不存在（表单在弹窗内）', !document.getElementById('act-title'));
    check('页面存在「添加活动」按钮', !!document.getElementById('actAddBtn'));
    check('弹窗初始隐藏', !document.getElementById('actModal').classList.contains('open'));

    // ---- 2. 点击添加按钮弹出表单 ----
    check('点击添加按钮后弹窗打开', openForm());
    check('弹窗内含标题输入（必填）', !!document.getElementById('act-title'));
    check('弹窗内含类别分段控件', !!document.getElementById('act-seg') && document.querySelectorAll('#act-seg .act-seg-btn').length === 3);
    check('弹窗内含详情文本域', !!document.getElementById('act-detail'));
    check('弹窗内含添加图片按钮与文件输入', !!document.getElementById('act-img-add') && !!document.getElementById('act-file'));
    check('默认类别为日常活动', document.querySelector('#act-seg .act-seg-btn.active').dataset.cat === 'daily');

    // ---- 3. 新增一条日常活动 ----
    document.getElementById('act-title').value = '社区试吃会';
    document.getElementById('act-detail').value = '周六上午 9 点，小区门口';
    document.getElementById('act-save').click();
    const stored1 = JSON.parse(window.localStorage.getItem('liumo_activities_fresh') || '[]');
    check('新增后写入 localStorage', stored1.length === 1);
    check('新增条目类别为 daily', stored1[0].category === 'daily');
    check('新增条目标题正确', stored1[0].title === '社区试吃会');
    check('列表已渲染该卡片（默认全部页签可见）', [...document.querySelectorAll('#act-list .act-card')].some(c => c.querySelector('.act-card-title').textContent === '社区试吃会'));
    check('全部计数变为 1', document.querySelector('#act-tabs .act-tab[data-tab="all"] .act-count').textContent === '1');
    check('日常计数变为 1', document.querySelector('#act-tabs .act-tab[data-tab="daily"] .act-count').textContent === '1');
    check('保存后弹窗关闭', !document.getElementById('actModal').classList.contains('open'));

    // ---- 4. 标题为空时不允许保存 ----
    openForm();
    const before = JSON.parse(window.localStorage.getItem('liumo_activities_fresh')).length;
    document.getElementById('act-title').value = '   ';
    document.getElementById('act-save').click();
    const after = JSON.parse(window.localStorage.getItem('liumo_activities_fresh')).length;
    check('标题为空时不写入', before === after);
    // 关闭弹窗（取消）
    document.getElementById('act-cancel').click();
    check('点击取消关闭弹窗', !document.getElementById('actModal').classList.contains('open'));

    // ---- 5. 切到节日活动页签并新增一条 ----
    document.querySelector('#act-tabs .act-tab[data-tab="festival"]').click();
    check('切到节日活动页签后激活态正确', document.querySelector('#act-tabs .act-tab.active').dataset.tab === 'festival');
    check('节日页签下空态', !!document.querySelector('#act-list .empty-state'));
    openForm();
    check('弹出表单后默认类别跟随页签(festival)', document.querySelector('#act-seg .act-seg-btn.active').dataset.cat === 'festival');
    document.getElementById('act-title').value = '中秋促销';
    document.getElementById('act-save').click();
    check('节日计数变为 1', document.querySelector('#act-tabs .act-tab[data-tab="festival"] .act-count').textContent === '1');
    check('节日页签只显示节日活动', [...document.querySelectorAll('#act-list .act-card')].every(c => c.querySelector('.act-badge.festival')));
    check('节日页签不显示日常活动', ![...document.querySelectorAll('#act-list .act-card')].some(c => c.querySelector('.act-badge.daily')));

    // ---- 6. 群活动 ----
    document.querySelector('#act-tabs .act-tab[data-tab="group"]').click();
    check('切到群活动页签后激活态正确', document.querySelector('#act-tabs .act-tab.active').dataset.tab === 'group');
    check('群活动页签下空态', !!document.querySelector('#act-list .empty-state'));
    openForm();
    check('弹出表单后默认类别跟随页签(group)', document.querySelector('#act-seg .act-seg-btn.active').dataset.cat === 'group');
    document.getElementById('act-title').value = '业主群接龙';
    document.getElementById('act-save').click();
    const storedG = JSON.parse(window.localStorage.getItem('liumo_activities_fresh'));
    check('群活动计数变为 1', document.querySelector('#act-tabs .act-tab[data-tab="group"] .act-count').textContent === '1');
    check('群活动条目类别为 group', storedG.some(a => a.title === '业主群接龙' && a.category === 'group'));

    // ---- 7. 切回「全部活动」聚合显示所有 ----
    document.querySelector('#act-tabs .act-tab[data-tab="all"]').click();
    check('全部页签显示全部 3 条', document.querySelectorAll('#act-list .act-card').length === 3);
    check('全部页签同时含日常/节日/群活动', [...document.querySelectorAll('#act-list .act-card')].some(c => c.querySelector('.act-badge.daily')) && [...document.querySelectorAll('#act-list .act-card')].some(c => c.querySelector('.act-badge.festival')) && [...document.querySelectorAll('#act-list .act-card')].some(c => c.querySelector('.act-badge.group')));

    // 回到日常页签验证筛选
    document.querySelector('#act-tabs .act-tab[data-tab="daily"]').click();
    check('日常页签只显示日常活动', [...document.querySelectorAll('#act-list .act-card')].every(c => c.querySelector('.act-badge.daily')));

    // ---- 8. 图片压缩 + 草稿缩略图 + 持久化 ----
    document.querySelector('#act-tabs .act-tab[data-tab="all"]').click();
    openForm();
    const file = new window.File([Buffer.from('fake-bytes-1234567890')], 'a.jpg', { type: 'image/jpeg' });
    const fileInput = document.getElementById('act-file');
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));

    setTimeout(() => {
      const draftLen = evalIn('actDraftImages.length');
      check('图片经压缩进入草稿数组', draftLen === 1);
      check('草稿图片为 dataURL', evalIn('actDraftImages[0]').indexOf('data:image') === 0);
      check('表单出现图片缩略图', document.querySelectorAll('#act-thumbs .act-thumb').length === 1);

      document.querySelector('#act-thumbs .act-thumb-remove').click();
      check('可删除草稿缩略图（草稿清空）', evalIn('actDraftImages.length') === 0 && document.querySelectorAll('#act-thumbs .act-thumb').length === 0);

      fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
      setTimeout(() => {
        check('重新加入图片后草稿为 1', evalIn('actDraftImages.length') === 1);
        fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
        setTimeout(() => {
          check('再加一张后草稿为 2', evalIn('actDraftImages.length') === 2);
          document.getElementById('act-title').value = '带图活动';
          document.getElementById('act-save').click();
          const stored3 = JSON.parse(window.localStorage.getItem('liumo_activities_fresh'));
          const withImg = stored3.find(a => a.title === '带图活动');
          check('带图活动已保存且含 2 张图片', withImg && withImg.images && withImg.images.length === 2);
          const cardWithImg = [...document.querySelectorAll('#act-list .act-card')].find(c => c.querySelector('.act-card-title').textContent === '带图活动');
          check('卡片渲染 2 张缩略图', cardWithImg && cardWithImg.querySelectorAll('.act-card-img').length === 2);

          // ---- 8.5 图片点击放大预览 + 切换 + 保存 ----
          const imgEls = cardWithImg.querySelectorAll('.act-card-img');
          imgEls[0].click();
          const lb = document.querySelector('.act-lightbox');
          check('点击图片弹出预览层', !!lb && lb.classList.contains('open'));
          check('多图时显示切换箭头(非 single)', !!lb && !lb.classList.contains('single'));
          check('预览计数器 1 / 2', lb.querySelector('.act-lb-counter').textContent === '1 / 2');
          check('预览层显示原图', lb.querySelector('.act-lightbox-img').src.indexOf('data:image') === 0);
          check('预览层含「保存到本地」按钮', !!lb.querySelector('.act-lb-save'));
          lb.querySelector('.act-lb-next').click();
          check('点击下一张 -> 2 / 2', lb.querySelector('.act-lb-counter').textContent === '2 / 2');
          lb.querySelector('.act-lb-prev').click();
          check('点击上一张 -> 1 / 2', lb.querySelector('.act-lb-counter').textContent === '1 / 2');
          document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
          check('右方向键 -> 2 / 2', lb.querySelector('.act-lb-counter').textContent === '2 / 2');
          document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft' }));
          check('左方向键 -> 1 / 2', lb.querySelector('.act-lb-counter').textContent === '1 / 2');
          const origClick = window.HTMLAnchorElement.prototype.click;
          window.__dl = null;
          window.HTMLAnchorElement.prototype.click = function () { window.__dl = { href: this.href, download: this.download }; };
          lb.querySelector('.act-lb-save').click();
          check('保存到本地触发下载(dataURL)', window.__dl && window.__dl.href.indexOf('data:image') === 0);
          check('下载文件名含「活动图片」', window.__dl && window.__dl.download.indexOf('活动图片') === 0);
          window.HTMLAnchorElement.prototype.click = origClick;
          lb.querySelector('.act-lightbox-backdrop').click();
          check('点击遮罩可关闭预览', !document.querySelector('.act-lightbox').classList.contains('open'));
          imgEls[0].click();
          document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
          check('Esc 可关闭预览', !document.querySelector('.act-lightbox').classList.contains('open'));

          runLaterChecks();
        }, 50);
      }, 50);
    }, 50);

    function runLaterChecks() {
      try {
        // ---- 9. 编辑已有活动（弹窗打开并回填） ----
        const editBtn = document.querySelector('#act-list .act-card [data-act="edit"]');
        editBtn.click();
        check('编辑时弹窗打开', document.getElementById('actModal').classList.contains('open'));
        check('编辑时标题回填到表单', document.getElementById('act-title').value.length > 0);
        check('编辑时保存按钮变为「保存修改」', document.getElementById('act-save').textContent === '保存修改');
        check('编辑时出现「取消编辑」按钮', document.getElementById('act-cancel').hidden === false);
        const origTitle = document.getElementById('act-title').value;
        document.getElementById('act-title').value = origTitle + '（改）';
        document.getElementById('act-save').click();
        const stored4 = JSON.parse(window.localStorage.getItem('liumo_activities_fresh'));
        check('编辑后标题更新且数量不变', stored4.length === 4 && stored4.some(a => a.title === origTitle + '（改）'));
        check('编辑保存后弹窗关闭', !document.getElementById('actModal').classList.contains('open'));

        // ---- 10. 删除活动 ----
        const beforeDel = JSON.parse(window.localStorage.getItem('liumo_activities_fresh')).length;
        document.querySelector('#act-list .act-card [data-act="delete"]').click();
        const afterDel = JSON.parse(window.localStorage.getItem('liumo_activities_fresh')).length;
        check('删除后数量减一', afterDel === beforeDel - 1);

        // ---- 11. 旧版文本笔记迁移 ----
        window.localStorage.clear();
        window.localStorage.setItem('liumo_subnotes_fresh', JSON.stringify([
          { id: 'old1', text: '旧笔记标题\n旧笔记正文', createdAt: 1000, updatedAt: 1000 },
          { id: 'old2', text: '只有一行', createdAt: 2000, updatedAt: 2000 }
        ]));
        evalIn('currentSub = "activities"; renderFreshActivities(document.getElementById("content"), MODULES.find(m=>m.id==="fresh"));');
        const migrated = JSON.parse(window.localStorage.getItem('liumo_activities_fresh') || '[]');
        check('旧笔记迁移为 2 条日常活动', migrated.length === 2 && migrated.every(a => a.category === 'daily'));
        check('旧笔记首行作标题', migrated.find(a => a.id === 'old1').title === '旧笔记标题' && migrated.find(a => a.id === 'old1').detail === '旧笔记正文');
        check('单行旧笔记标题正确', migrated.find(a => a.id === 'old2').title === '只有一行');
        check('迁移后旧 key 已清理', window.localStorage.getItem('liumo_subnotes_fresh') === null);

        const passed = results.filter(r => r.pass).length;
        console.log(`\n==== ${passed}/${results.length} 通过 ====`);
        process.exit(passed === results.length ? 0 : 1);
      } catch (e) {
        console.error('TEST ERROR:', e);
        process.exit(2);
      }
    }
  } catch (e) {
    console.error('TEST ERROR:', e);
    process.exit(2);
  }
}, 100);
