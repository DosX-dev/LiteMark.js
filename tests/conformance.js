const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const examples = JSON.parse(fs.readFileSync(path.join(__dirname, 'gfm.json')));
(async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'litemark-conformance-'));
    const browser = await chromium.launch({ channel: process.env.LITEMARK_BROWSER || 'msedge', headless: true });
    try {
        let failed = 0;
        const page = await browser.newPage();
        await page.setContent('<!doctype html><meta charset=utf-8><main></main>');
        let source = fs.readFileSync(path.join(root, 'source/LiteMark.js'), 'utf8');
        source = source.replace('    window.markdownToHtml =', '    window.__test = { parseMarkdown, sanitize };\n    window.markdownToHtml =');
        await page.addScriptTag({ content: source });
        for (const [name, cases] of [['commonmark', JSON.parse(fs.readFileSync(path.join(__dirname, 'commonmark.json')))], ['gfm', examples], ['gfm-published', JSON.parse(fs.readFileSync(path.join(__dirname, 'gfm-published.json')))]]) {
            const failures = await page.evaluate(({ cases, name }) => {
                function canonical(html) {
                    const template = document.createElement('template'); template.innerHTML = html;
                    function visit(node) {
                        if (node.nodeType === 3) return node.data;
                        if (node.nodeType === 8) return ['comment', node.data];
                        const tag = node.localName || 'root';
                        const attributes = Array.from(node.attributes || []).filter(attr => !['target', 'rel'].includes(attr.name) && !(attr.name === 'style' && ['img', 'th', 'td', 'li'].includes(tag)) && !(attr.name === 'class' && tag === 'pre')).map(attr => [attr.name, attr.value]).sort();
                        let children = Array.from(node.childNodes).filter(child => !(child.nodeType === 3 && /^\s*$/.test(child.data) && ['root', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr'].includes(tag))).map(visit);
                        const merged = []; for (const child of children) { if (typeof child === 'string' && typeof merged[merged.length - 1] === 'string') merged[merged.length - 1] += child; else merged.push(child); }
                        // GFM 0.29 flattens repeated emphasis; CommonMark 0.31 retains it.
                        // Both have identical semantics. Normalize only identical nested tags.
                        const flat = [];
                        for (const child of merged) {
                            if (Array.isArray(child) && ['strong', 'em'].includes(tag) && child[0] === tag && !child[1].length) flat.push(...child[2]);
                            else flat.push(child);
                        }
                        const joined = [];
                        for (const child of flat) { if (typeof child === 'string' && typeof joined[joined.length - 1] === 'string') joined[joined.length - 1] += child; else joined.push(child); }
                        return [tag, attributes, joined];
                    }
                    return JSON.stringify(visit(template.content));
                }
                return cases.flatMap(test => {
                    // GFM contains base-grammar examples followed by extension examples.
                    // Run each against its stated grammar; no examples are skipped.
                    const extensions = name.startsWith('gfm') && (/\(extension\)/.test(test.section) || name === 'gfm-published' && /Raw HTML/.test(test.section));
                    const actual = __test.parseMarkdown(test.markdown, extensions);
                    if (canonical(actual) === canonical(test.html)) return [];
                    return [{ ...test, actual }];
                });
            }, { cases, name });
            fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(failures, null, 2));
            const sections = {}; for (const failure of failures) sections[failure.section] = (sections[failure.section] || 0) + 1;
            console.log(name, cases.length - failures.length, '/', cases.length, sections);
            failed += failures.length;
        }
        console.log('Artifacts:', directory);
        assert.equal(failed, 0, 'Every specification example must pass');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
