'use strict';
const assert = require('node:assert/strict');
exports.run = async function run(page) {
    const actual = await page.evaluate(() => {
        const render = source => {
            const host = document.createElement('section');
            const input = document.createElement('markdown');
            input.innerHTML = source;
            host.append(input);
            document.renderAllMarkdownTags(host);
            return host.querySelector('img').getAttribute('alt');
        };
        return {
            baseline: render('![![x](z)](u)'),
            image: render('![<md>![x](z)</md>](u)'),
            mixed: render('![before <md>![**x**](z) after</md> end](u)'),
            deeper: render('![<md><md>![x](z)</md></md>](u)'),
            break: render('![<md>a  \nb</md>](u)'),
        };
    });
    assert.equal(actual.baseline, 'x', 'Ordinary nested images contribute their alternative text');
    assert.equal(actual.image, 'x', 'Nested source images contribute their alternative text to an outer image description');
    assert.equal(actual.mixed, 'before x after end', 'Nested image alternative text joins surrounding description text');
    assert.equal(actual.deeper, 'x', 'Image description text survives multiple nested source tags');
    assert.equal(actual.break, 'a\nb', 'A hard break in an opaque image description retains its newline');
    return 5;
};
