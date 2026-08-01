// 店员巡检（整改闭环）功能测试
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
    const mod = evalIn('MODULES.find(m => m.id === "inspect")');
    check('店员巡检模块已注册', !!mod && mod.name === '店员巡检');

    window.localStorage.clear();
    evalIn('currentModule = "inspect"; renderInspectModule(document.getElementById("content"), MODULES.find(m=>m.id==="inspect"));');
    check('已预置店员名册', JSON.parse(window.localStorage.getItem('liumo_inspect_employees') || '[]').length >= 1);

    // ---- 店长视角：新建整改单 ----
    check('默认店长视角', !!document.querySelector('.insp-role-btn.active[data-role="manager"]'));
    check('统计区存在', !!document.getElementById('inspFilterStatus'));
    document.getElementById('inspNewBtn').click();
    check('点击新建后弹窗打开', document.getElementById('inspNewModal').classList.contains('open'));
    document.getElementById('inspNewTitle').value = '生鲜货架陈列不整齐';
    document.getElementById('inspNewArea').value = '生鲜区';
    document.getElementById('inspNewDesc').value = '端头陈列歪斜，价签脱落';
    document.getElementById('inspNewSave').click();
    const tickets = JSON.parse(window.localStorage.getItem('liumo_inspect_tickets') || '[]');
    check('整改单已写入 localStorage', tickets.length === 1);
    check('状态为待整改', tickets[0].status === 'pending');
    check('指派店员为张三', tickets[0].employee === '张三');
    check('弹窗已关闭', !document.getElementById('inspNewModal').classList.contains('open'));
    check('列表出现 1 张卡片', document.querySelectorAll('#inspList .insp-card').length === 1);
    check('卡片标记待整改', document.querySelector('#inspList .insp-card .insp-status.status-pending'));

    // ---- 店员视角：张三查看并提交整改 ----
    document.querySelector('.insp-role-btn[data-role="employee"]').click();
    check('切换到店员视角', !!document.querySelector('.insp-role-btn.active[data-role="employee"]'));
    check('店员视角出现身份选择', !!document.getElementById('inspEmpPick'));
    check('店员视角可见自己的整改单', document.querySelectorAll('#inspList .insp-card').length === 1);
    document.querySelector('#inspList .insp-open-btn').click();
    check('详情弹窗打开', document.getElementById('inspDetailModal').classList.contains('open'));
    check('详情展示提交整改按钮', !!document.querySelector('#inspDetailBody [data-act="rectify"]'));
    document.getElementById('inspReplyText').value = '已重新陈列并补价签';
    document.querySelector('#inspDetailBody [data-act="rectify"]').click();
    const t2 = JSON.parse(window.localStorage.getItem('liumo_inspect_tickets'))[0];
    check('提交整改后状态=已整改待确认', t2.status === 'rectified');
    check('整改记录含店员回复', t2.replies.length === 1 && t2.replies[0].from === 'employee' && t2.replies[0].type === 'rectify');

    // ---- 店长视角：确认完成 ----
    document.querySelector('.insp-role-btn[data-role="manager"]').click();
    document.querySelector('#inspList .insp-open-btn').click();
    check('店长详情含确认/驳回', !!document.querySelector('#inspDetailBody [data-act="confirm"]') && !!document.querySelector('#inspDetailBody [data-act="reject"]'));
    document.getElementById('inspReplyText').value = '合格，保持';
    document.querySelector('#inspDetailBody [data-act="confirm"]').click();
    const t3 = JSON.parse(window.localStorage.getItem('liumo_inspect_tickets'))[0];
    check('确认后状态=已完成', t3.status === 'confirmed');
    check('确认记录含店长回复', t3.replies.some(r => r.from === 'manager'));
    check('已完成单在店员视角不再出现', evalIn('(function(){ inspRole="employee"; inspCurEmp="张三"; renderInspectBody(); return document.querySelectorAll("#inspList .insp-card").length; })()') === 0);

    // ---- 店员名册管理 ----
    document.querySelector('.insp-role-btn[data-role="manager"]').click();
    document.getElementById('inspEmpManage').click();
    check('店员名册弹窗打开', document.getElementById('inspEmpModal').classList.contains('open'));
    const before = JSON.parse(window.localStorage.getItem('liumo_inspect_employees')).length;
    document.getElementById('inspEmpInput').value = '赵六';
    document.getElementById('inspEmpAdd').click();
    const after = JSON.parse(window.localStorage.getItem('liumo_inspect_employees'));
    check('新增店员已保存', after.length === before + 1 && after.includes('赵六'));
    document.querySelector('.insp-emp-del[data-emp="赵六"]').click();
    check('删除店员生效', !JSON.parse(window.localStorage.getItem('liumo_inspect_employees')).includes('赵六'));

  } catch (e) {
    check('测试过程未抛异常: ' + e.message, false);
    console.error(e);
  }
  const pass = results.filter(r => r.pass).length;
  console.log('\n结果: ' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
}, 100);
