'use strict';
const assert = require('node:assert/strict');
// An unmatched image opener does not disable ordinary links or bare URLs.
// Regression: rescanning all open image brackets for each later link makes
// these linear-size paragraphs quadratic, although their HTML is correct.
exports.run = async function run(page) {
    const rows = await page.evaluate(() => {
        const rows = [];
        for (const [name, token, count] of [['inline links', '[x](u) ', 80000], ['bare autolinks', 'www.a.com ', 80000]]) {
            const input = '!['.repeat(count) + (name === 'bare autolinks' ? ' ' : '') + token.repeat(count);
            const started = performance.now();
            const html = markdownToHtml(input);
            const duration = performance.now() - started;
            const host = document.createElement('div'); host.innerHTML = html;
            rows.push({ name: name + ' remain recognized beneath unmatched image brackets', actual: host.querySelectorAll('a').length, expected: count });
            rows.push({ name: name + ' preserve unmatched image opener text', actual: host.textContent.startsWith('!['.repeat(count)), expected: true });
            rows.push({ name: name + ' convert 80000 unmatched image openers and 80000 links within 2500ms (' + duration + 'ms)', actual: duration < 2500, expected: true });
        }
        return rows;
    });
    for (const row of rows) assert.equal(row.actual, row.expected, row.name);
    return rows.length;
};
