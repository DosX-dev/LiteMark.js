'use strict';
const assert = require('node:assert/strict');

exports.run = async function run(page) {
    const result = await page.evaluate(() => {
        const count = 64000;
        const source = '!['.repeat(count) + 'http://a.b '.repeat(count);
        const began = performance.now();
        const html = markdownToHtml(source);
        const elapsed = performance.now() - began;
        const host = document.createElement('div');
        host.innerHTML = html;
        return {
            elapsed,
            links: host.querySelectorAll('a').length,
            exactText: host.textContent === source.trimEnd(),
            hrefs: Array.from(host.querySelectorAll('a')).every(link => link.getAttribute('href') === 'http://a.b'),
        };
    });
    assert.equal(result.links, 63999, 'The first URL follows [, while all later URLs have whitespace boundaries');
    assert.equal(result.exactText, true, 'Unmatched image brackets and URL text remain intact');
    assert.equal(result.hrefs, true, 'Every recognized URL keeps its destination');
    assert.ok(result.elapsed < 1800, `Unmatched image brackets followed by bare URLs took ${result.elapsed} ms`);
    return 4;
};
