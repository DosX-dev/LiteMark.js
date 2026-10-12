'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    let checks = 0;
    // At the quote's column 2 a tab advances to column 4: only two
    // indentation columns, so these remain block markers, not paragraph text.
    for (const [source, selector, text] of [
        ['> \t# heading', 'blockquote > h1', 'heading'],
        ['> \t- item', 'blockquote > ul > li', 'item'],
        ['> \t```\n> code\n> \t```', 'blockquote > pre > code', 'code\n'],
        ['> text\n> \t---', 'blockquote > h2', 'text'],
        ['> \t> child', 'blockquote > blockquote > p', 'child'],
        ['> \t***', 'blockquote > hr', ''],
    ]) {
        const result = await page.evaluate(({ source, selector }) => {
            const host = document.createElement('div'); host.innerHTML = markdownToHtml(source);
            const element = host.querySelector(selector);
            return element ? element.textContent : null;
        }, { source, selector });
        assert.equal(result, text, source); checks++;
    }
    // CommonMark 0.31.2 adds search to Type-6 HTML block tags; its
    // start can interrupt a paragraph, unlike a generic Type-7 tag.
    for (const source of ['a\n<search>\n*b*\n</search>', 'a\n<search class="box">\n*b*\n</search>']) {
        const result = await page.evaluate(source => {
            const host = document.createElement('div'); host.innerHTML = markdownToHtml(source);
            return host.textContent;
        }, source);
        assert.ok(result.includes('*b*'), 'HTML search block content remains literal: ' + source); checks++;
    }
    return checks;
};


