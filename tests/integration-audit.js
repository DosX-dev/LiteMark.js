'use strict';
const assert = require('node:assert/strict');

async function run(page) {
    const result = await page.evaluate(() => {
        const results = [];
        function render(input) {
            const source = document.createElement('markdown');
            source.innerHTML = input;
            document.body.append(source);
            document.renderAllMarkdownTags(source);
            const rendered = document.body.lastElementChild;
            const html = rendered.innerHTML;
            const text = rendered.textContent;
            rendered.remove();
            return { html, text };
        }
        results.push(render('before <md id="audit-inner">\\*literal\\*</md> after'));
        results.push(render('<md id="audit-inner">`<b>bold</b>`</md>'));
        results.push(render('before <md id="audit-inner">`**literal**`</md> after'));
        results.push(render('before <md id="audit-inner">&amp;amp;amp;</md> after'));
        results.push(render('<code>&lt;b&gt;literal&lt;/b&gt;</code>'));
        results.push(render('<span>&lt;em&gt;literal&lt;/em&gt;</span>'));
        results.push(render('<div>&amp;amp;</div>'));
        // Root text must still be parsed as decoded Markdown, including entities
        // used to encode quotation markers and literal fenced-code markup.
        results.push(render('&gt; quote'));
        results.push(render('```\n&lt;b&gt; &amp;amp;\n```'));
        results.push(render('```\n<md id="audit-fence">**bold**</md>\n```'));
        const began = performance.now();
        const malformed = markdownToHtml('[a]('.repeat(10000));
        const milliseconds = performance.now() - began;
        const imageHolder = document.createElement("div");
        imageHolder.innerHTML = markdownToHtml("![*" + "a `b` ".repeat(70000) + "z*](x)");
        const largeAlt = imageHolder.querySelector("img").getAttribute("alt");
        return { results, milliseconds, malformed, largeAlt };
    });
    const { results } = result;
    assert(!results[0].html.includes('<em>'), 'Rendered nested escaped Markdown must remain literal');
    assert(results[1].html.includes('<code>&lt;b&gt;bold&lt;/b&gt;</code>'), 'Nested code HTML must stay escaped');
    assert(results[2].html.includes('<code>**literal**</code>'), 'Nested code must not be reparsed as emphasis');
    assert(results[3].text.includes('&amp;'), 'Nested entities must not be decoded twice');
    assert(results[4].html.includes('<code>&lt;b&gt;literal&lt;/b&gt;</code>'), 'Real HTML child text must remain literal');
    assert(results[5].html.includes('<span>&lt;em&gt;literal&lt;/em&gt;</span>'), 'Encoded HTML in child text must not create elements');
    assert.equal(results[6].text, '&amp;', 'HTML subtree entities must preserve the original DOM text');
    assert(results[7].html.includes('<blockquote>'), 'Root encoded quotation marker still parses');
    assert(results[8].html.includes('&lt;b&gt; &amp;amp;'), 'Root code text is decoded only by the HTML source parser');
    assert(!results[9].html.includes("<strong>"), "Nested rendered HTML inside fenced code stays literal");
    assert(results[9].html.includes("&lt;div"), "Opaque token in code expands as escaped HTML");
    assert(!results[9].html.includes("data-litemark-slot"), "Opaque tokens never leak into output");
    assert(result.milliseconds < 1000, `Malformed link destinations should finish promptly, took ${result.milliseconds}ms`);
    assert.equal(result.malformed, '<p>' + '[a]('.repeat(10000) + '</p>');
    assert.equal(result.largeAlt, "a b ".repeat(70000) + "z", "Large formatted image alternative text must not exceed the function argument limit");
    return 15;
}
module.exports = { run };



