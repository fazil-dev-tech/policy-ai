const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Capture all logs and errors
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));
    page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));

    await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle0' }).catch(e => console.log('GOTO_ERROR:', e.message));

    console.log('--- HTML ---');
    const root = await page.$eval('#root', el => el.innerHTML).catch(e => '');
    console.log('ROOT_HTML_LENGTH:', root.length);
    await browser.close();
})();
