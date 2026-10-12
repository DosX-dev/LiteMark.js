const assert = require('node:assert/strict');

// These cases exercise source provenance beyond the published examples.
// Escaped/entity-built URL prefixes stay text, while GFM can still recognize
// email addresses in the resolved text (verified with GitHub's Markdown API).
module.exports = async function run(page) {
    const results = await page.evaluate(() => {
        const cases = [];
        const add = (name, markdown, expected) => {
            const element = document.createElement('div');
            element.innerHTML = markdownToHtml(markdown);
            cases.push({ name, actual: { text: element.textContent, breaks: element.querySelectorAll('br').length, links: element.querySelectorAll('a').length }, expected });
        };
        add('entity spaces do not create a hard break', 'a&#32;&#32;\nb', { text: 'a  \nb', breaks: 0, links: 0 });
        add('mixed decoded and literal spaces stay a soft break', 'a&#32; \nb', { text: 'a \nb', breaks: 0, links: 0 });
        add('literal hard break preserves preceding entity space', 'a&#32;  \nb', { text: 'a \nb', breaks: 1, links: 0 });
        for (const char of ['\uFEFF', '\u000B', '\u2028', '\u2029']) {
            add('reference labels preserve U+' + char.charCodeAt(0).toString(16), '[x]\n\n[x' + char + ']: /a', { text: '[x]', breaks: 0, links: 0 });
            add('reference labels do not fold U+' + char.charCodeAt(0).toString(16), '[x y]\n\n[x' + char + 'y]: /a', { text: '[x y]', breaks: 0, links: 0 });
        }
        for (const length of [500, 999]) {
            const label = '😀'.repeat(length);
            add('shortcut reference counts Unicode characters: ' + length, '[' + label + ']\n\n[' + label + ']: /a', { text: label, breaks: 0, links: 1 });
            add('explicit reference counts Unicode characters: ' + length, '[label][' + label + ']\n\n[' + label + ']: /a', { text: 'label', breaks: 0, links: 1 });
        }
        const tooLong = '\\!'.repeat(500);
        const longElement = document.createElement('div');
        longElement.innerHTML = markdownToHtml('[label][' + tooLong + ']\n\n[' + tooLong + ']: /a');
        cases.push({ name: 'escaped pairs still count two source characters in label limit', actual: longElement.querySelectorAll('a').length, expected: 0 });
        for (const [markdown, text] of [['www\\.example.com', 'www.example.com'], ['http\\://example.com', 'http://example.com'], ['www&#46;example.com', 'www.example.com']]) {
            add('decoded URL prefix is not markup: ' + markdown, markdown, { text, breaks: 0, links: 0 });
        }
        add('resolved escaped email retains GFM autolinking', 'foo\\@example.com', { text: 'foo@example.com', breaks: 0, links: 1 });
        for (const char of ['\t', '\v', '\f', '\r', '\n']) {
            const element = document.createElement('div');
            element.innerHTML = markdownToHtml('- [' + char + '] task');
            const checkbox = element.querySelector('input[type="checkbox"]');
            cases.push({ name: 'ordinary whitespace inside task marker: U+' + char.charCodeAt(0).toString(16), actual: checkbox ? checkbox.checked : null, expected: false });
        }
        for (const char of ['\uFEFF', '\u00A0', '\u2028', '\u2029']) {
            const element = document.createElement('div');
            element.innerHTML = markdownToHtml('- [x]' + char + 'task\n- [' + char + '] task');
            cases.push({ name: 'nonordinary whitespace does not create task markers: U+' + char.charCodeAt(0).toString(16), actual: element.querySelectorAll('input').length, expected: 0 });
        }
        for (const entity of ['&notit;', '&copycat;', '&ampfoo;']) {
            add('unknown named entity stays literal: ' + entity, entity, { text: entity, breaks: 0, links: 0 });
            const element = document.createElement('div');
            element.innerHTML = markdownToHtml('[label](/' + entity + ' "' + entity + '") ![' + entity + '](/' + entity + ')');
            const link = element.querySelector('a'), image = element.querySelector('img');
            cases.push({ name: 'unknown entity stays literal in destinations/title/alt: ' + entity, actual: [link.getAttribute('href'), link.title, image.getAttribute('src'), image.alt], expected: ['/' + entity, entity, '/' + entity, entity] });
        }
        const large = '![**' + '`x` '.repeat(80000) + 'x**](a.png)';
        const element = document.createElement('div');
        element.innerHTML = markdownToHtml(large);
        const image = element.querySelector('img');
        cases.push({ name: 'large formatted image alternative avoids spread argument overflow', actual: image && image.alt, expected: 'x '.repeat(80000) + 'x' });
        return cases;
    });
    for (const result of results) assert.deepEqual(result.actual, result.expected, result.name);
    return results.length;
};
