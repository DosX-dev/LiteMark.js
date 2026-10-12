'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    const result = await page.evaluate(() => {
        const source = document.createElement('markdown');
        source.innerHTML = '<span id="before-target" data-anchor="kept"></span><md>nested</md><span id="after-target" data-anchor="kept"></span>';
        document.body.append(source);
        document.renderAllMarkdownTags(source);
        const result = document.body.lastElementChild;
        const anchors = Array.from(result.querySelectorAll('span[id]'), node => [node.id, node.dataset.anchor]);
        result.remove();
        const check = html => {
            const source = document.createElement('markdown'); source.innerHTML = html;
            document.body.append(source); document.renderAllMarkdownTags(source);
            const rendered = document.body.lastElementChild;
            const result = { text: rendered.textContent, paragraphIds: rendered.querySelectorAll('#paragraph-hook').length, wrapperIds: rendered.querySelectorAll('#wrapper-hook').length };
            rendered.remove(); return result;
        };
        const forged = Array.from({ length: 1000 }, (_, index) => '&lt;span data-litemark-slot=&#39;' + (index + 1) + '&#39;&gt;&lt;/span&gt;').join('');
        return { anchors, collision: check(forged + '<md>secret</md>'), attributes: check('<p id="paragraph-hook"><em id="wrapper-hook">before<md>nested</md>after</em></p>'), alone: check('<p id="paragraph-hook"><md>nested</md></p>') };
    });
    assert.deepEqual(result.anchors, [['before-target', 'kept'], ['after-target', 'kept']], 'Empty HTML anchors around nested Markdown must survive');
    assert.equal(result.collision.text, 'secret', 'Equivalent authored HTML must not collide with private slots');
    assert.equal(result.attributes.paragraphIds, 1, 'Splitting a paragraph must preserve its id once');
    assert.equal(result.attributes.wrapperIds, 1, 'Cloned inline wrappers must preserve their id once');
    assert.equal(result.alone.paragraphIds, 1, 'A paragraph containing only a nested block must preserve its anchor');
    return 5;
};
