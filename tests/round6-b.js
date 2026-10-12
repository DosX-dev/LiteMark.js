'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    const rows = await page.evaluate(() => {
        const rows = [];
        function check(input, selector, expected, name) {
            const host = document.createElement('div'); host.innerHTML = markdownToHtml(input);
            rows.push({ name, actual: Array.from(host.querySelectorAll(selector)).map(n => selector === 'a' ? n.getAttribute('href') : selector === 'img' ? n.alt : n.textContent), expected });
        }
        for (const size of [499, 500, 998, 999, 1000]) {
            const label = '😀'.repeat(size);
            check('[x][' + label + ']\n\n[' + label + ']: /scalar', 'a', size <= 999 ? ['/scalar'] : [], 'Unicode scalar reference label length ' + size);
            check('![' + label + ']\n\n[' + label + ']: /scalar', 'img', size <= 999 ? [label] : [], 'Unicode scalar shortcut image length ' + size);
        }
        for (const [first, second] of [['Σ', 'ς'], ['İ', 'i\u0307'], ['ﬃ', 'FFI'], ['ᾲ', 'ὰι'], ['\u0345', 'ι']]) {
            check('[x][' + first + ']\n\n[' + second + ']: /fold', 'a', ['/fold'], 'full Unicode case folding ' + first);
        }
        for (const width of [1, 2, 4, 7]) for (const escaped of [0, 1, 2, 3]) {
            const ticks = '`'.repeat(width);
            const prefix = '\\'.repeat(escaped);
            const opener = escaped % 2 ? '`' + ticks : ticks;
            const input = prefix + opener + ' x ' + ticks;
            const literal = '\\'.repeat(Math.floor(escaped / 2)) + (escaped % 2 ? '`' : '');
            check(input, 'code', ['x'], 'code opener slash parity ' + width + '/' + escaped);
            check('![' + input + '](image)', 'img', [literal + 'x'], 'image alt code and slash parity ' + width + '/' + escaped);
        }
        for (const marker of ['*', '_', '**', '__', '~~']) {
            check(marker + '[a `b` ![c](img)](/dest)' + marker, 'a', ['/dest'], 'format around code and image link ' + marker);
            check('![' + marker + 'a' + marker + ' <span>b</span> `c` [d](/url)](/image)', 'img', ['a b c d'], 'image plain alt nested formatting ' + marker);
        }
        check('[a\n b](/url "first\nsecond")', 'a', ['/url'], 'multiline label and title');
        check('[x](<a\\>b>)', 'a', ['a%3Eb'], 'escaped angle destination terminator');
        check('> - [x][key]\n>\n>   [key]: /nested "title"\n> - ![x][key]', 'a', ['/nested'], 'references shared between nested list leaves');
        check('> - [x][key]\n>\n>   [key]: /nested "title"\n> - ![x][key]', 'img', ['x'], 'image reference from nested definition');
        return rows;
    });
    for (const row of rows) assert.deepEqual(row.actual, row.expected, row.name);
    return rows.length;
};
