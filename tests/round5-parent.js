'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    const results = await page.evaluate(() => {
        const label = 'a\\\nb';
        return ['[' + label + ']', '[text][' + label + ']', '[' + label + '][]'].map(use => {
            const host = document.createElement('div'); host.innerHTML = markdownToHtml(use + '\n\n[' + label + ']: /label');
            const link = host.querySelector('a'); return link && [link.getAttribute('href'), link.textContent, link.querySelectorAll('br').length];
        });
    });
    assert.deepEqual(results, [['/label', 'a\nb', 1], ['/label', 'text', 0], ['/label', 'a\nb', 1]], 'A literal backslash before a label line ending is valid');
    return 3;
};
