'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    let checks = 0;
    // A trailing blank consumed by indented code separates direct item
    // blocks/items, even though that blank is omitted from the code content.
    for (const source of [
        '-     code\n\n  text',
        '-     code\n\n- text',
        '1.     code\n\n   text',
        '1.     code\n\n2. text',
        '> -     code\n>\n>   text',
        '-     code\n  \t\n  text',
        '- -     code\n\n  text',
        '- -     code\n\n- text',
    ]) {
        const result = await page.evaluate(source => {
            const host = document.createElement('div'); host.innerHTML = markdownToHtml(source);
            return { paragraphs: Array.from(host.querySelectorAll('li > p'), p => p.textContent), code: host.querySelector('pre code').textContent };
        }, source);
        assert.deepEqual(result, { paragraphs: ['text'], code: 'code\n' }, 'Indented-code blank separates list blocks/items: ' + source); checks++;
    }
    // Internal code blanks and blanks after the final item do not make
    // otherwise tight lists loose; only actual block/item separators count.
    for (const [source, code] of [
        ['-     code\n  text', 'code\n'],
        ['- before\n-     code\n\n', 'code\n'],
        ['-     code\n\n      more\n  text', 'code\n\nmore\n'],
    ]) {
        const result = await page.evaluate(source => {
            const host = document.createElement('div'); host.innerHTML = markdownToHtml(source);
            return { paragraphs: host.querySelectorAll('li > p').length, code: host.querySelector('pre code').textContent };
        }, source);
        assert.deepEqual(result, { paragraphs: 0, code }, source); checks++;
    }
    return checks;
};

