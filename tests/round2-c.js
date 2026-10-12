'use strict';
const assert = require('node:assert/strict');
async function run(page) {
    const result = await page.evaluate(() => {
        const render = source => { const el = document.createElement('markdown'); el.innerHTML = source; document.body.append(el); document.renderAllMarkdownTags(el); const out = document.body.lastElementChild; const html = out.innerHTML; const text = out.textContent; out.remove(); return { html, text }; };
        return { adjacent: render("<md>x</md><md>y</md><md>z</md>"), inline: render("before <md>x</md> middle <md>y</md> after"), link: render("[<md>**bold**</md>](target.html)"), indented: render("    <md>**bold**</md>"), alt: render('![<md>**bold** &amp;amp;amp;</md>](x)'), siblings: render('<md>**x**</md>\n\n<md>**y**</md>'), following: render('<md>**x**</md>\n# following'), footer: markdownToHtml('<table><tfoot><tr><td><em>footer</em></td></tr></tfoot></table>'), fence: render('```\n<md>**bold**</md>\n```'), code: render('`<md>**bold**</md>`'), table: render('a | b\n---|---\n<md>**foo**</md> | z') };
    });
    assert(result.alt.html.includes('alt="bold &amp;amp;"'), 'Opaque nested Markdown image labels preserve text and one entity layer');
    assert(!result.siblings.html.includes('<p></p>'), 'Standalone nested blocks must not introduce empty paragraphs');
    assert(result.siblings.html.includes('<strong>x</strong>') && result.siblings.html.includes('<strong>y</strong>'), 'Both nested blocks preserve formatting');
    assert(result.following.html.includes('<h1>following</h1>'), 'A standalone nested block does not consume the next Markdown block');
    assert(result.footer.includes('<tfoot>') && result.footer.includes('<td><em>footer</em></td>'), 'Safe table footers preserve their rows and formatting');
    assert(result.fence.html.includes('&lt;div') && !result.fence.html.includes('<strong>'), 'Opaque nested blocks in fenced code remain literal HTML');
    assert(result.code.html.includes('&lt;div') && !result.code.html.includes('<strong>'), 'Opaque nested blocks in inline code remain literal HTML');
    assert(result.table.html.includes('<td><div><p><strong>foo</strong></p></div></td>'), 'Opaque blocks in table cells preserve formatted content');
    assert(!Object.values(result).some(x => (typeof x === 'string' ? x : x.html).includes('data-litemark-slot')), 'Internal placeholders must not leak');
    assert.equal(result.inline.html, "<p>before </p><div><p>x</p></div><p> middle </p><div><p>y</p></div><p> after</p>", "Inline nested blocks split their surrounding paragraph without losing later slots");
    assert(result.link.html.includes("<a href=") && result.link.html.includes("<strong>bold</strong>") && !result.link.html.includes("<p></p>"), "Links still surround nested content without empty repaired paragraphs");
    assert(result.indented.html.includes("<pre") && result.indented.html.includes("&lt;div") && !result.indented.html.includes("<strong>"), "An indented opaque block remains literal code");
    assert.equal(result.adjacent.html, "<div><p>x</p></div><div><p>y</p></div><div><p>z</p></div>", "Adjacent opaque blocks remain in the DOM until each is expanded");
    return 13;
}
module.exports = { run };



