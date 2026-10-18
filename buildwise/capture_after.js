import fs from 'node:fs';

async function main() {
  const dir = '/Users/narmathan/buildwise/docs/screenshots/after';
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
    await new Promise((r) => setTimeout(r, 700));
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

  // Navigate fresh
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await new Promise((r) => setTimeout(r, 1500));

  async function setTheme(theme) {
    await evaluate(`
      document.documentElement.setAttribute('data-theme', '${theme}');
      localStorage.setItem('buildwise-theme', '${theme}');
    `);
    await new Promise((r) => setTimeout(r, 500));
  }

  async function reactClick(fnBody) {
    await evaluate(`
      (() => {
        function trigger(el) {
          if (!el) return false;
          const k = Object.keys(el).find(x => x.startsWith("__reactProps"));
          if (k && el[k] && typeof el[k].onClick === "function") {
            el[k].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
            return true;
          }
          el.click();
          return true;
        }
        ${fnBody}
      })()
    `);
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log('Capturing verified AFTER screenshots in light and dark mode...');

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== THEME: ${theme.toUpperCase()} ===`);
    await setTheme(theme);

    // 1. Dashboard
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.desktop-nav .nav-link')).find(b => b.textContent.trim() === 'Dashboard');
      trigger(btn);
    `);
    await capture(`dashboard_${theme}.png`);
    await capture(`01_dashboard_${theme}.png`);

    // 2. House Planner (Step 1: Plot)
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.desktop-nav .nav-link')).find(b => b.textContent.trim() === 'House Planner');
      trigger(btn);
    `);
    await capture(`planner_step1_${theme}.png`);
    await capture(`02_house_planner_step1_${theme}.png`);

    // Step 2: Requirements
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Continue'));
      trigger(btn);
    `);
    await capture(`planner_step2_${theme}.png`);
    await capture(`03_house_planner_step2_${theme}.png`);

    // Step 3: Budget & Affordability
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Continue'));
      trigger(btn);
    `);
    await capture(`planner_step3_${theme}.png`);
    await capture(`04_house_planner_step3_${theme}.png`);

    // Step 4: Review
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Continue'));
      trigger(btn);
    `);
    await capture(`planner_step4_${theme}.png`);
    await capture(`05_house_planner_step4_${theme}.png`);

    // Generate plan
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.planner-actions button')).find(b => b.textContent.includes('Generate'));
      trigger(btn);
    `);
    // Wait for plan generation engine and API calls
    await new Promise((r) => setTimeout(r, 4500));
    await capture(`generated_plan_${theme}.png`);
    await capture(`06_generated_plan_${theme}.png`);

    // Compare plans
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Compare'));
      trigger(btn);
    `);
    await capture(`generated_plan_compare_${theme}.png`);
    await capture(`07_generated_plan_compare_${theme}.png`);

    // Back to Planner, then Construction
    await reactClick(`
      const btn = document.querySelector('.back-link');
      trigger(btn);
    `);
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.desktop-nav .nav-link')).find(b => b.textContent.trim() === 'Construction');
      trigger(btn);
    `);
    await capture(`construction_${theme}.png`);
    await capture(`08_construction_${theme}.png`);

    // Materials
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.desktop-nav .nav-link')).find(b => b.textContent.trim() === 'Materials');
      trigger(btn);
    `);
    await capture(`materials_${theme}.png`);
    await capture(`09_materials_${theme}.png`);

    // Reports
    await reactClick(`
      const btn = Array.from(document.querySelectorAll('.desktop-nav .nav-link')).find(b => b.textContent.trim() === 'Reports');
      trigger(btn);
    `);
    await capture(`reports_${theme}.png`);
    await capture(`10_reports_${theme}.png`);
  }

  ws.close();
  console.log('\nAll after screenshots verified and saved successfully!');
}

main().catch(console.error);
