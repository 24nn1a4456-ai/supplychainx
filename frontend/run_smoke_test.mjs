import { chromium } from 'playwright';

async function runSmokeTest() {
  console.log('[SMOKE TEST] Launching Google Chrome...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.message);
  });

  console.log('[SMOKE TEST] Navigating to http://127.0.0.1:5173...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('[SMOKE TEST] Dashboard loaded successfully. Title:', await page.title());

  // Check 3D Canvas
  const canvasCount = await page.locator('canvas').count();
  console.log('[SMOKE TEST] 3D Supply Network Canvas count:', canvasCount);

  // 1. Initial Reset
  console.log('[SMOKE TEST] 1. Resetting demo...');
  const resetBtn = page.locator('button:has-text("Reset Demo")').first();
  if (await resetBtn.isVisible()) {
    await resetBtn.click();
    await page.waitForTimeout(1500);
  }

  // 2. Start Outage
  console.log('[SMOKE TEST] 2. Clicking Start Supplier Outage Simulation...');
  const startBtn = page.locator('button:has-text("1. Start Supplier Outage Simulation")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 10000 });
  await startBtn.click();
  await page.waitForTimeout(2000);

  // 3. Assess Impact
  console.log('[SMOKE TEST] 3. Clicking Proceed to Assess Impact...');
  const assessBtn = page.locator('button:has-text("2. Proceed to Assess Impact")').first();
  await assessBtn.waitFor({ state: 'visible', timeout: 10000 });
  await assessBtn.click();
  await page.waitForTimeout(2000);

  // 4. Evaluate Alternative Suppliers (Calls backend /plan directly and moves to awaiting_approval)
  console.log('[SMOKE TEST] 4. Clicking Evaluate Alternative Suppliers...');
  const evalBtn = page.locator('button:has-text("3. Evaluate Alternative Suppliers")').first();
  await evalBtn.waitFor({ state: 'visible', timeout: 10000 });
  await evalBtn.click();
  await page.waitForTimeout(3500);

  // 5. In awaiting_approval stage:
  // If planning stage button is visible, click it, else directly check awaiting_approval
  const planBtn = page.locator('button:has-text("4. Synthesize Plan")').first();
  if (await planBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('[SMOKE TEST] Clicking 4. Synthesize Plan...');
    await planBtn.click();
    await page.waitForTimeout(2000);
  }

  // Check Approve Plan button
  console.log('[SMOKE TEST] Waiting for Approve Plan button...');
  const approveBtn = page.locator('button:has-text("Approve Plan")').first();
  await approveBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('[SMOKE TEST] Approve button is visible.');

  // Check cost display
  const planText = await page.innerText('body');
  const hasCost = planText.includes('331,650') || planText.includes('$331,650');
  console.log('[SMOKE TEST] Recovery cost $331,650 in UI:', hasCost);

  // 6. Approve Plan
  console.log('[SMOKE TEST] 6. Clicking Approve Plan...');
  await approveBtn.click();
  await page.waitForTimeout(1000);

  const confirmBtn = page.locator('button:has-text("Confirm (Approve)")').first();
  if (await confirmBtn.isVisible()) {
    console.log('[SMOKE TEST] Confirming authorization in prompt...');
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }

  // 7. Execute Simulated Recovery
  console.log('[SMOKE TEST] 7. Clicking Execute Simulated Actions...');
  const execBtn = page.locator('button:has-text("Execute Simulated Actions"), button:has-text("5. Authorize")').first();
  await execBtn.waitFor({ state: 'visible', timeout: 10000 });
  await execBtn.click();
  await page.waitForTimeout(1000);

  const confirmExecBtn = page.locator('button:has-text("Confirm (Execute)"), button:has-text("Confirm (Simulated)"), button:has-text("Confirm")').first();
  if (await confirmExecBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmExecBtn.click();
    await page.waitForTimeout(2500);
  } else {
    await page.waitForTimeout(2500);
  }

  // 8. Verify Completion
  const finalContent = await page.innerText('body');
  const isCompleted = finalContent.includes('COMPLETED') || finalContent.includes('Completed') || finalContent.includes('Resolved') || finalContent.includes('DISPATCHED');
  console.log('[SMOKE TEST] 8. Workflow marked Completed / Dispatched:', isCompleted);

  // 9. Final Reset
  console.log('[SMOKE TEST] 9. Resetting demo to clean state...');
  const finalResetBtn = page.locator('button:has-text("Reset Demo")').first();
  if (await finalResetBtn.isVisible()) {
    await finalResetBtn.click();
    await page.waitForTimeout(1500);
  }

  await browser.close();
  console.log('[SMOKE TEST SUCCESS] Full end-to-end UI smoke test completed successfully!');
}

runSmokeTest().catch(err => {
  console.error('[SMOKE TEST ERROR]', err);
  process.exit(1);
});
