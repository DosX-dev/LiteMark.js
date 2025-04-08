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

### `markdownToHtml(markdown: string): string`

Converts raw Markdown text into sanitized HTML.

### `document.renderAllMarkdownTags(root?: HTMLElement): void`

Searches for all Markdown elements (`<markdown>`, `<md>`, etc.) in `root` and replaces them with rendered HTML.

---

## 📦 Installation

Standalone, plug-n-play. No dependencies.  
If needed, you can bundle it using your own toolchain (Webpack, Rollup, etc.).