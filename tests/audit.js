'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require('playwright');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'litemark-audit-'));
fs.copyFileSync(path.join(__dirname, '../source/LiteMark.js'), path.join(directory, 'LiteMark.js'));
fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html><meta charset="utf-8"><title>LiteMark audit</title><script src="LiteMark.js"></script><body>');
const server = http.createServer((request, response) => {
    const name = request.url.split('?')[0] === '/LiteMark.js' ? 'LiteMark.js' : 'index.html';
    response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    response.end(fs.readFileSync(path.join(directory, name)));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: process.env.LITEMARK_BROWSER || 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        let count = 0;
        const rounds = fs.readdirSync(__dirname).filter(name => /^round\d+-[a-z]+\.js$/.test(name)).sort().map(name => name.slice(0, -3));
        for (const file of ['inline-audit', 'blocks-audit', 'integration-audit', ...rounds]) {
            const audit = require('./' + file);
            const started = Date.now(), passed = await (typeof audit === 'function' ? audit : audit.run)(page);
            count += passed;
            console.log(`${file}: ${passed} checks (${Date.now() - started} ms)`);
        }
        assert.deepEqual(errors, [], 'Audit browser console must stay clean');
        console.log(`Audit: ${count} checks passed in Edge (${directory})`);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
