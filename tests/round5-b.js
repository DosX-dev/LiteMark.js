'use strict';
const assert = require('node:assert/strict');
// CommonMark sequential backslash escaping consumes the first tick, leaving
// the remaining run eligible as a code-span opener. GitHub Markdown API
// independently confirms these inputs; its notranslate class is host styling.
// https://spec.commonmark.org/0.31.2/#backslash-escapes
// https://spec.commonmark.org/0.31.2/#code-spans
exports.run = async function run(page) {
    const rows = await page.evaluate(() => {
        const rows = [];
        for (const width of [1, 2, 3, 8]) {
            const ticks = '`'.repeat(width);
            const input = '\\`' + ticks + ' foo ' + ticks;
            const actual = markdownToHtml(input);
            rows.push({ name: 'escaped leading tick leaves code opener of width ' + width, actual, expected: '<p>`<code>foo</code></p>' });
            const host = document.createElement('div');
            host.innerHTML = markdownToHtml('![' + input + '](img.png)');
            rows.push({ name: 'image alt strips code delimiters after escaped leading tick of width ' + width, actual: host.querySelector('img').alt, expected: '`foo' });
        }
        const host = document.createElement('div');
        host.innerHTML = markdownToHtml('| \\``a|b` | c |\n| --- | --- |');
        rows.push({ name: 'matched table code after escaped leading tick retains internal pipe (documented compatibility)', actual: [...host.querySelectorAll('th')].map(node => node.textContent), expected: ['`a|b', 'c'] });
        return rows;
    });
    for (const row of rows) assert.deepEqual(row.actual, row.expected, row.name);
    return rows.length;
};
