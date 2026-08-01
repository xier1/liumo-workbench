// 待办清单（原备忘录）功能测试：改名 + 点击「添加待办」再弹出表单 + 四象限优先级 + 编辑可改优先级
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
function renderTodo() { evalIn('currentModule = "todo"; renderContent();'); }

setTimeout(() => {
  try {
    // 1) 模块改名
    const todoMod = evalIn('MODULES.find(m => m.id === "todo")');
    check('模块名已改为「待办清单」', todoMod && todoMod.name === '待办清单');
    check('模块描述已更新为待办事项', todoMod && /待办事项/.test(todoMod.desc));

    // 2) 渲染待办清单模块
    renderTodo();
    const addBtn = document.getElementById('todoAddBtn');
    const modal = document.getElementById('todoModal');
    check('存在「添加待办」按钮', !!addBtn);
    check('存在添加待办弹窗', !!modal);
    check('表单输入框位于弹窗内部', modal && modal.contains(document.getElementById('todoInput')));
    check('弹窗初始为关闭状态', modal && !modal.classList.contains('open'));
    check('常驻输入框已移除（仅弹窗内一份 todoInput）', document.querySelectorAll('#todoInput').length === 1);

    // 3) 四象限优先级:添加表单含 4 个选项
    const optVals = [...document.getElementById('prioritySelect').options].map(o => o.value);
    check('添加表单含四象限 4 个优先级(iq/inq/uq/nuq)', optVals.join(',') === 'iq,inq,uq,nuq');
    check('priorityLabel(iq)=重要且紧急', evalIn('priorityLabel("iq")') === '重要且紧急');
    check('priorityLabel(nuq)=不重要不紧急', evalIn('priorityLabel("nuq")') === '不重要不紧急');

    // 4) 点击「添加待办」打开表单
    addBtn.click();
    check('点击后弹窗打开', modal.classList.contains('open'));

    // 5) 保存新增一条待办(选「重要且紧急」)
    const before = evalIn('todos.length');
    document.getElementById('todoInput').value = '给货架补货';
    document.getElementById('prioritySelect').value = 'iq';
    document.getElementById('todoSaveBtn').click();
    const after = evalIn('todos.length');
    check('保存后待办数量 +1', after === before + 1);
    check('保存后弹窗关闭', !modal.classList.contains('open'));
    const added = evalIn('todos[0]');
    check('新增待办内容正确', added && added.title === '给货架补货');
    check('新增待办优先级为重要且紧急(iq)', added && added.priority === 'iq');
    check('列表中渲染出该待办', !!document.querySelector('.todo-item'));

    // 6) 编辑可修改优先级(修复 bug)
    const tid = added.id;
    document.querySelector(`.todo-item[data-id="${tid}"] [data-action="edit"]`).click();
    const prioSel = document.getElementById(`editPriority-${tid}`);
    check('编辑态出现优先级下拉', !!prioSel);
    check('编辑态默认带原优先级(iq)', prioSel && prioSel.value === 'iq');
    prioSel.value = 'nuq';
    document.querySelector(`.todo-item[data-id="${tid}"] [data-action="save-edit"]`).click();
    const edited = evalIn(`todos.find(t => t.id === "${tid}")`);
    check('编辑后优先级已更新为不重要不紧急(nuq)', edited && edited.priority === 'nuq');
    check('编辑后标题保持不变', edited && edited.title === '给货架补货');

    // 7) 取消不新增
    const beforeCancel = evalIn('todos.length');
    document.getElementById('todoAddBtn').click();
    check('再次打开弹窗', modal.classList.contains('open'));
    document.getElementById('todoInput').value = '不应被添加';
    document.getElementById('todoCancelBtn').click();
    check('取消后弹窗关闭', !modal.classList.contains('open'));
    check('取消后待办数量不变', evalIn('todos.length') === beforeCancel);
    check('取消内容未写入', !evalIn('todos.some(t => t.title === "不应被添加")'));

    // 8) Esc 关闭弹窗
    document.getElementById('todoAddBtn').click();
    check('Esc 测试前弹窗已打开', modal.classList.contains('open'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    check('按 Esc 关闭弹窗', !modal.classList.contains('open'));

    // 9) 点击遮罩关闭
    document.getElementById('todoAddBtn').click();
    modal.querySelector('.act-modal-backdrop').click();
    check('点击遮罩关闭弹窗', !modal.classList.contains('open'));

  } catch (e) {
    check('测试执行未抛异常: ' + e.message, false);
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n结果: ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}, 200);
