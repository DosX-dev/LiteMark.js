'use strict';
const assert = require('node:assert/strict');
// CommonMark 0.31.2 §2.5 numeric references use corresponding Unicode code
// points; §6.3 reference labels use Unicode default case folding.
exports.run = async function run(page) {
    const rows = await page.evaluate(() => {
        const parse = input => { const host = document.createElement('div'); host.innerHTML = markdownToHtml(input); return host; };
        const results = [];
        for (const [label, definition, expected] of [['\u0131', 'I', 0], ['I', '\u0131', 0], ['i', 'I', 1], ['\u00df', 'SS', 1], ['\u1e9e', 'ss', 1], ['\u03c3', '\u03c2', 1], ['\ufb03', 'ffi', 1], ['\u017f', 's', 1], ['\u0130', 'i', 0], ['\u0130', '\u0131', 0], ['\u13a0', '\uab70', 1], ['\u{10400}', '\u{10428}', 1]]) {
            const input = '[' + label + ']\n\n[' + definition + ']: /url';
            results.push({ name: input, actual: parse(input).querySelectorAll('a').length, expected });
        }
        for (const point of [128, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 142, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 158, 159]) {
            for (const input of ['&#' + point + ';', '&#x' + point.toString(16) + ';']) {
                results.push({ name: input, actual: parse(input).textContent, expected: String.fromCodePoint(point) });
            }
        }
        for (const slashes of [2, 4, 6]) {
            const host = parse("| a" + "\\".repeat(slashes) + "|\n| --- |");
            results.push({ name: "terminal table pipe after " + slashes + " backslashes", actual: host.querySelectorAll("th").length, expected: 1 });
            results.push({ name: "table header preserves escaped backslashes " + slashes, actual: host.querySelector("th")?.textContent, expected: "a" + "\\".repeat(slashes / 2) });
        }
        const title = parse('[x](/url "&#128;")').querySelector('a');
        results.push({ name: 'numeric reference in link title', actual: title.getAttribute('title'), expected: '\u0080' });
        const started = performance.now();
        const repeated = parse("a *b* ".repeat(120000));
        const duration = performance.now() - started;
        results.push({ name: "120000 valid emphasis pairs", actual: repeated.querySelectorAll("em").length, expected: 120000 });
        results.push({ name: "valid emphasis text retained", actual: repeated.textContent.length, expected: 480000 - 1 });
        results.push({ name: "120000 valid emphasis pairs finish within 2500ms: " + duration, actual: duration < 2500, expected: true });
        return results;
    });
    for (const row of rows) assert.equal(row.actual, row.expected, row.name);
    return rows.length;
};

