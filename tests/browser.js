const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'litemark-browser-'));
const source = fs.readFileSync(path.join(__dirname, '../source/LiteMark.js'), 'utf8');
assert(!/MarkdownIt|markdown-it|require\(|\bimport\s/.test(source), 'The library must be standalone and authored here');
assert.deepEqual(fs.readdirSync(path.join(__dirname, '../source')).filter(name => name.endsWith('.js')), ['LiteMark.js']);
fs.writeFileSync(path.join(directory, 'LiteMark.js'), source);
fs.writeFileSync(path.join(directory, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64'));
fs.writeFileSync(path.join(directory, 'illustration.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="96" viewBox="0 0 192 96"><rect width="192" height="96" rx="8" fill="#264b85"/><circle cx="48" cy="48" r="28" fill="#ffd166"/><path d="M90 70L125 25L172 70Z" fill="#63d5b7"/><text x="96" y="89" fill="white" font-family="sans-serif" font-size="12" text-anchor="middle">Markdown image</text></svg>');
fs.writeFileSync(path.join(directory, 'target.html'), '<!doctype html><title>Link works</title>');
fs.writeFileSync(path.join(directory, 'late.html'), '<!doctype html><markdown id="late"># Late script</markdown>');
fs.writeFileSync(path.join(directory, 'index.html'), `<!doctype html><meta charset="utf-8"><title>LiteMark browser regression gallery</title>
<style>body{font:16px system-ui;max-width:960px;margin:24px auto;padding:0 16px;overflow-wrap:anywhere}section{padding:12px;border:1px solid #ccc;margin:12px 0}table{border-collapse:collapse}td,th{border:1px solid #999;padding:6px}pre{padding:12px;background:#eee;overflow:auto}blockquote{border-left:4px solid #aaa;padding-left:12px;margin-left:0}img{max-width:100%}</style>
<script src="LiteMark.js"></script><markdown id="auto" class="original" data-source="kept"># Automatic\n\n&gt; **Quote**\n&gt; second line</markdown><main id="results"></main>`);
const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).slice(1) || 'index.html';
    if (name === 'favicon.ico') { res.statusCode = 204; res.end(); return; }
    if (!['LiteMark.js', 'index.html', 'late.html', 'target.html', 'pixel.png', 'illustration.svg'].includes(name)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : name.endsWith('.png') ? 'image/png' : name.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(directory, name)));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: process.env.LITEMARK_BROWSER || 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        const base = `http://127.0.0.1:${server.address().port}`;
        await page.goto(base);
        const result = await page.evaluate(() => {
            let count = 0;
            function check(condition, name) { if (!condition) throw Error(name); count++; }
            function parse(markdown, show = true) { const element = document.createElement('section'); element.innerHTML = markdownToHtml(markdown); if (show) document.querySelector('#results').append(element); return element; }
            function text(md, expected) { check(parse(md, false).textContent === expected, 'text: ' + JSON.stringify(md)); }
            const auto = document.querySelector('#auto');
            check(auto.localName === 'div' && auto.querySelector('h1').textContent === 'Automatic', 'automatic rendering');
            check(auto.className === 'original' && auto.dataset.source === 'kept', 'source attributes');
            check(auto.querySelector('blockquote strong').textContent === 'Quote', 'HTML source quotes');
            const quote = parse('> first\n> second\n>\n> - one\n> - two\n>   > nested');
            check(quote.querySelectorAll('blockquote').length === 2, 'nested quotes');
            check(quote.querySelector('blockquote p').textContent === 'first\nsecond', 'quote paragraph grouping');
            check(quote.querySelectorAll('li').length === 2, 'list inside quote');
            const code = parse('```js\n\n  const x = "<&amp;>";\n\\*literal\\*\n\n```');
            check(code.querySelector('code').textContent === '\n  const x = "<&amp;>";\n\\*literal\\*\n\n', 'literal fenced code');
            check(code.querySelector('code').className === 'language-js', 'language metadata');
            check(parse('`` a ` b ``', false).querySelector('code').textContent === 'a ` b', 'backtick runs');
            check(parse('`unclosed', false).querySelector('code') === null, 'unclosed code stays literal');
            check(parse('~~~txt\n<>&amp;\n~~~', false).querySelector('code').textContent === '<>&amp;\n', 'tilde fence');
            check(parse('    a\n      \n    b', false).querySelector('code').textContent === 'a\n  \nb\n', 'indented code whitespace');
            check(parse('[link](https://example.com/a(b)c "title")', false).querySelector('a').getAttribute('href') === 'https://example.com/a(b)c', 'balanced URL');
            check(parse('[ёж](</a b> "Ёж")', false).querySelector('a').getAttribute('href') === '/a%20b', 'angle destination spaces');
            const reference = parse('[full][a] [short][] [implicit]\n\n[a]: /target.html "Full"\n[short]: /target.html\n[implicit]: /target.html');
            check(reference.querySelectorAll('a').length === 3 && reference.querySelector('a').title === 'Full', 'reference forms and forward definitions');
            check(parse('[FOO  bar]\n\n[foo bar]: /target.html', false).querySelector('a') !== null, 'label whitespace and case');
            check(parse('[x]\n\n[x]: /first\n[x]: /second', false).querySelector('a').getAttribute('href') === '/first', 'first definition wins');
            check(parse('> [link]\n>\n> [link]: /target.html', false).querySelector('blockquote a') !== null, 'definition in quote');
            check(parse('- [link]\n\n  [link]: /target.html', false).querySelector('li a') !== null, 'definition in list');
            check(parse('**bold *italic***', false).querySelector('strong em').textContent === 'italic', 'nested emphasis');
            text('foo_bar_baz', 'foo_bar_baz');
            text('\u00a0', '\u00a0');
            check(parse('# \u00a0title\u00a0', false).querySelector('h1').textContent === '\u00a0title\u00a0', 'heading preserves nonbreaking spaces');
            check(parse('    code\n    \u00a0', false).querySelector('code').textContent === 'code\n\u00a0\n', 'nonbreaking space is not a blank code line');
            check(parse('a\n#\u00a0b', false).querySelectorAll('p').length === 1, 'nonbreaking space cannot separate heading marker');
            check(parse('a|b\n---|---\n\u00a0|x', false).querySelector('td').textContent === '\u00a0', 'table nonbreaking spaces');
            check(parse('*\ufeff*', false).querySelector('em').textContent === '\ufeff', 'BOM is not emphasis whitespace');
            text('<span\u00a0title=x>text</span>', '<span\u00a0title=x>text');
            check(parse('<span title=a\u00a0b>text</span>', false).querySelector('span').title === 'a\u00a0b', 'nonbreaking space in unquoted HTML attribute');
            check(parse('a*😀*b', false).querySelector('em') === null, 'astral Unicode punctuation flanking');
            check(parse('😀*ёж*😀', false).querySelector('em').textContent === 'ёж', 'emphasis next to astral symbols');
            text('\\*literal\\* &amp; &lt; &bogus;', '*literal* & < &bogus;');
            const table = parse('| a | b |\n| :--- | ---: |\n| `x|y` | z |\n| only |\n| one | two | extra |');
            check(table.querySelectorAll('td').length === 6 && table.querySelector('code').textContent === 'x|y', 'table code pipes and row widths');
            check(table.querySelector('th').style.textAlign === 'left' && table.querySelectorAll('th')[1].style.textAlign === 'right', 'table alignments');
            check(parse('a | b\n---|---\nx\\|y | **z**', false).querySelector('td').textContent === 'x|y', 'no edge pipes and escaped pipes');
            const combined = parse('> - Table:\n>\n>   | Image | Format |\n>   | :---: | --- |\n>   | [![*pixel*](/illustration.svg "pic")](/target.html) | ~~gone~~ **bold** |');
            check(combined.querySelector('blockquote li table td a img').alt === 'pixel', 'quote list table linked image');
            check(combined.querySelector('td del').textContent === 'gone', 'formatting inside table');
            const list = parse('- [x] done\n  1. child\n  2. other\n- [ ] pending');
            check(list.querySelectorAll('input').length === 2 && list.querySelectorAll('ol li').length === 2, 'nested tasks');
            check(list.querySelector('input').checked && list.querySelector('input').disabled, 'task state');
            const ordered = parse('3. three\n7. next', false);
            check(ordered.querySelector('ol').start === 3 && !ordered.querySelector('li').hasAttribute('value'), 'list numbering');
            check(parse('- a\n\n  b\n\n- c', false).querySelectorAll('li p').length === 3, 'loose list paragraphs');
            check(parse('a\nb\n\nc  \nd\ne\\\nf', false).querySelectorAll('br').length === 2, 'hard versus soft breaks');
            const headers = parse('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n\nSetext\n======\n\nOther\n-----', false);
            check(headers.querySelectorAll('h1,h2,h3,h4,h5,h6').length === 8, 'all headings');
            check(parse('www.example.com https://example.com/a(b). name@example.com ftp://example.com', false).querySelectorAll('a').length === 4, 'extended autolinks');
            check(parse('a.b-c_d@a.b_', false).querySelector('a') === null, 'invalid email domain');
            check(parse('_foo@bar_baz.example', false).querySelector('a').getAttribute('href') === 'mailto:_foo@bar_baz.example', 'email underscores');
            check(parse('[a@b.c www.foo.bar]', false).querySelectorAll('a').length === 2, 'autolinks after failed brackets in document order');
            check(parse('mailto:foo@bar.baz xmpp:foo@bar.baz/txt@bin.com', false).querySelectorAll('a').length === 2, 'protocol autolinks');
            const domains = parse('https://localhost www.local', false).querySelectorAll('a');
            check(domains.length === 1 && domains[0].getAttribute('href') === 'http://www.local', 'www prefix is part of its valid domain');
            check(parse('foo <!-- not -- valid -->', false).textContent === 'foo <!-- not -- valid -->', 'strict GFM inline comments');
            check(parse('[x](/a&#99999999;)', false).querySelector('a').getAttribute('href') === '/a&#99999999;', 'invalid numeric entity in URL');
            const nestedAnchor = parse('[<https://example.com>](https://other.example)', false);
            check(nestedAnchor.querySelector('a a') === null && nestedAnchor.textContent.startsWith('['), 'no nested anchors');
            const entity = parse('[x](/test?a=1&amp;b=2) [y](/test?a=1&amp;amp;b=2)', false);
            check(entity.querySelectorAll('a')[0].getAttribute('href') === '/test?a=1&b=2' && entity.querySelectorAll('a')[1].getAttribute('href') === '/test?a=1&amp;b=2', 'URL entities decoded once');
            const safe = parse('<details open><summary>HTML</summary>\n\nraw **not parsed**\n\n</details>');
            check(safe.querySelector('details[open] summary').textContent === 'HTML', 'safe block HTML');
            const attacks = [
                '[x](javascript:alert(1))', '[x](<jav&#x09;ascript:alert(1)>)', '<a href="java&#10;script:alert(1)">x</a>',
                '<img src="javascript:alert(1)" onerror="alert(1)">', '<svg onload="alert(1)"><a href="javascript:alert(1)">x</a></svg>',
                '<iframe srcdoc="<script>alert(1)</script>"></iframe>', '<script>alert(1)</script>', '<style>body{display:none}</style>',
                '<span style="background:url(javascript:alert(1));color:red" onclick="alert(1)">x</span>',
                '![x](data:image/svg+xml;base64,PHN2Zz4=)', '[x](vbscript:msgbox(1))', '<math><mtext><img src=x onerror=alert(1)></mtext></math>'
            ];
            for (const attack of attacks) {
                const host = parse(attack, false);
                check(!host.querySelector('script,style,iframe,svg,math,[onerror],[onclick],[onload]'), 'sanitized tags: ' + attack);
                check(!Array.from(host.querySelectorAll('[href],[src]')).some(element => /^(?:javascript|vbscript|data):/i.test((element.getAttribute('href') || element.getAttribute('src')).replace(/\s/g, ''))), 'sanitized URL: ' + attack);
            }
            check(parse('[custom](steam://run/1)', false).querySelector('a').getAttribute('href') === 'steam://run/1', 'safe custom URL scheme');
            for (const selector of ['markdown', 'md', 'text']) {
                const element = document.createElement(selector); if (selector === 'text') element.setAttribute('type', 'text/md');
                element.textContent = '**dynamic**'; element.setAttribute('data-test', selector); document.body.append(element); document.renderAllMarkdownTags(element);
                check(document.body.lastElementChild.querySelector('strong').textContent === 'dynamic' && document.body.lastElementChild.dataset.test === selector, 'root rendering: ' + selector);
                document.body.lastElementChild.remove();
            }
            const nested = document.createElement('markdown'); nested.innerHTML = '# Outer\n\n<md id="inner">**Inner**</md>'; document.body.append(nested); document.renderAllMarkdownTags(nested);
            check(document.querySelector('#inner strong').textContent === 'Inner' && !document.querySelector('markdown,md'), 'nested source tags'); document.body.lastElementChild.remove();
            const dom = document.createElement('markdown'); dom.textContent = '```\n<img> &amp; \\*literal\\*\n```'; document.body.append(dom); document.renderAllMarkdownTags(dom);
            check(document.body.lastElementChild.querySelector('code').textContent === '<img> &amp; \\*literal\\*\n', 'DOM source literal code'); document.body.lastElementChild.remove();
            const tabCode = document.createElement('markdown'); tabCode.textContent = '```\n\tconst tab = 1;\n```'; document.body.append(tabCode); document.renderAllMarkdownTags(tabCode);
            check(document.body.lastElementChild.querySelector('code').textContent === '\tconst tab = 1;\n', 'DOM fenced tabs preserved'); document.body.lastElementChild.remove();
            const indentCode = document.createElement('markdown'); indentCode.textContent = '    const code = 1;'; document.body.append(indentCode); document.renderAllMarkdownTags(indentCode);
            check(document.body.lastElementChild.querySelector('code').textContent === 'const code = 1;\n', 'DOM indented code preserved'); document.body.lastElementChild.remove();
            const attributes = document.createElement('markdown'); attributes.innerHTML = '<span title="a&gt;b&amp;quot;">safe</span>'; document.body.append(attributes); document.renderAllMarkdownTags(attributes);
            check(document.body.lastElementChild.querySelector('span').getAttribute('title') === 'a>b&quot;', 'DOM attributes preserved exactly'); document.body.lastElementChild.remove();
            const before = document.querySelector('#results').innerHTML; document.renderAllMarkdownTags(null); document.renderAllMarkdownTags();
            check(document.querySelector('#results').innerHTML === before, 'repeat render idempotent');
            for (const value of [null, undefined, '']) check(markdownToHtml(value) === '', 'empty input');
            let state = 12345678; const fragments = ['> ', '- ', '1. ', '|', '`', '**', '_', '\\', '[', ']', '(', ')', '\n', '<img>', '&amp;', 'Ё', ' x '];
            for (let sample = 0; sample < 500; sample++) {
                let markdown = ''; for (let token = 0; token < 80; token++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; markdown += fragments[state % fragments.length]; }
                const host = parse(markdown, false); check(!host.querySelector('script,[onerror],[onclick]'), 'malformed input ' + sample);
            }
            const began = performance.now();
            const big = parse(('# heading\n\n> quote **bold**\n\n- item\n  - nested\n\n| a | b |\n|---|---|\n| x | y |\n\n').repeat(2000), false);
            check(big.querySelectorAll('h1').length === 2000 && big.querySelectorAll('table').length === 2000, 'large document output');
            const deep = parse('> '.repeat(400) + 'deep', false);
            check(deep.querySelectorAll('blockquote').length === 400 && deep.textContent.includes('deep'), '400 levels of quotes');
            const deepEm = parse('*'.repeat(800) + 'deep' + '*'.repeat(800), false);
            check(deepEm.querySelectorAll('strong').length === 400 && deepEm.textContent === 'deep', '400 levels of emphasis');
            const malformed = parse('x* '.repeat(30000), false);
            check(malformed.textContent.trim() === 'x* '.repeat(30000).trim(), '30000 unmatched delimiters preserve text');
            check(performance.now() - began < 10000, 'large/deep documents finish promptly');
            return { count, elapsedMs: Math.round(performance.now() - began) };
        });
        for (const image of await page.locator('#results img').all()) await image.evaluate(element => element.decode());
        assert(await page.locator('#results img').first().evaluate(element => element.naturalWidth > 0), 'Image must actually load');
        const popupPromise = page.waitForEvent('popup'); await page.locator('#results a[href="/target.html"]').first().click();
        const popup = await popupPromise; await popup.waitForLoadState(); assert.equal(await popup.title(), 'Link works'); await popup.close();
        for (const width of [1200, 390]) { await page.setViewportSize({ width, height: 900 }); await page.screenshot({ path: path.join(directory, `gallery-${width}.png`), fullPage: true }); }
        const late = await browser.newPage(); late.on('pageerror', error => errors.push(error.message)); await late.goto(base + '/late.html'); await late.addScriptTag({ url: base + '/LiteMark.js' });
        assert.equal(await late.locator('#late h1').textContent(), 'Late script');
        assert.deepEqual(errors, []);
        console.log(`${result.count} regression/fuzz checks, images, links, late loading and 2 viewports passed (${result.elapsedMs} ms stress test). Artifacts: ${directory}`);
    } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
