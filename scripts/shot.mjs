import { chromium } from 'playwright';

const sizes = [
  { name: '390x844', w: 390, h: 844 },
  { name: '844x390', w: 844, h: 390 },
  { name: '1280x720', w: 1280, h: 720 },
];

const browser = await chromium.launch();
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  // Wait for canvas + assets + scene to be ready.
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `/tmp/slot-mobile-${s.name}.png` });
  console.log(`captured ${s.name}`);
  await ctx.close();
}
await browser.close();
