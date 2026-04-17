const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
    let output = '';
    const originalLog = console.log;
    const originalError = console.error;

    const log = msg => {
        output += msg + '\n';
        originalLog(msg);
    };

    Object.assign(console, {
        log: (...args) => log('LOG: ' + args.join(' ')),
        error: (...args) => log('ERROR: ' + args.join(' '))
    });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('pageerror', err => log('PAGE_ERROR_TRACE:\n' + err.stack));
    page.on('console', msg => log('CONSOLE_EVENT: ' + msg.type() + ' ' + msg.text()));

    await page.goto('http://localhost:5173/register').catch(e => log('GOTO_ERROR: ' + e.message));

    await new Promise(r => setTimeout(r, 2000));

    const root = await page.$eval('#root', el => el.innerHTML).catch(e => 'error');
    log('ROOT_HTML_LENGTH: ' + root.length);

    fs.writeFileSync('puppet_logs.txt', output);
    await browser.close();
})();
