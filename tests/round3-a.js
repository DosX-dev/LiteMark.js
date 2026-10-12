'use strict';
const assert = require('node:assert/strict');

// Missing inline HTML terminators must not scan the entire remaining suffix
// again at each candidate. These are literal Markdown text, not HTML blocks:
// the paragraph prefix prevents processing-instruction / CDATA block starts.
exports.run = async function run(page) {
    let checks = 0;
    for (const [prefix, count, limit] of [['<?', 50000, 1500], ['<![CDATA[', 50000, 1500], ['<!X ', 50000, 1500], ['<!--text ', 50000, 1500]]) {
        const result = await page.evaluate(({ prefix, count }) => {
            const source = 'prefix ' + prefix.repeat(count);
            const start = performance.now();
            const html = markdownToHtml(source);
            const elapsed = performance.now() - start;
            const host = document.createElement('div'); host.innerHTML = html;
            return { elapsed, text: host.textContent, paragraphs: host.querySelectorAll('p').length };
        }, { prefix, count });
        assert.equal(result.text, ('prefix ' + prefix.repeat(count)).trimEnd()); checks++;
        assert.equal(result.paragraphs, 1); checks++;
        assert.ok(result.elapsed < limit, `${prefix} malformed inline HTML should complete without a multi-second freeze (${result.elapsed} ms)`); checks++;
    }
    for (const input of ['prefix <!--comment--> suffix', 'prefix <![CDATA[text]]> suffix', 'prefix <!X text> suffix']) {
        const result = await page.evaluate(input => markdownToHtml(input), input);
        assert.equal(result, '<p>prefix  suffix</p>', 'Complete inline HTML constructs still parse: ' + input); checks++;
    }
    return checks;
};



