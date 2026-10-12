'use strict';
const assert = require('node:assert/strict');

exports.run = async function run(page) {
    let checks = 0;
    // GFM single-column tables need no pipe when the delimiter is not a
    // setext underline. Confirmed with GitHub's Markdown endpoint, mode=gfm.
    for (const [delimiter, align] of [[':---', 'left'], ['---:', 'right'], [':---:', 'center']]) {
        for (const [source, container] of [
            ['header\n' + delimiter + '\nvalue', ''],
            ['> header\n> ' + delimiter + '\n> value', 'blockquote'],
            ['- header\n  ' + delimiter + '\n  value', 'li'],
            ['before\nheader\n' + delimiter + '\nvalue', '']
        ]) {
            const result = await page.evaluate(({ source, container }) => {
                const host = document.createElement('div');
                host.innerHTML = markdownToHtml(source);
                const table = host.querySelector(container ? container + ' table' : 'table');
                return table && [table.querySelector('th').textContent, table.querySelector('th').getAttribute('align'), table.querySelector('td').textContent];
            }, { source, container });
            assert.deepEqual(result, ['header', align, 'value'], source);
            checks++;
        }
    }
    const setext = await page.evaluate(() => markdownToHtml('header\n---'));
    assert.equal(setext, '<h2>header</h2>'); checks++;
    // Each newline must inspect only its trailing source spaces. Scanning
    // the entire prefix froze Edge for several seconds on this 820 KB input.
    const large = await page.evaluate(() => {
        const source = ('a '.repeat(20) + '\n').repeat(20000);
        const start = performance.now();
        const html = markdownToHtml(source);
        const host = document.createElement('div'); host.innerHTML = html;
        return { time: performance.now() - start, paragraphs: host.querySelectorAll('p').length, breaks: host.querySelectorAll('br').length, words: host.textContent.match(/a/g).length };
    });
    assert.equal(large.paragraphs, 1); checks++;
    assert.equal(large.breaks, 0); checks++;
    assert.equal(large.words, 400000); checks++;
    assert.ok(large.time < 2500, '820 KB multiline paragraph should parse without a multi-second freeze: ' + large.time + ' ms'); checks++;
    const references = await page.evaluate(() => {
        const source = '[last][a5999]\n\n' + Array.from({ length: 6000 }, (_, i) => '[a' + i + ']: /a' + i).join('\n');
        const start = performance.now();
        const host = document.createElement('div'); host.innerHTML = markdownToHtml(source);
        return { time: performance.now() - start, text: host.textContent, href: host.querySelector('a') && host.querySelector('a').getAttribute('href') };
    });
    assert.equal(references.text, 'last'); checks++;
    assert.equal(references.href, '/a5999'); checks++;
    assert.ok(references.time < 2500, '6000 contiguous reference definitions should not rebuild the entire suffix index: ' + references.time + ' ms'); checks++;
    return checks;
};
