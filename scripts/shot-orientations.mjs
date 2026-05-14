import { chromium } from 'playwright';

const sizes = [
  { name: 'landscape', w: 844, h: 390 },
  { name: 'portrait', w: 390, h: 844 },
];

const browser = await chromium.launch();
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3002/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `/tmp/slot-${s.name}.png` });
  console.log(`captured ${s.name}`);
  await ctx.close();
}
await browser.close();
