import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 1,
  locale: 'zh-HK',
});
const page = await ctx.newPage();
await page.goto('http://localhost:3001/', { waitUntil: 'load' });
// Wait long enough for the 600ms post-create delay before the modal appears.
await page.waitForTimeout(3500);
await page.screenshot({ path: '/tmp/slot-daily-zhhk.png' });
console.log('captured daily reward zh-HK');
await ctx.close();
await browser.close();
