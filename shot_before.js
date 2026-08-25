const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  const seeds = {
    liumo_workbench_initialized: '1',
    liumo_cost_items: JSON.stringify([
      { id: 'c1', name: '房租', default: 5000 },
      { id: 'c2', name: '人工', default: 8000 },
      { id: 'c3', name: '水电', default: 1200 },
      { id: 'c4', name: '其他', default: 600 },
    ]),
    liumo_cost_logs: JSON.stringify([
      { id: 'l1', date: '2026-05', items: [{name:'固定成本',amount:11800},{name:'人工成本',amount:8000},{name:'其他',amount:900}], note: '' },
      { id: 'l2', date: '2026-06', items: [{name:'固定成本',amount:11800},{name:'人工成本',amount:8200},{name:'其他',amount:1100}], note: '' },
      { id: 'l3', date: '2026-07', items: [{name:'固定成本',amount:12000},{name:'人工成本',amount:8500},{name:'其他',amount:1000}], note: '' },
    ]),
    liumo_sales_logs: JSON.stringify([
      { date:'2023-01', retail:300000, dailySales:9600, dailyOrders:300, avgTicket:32 },
      { date:'2023-02', retail:310000, dailySales:10000, dailyOrders:320, avgTicket:31.25 },
      { date:'2024-01', retail:360000, dailySales:12000, dailyOrders:380, avgTicket:31.6 },
      { date:'2024-02', retail:380000, dailySales:13000, dailyOrders:410, avgTicket:31.7 },
      { date:'2025-01', retail:420000, dailySales:14000, dailyOrders:430, avgTicket:32.5 },
      { date:'2025-02', retail:450000, dailySales:15000, dailyOrders:460, avgTicket:32.6 },
    ]),
    liumo_scrap_logs: JSON.stringify([
      { date:'2026-05', category:'蔬菜', weight:120, amount:480, unit:'kg' },
      { date:'2026-06', category:'肉类', weight:200, amount:1600, unit:'kg' },
      { date:'2026-07', category:'蔬菜', weight:130, amount:520, unit:'kg' },
    ]),
    liumo_salary_logs: JSON.stringify([
      { date:'2026-05', base:6000, bonus:800, deduct:200 },
      { date:'2026-06', base:6000, bonus:1200, deduct:0 },
      { date:'2026-07', base:6000, bonus:900, deduct:100 },
    ]),
  };

  await page.addInitScript((s) => {
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v));
  }, seeds);

  await page.goto('file:///root/.codebuddy/artifact/fresh/index.html');
  await page.waitForTimeout(800);

  // Dashboard / default
  await page.screenshot({ path: '/tmp/shot_default.png', fullPage: false });

  // helper to open a module by matching nav text
  async function openModule(text) {
    const clicked = await page.evaluate((t) => {
      const items = [...document.querySelectorAll('.nav-item')];
      const el = items.find(n => n.textContent.includes(t));
      if (el) { el.click(); return true; }
      return false;
    }, text);
    await page.waitForTimeout(700);
    return clicked;
  }

  async function shot(name) {
    // expand any collapsed cost admin for visibility
    await page.evaluate(() => {
      document.querySelectorAll('.co-admin-card.co-collapsed').forEach(c => c.classList.remove('co-collapsed'));
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: '/tmp/shot_' + name + '.png', fullPage: true });
  }

  if (await openModule('超市成本核算')) await shot('cost');
  if (await openModule('销售数据管理')) await shot('sales');
  if (await openModule('年度增长率')) await shot('yeargrowth');
  if (await openModule('季度增长率')) await shot('quartergrowth');
  if (await openModule('工资')) await shot('salary');
  if (await openModule('废品')) await shot('scrap');

  await browser.close();
  console.log('DONE');
})();
