# Browser tests

The shipped library is only `../source/LiteMark.js`. It has no dependencies,
imports, bundled third-party parsers, runtime downloads, or build step.
Playwright is a development-only browser driver for these tests.

From this directory, run:

```sh
npm install
npm test
```

Microsoft Edge must be installed. To use another installed Chromium browser,
set `LITEMARK_BROWSER=chrome` (the same variable applies to all suites).
All generated pages, copied scripts, reports and screenshots go into the system
temporary directory. Nothing is served from the working repository.

## Specification fixtures

-   `commonmark.json`: all 652 examples from CommonMark 0.31.2,
    https://spec.commonmark.org/0.31.2/spec.json — John MacFarlane,
    Creative Commons Attribution-ShareAlike 4.0.
-   `gfm.json`: all 672 examples extracted from GitHub's GFM specification,
    https://github.com/github/cmark-gfm/blob/master/test/spec.txt
    (retrieved 2026-10-11; specification version 0.29),
    Creative Commons Attribution-ShareAlike 4.0.
-   `gfm-published.json`: all 677 examples from the published GFM 0.29-gfm
    specification at https://github.github.com/gfm/ (retrieved 2026-10-11),
    Creative Commons Attribution-ShareAlike 4.0. Its protocol autolinks include
    `mailto:` and `xmpp:`, with XMPP resources.
-   Specification explanations: https://spec.commonmark.org/0.31.2/
    and https://github.github.com/gfm/.
-   License: https://creativecommons.org/licenses/by-sa/4.0/.

These are Markdown input / expected HTML data, not third-party parser code.
The fixtures retain their CC BY-SA license; the library remains MIT-licensed.

`conformance.js` temporarily exposes private parsing functions in an in-memory
copy. It runs every example; base-grammar sections use the base grammar and GFM
extension sections enable extensions. The public library always enables GFM.
There is no public grammar option or test hook in the shipped file.
The published GFM Raw HTML section uses its strict comment grammar; newer
CommonMark/cmark examples use their more permissive base comment grammar.
Both grammars are exercised explicitly, with no skipped examples.

Comparison preserves text, code whitespace and attributes. It normalizes browser
serialization, whitespace between block elements, LiteMark's link safety/image
styles/pre language class, and redundant nested emphasis. GFM 0.29 flattens
repeated emphasis whereas CommonMark 0.31.2 retains it; the equivalent markup is
normalized explicitly. Failed cases are saved and make the command fail.

`browser.js` uses the unmodified shipped script over local HTTP. It checks the
public API, source tags, nested constructs, tables, references, entity decoding,
malformed input, sanitized HTML, actual image loading and link navigation,
late script loading, repeated rendering, 2000-table documents, 400-level
nesting, and 30000 unmatched delimiters. It captures desktop/mobile screenshots.

`audit.js` runs focused regressions found by three independent audits. These
cover table interruption and indentation, code whitespace in list containers,
Unicode reference labels, literal versus decoded hard-break spaces, entity and
URL provenance, nested source tags, HTML subtree text, malformed link scaling,
and large image alternative text. Like the integration gallery, it serves a
copy of the standalone script from the system temporary directory in Edge.

The `round*-*.js` modules record additional independent whole-file audit
iterations, with three fresh auditors per iteration. The runner
discovers these regression modules automatically. They include single-column
tables, terminal backslash parity, Unicode label case folding, numeric character
references, inert template text, nested-tag anchors and attribute preservation,
private-placeholder collisions, and scaling checks for large paragraphs,
reference definitions, code delimiters, malformed HTML and 120,000 emphasis
pairs. Performance assertions also verify the resulting DOM and text; no input
limits or fallback that disables formatting are added to the public parser.

Later rounds also check residual tabs in containers, modern `search` HTML
blocks, many unresolved image brackets followed by links, escaped partial
backtick runs, reference labels with backslash line endings, blank separators
after indented list code, and nested source images contributing their alt text.
Control cases cover Unicode scalar limits/folding, slash parity, mixed
formatting and references across containers.
