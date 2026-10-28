import { chromium } from 'playwright';
import path from 'path';

async function capture() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const outDir = 'C:\\Users\\anuhy\\.gemini\\antigravity-ide\\brain\\f0ad4a58-6e8e-4b87-8c9a-c1212e2f08be\\scratch';

  // 1. Full dashboard overview
  await page.screenshot({ path: path.join(outDir, '01_dashboard_1440x900.png') });
  console.log('Captured 01_dashboard_1440x900.png');

  // 2. Open Workflow Modal
  const workflowBtn = page.locator('button:has-text("OUTAGE WORKFLOW")').first();
  if (await workflowBtn.isVisible()) {
    await workflowBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '02_workflow_modal_overview.png') });
    console.log('Captured 02_workflow_modal_overview.png');

    // Tab 2: Affected Assets
    const affectedTab = page.locator('button:has-text("2. Affected Assets")');
    if (await affectedTab.isVisible() && !await affectedTab.isDisabled()) {
      await affectedTab.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, '03_workflow_modal_affected.png') });
      console.log('Captured 03_workflow_modal_affected.png');
    }

    // Close Modal
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 3. Reset demo first for clean slate
  const resetBtn = page.locator('button:has-text("Reset Demo")').first();
  if (await resetBtn.isVisible()) {
    await resetBtn.click();
    await page.waitForTimeout(600);
  }

  // 4. Click "1. Start Supplier Outage Simulation"
  const startBtn = page.locator('button:has-text("1. Start Supplier Outage Simulation")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(800);
    console.log('Started supplier outage simulation');
  }

  // 5. Open workflow modal and proceed to Assess -> Plan
  const wfBtn = page.locator('button:has-text("OUTAGE WORKFLOW")').first();
  if (await wfBtn.isVisible()) {
    await wfBtn.click();
    await page.waitForTimeout(600);

    // Click "Assess Affected Assets ➔"
    const assessBtn = page.locator('button:has-text("Assess Affected Assets")').first();
    if (await assessBtn.isVisible()) {
      await assessBtn.click();
      await page.waitForTimeout(1000);
      console.log('Advanced to assessing stage');
    }

    // Click "Source Alternatives ➔"
    const planBtn = page.locator('button:has-text("Source Alternatives")').first();
    if (await planBtn.isVisible()) {
      await planBtn.click();
      await page.waitForTimeout(1500);
      console.log('Advanced to planning / awaiting_approval stage');
    }

    // Screenshot the recovery plan with weather risk banner and transport comparisons
    await page.screenshot({ path: path.join(outDir, '05_workflow_plan_with_weather.png') });
    console.log('Captured 05_workflow_plan_with_weather.png');
  }

  await browser.close();
  console.log('Inspection captures completed successfully.');
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
