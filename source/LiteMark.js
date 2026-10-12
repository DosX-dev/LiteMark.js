/**
 * ------------------------------------------------------------------------
 * Name:         LiteMark.js
 * Purpose:      A lightweight library for converting Markdown to HTML
 *               with manual render triggering and support for custom
 *               HTML tags containing Markdown content.
 *
 * Scope:        - Embedding Markdown into web pages and applications;
 *               - Rendering Markdown directly in the browser;
 *               - Using non-standard/custom tags to wrap Markdown.
 *
 * Author:       DosX (https://github.com/DosX-dev)
 * Version:      1.2.0
 * License:      MIT (https://opensource.org/licenses/MIT)
 *
 * Copyright:    © DosX. Distributed under the MIT License.
 *
 * Notes:        This library supports the following Markdown features:
 *               - Headings, lists (ordered/unordered), quotes, tables;
 *               - Embedded links and images;
 *               - Inline formatting (bold, italic, strikethrough, code);
 *               - Checkbox lists and nested list structures;
 *               - Code blocks with syntax language hints (language-*);
 *
 * ------------------------------------------------------------------------
 */
(() => {
    "use strict";
    if (typeof window !== "object" || typeof document !== "object") {
        throw new Error("LiteMark.js requires a browser environment.");
    }

    const SELECTOR = 'text[type="text/markdown"],text[type="text/md"],text[type="markdown"],text[type="md"],markdown,md';
    const style = document.createElement("style");
    style.textContent = SELECTOR + " { display: none !important; }";
    (document.head || document.documentElement).appendChild(style);

    const entityCache = new Map();
    function decodeEntities(text) {
        return text.replace(/&(?:#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]+);/gi, entity => {
            if (entity[1] === "#") {
                const point = entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
                return String.fromCodePoint(!point || point > 0x10ffff || point >= 0xd800 && point <= 0xdfff ? 0xfffd : point);
            }
            if (!entityCache.has(entity)) {
                const span = document.createElement("span");
                span.innerHTML = '<span title="' + entity + '"></span>';
                if (entityCache.size > 512) entityCache.clear();
                const decoded = span.firstChild.getAttribute("title");
                // A partial legacy-name match leaves the final semicolon.
                // Of the complete HTML named entities, only &semi; decodes
                // to a value ending in that character.
                entityCache.set(entity, /^&[a-z]/i.test(entity) && decoded.endsWith(";") && entity !== "&semi;" ? entity : decoded);
            }
            return entityCache.get(entity);
        });
    }
    function escapeHtml(text) {
        return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    }
    function unescapeMarkdown(text) {
        return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1");
    }
    function safeUrl(value, image = false) {
        const url = value.trim();
        const scheme = url.replace(/[\u0000-\u0020\u007f]/g, "").match(/^([a-z][a-z0-9+.-]*):/i);
        if (!scheme || !/^(?:javascript|vbscript|data)$/i.test(scheme[1])) return url.replace(/ /g, "%20");
        if (image && /^data:image\/(?:png|gif|jpe?g|webp|avif);base64,[a-z0-9+/=]+$/i.test(url)) return url;
        return null;
    }

    // Only sanitized HTML is returned, including when the input contains HTML.
    // Parsing in a template keeps script/resource nodes inert during sanitizing.
    const allowedTags = new Set("a abbr address article aside b bdi bdo blockquote br caption code col colgroup dd del details div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label li main mark nav ol p pre q rp rt ruby s samp search section small span strong sub summary sup table tbody td tfoot th thead time tr u ul var wbr".split(" "));
    const allowedAttributes = new Set("align alt class colspan datetime dir height id lang open role rowspan scope start title type value width checked disabled".split(" "));
    function htmlText(node, inlineAlt = false) {
        const parts = [], work = [node];
        while (work.length) {
            const current = work.pop();
            if (current.nodeType === 3) { parts.push(current.data); continue; }
            if (inlineAlt && current.nodeType === 1 && current.localName === "img") { parts.push(current.getAttribute("alt") || ""); continue; }
            // Template descendants live in a separate inert DocumentFragment.
            const children = (current.content && current.content.nodeType === 11 ? current.content : current).childNodes;
            for (let i = children.length - 1; i >= 0; i--) work.push(children[i]);
        }
        return parts.join("");
    }
    function sanitize(html) {
        const template = document.createElement("template");
        template.innerHTML = html;
        const pending = [template.content];
        while (pending.length) {
            const parent = pending.pop();
            for (const node of Array.from(parent.childNodes)) {
                if (node.nodeType === 8) { node.remove(); continue; }
                if (node.nodeType !== 1) continue;
                const tag = node.localName;
                if (!allowedTags.has(tag) || node.namespaceURI !== "http://www.w3.org/1999/xhtml") {
                    node.replaceWith(document.createTextNode(htmlText(node)));
                    continue;
                }
                for (const attr of Array.from(node.attributes)) {
                    const name = attr.name;
                    if (name === "href" || name === "src") {
                        const url = tag === "a" && name === "href" || tag === "img" && name === "src" ? safeUrl(attr.value, tag === "img") : null;
                        if (url === null) node.removeAttribute(name); else node.setAttribute(name, url);
                    } else if (name === "style") {
                        const declarations = attr.value.split(";").filter(part => /^(?:\s*)(?:text-align|max-width|list-style|color|background-color|font-weight|font-style|text-decoration|white-space|display|padding|margin|border(?:-[a-z]+)?)\s*:/i.test(part) && !/[\\@]|url\s*\(|expression\s*\(|[<>]/i.test(part));
                        if (declarations.length) node.setAttribute(name, declarations.join(";") + ";"); else node.removeAttribute(name);
                    } else if (!allowedAttributes.has(name) && !/^(?:data|aria)-[a-z0-9_-]+$/.test(name) && !(tag === "a" && ["target", "rel"].includes(name))) node.removeAttribute(name);
                }
                if (tag === "a" && node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
                if (tag === "input") { node.setAttribute("type", "checkbox"); node.setAttribute("disabled", ""); }
                pending.push(node);
            }
        }
        return template.innerHTML;
    }

    const punctuation = char => !!char && /[\p{P}\p{S}]/u.test(char);
    const whitespace = char => !char || /[\p{Zs}\t\r\n\f]/u.test(char);
    const trimMarkdown = value => value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
    const previousCharacter = (text, position) => position > 1 && /[\uDC00-\uDFFF]/.test(text[position - 1]) && /[\uD800-\uDBFF]/.test(text[position - 2]) ? text.slice(position - 2, position) : text[position - 1] || "";
    const nextCharacter = (text, position) => text[position] ? String.fromCodePoint(text.codePointAt(position)) : "";
    const labelKey = value => value.replace(/^[\p{Zs}\t\r\n\f]+|[\p{Zs}\t\r\n\f]+$/gu, "").replace(/[\p{Zs}\t\r\n\f]+/gu, " ").replace(/[^\u0131]/gu, char => char.toLowerCase().toUpperCase().toLowerCase());
    const decode = value => decodeEntities(unescapeMarkdown(value));
    function normalizeUrl(value) {
        try { return encodeURI(value).replace(/%25/g, "%").replace(/\[/g, "%5B").replace(/\]/g, "%5D"); }
        catch (_) { return value.replace(/ /g, "%20"); }
    }
    let destinationIndex;
    function destinationEnd(text, start) {
        if (!destinationIndex || destinationIndex.text !== text) {
            const matches = new Int32Array(text.length), escaped = new Uint8Array(text.length), stack = [];
            matches.fill(-1);
            for (let i = 0; i < text.length; i++) {
                if (text[i] === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(text[i + 1] || " ")) { escaped[i] = 1; i++; continue; }
                if (text[i] === "(") stack.push(i);
                else if (text[i] === ")" && stack.length) matches[stack.pop()] = i;
            }
            const ends = new Int32Array(text.length + 1); ends[text.length] = text.length;
            for (let i = text.length - 1; i >= 0; i--) {
                if (escaped[i]) ends[i] = ends[i + 2];
                else if (text[i] === "(") ends[i] = matches[i] < 0 ? -1 : ends[matches[i] + 1];
                else if (text[i] === ")" || /[ \t\n]/.test(text[i]) || text.charCodeAt(i) < 32) ends[i] = i;
                else ends[i] = ends[i + 1];
            }
            destinationIndex = { text, ends };
        }
        return destinationIndex.ends[start];
    }
    function destination(text, start, definition = false) {
        let i = start, value = "";
        if (text[i] === "<") {
            i++;
            while (i < text.length && text[i] !== ">") {
                if (text[i] === "\n" || text[i] === "<") return null;
                if (text[i] === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(text[i + 1] || " ")) value += text[i++] + text[i++];
                else value += text[i++];
            }
            if (text[i] !== ">") return null;
            return { value: decode(value), end: i + 1 };
        }
        // Failed unclosed destinations must not rescan the same suffix for
        // every preceding bracket. The index is linear and cached per text.
        // Definitions are consumed once from successive paragraph prefixes;
        // indexing every shrinking prefix would itself become quadratic.
        if (!definition && destinationEnd(text, start) < 0) return null;
        let balance = 0;
        while (i < text.length) {
            const char = text[i];
            if (/[ \t\n]/.test(char) || char.charCodeAt(0) < 32) break;
            if (char === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(text[i + 1] || " ")) { value += text[i++] + text[i++]; continue; }
            if (char === "(") balance++;
            if (char === ")") { if (!balance) break; balance--; }
            value += char; i++;
        }
        if (balance || definition && !value) return null;
        return { value: decode(value), end: i };
    }
    function readTitle(text, start) {
        const opening = text[start], closing = opening === "(" ? ")" : opening;
        if (!['"', "'", "("].includes(opening)) return null;
        let i = start + 1, value = "";
        while (i < text.length && text[i] !== closing) {
            if (text[i] === "\\" && text[i + 1]) { value += text[i++] + text[i++]; continue; }
            if (opening === "(" && text[i] === "(" || text[i] === "\n" && /^\n[ \t]*\n/.test(text.slice(i))) return null;
            value += text[i++];
        }
        return text[i] === closing ? { value: decode(value), end: i + 1 } : null;
    }
    function readDefinition(text) {
        const label = text.match(/^ {0,3}\[((?:\\[\s\S]|[^\[\]\\]){1,999})\]:[ \t]*(?:\n[ \t]*)?/u);
        if (!label || Array.from(label[1]).length > 999 || !labelKey(label[1])) return null;
        const dest = destination(text, label[0].length, true);
        if (!dest) return null;
        let i = dest.end, title;
        const spacing = text.slice(i).match(/^[ \t]*(?:\n[ \t]*)?/)[0];
        if (spacing) {
            const parsed = readTitle(text, i + spacing.length);
            if (parsed && /^[ \t]*(?:\n|$)/.test(text.slice(parsed.end))) { title = parsed.value; i = parsed.end; }
        }
        const ending = text.slice(i).match(/^[ \t]*(?:\n|$)/);
        if (!ending) return null;
        return { key: labelKey(label[1]), url: dest.value, title, end: i + ending[0].length };
    }
    const blockTags = /^(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t\n]|\/?>|$)/i;
    const htmlTagPattern = /^(?:<[a-z][a-z0-9-]*(?:[ \t\n\f\r]+[a-z_:][a-z0-9_.:-]*(?:[ \t\n\f\r]*=[ \t\n\f\r]*(?:[^ \t\n\f\r"'=<>`]+|'[^']*'|"[^"]*"))?)*[ \t\n\f\r]*\/?>|<\/[a-z][a-z0-9-]*[ \t\n\f\r]*>)/i;
    function htmlStart(text, interrupt) {
        if (/^<(?:script|pre|style|textarea)(?:[ \t\n\f\r]|>|$)/i.test(text)) return { end: /<\/(?:script|pre|style|textarea)[ \t\n\f\r]*>/i };
        if (text.startsWith("<!--")) return { end: /-->/ };
        if (text.startsWith("<?")) return { end: /\?>/ };
        if (/^<![A-Z]/.test(text)) return { end: />/ };
        if (text.startsWith("<![CDATA[")) return { end: /\]\]>/ };
        if (/^<\/?/.test(text) && blockTags.test(text.replace(/^<\/?/, ""))) return { blank: true };
        const tag = text.match(htmlTagPattern);
        if (!interrupt && tag && !trimMarkdown(text.slice(tag[0].length))) return { blank: true };
        return null;
    }
    function codeSpanEnds(text) {
        const ends = new Map(), last = new Map(), runs = [];
        for (const run of text.matchAll(/`+/g)) runs.push({ start: run.index, length: run[0].length });
        for (let index = runs.length - 1; index >= 0; index--) {
            const run = runs[index];
            if (last.has(run.length)) ends.set(run.start, last.get(run.length));
            // An escape can consume the first tick before inline parsing reaches
            // this run. The remaining opener still closes on a whole later run.
            if (run.length > 1 && last.has(run.length - 1)) ends.set(run.start + 1, last.get(run.length - 1));
            last.set(run.length, run.start);
        }
        return ends;
    }
    function tableCells(text) {
        text = trimMarkdown(text);
        if (text[0] === "|") text = text.slice(1);
        if (text.endsWith("|")) {
            let backslashes = 0;
            for (let position = text.length - 2; position >= 0 && text[position] === "\\"; position--) backslashes++;
            if (backslashes % 2 === 0) text = text.slice(0, -1);
        }
        const cells = [], codeEnds = codeSpanEnds(text); let part = "", i = 0;
        while (i < text.length) {
            if (text[i] === "\\" && text[i + 1]) { part += text.slice(i, i + 2); i += 2; continue; }
            if (text[i] === "`") {
                const run = text.slice(i).match(/^`+/)[0];
                const end = codeEnds.has(i) ? codeEnds.get(i) : -1;
                if (end >= 0) { part += text.slice(i, end + run.length); i = end + run.length; continue; }
                part += run; i += run.length; continue;
            }
            if (text[i] === "|") { cells.push(trimMarkdown(part)); part = ""; i++; } else part += text[i++];
        }
        cells.push(trimMarkdown(part)); return cells;
    }
    function blockTree(source, references, extensions, slots) {
        // Open containers are matched before opening new blocks. A paragraph may
        // continue lazily across a missing quote/list prefix, but other leaves may not.
        const root = { type: "document", children: [] }, stack = [root];
        const lines = source.replace(/\r\n?/g, "\n").replace(/\0/g, "\ufffd").split("\n");
        if (lines[lines.length - 1] === "") lines.pop();
        let cursor;
        function rest() { return cursor.pending + cursor.text.slice(cursor.pos); }
        function spaces() { const match = rest().match(/^[ \t]*/)[0]; let col = cursor.col; for (const char of match) col += char === "\t" ? 4 - col % 4 : 1; return col - cursor.col; }
        // Expand only indentation used to recognize block syntax. Content,
        // especially code bodies, retains its original tabs.
        function blockText(text = rest()) {
            const leading = text.match(/^[ \t]*/)[0];
            let col = cursor.col;
            for (const char of leading) col += char === "\t" ? 4 - col % 4 : 1;
            return " ".repeat(col - cursor.col) + text.slice(leading.length);
        }
        function advance(count) {
            while (count > 0 && (cursor.pending || cursor.pos < cursor.text.length)) {
                if (cursor.pending) { cursor.pending = cursor.pending.slice(1); cursor.col++; count--; continue; }
                const char = cursor.text[cursor.pos++], width = char === "\t" ? 4 - cursor.col % 4 : 1;
                if (width > count) { cursor.pending = " ".repeat(width - count); cursor.col += count; count = 0; }
                else { cursor.col += width; count -= width; }
            }
        }
        const blank = () => /^[ \t]*$/.test(rest());
        function add(type, properties = {}) {
            const node = { type, children: [], ...properties };
            stack[stack.length - 1].children.push(node); stack.push(node); return node;
        }
        function finish(node) {
            if (node.type === "quote") node.lastBlank = false;
            if (node.type !== "quote" && node.children.length && node.children[node.children.length - 1].lastBlank) node.lastBlank = true;
            if (node.type === "item" && node.lastBlank) node.blankSeen = true;
            if (node.type === "paragraph") {
                let value = node.lines.join("\n"), definition;
                while ((definition = readDefinition(value))) {
                    if (!references.has(definition.key)) references.set(definition.key, definition);
                    value = value.slice(definition.end);
                }
                node.text = value;
                if (!trimMarkdown(value)) node.hidden = true;
            }
            if (node.type === "code" && !node.fenced) {
                // Blanks consumed by an indented code leaf still separate
                // later list blocks/items, although omitted from its content.
                while (node.lines.length && /^[ \t]*$/.test(node.lines[node.lines.length - 1])) {
                    node.lastBlank = true; node.lines.pop();
                }
            }
        }
        function close(length) { while (stack.length > length) finish(stack.pop()); }
        function marker(text) {
            const match = blockText(text).match(/^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+|$)(.*)$/);
            if (!match) return null;
            const indent = match[1].length, width = match[2].length;
            let col = cursor.col + indent + width, padding = 0;
            for (const char of match[3]) { const step = char === "\t" ? 4 - col % 4 : 1; col += step; padding += step; }
            if (!match[4] || padding > 4) padding = 1;
            return { indent, width: width + padding, token: match[2], ordered: /^\d/.test(match[2]), start: parseInt(match[2], 10), delimiter: /^\d/.test(match[2]) ? match[2].slice(-1) : match[2], empty: !match[4] };
        }
        function starts(text, paragraph) {
            text = blockText(text);
            const indent = spaces(); if (indent >= 4) return false;
            if (/^ {0,3}>/.test(text) || /^ {0,3}#{1,6}(?:[ \t]|$)/.test(text) || /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/.test(text)) return true;
            const fence = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
            if (fence && !(fence[1][0] === "`" && fence[2].includes("`"))) return true;
            const list = marker(text); if (list && (!paragraph || !list.empty && (!list.ordered || list.start === 1))) return true;
            return !!htmlStart(text.replace(/^ {0,3}/, ""), paragraph);
        }
        for (const line of lines) {
            cursor = { text: line, pos: 0, col: 0, pending: "" };
            let matched = 1, handled = false;
            for (; matched < stack.length; matched++) {
                const node = stack[matched];
                if (node.type === "quote") {
                    const match = blockText().match(/^ {0,3}>/);
                    if (!match) break;
                    advance(match[0].length); if (/^[ \t]/.test(rest())) advance(1);
                } else if (node.type === "item") {
                    if (blank()) { if (!node.children.length) break; advance(Math.min(spaces(), node.indent)); }
                    else if (spaces() >= node.indent) advance(node.indent); else break;
                } else if (node.type === "list") continue;
                else if (node.type === "code") {
                    if (node.fenced) {
                        const match = blockText().match(/^ {0,3}(`+|~+)[ \t]*$/);
                        if (match && match[1][0] === node.fence[0] && match[1].length >= node.fence.length) close(matched);
                        else { advance(Math.min(spaces(), node.indent)); node.lines.push(rest()); }
                        handled = true;
                    } else if (spaces() >= 4 || blank()) { advance(Math.min(4, spaces())); node.lines.push(rest()); handled = true; }
                    break;
                } else if (node.type === "html") {
                    if (node.blank && blank()) break;
                    node.lines.push(rest()); if (node.end && node.end.test(rest())) close(matched);
                    handled = true; break;
                } else if (node.type === "table") {
                    if (blank() || spaces() >= 4 || starts(rest(), false)) break;
                    node.rows.push(tableCells(rest())); handled = true; break;
                } else break;
            }
            if (handled) continue;
            // Finished nested source tags form their own block when they occupy
            // a line. Unlike ordinary raw HTML, they do not consume later lines.
            const opaque = trimMarkdown(rest());
            if (slots && spaces() < 4 && slots.has(opaque)) {
                close(matched);
                if (stack[stack.length - 1].type === "paragraph") close(stack.length - 1);
                add("opaque", { value: opaque }); close(stack.length - 1); continue;
            }
            let tip = stack[stack.length - 1];
            if (tip.type === "paragraph" && !blank()) {
                if (matched === stack.length - 1 && /^ {0,3}(?:=+|-+)[ \t]*$/.test(blockText())) {
                    let content = tip.lines.join("\n"), definition;
                    while ((definition = readDefinition(content))) { if (!references.has(definition.key)) references.set(definition.key, definition); content = content.slice(definition.end); }
                    if (trimMarkdown(content)) { tip.type = "heading"; tip.level = trimMarkdown(rest())[0] === "=" ? 1 : 2; tip.text = trimMarkdown(content); close(stack.length - 1); continue; }
                    tip.lines = content ? [content] : [];
                }
                if (extensions && matched === stack.length - 1 && spaces() < 4 && tip.lines.length) {
                    const cells = tableCells(rest()), header = tableCells(tip.lines[tip.lines.length - 1]);
                    if (cells.length === header.length && cells.every(value => /^:?-+:?$/.test(value))) {
                        if (tip.lines.length > 1) {
                            const previous = { type: "paragraph", children: [], lines: tip.lines.slice(0, -1) };
                            finish(previous);
                            const siblings = stack[stack.length - 2].children;
                            siblings.splice(siblings.indexOf(tip), 0, previous);
                        }
                        tip.type = "table"; tip.header = header; tip.align = cells.map(value => value.startsWith(":") && value.endsWith(":") ? "center" : value.endsWith(":") ? "right" : value.startsWith(":") ? "left" : null); tip.rows = []; continue;
                    }
                }
                const sibling = matched < stack.length - 1 && stack[matched].type === "item" && marker(rest());
                if (!sibling && !starts(rest(), true)) { advance(spaces()); tip.lines.push(rest()); continue; }
            }
            close(matched);
            if (stack[stack.length - 1].type === "paragraph") close(stack.length - 1);
            if (blank()) {
                const parent = stack[stack.length - 1]; parent.lastBlank = true;
                if (parent.type === "item") { parent.blankSeen = true; }
                if (parent.type === "list" && parent.children.length) parent.children[parent.children.length - 1].blankSeen = true;
                continue;
            }
            let opened = true;
            while (opened) {
                opened = false;
                const text = blockText(), indent = spaces(), parent = stack[stack.length - 1];
                if (parent.type === "list" && (!marker(text) || /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/.test(text))) { close(stack.length - 1); opened = true; continue; }
                if (parent.type === "item" && parent.children.length && (parent.blankSeen || parent.children[parent.children.length - 1].lastBlank)) { stack[stack.length - 2].loose = true; parent.blankSeen = false; parent.lastBlank = false; }
                if (indent < 4) {
                    const quote = text.match(/^ {0,3}>/);
                    if (quote) { advance(quote[0].length); if (/^[ \t]/.test(rest())) advance(1); add("quote"); opened = true; continue; }
                    const heading = text.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/);
                    if (heading) { add("heading", { level: heading[1].length, text: trimMarkdown((heading[2] || "").replace(/(?:^|[ \t]+)#+[ \t]*$/, "")) }); close(stack.length - 1); handled = true; break; }
                    const fence = text.match(/^( {0,3})(`{3,}|~{3,})[ \t]*(.*)$/);
                    if (fence && !(fence[2][0] === "`" && fence[3].includes("`"))) { add("code", { fenced: true, fence: fence[2], indent: fence[1].length, info: decode(trimMarkdown(fence[3])), lines: [] }); handled = true; break; }
                    if (/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/.test(text)) { add("rule"); close(stack.length - 1); handled = true; break; }
                    const html = htmlStart(text.replace(/^ {0,3}/, ""), false);
                    if (html) { const node = add("html", { ...html, lines: [rest()] }); if (node.end && node.end.test(text)) close(stack.length - 1); handled = true; break; }
                    const list = marker(text);
                    if (list) {
                        if (parent.type === "list" && (parent.ordered !== list.ordered || parent.delimiter !== list.delimiter)) close(stack.length - 1);
                        let container = stack[stack.length - 1];
                        if (container.type !== "list") container = add("list", { ordered: list.ordered, start: list.start, delimiter: list.delimiter, loose: false });
                        if (container.children.length && container.children[container.children.length - 1].blankSeen) container.loose = true;
                        advance(list.indent + list.width);
                        add("item", { indent: list.indent + list.width }); opened = true; continue;
                    }
                }
                if (parent.type === "list") { close(stack.length - 1); opened = true; continue; }
                if (parent.type === "item" && parent.blankSeen && parent.children.length) { stack[stack.length - 2].loose = true; parent.blankSeen = false; }
                if (indent >= 4) { advance(4); add("code", { fenced: false, lines: [rest()], info: "" }); handled = true; break; }
            }
            if (!handled && !blank()) { advance(spaces()); add("paragraph", { lines: [rest()] }); }
        }
        close(1);
        return root;
    }
    function bareAutolinks(text) {
        const candidates = new Map(), result = new Map();
        const urls = /(?:(?:https?|ftp):\/\/|www\.)[^\s<]+/gi;
        let match;
        while ((match = urls.exec(text))) candidates.set(match.index, match[0]);
        // Search around @ signs rather than repeatedly trying an email regex
        // at every character of a long malformed word.
        for (let at = text.indexOf("@"); at >= 0; at = text.indexOf("@", at + 1)) {
            let begin = at, end = at + 1;
            while (begin > 0 && /[a-z0-9._+-]/i.test(text[begin - 1])) begin--;
            while (end < text.length && /[a-z0-9._-]/i.test(text[end])) end++;
            if (begin === at || end === at + 1) continue;
            const prefix = text.slice(Math.max(0, begin - 7), begin).match(/(?:mailto:|xmpp:)$/i);
            if (prefix) begin -= prefix[0].length;
            if (/^xmpp:/i.test(text.slice(begin)) && text[end] === "/") {
                let resource = end + 1;
                while (resource < text.length && /[a-z0-9@.]/i.test(text[resource])) resource++;
                if (resource > end + 1) end = resource;
            }
            if (!candidates.has(begin)) candidates.set(begin, text.slice(begin, end));
        }
        for (const [start, candidate] of Array.from(candidates).sort((a, b) => a[0] - b[0])) {
            const email = !/^(?:(?:https?|ftp):\/\/|www\.)/i.test(candidate);
            let value = candidate.replace(email ? /[.]+$/ : /[?!.,:*_~]+$/, "");
            if (value.endsWith(")")) {
                let excess = (value.match(/\)/g) || []).length - (value.match(/\(/g) || []).length;
                while (excess > 0 && value.endsWith(")")) { value = value.slice(0, -1); excess--; }
            }
            if (value.endsWith(";")) value = value.replace(/&[a-z0-9]+;$/i, "").replace(/;$/, "");
            const domain = email ? value.replace(/^(?:mailto:|xmpp:)/i, "").split("@")[1].split("/")[0]
                : (value.replace(/^(?:https?|ftp):\/\//i, "").match(/^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/u) || [""])[0];
            const valid = email
                ? /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/i.test(domain) && /[a-z0-9]$/i.test(domain) && !/[a-z0-9._+-]/i.test(text[start - 1] || " ")
                : domain && !/[_]/.test(domain.split(".").slice(-2).join(".")) && (start === 0 || /[\s(*_~]/.test(text[start - 1]));
            if (!valid || !value) continue;
            const url = /^www\./i.test(value) ? "http://" + value : /^(?:(?:https?|ftp):\/\/|mailto:|xmpp:)/i.test(value) ? value : "mailto:" + value;
            result.set(start, { type: "link", url: normalizeUrl(url), children: [{ type: "text", value }], end: start + value.length });
        }
        return result;
    }
    function inlineTree(text, references, extensions, slots) {
        const head = { type: "sentinel" }, delimiters = [], brackets = [];
        // Published GFM uses the strict HTML comment grammar; the newer
        // CommonMark base grammar also permits early closes and internal --.
        const htmlCommentPattern = extensions ? /^<!--(?!>|->)(?:(?!--)[\s\S])*?(?<!-)-->/ : /^<!--(?:>|->|[\s\S]*?-->)/;
        // A missing terminator must not rescan the suffix at every inline
        // HTML opener. Successful opaque constructs consume their terminator.
        const lastHtmlClose = text.lastIndexOf(">"), lastCommentClose = text.lastIndexOf("-->"),
            lastProcessingClose = text.lastIndexOf("?>"), lastCdataClose = text.lastIndexOf("]]>");
        let tail = head, i = 0, delimiterId = 0, linkEpoch = 0, activeLinks = 0;
        const bareCandidates = extensions ? bareAutolinks(text) : new Map();
        // Index exact backtick runs once, including runs inside code spans.
        // Many different unmatched run lengths must not rescan the suffix.
        const codeEnds = codeSpanEnds(text);
        const validLabelLength = value => value.length <= 999 || value.length <= 1998 && Array.from(value).length <= 999;
        function append(node) { node.prev = tail; tail.next = node; tail = node; return node; }
        function remove(node) { node.prev.next = node.next; if (node.next) node.next.prev = node.prev; else tail = node.prev; }
        function emit(value) { return append({ type: "text", value, sourcePosition: i }); }
        function emphasis(bottom = 0) {
            // Match delimiter runs using Unicode flanking and the rule of three.
            // Brackets supply a lower bound so emphasis cannot cross a link boundary.
            // Keep stable indices for bracket lower bounds; unlink active
            // delimiters instead of shifting a large array for every match.
            for (let index = bottom; index < delimiters.length; index++) {
                delimiters[index].previous = index - 1;
                delimiters[index].following = index + 1;
            }
            let current = bottom;
            const failedBefore = new Map();
            function unlink(index) {
                const delimiter = delimiters[index];
                if (delimiter.previous >= bottom) delimiters[delimiter.previous].following = delimiter.following;
                if (delimiter.following < delimiters.length) delimiters[delimiter.following].previous = delimiter.previous;
            }
            while (current < delimiters.length) {
                const closer = delimiters[current];
                if (!closer.close) { current = closer.following; continue; }
                const category = closer.char + ":" + closer.open + ":" + (closer.char === "~" ? Math.min(closer.original, 3) : closer.original % 3);
                const floor = failedBefore.get(category) || 0;
                let openerIndex = closer.previous;
                for (; openerIndex >= bottom; openerIndex = delimiters[openerIndex].previous) {
                    const opener = delimiters[openerIndex];
                    if (opener.id <= floor) { openerIndex = bottom - 1; break; }
                    if (opener.char !== closer.char || !opener.open) continue;
                    if (closer.char !== "~" && (opener.close || closer.open) && (opener.original + closer.original) % 3 === 0 && (opener.original % 3 || closer.original % 3)) continue;
                    if (closer.char === "~" && (opener.length > 2 || closer.length > 2 || opener.length !== closer.length)) continue;
                    break;
                }
                if (openerIndex < bottom) { failedBefore.set(category, closer.id - 1); current = closer.following; continue; }
                const opener = delimiters[openerIndex], used = opener.length >= 2 && closer.length >= 2 ? 2 : 1;
                const children = []; let node = opener.node.next;
                while (node && node !== closer.node) { const next = node.next; children.push(node); node.prev = null; node.next = null; node = next; }
                const wrapper = { type: closer.char === "~" ? "del" : used === 2 ? "strong" : "em", children, prev: opener.node, next: closer.node };
                opener.node.next = wrapper; closer.node.prev = wrapper;
                opener.length -= used; closer.length -= used;
                opener.node.value = opener.node.value.slice(0, -used); closer.node.value = closer.node.value.slice(used);
                opener.following = current; closer.previous = openerIndex;
                if (!opener.length) { remove(opener.node); unlink(openerIndex); }
                if (!closer.length) { remove(closer.node); unlink(current); current = closer.following; }
            }
            delimiters.length = bottom;
        }

        function inlineDestination(start) {
            if (text[start] !== "(") return null;
            let cursor = start + 1;
            const space = text.slice(cursor).match(/^[ \t]*(?:\n[ \t]*)?/)[0]; cursor += space.length;
            const dest = destination(text, cursor);
            if (!dest) return null;
            cursor = dest.end;
            const spacing = text.slice(cursor).match(/^[ \t\n]*/)[0]; cursor += spacing.length;
            let title;
            if (spacing && text[cursor] !== ")") {
                const parsed = readTitle(text, cursor);
                if (!parsed) return null;
                title = parsed.value; cursor = parsed.end;
                cursor += text.slice(cursor).match(/^[ \t\n]*/)[0].length;
            }
            return text[cursor] === ")" ? { url: dest.value, title, end: cursor + 1 } : null;
        }
        while (i < text.length) {
            const char = text[i];
            if (char === "\\") {
                if (text[i + 1] === "\n") { append({ type: "break" }); i += 2; while (/[ \t]/.test(text[i] || "x")) i++; continue; }
                if (/[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(text[i + 1] || " ")) { emit(text[i + 1]); i += 2; continue; }
                emit(char); i++; continue;
            }
            if (char === "`") {
                const run = text.slice(i).match(/^`+/)[0];
                const end = codeEnds.has(i) ? codeEnds.get(i) : -1;
                if (end >= 0) {
                    let value = text.slice(i + run.length, end).replace(/\n/g, " ");
                    if (value.startsWith(" ") && value.endsWith(" ") && /[^ ]/.test(value)) value = value.slice(1, -1);
                    append({ type: "code", value }); i = end + run.length;
                } else { emit(run); i += run.length; }
                continue;
            }
            if (char === "[" || char === "!" && text[i + 1] === "[") {
                const image = char === "!", node = emit(image ? "![" : "[");
                brackets.push({ node, image, epoch: linkEpoch, start: i + (image ? 2 : 1), bottom: delimiters.length });
                if (!image) activeLinks++;
                i += image ? 2 : 1; continue;
            }
            if (char === "]") {
                const bracket = brackets.pop();
                if (!bracket || !bracket.image && bracket.epoch !== linkEpoch) { emit(char); i++; continue; }
                if (!bracket.image) activeLinks--;
                let target = inlineDestination(i + 1), label = text.slice(bracket.start, i), end = i + 1;
                if (!target) {
                    let full = text.slice(i + 1).match(/^\[((?:\\[\s\S]|[^\[\]\\]){0,999})\]/u);
                    if (full && !validLabelLength(full[1])) full = null;
                    if (full) { target = references.get(labelKey(full[1] || label)); end += full[0].length; }
                    else if (validLabelLength(label) && !/(^|[^\\])\[/.test(label)) target = references.get(labelKey(label));
                    if (target) target = { ...target, end };
                }
                if (!target) { emit(char); i++; continue; }
                emphasis(bracket.bottom);
                const children = []; let node = bracket.node.next;
                while (node) { const next = node.next; children.push(node); node.prev = null; node.next = null; node = next; }
                tail = bracket.node.prev; tail.next = null;
                append({ type: bracket.image ? "image" : "link", children, url: normalizeUrl(target.url), title: target.title });
                // A successful link invalidates older link openers, while image
                // openers remain eligible. An epoch avoids repeatedly scanning
                // a long stack of unmatched images for each following link.
                if (!bracket.image) { linkEpoch++; activeLinks = 0; }
                i = target.end; continue;
            }
            const bare = bareCandidates.get(i);
            if (bare && !activeLinks) { append(bare); i = bare.end; continue; }
            if (char === "*" || char === "_" || extensions && char === "~") {
                const run = text.slice(i).match(/^(\*+|_+|~+)/)[0], before = previousCharacter(text, i), after = nextCharacter(text, i + run.length);
                const left = !whitespace(after) && (!punctuation(after) || whitespace(before) || punctuation(before));
                const right = !whitespace(before) && (!punctuation(before) || whitespace(after) || punctuation(after));
                const node = emit(run);
                delimiters.push({ char, id: ++delimiterId, original: run.length, length: run.length, node, open: left && (char !== "_" || !right || punctuation(before)), close: right && (char !== "_" || !left || punctuation(after)) });
                i += run.length; continue;
            }
            if (char === "<") {
                const opaque = slots && text.slice(i).match(/^<span data-litemark-slot="\d+"><\/span>/);
                if (opaque && slots.has(opaque[0])) { append({ type: "html", value: opaque[0] }); i += opaque[0].length; continue; }
                const auto = text.slice(i).match(/^<([a-z][a-z0-9+.-]{1,31}:[^<>\u0000-\u0020]*|[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)>/i);
                if (auto) {
                    append({ type: "link", url: normalizeUrl(auto[1].includes(":") ? auto[1] : "mailto:" + auto[1]), children: [{ type: "text", value: auto[1] }] });
                    linkEpoch++; activeLinks = 0;
                    i += auto[0].length; continue;
                }
                const html = (lastHtmlClose > i && text.slice(i).match(htmlTagPattern))
                    || ((lastCommentClose >= i || !extensions && /^<!--(?:>|->)/.test(text.slice(i))) && text.slice(i).match(htmlCommentPattern))
                    || (lastProcessingClose > i && text.slice(i).match(/^<\?[\s\S]*?\?>/))
                    || (lastHtmlClose > i && text.slice(i).match(/^<![A-Z]+\s[^>]*>/))
                    || (lastCdataClose > i && text.slice(i).match(/^<!\[CDATA\[[\s\S]*?\]\]>/));
                if (html) { append({ type: "html", value: html[0] }); i += html[0].length; continue; }
            }
            if (char === "&") {
                const entity = text.slice(i).match(/^&(?:#[0-9]{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]+);/i);
                if (entity) { emit(decodeEntities(entity[0])); i += entity[0].length; continue; }
            }
            if (char === "\n") {
                let spaceStart = i;
                while (spaceStart > 0 && text[spaceStart - 1] === " ") spaceStart--;
                const spaces = i - spaceStart;
                let remaining = spaces, node = tail;
                while (remaining && node !== head && node.type === "text") {
                    const trailing = Math.min(remaining, node.value.match(/ *$/)[0].length);
                    if (!trailing) break;
                    remaining -= trailing; node.value = node.value.slice(0, -trailing); const prev = node.prev;
                    if (!node.value) remove(node); else break;
                    node = prev;
                }
                append({ type: spaces >= 2 ? "break" : "softbreak" }); i++; while (/[ \t]/.test(text[i] || "x")) i++; continue;
            }
            // Coalesce plain text without crossing characters with parsing rules.
            let end = i + 1;
            while (end < text.length && !bareCandidates.has(end) && !/[\\`\[\]!_*~<&\n\s]/.test(text[end]) && !/[\s(*_~]/.test(text[end - 1])) end++;
            emit(text.slice(i, end)); i = end;
        }
        emphasis();
        const children = []; for (let node = head.next; node; node = node.next) children.push(node);
        // Resolve text left by failed brackets, and email addresses inside emphasis.
        // Do not revisit code, HTML, link labels or image alternative text.
        if (extensions) {
            const arrays = [children];
            while (arrays.length) {
                const nodes = arrays.pop(), expanded = [];
                for (let index = 0; index < nodes.length; index++) {
                    const node = nodes[index];
                    if (node.type !== "text") { expanded.push(node); if (["em", "strong", "del"].includes(node.type)) arrays.push(node.children); continue; }
                    let value = node.value;
                    const sourceStarts = new Set();
                    if (bareCandidates.has(node.sourcePosition)) sourceStarts.add(0);
                    while (index + 1 < nodes.length && nodes[index + 1].type === "text") {
                        const next = nodes[++index];
                        if (bareCandidates.has(next.sourcePosition)) sourceStarts.add(value.length);
                        value += next.value;
                    }
                    let offset = 0;
                    for (const [start, link] of bareAutolinks(value)) {
                        if (start < offset) continue;
                        // URL prefixes must occur in the source. Only email
                        // autolinks may arise from decoded/escaped text nodes.
                        if (!/^(?:mailto:|xmpp:)/i.test(link.url) && !sourceStarts.has(start)) continue;
                        if (start > offset) expanded.push({ type: "text", value: value.slice(offset, start) });
                        expanded.push(link); offset = link.end;
                    }
                    if (offset < value.length) expanded.push({ type: "text", value: value.slice(offset) });
                }
                nodes.length = 0; for (const node of expanded) nodes.push(node);
            }
        }
        return children;
    }
    function renderInline(children, slots) {
        let result = ""; const work = children.slice().reverse();
        function plain(nodes) {
            let value = "", pending = nodes.slice().reverse();
            while (pending.length) {
                const node = pending.pop();
                if (node.children) { for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]); }
                else if (node.type === "html" && slots && slots.has(node.value)) value += slots.get(node.value).text;
                else if (node.type !== "html") value += node.value || (node.type === "softbreak" || node.type === "break" ? "\n" : "");
            }
            return value;
        }
        while (work.length) {
            const node = work.pop();
            if (typeof node === "string") { result += node; continue; }
            if (node.type === "text") result += escapeHtml(node.value);
            else if (node.type === "html") result += node.value;
            else if (node.type === "code") result += "<code>" + escapeHtml(node.value) + "</code>";
            else if (node.type === "break") result += "<br>\n";
            else if (node.type === "softbreak") result += "\n";
            else if (node.type === "image") {
                result += '<img src="' + escapeHtml(node.url) + '" alt="' + escapeHtml(plain(node.children)) + '"' + (node.title === undefined ? "" : ' title="' + escapeHtml(node.title) + '"') + ' style="max-width: 100%;">';
            } else {
                const tag = node.type === "link" ? "a" : node.type;
                result += "<" + tag + (tag === "a" ? ' href="' + escapeHtml(node.url) + '"' + (node.title === undefined ? "" : ' title="' + escapeHtml(node.title) + '"') + ' target="_blank" rel="noopener noreferrer"' : "") + ">";
                work.push("</" + tag + ">"); for (let i = node.children.length - 1; i >= 0; i--) work.push(node.children[i]);
            }
        }
        return result;
    }
    function parseMarkdown(source, extensions = true, slots) {
        const references = new Map(), root = blockTree(source, references, extensions, slots);
        let result = ""; const work = [{ node: root, tight: false }];
        const inline = text => renderInline(inlineTree(text, references, extensions, slots), slots);
        while (work.length) {
            const task = work.pop(); if (typeof task === "string") { result += task; continue; }
            const { node, tight } = task;
            if (node.hidden) continue;
            if (node.type === "opaque") result += node.value + "\n";
            else if (node.type === "paragraph") result += (tight ? "" : "<p>") + inline(node.text.replace(/[ \t]+$/, "")) + (tight ? task.last ? "" : "\n" : "</p>\n");
            else if (node.type === "heading") result += "<h" + node.level + ">" + inline(node.text) + "</h" + node.level + ">\n";
            else if (node.type === "rule") result += "<hr>\n";
            else if (node.type === "code") {
                const lang = (node.info || "").split(/\s/)[0];
                result += '<pre class="language-' + escapeHtml(lang || "plaintext") + '"><code' + (lang ? ' class="language-' + escapeHtml(lang) + '"' : "") + ">" + escapeHtml(node.lines.join("\n") + (node.lines.length ? "\n" : "")) + "</code></pre>\n";
            } else if (node.type === "html") result += node.lines.join("\n") + "\n";
            else if (node.type === "table") {
                const row = (cells, tag) => "<tr>\n" + node.header.map((_, i) => "<" + tag + (node.align[i] ? ' align="' + node.align[i] + '" style="text-align:' + node.align[i] + ';"' : "") + ">" + inline((cells[i] || "").replace(/\\\|/g, "|")) + "</" + tag + ">\n").join("") + "</tr>\n";
                result += "<table>\n<thead>\n" + row(node.header, "th") + "</thead>\n" + (node.rows.length ? "<tbody>\n" + node.rows.map(cells => row(cells, "td")).join("") + "</tbody>\n" : "") + "</table>\n";
            } else {
                let tag = "", attrs = "";
                if (node.type === "quote") tag = "blockquote";
                if (node.type === "list") { tag = node.ordered ? "ol" : "ul"; if (node.ordered && node.start !== 1) attrs = ' start="' + node.start + '"'; }
                if (node.type === "item") {
                    tag = "li";
                    const first = node.children.find(child => !child.hidden);
                    if (extensions && first && first.type === "paragraph") {
                        const checked = first.text.match(/^\[([ \t\n\v\f\rxX])\](?:[ \t\n\v\f\r]+|$)/);
                        if (checked) { first.text = first.text.slice(checked[0].length); first.text = '<input type="checkbox" disabled' + (checked[1].toLowerCase() === "x" ? " checked" : "") + '> ' + first.text; attrs = ' style="list-style: none;"'; }
                    }
                }
                if (tag) { result += "<" + tag + attrs + ">" + (tag === "li" && (!node.children.length || tight && node.children[0].type === "paragraph") ? "" : "\n"); work.push("</" + tag + ">\n"); }
                for (let i = node.children.length - 1; i >= 0; i--) work.push({ node: node.children[i], last: i === node.children.length - 1, tight: node.type === "list" ? !node.loose : node.type === "item" ? tight : false });
            }
        }
        return extensions ? result.replace(/<\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?=[\s/>])/gi, tag => "&lt;" + tag.slice(1)) : result;
    }
    function convert(source, slots) {
        let html = parseMarkdown(String(source == null ? "" : source), true, slots);
        if (slots && slots.size) {
            // Escaped markers occur in code or attributes. Expand them as text,
            // while real markers are replaced structurally in an inert DOM.
            html = html.replace(/&lt;span data-litemark-slot=&quot;(\d+)&quot;&gt;&lt;\/span&gt;/g, (match, id) => {
                const value = slots.get('<span data-litemark-slot="' + id + '"></span>');
                return value ? escapeHtml(value.html) : match;
            });
            const template = document.createElement("template");
            template.innerHTML = html;
            // Empty author-provided elements can be anchors or DOM hooks.
            // Preserve them, but discard empty ancestor clones from splitting.
            const authoredElements = Array.from(template.content.querySelectorAll("*"));
            const originalElements = new WeakSet(authoredElements);
            const emptyElements = new WeakSet(authoredElements.filter(node => !node.hasChildNodes()));
            for (const placeholder of Array.from(template.content.querySelectorAll("span[data-litemark-slot]"))) {
                const value = slots.get(placeholder.outerHTML);
                if (!value) continue;
                const content = document.createElement("template"); content.innerHTML = value.html;
                const paragraph = placeholder.closest("p");
                if (!paragraph) { placeholder.replaceWith(content.content); continue; }
                const ancestors = [];
                for (let parent = placeholder.parentElement; parent !== paragraph; parent = parent.parentElement) ancestors.push(parent);
                const before = document.createRange();
                before.selectNodeContents(paragraph); before.setEndBefore(placeholder);
                const prefix = before.extractContents();
                // A partial range clones its ancestor elements. Their ids belong
                // to the first piece, rather than every generated wrapper.
                for (const clone of prefix.querySelectorAll("[id]")) {
                    if (originalElements.has(clone)) continue;
                    const original = ancestors.find(parent => parent.id === clone.id);
                    if (original) original.removeAttribute("id");
                }
                let replacement = content.content;
                // A link or emphasis surrounding the nested source still applies
                // to it when its block is lifted out of the enclosing paragraph.
                for (const parent of ancestors) {
                    const wrapper = parent.cloneNode(false); wrapper.append(replacement); replacement = wrapper;
                    parent.removeAttribute("id");
                }
                placeholder.remove();
                const nodes = [];
                const meaningful = fragment => {
                    const walker = document.createTreeWalker(fragment, 5);
                    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                        if (node.nodeType === 3 && node.data.length || node.nodeType === 1 && (emptyElements.has(node) || /^(?:img|input|br|hr|table|pre)$/.test(node.localName) || node.localName === "span" && node.hasAttribute("data-litemark-slot") && slots.has(node.outerHTML))) return true;
                    }
                    return false;
                };
                if (meaningful(prefix)) { const part = paragraph.cloneNode(false); part.append(prefix); nodes.push(part); paragraph.removeAttribute("id"); }
                // Retain the paragraph's styles, DOM hooks and anchor when its
                // child block needs a flow container instead of an invalid p.
                if (paragraph.attributes.length) {
                    const wrapper = document.createElement("div");
                    for (const attr of Array.from(paragraph.attributes)) wrapper.setAttribute(attr.name, attr.value);
                    wrapper.append(replacement); replacement = wrapper;
                    paragraph.removeAttribute("id");
                }
                nodes.push(replacement);
                paragraph.before(...nodes);
                if (!meaningful(paragraph)) paragraph.remove();
            }
            html = template.innerHTML;
        }
        return trimMarkdown(sanitize(html));
    }
    window.markdownToHtml = function markdownToHtml(markdown) { return convert(markdown); };
    const renderedElements = new WeakSet();
    let slotSequence = 0;
    function elementMarkdown(element, slots) {
        let result = "", work = Array.from(element.childNodes, node => ({ node, html: false })).reverse();
        const reservedSlots = new Set();
        // HTML spellings canonicalize in the DOM: single/unquoted attributes,
        // case differences and character references can denote the same id.
        const authored = decodeEntities(element.innerHTML + element.textContent);
        for (const match of authored.matchAll(/\bdata-litemark-slot[ \t\r\n\f]*=[ \t\r\n\f]*(?:"(\d+)"|'(\d+)'|(\d+)(?=[ \t\r\n\f/>]))/gi)) reservedSlots.add(match[1] || match[2] || match[3]);
        while (work.length) {
            const task = work.pop();
            if (typeof task === "string") { result += task; continue; }
            const { node, html } = task;
            if (node.nodeType === 3) result += html ? escapeHtml(node.data) : node.data;
            else if (node.nodeType === 1) {
                // A rendered descendant is finished HTML, not another Markdown
                // input. Keep it opaque until the outer parse has completed.
                if (renderedElements.has(node)) {
                    let marker;
                    do { marker = '<span data-litemark-slot="' + (++slotSequence) + '"></span>'; }
                    while (reservedSlots.has(String(slotSequence)));
                    slots.set(marker, { html: node.outerHTML, text: htmlText(node, true) }); result += marker; continue;
                }
                const serialized = node.cloneNode(false).outerHTML;
                const voidElement = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(node.localName);
                const closing = "</" + node.localName + ">";
                const opening = voidElement ? serialized : serialized.slice(0, -closing.length);
                result += opening;
                if (!voidElement) work.push(closing);
                const children = (node.content && node.content.nodeType === 11 ? node.content : node).childNodes;
                for (let i = children.length - 1; i >= 0; i--) work.push({ node: children[i], html: true });
            }
        }
        return result;
    }
    document.renderAllMarkdownTags = function renderAllMarkdownTags(root = document) {
        if (!root) root = document;
        const elements = Array.from(root.querySelectorAll(SELECTOR));
        if (root.matches && root.matches(SELECTOR)) elements.unshift(root);
        for (const element of elements.reverse()) {
            // Source-tag text is Markdown too: stripping common indentation would
            // silently turn an indented code block into a paragraph or change tabs.
            const slots = new Map(), markdown = elementMarkdown(element, slots);
            const replacement = document.createElement("div");
            for (const attr of Array.from(element.attributes)) replacement.setAttribute(attr.name, attr.value);
            replacement.innerHTML = convert(markdown, slots);
            renderedElements.add(replacement); element.replaceWith(replacement);
        }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => document.renderAllMarkdownTags(), { once: true });
    else document.renderAllMarkdownTags();
})();
