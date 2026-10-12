const assert = require('node:assert/strict');

// Paragraph/table transitions and indentation must work inside containers too.
exports.run = async function run(page) {
    const cases = [
        ['table interrupts paragraph', 'before\na | b\n--- | ---\nx | y', ['before'], ['a', 'b'], ['x', 'y'], ''],
        ['table interrupts quote paragraph', '> before\n> a | b\n> --- | ---\n> x | y', ['before'], ['a', 'b'], ['x', 'y'], ''],
        ['table interrupts list paragraph', '- before\n  a | b\n  --- | ---\n  x | y', [], ['a', 'b'], ['x', 'y'], ''],
        ['indented delimiter is paragraph', 'foo | bar\n    --- | ---', ['foo | bar\n--- | ---'], [], [], ''],
        ['indented row starts code', 'foo | bar\n--- | ---\n    a | b', [], ['foo', 'bar'], [], 'a | b\n'],
        ['tab-indented row starts code', 'foo | bar\n--- | ---\n\ta | b', [], ['foo', 'bar'], [], 'a | b\n'],
        ['indented quote row starts code', '> foo | bar\n> --- | ---\n>     a | b', [], ['foo', 'bar'], [], 'a | b\n'],
        ['indented list row starts code', '- foo | bar\n  --- | ---\n      a | b', [], ['foo', 'bar'], [], 'a | b\n'],
        ['list code preserves blank-line spaces', '-     chunk1\n        \n        chunk2', [], [], [], 'chunk1\n  \n  chunk2\n'],
        ['list fence preserves blank-line spaces', '- ```\n    \n  ```', [], [], [], '  \n'],
        ['missing quote prefix stays lazy paragraph', '> before\na | b\n--- | ---\nx | y', ['before\na | b\n--- | ---\nx | y'], [], [], ''],
        ['missing list prefix stays lazy paragraph', '- before\na | b\n--- | ---\nx | y', [], [], [], ''],
    ];
    for (const [name, markdown, paragraphs, headers, cells, code] of cases) {
        const actual = await page.evaluate(markdown => {
            const root = document.createElement('div'); root.innerHTML = markdownToHtml(markdown);
            return {
                paragraphs: [...root.querySelectorAll('p')].map(node => node.textContent),
                headers: [...root.querySelectorAll('th')].map(node => node.textContent),
                cells: [...root.querySelectorAll('td')].map(node => node.textContent),
                code: root.querySelector('pre code')?.textContent || '',
            };
        }, markdown);
        assert.deepEqual(actual, { paragraphs, headers, cells, code }, name);
    }
    return cases.length;
};


