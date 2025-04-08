# 🧩 LiteMark.js

**LiteMark.js** is a lightweight Markdown-to-HTML converter for the browser with manual rendering support and custom tag detection.  
Designed to be embedded in web pages and applications where native Markdown rendering is required — with full control over when and how it happens.

---

## ✨ Features

- 📄 Parses standard Markdown syntax
- 🔧 Manual rendering with `markdownToHtml(...)`
- 🧠 Supports `<markdown>`, `<md>` and typed `<text type="markdown">` blocks
- ✅ Checkbox lists rendering
- 🔢 Nested lists (ordered and unordered)
- 🧱 Syntax-highlighted code blocks (` ```lang `)
- 🖼️ Image and link embedding
- 🔠 Inline formatting (bold, italic, strikethrough, code)
- 📊 Markdown tables with alignment
- 💬 Multi-level blockquotes
- 💡 Clean, dependency-free, framework-agnostic

---

## 🚀 Usage

### 1. Include the script in <head>

```html
<script src="LiteMark.js"></script>
```

### 2. Write Markdown inside custom tags

```html
<markdown>
# Hello Markdown!

- [x] Works in the browser
- [ ] With manual control

> Quote blocks supported!

```js
console.log("This is a code block.");
```
</markdown>
```
or using `<text type="markdown">Markdown content here</text>`

### 3. Let it render

Rendering happens automatically on `DOMContentLoaded`,  
but you can also call:

```js
document.renderAllMarkdownTags();
// or render specific elements:
markdownToHtml("**Custom render**");
```

---

## 🛠️ API

The following methods are available globally via the `window` object.

### `window.markdownToHtml(markdown: string): string`

Converts a raw Markdown string into sanitized HTML.  
Returns a string of HTML without inserting it into the DOM.

> Useful for rendering Markdown on-the-fly, for example:
>
> ```js
> const html = window.markdownToHtml("**bold** _italic_");
> someElement.innerHTML = html;
> ```

---

### `window.document.renderAllMarkdownTags(root?: HTMLElement): void`

Searches for all supported Markdown elements (`<markdown>`, `<md>`, `<text type="markdown">`, etc.) inside the given `root` (or `document` by default), converts their contents to HTML, and replaces the original elements with `<div>`s containing rendered content.

> This method is **automatically executed** on page load (`DOMContentLoaded`),  
> but **must be called manually** if you add Markdown elements dynamically:
>
> ```js
> const newEl = document.createElement("markdown");
> newEl.textContent = "# Hello from JS";
> document.body.appendChild(newEl);
>
> document.renderAllMarkdownTags(); // Must be called!
> ```

---

## 📦 Installation

Standalone, plug-n-play. No dependencies.  
If needed, you can bundle it using your own toolchain (Webpack, Rollup, etc.).