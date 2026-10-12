<p align="center"><img src="pics/title.png" alt="LiteMark.js"></p>

**LiteMark.js** renders Markdown directly in the browser. One JavaScript file, no dependencies, no configuration or build step. Write Markdown inside HTML tags, or convert a string yourself.

## Quick start

Download [source/LiteMark.js](source/LiteMark.js), place it beside your page, and include it:

```html
<script src="LiteMark.js" defer></script>

<markdown class="article">
# Hello, Markdown!

**Bold**, *italic*, ~~strikethrough~~ and `inline code`.

> A quote with [a link](https://example.com).

- [x] One file
- [x] No dependencies

| Feature | Supported |
| :------ | :-------: |
| Tables  | Yes       |
</markdown>
```

The script automatically replaces Markdown source tags with rendered `<div>` elements. Attributes such as `id` and `class` are copied to the replacement. Rendering runs when the DOM is ready, or immediately if the page has already loaded.

Supported source tags are `<markdown>`, `<md>`, and `<text>` with `type="markdown"`, `"md"`, `"text/markdown"` or `"text/md"`. Nested source tags are supported too.

**Keep Markdown indentation intentional.** Four leading spaces start a code block; indenting the whole source tag to match your HTML layout changes the Markdown.

## API

### `window.markdownToHtml(markdown)`

Returns sanitized HTML from a Markdown string. It does not insert anything into the page.

```js
const source = "## Hello\n\nRead **this**.";
document.querySelector("#preview").innerHTML = window.markdownToHtml(source);
```

### `document.renderAllMarkdownTags(root = document)`

Renders source tags inside `root`, including `root` itself when it is a source tag. Call it after adding Markdown elements dynamically:

```js
const block = document.createElement("md");
block.textContent = "## Added later\n\n- First\n- Second";
document.body.appendChild(block);
document.renderAllMarkdownTags(block);
```

Calling it again leaves already rendered content alone. To render a new Markdown string into an existing preview, use `markdownToHtml`.

## Supported Markdown

The parser is an original implementation of CommonMark 0.31.2 with GitHub Flavored Markdown extensions.

| Syntax | Support |
| --- | --- |
| Blocks | Both heading styles, paragraphs, thematic breaks, nested quotes |
| Lists | Ordered and unordered, mixed nesting, empty items, multiple paragraphs, task checkboxes |
| Code | Indented and fenced blocks, language classes, arbitrary-length inline backtick spans |
| Formatting | Emphasis, strong emphasis, strikethrough, escapes, HTML entities |
| Links and images | Inline links, titles, nested parentheses, full/collapsed/shortcut references, definitions after use |
| Autolinks | Angle-bracket links and GitHub-style bare URLs and email addresses |
| Tables | Alignment, optional edge pipes, escaped pipes, formatted cells, images, uneven rows |
| HTML | Safe elements and attributes, with output sanitization |

Tables also preserve unescaped pipes inside matched inline-code spans for compatibility with earlier LiteMark versions. Escape those pipes when sharing the document with other GFM renderers.

Styling and syntax highlighting are up to your page. Fenced code with a language gets a `language-*` class. Math, Mermaid, footnotes and repository-specific user/issue links are outside the supported syntax.

## HTML and source text

Safe embedded HTML is retained. Executable elements, event handlers, dangerous URLs and unsafe styles are filtered. Code is escaped and stays literal. Task checkboxes are disabled, and links that open new windows receive safe `rel` attributes.

Use `textContent` when creating source tags from JavaScript. In an HTML file, escape literal `<` and `&` as you would in ordinary HTML text. The browser decodes source-tag text once; `markdownToHtml` accepts Markdown directly and does not decode it as an HTML document first.

## Changes from the earlier parser

- Ordinary line endings are soft breaks. Two trailing spaces or a backslash create a hard break; blank lines separate paragraphs.
- Ordered lists start at their first number and continue sequentially, even if later source markers use different numbers.
- Code preserves whitespace, tabs, escapes and entities. Source-tag indentation has the same meaning as indentation in the string API.
- A literal `>` starts a quote. In the string API, `&gt;` represents text rather than a quote marker; inside an HTML source tag, the browser has already decoded it.

## Development

Tests, specification fixtures and browser tooling live in [tests/](tests/README.md). They cover parsing, sanitization, source-tag integration, malformed input and large documents in a real browser. Test dependencies are used only for development and are not part of `LiteMark.js`.

## License

[MIT](LICENSE) — DosX.
