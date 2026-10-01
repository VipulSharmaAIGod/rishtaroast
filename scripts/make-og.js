// Renders public/og.png (1200x630 social preview) from public/og-template.html using headless Chrome.
// Usage: `npm run static` (serves public/ on :8080) in another terminal, then `npm run og`.
// Re-run after changing SITE_URL in public/config.js (the image shows the domain), then commit public/og.png.
const path = require('path');
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 630 });
  await p.goto((process.env.BASE_URL || 'http://localhost:8080') + '/og-template.html', { waitUntil: 'networkidle0' });
  await p.waitForSelector('body[data-ready="1"]');
  await p.screenshot({ path: path.join(__dirname, '..', 'public', 'og.png') });
  await b.close();
  console.log('wrote public/og.png');
})();
