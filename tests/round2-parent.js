'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    const result = await page.evaluate(() => {
        const row = '`x ' + Array.from({ length: 800 }, (_, index) => '`'.repeat(index + 2) + 'x ').join('');
        const began = performance.now();
        const host = document.createElement('div');
        host.innerHTML = markdownToHtml('a | b\n--- | ---\n' + row + '| end');
        const elapsed = performance.now() - began;
        const malformed = document.createElement('div');
        malformed.innerHTML = markdownToHtml('a | b | c\n--- | --- | ---\nx ```a|b`` | end');
        return { elapsed, cells: Array.from(host.querySelectorAll('td'), node => node.textContent), expected: row.trimEnd(), malformed: Array.from(malformed.querySelectorAll('td'), node => node.textContent) };
    });
    assert.deepEqual(result.cells, [result.expected, 'end']);
    assert.ok(result.elapsed < 1000, `Unmatched table-cell code delimiters took ${result.elapsed}ms`);
    assert.deepEqual(result.malformed, ['x ```a', 'b``', 'end'], 'An unmatched backtick run cannot reopen inside itself');
    return 3;
};
