'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    const actual = await page.evaluate(() => {
        const render = source => {
            const host = document.createElement('section');
            host.innerHTML = '<markdown>' + source + '</markdown>';
            document.body.append(host);
            document.renderAllMarkdownTags(host);
            const text = host.textContent;
            host.remove();
            return text;
        };
        return {
            string: markdownToHtml('<template><strong>hello</strong></template>'),
            nestedString: markdownToHtml('<template>before<template>middle</template>after</template>'),
            source: render('<template><strong>hello</strong></template>'),
            metadata: markdownToHtml('<meta content="value"><div>hello</div>'),
        };
    });
    assert.equal(actual.string, '<p>hello</p>', 'Unsupported inert templates preserve their text like other removed HTML elements');
    assert.equal(actual.nestedString, '<p>beforemiddleafter</p>', 'Text preservation includes nested inert template contents');
    assert.equal(actual.source, 'hello', 'DOM source serialization must include inert template content');
    assert(actual.metadata.includes('<div>hello</div>') && !actual.metadata.includes('<meta'), 'String-valued content attributes are not template fragments');
    return 4;
};
