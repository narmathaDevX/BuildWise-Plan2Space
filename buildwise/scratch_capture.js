import fs from 'node:fs';

async function main() {
  const dir = '/Users/narmathan/buildwise/docs/screenshots/before';
  fs.mkdirSync(dir, { recursive: true });

  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await listRes.json();
  let page = pages.find((p) => p.type === 'page' && p.url.includes('5173'));

  if (!page) {
    const newRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:5173/', { method: 'PUT' });
    page = await newRes.json();
  }

  const wsUrl = page.webSocketDebuggerUrl;
  console.log('Connected to target:', page.id, wsUrl);

  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((r) => { ws.onopen = r; });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async function capture(filename) {
    await new Promise((r) => setTimeout(r, 600));
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${dir}/${filename}`, Buffer.from(data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Navigate to 5173 fresh
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await new Promise((r) => setTimeout(r, 1200));

  async function setTheme(theme) {
    await evaluate(`
      document.documentElement.setAttribute('data-theme', '${theme}');
      localStorage.setItem('buildwise-theme', '${theme}');
    `);
    await new Promise((r) => setTimeout(r, 400));
  }

  async function clickNav(name) {
    await evaluate(`
      const buttons = Array.from(document.querySelectorAll('.desktop-nav .nav-link'));
      const btn = buttons.find(b => b.textContent.trim() === '${name}');
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
  }

  async function clickBackToPlanner() {
    await evaluate(`
      const btn = document.querySelector('.back-link');
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('Capturing screenshots for all pages in light and dark mode...');

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== THEME: ${theme.toUpperCase()} ===`);
    await setTheme(theme);

    // 1. Dashboard
    await clickNav('Dashboard');
    await capture(`01_dashboard_${theme}.png`);

    // 2. House Planner (Step 1)
    await clickNav('House Planner');
    await capture(`02_house_planner_step1_${theme}.png`);

    // Step 2
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
    await capture(`03_house_planner_step2_${theme}.png`);

    // Step 3
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
    await capture(`04_house_planner_step3_${theme}.png`);

    // Step 4
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Review'));
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
    await capture(`05_house_planner_step4_${theme}.png`);

    // Click "Generate plan" in Step 4
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('.review-actions button')).find(b => b.textContent.includes('Generate'));
      if (btn) btn.click();
    `);
    // Wait for plan generation
    await new Promise((r) => setTimeout(r, 3500));
    await capture(`06_generated_plan_${theme}.png`);

    // Compare mode
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Compare'));
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
    await capture(`07_generated_plan_compare_${theme}.png`);

    // Back to Planner then Construction
    await clickBackToPlanner();
    await clickNav('Construction');
    await capture(`08_construction_${theme}.png`);

    // Materials
    await clickNav('Materials');
    await capture(`09_materials_${theme}.png`);

    // Reports
    await clickNav('Reports');
    await capture(`10_reports_${theme}.png`);
  }

  ws.close();
  console.log('\nAll before screenshots captured successfully!');
}

main().catch(console.error);
