'use strict';
const assert = require('node:assert/strict');
exports.run = async function (page) {
    const rows = await page.evaluate(() => {
        const rows = [];
        function test(input, selector, expected, name) { const h = document.createElement('div'); h.innerHTML = markdownToHtml(input); rows.push({ name, input, expected, actual: Array.from(h.querySelectorAll(selector), n => selector === 'a' ? n.getAttribute('href') : selector === 'img' ? n.alt : n.textContent) }); }
        for (const [a, b] of [['ß', 'SS'], ['ẞ', 'ss'], ['ſ', 'S'], ['ϐ', 'β'], ['ϑ', 'θ'], ['ϴ', 'θ'], ['ϕ', 'φ'], ['ϖ', 'π'], ['K', 'k'], ['Ω', 'ω'], ['Å', 'å'], ['Ꮳ', 'ꮳ']]) test('[x][' + a + ']\n\n[' + b + ']: /fold', 'a', ['/fold'], 'case equivalence ' + a);
        test('[x][ı]\n\n[i]: /no', 'a', [], 'dotless I distinction');
        for (const space of [' ', '\t', '\n', '\f', '\u00a0', '\u1680', '\u2000', '\u202f', '\u3000']) test('[x][a' + space + 'b]\n\n[a b]: /space', 'a', ['/space'], 'label whitespace ' + JSON.stringify(space));
        for (const marker of ['*', '_', '**', '__', '~~']) for (const body of ['`a b`', '[a](u)', '![a](i)', '<https://a.b>', 'a&amp;b']) test('![' + marker + body + marker + '](img)', 'img', [body === '`a b`' ? 'a b' : body === 'a&amp;b' ? 'a&b' : body === '<https://a.b>' ? 'https://a.b' : 'a'], 'plain image children ' + marker + '/' + body);
        for (const dest of ['a(b)c', 'a\\(b\\)c', '<a(b)c>']) test('[x](' + dest + ')', 'a', ['a(b)c'], 'destination parentheses ' + dest);
        for (const title of ['"a\\"b"', "'a\\'b'", '(a\\)b)']) { const h = document.createElement('div'); h.innerHTML = markdownToHtml('[x](u ' + title + ')'); rows.push({ name: 'escaped title ' + title, expected: ['a' + (title[0] === '"' ? '"' : title[0] === "'" ? "'" : ')') + 'b'], actual: Array.from(h.querySelectorAll('a'), n => n.title) }); }
        for (const input of ['<a@b>', '<A+B@EXAMPLE.COM>', '<foo:bar>', '<ab:>']) test(input, 'a', [input.includes('@') ? 'mailto:' + input.slice(1, -1) : input.slice(1, -1)], 'angle autolink ' + input);
        test('[outer [inner](in)](out)', 'a', ['in'], 'nested link invalidates outer');
        test('[outer ![inner](img)](out)', 'a', ['out'], 'nested image permits outer link');
        test('![outer [inner](in)](img)', 'img', ['outer inner'], 'image contains link text');
        test('![outer ![inner](img2)](img)', 'img', ['outer inner'], 'image contains image text');
        test('[a][key]\n\n[key]: /first\n[key]: /second', 'a', ['/first'], 'first definition wins');
        test('[a][key]\n\n[key]: /x "bad\n\n title"', 'a', [], 'blank title invalidates same-line definition');
        test('[a][&amp;]\n\n[&]: /no', 'a', [], 'reference entity spelling remains literal');
        test('[a][\\*]\n\n[*]: /no', 'a', [], 'reference escape spelling remains literal');
        test('*😀* _😀_ **😀**', 'em', ['😀', '😀'], 'astral flanking');
        for (const size of [1000, 5000, 10000]) { const input = '!['.repeat(size) + ' [x](url)'; const t = performance.now(); const h = document.createElement('div'); h.innerHTML = markdownToHtml(input); rows.push({ name: 'unmatched images with final link ' + size, actual: Array.from(h.querySelectorAll('a'), n => n.getAttribute('href')), expected: ['url'] }); if (performance.now() - t > 3000) throw Error('slow image bracket stack ' + size); }
        return rows;
    });
    for (const r of rows) assert.deepEqual(r.actual, r.expected, r.name + ' ' + r.input);
    return rows.length;
};

