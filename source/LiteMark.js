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
 * Version:      1.0.0
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

(function() {
    /**
     * List of custom selectors considered as markdown sources.
     * Elements matching these will be hidden initially.
     */
    const MARKDOWN_SELECTORS = [
        'markdown', 'md',
        'text[type="markdown"]',
        'text[type="text/markdown"]',
        'text[type="md"]',
        'text[type="text/md"]'
    ];

    // Hide markdown content before render
    const style = document.createElement('style');
    style.textContent = MARKDOWN_SELECTORS.join(',\n    ') + " { display: none !important; }";
    document.head.appendChild(style);

    /**
     * Main function to convert Markdown string to HTML.
     * @param {string} md - Markdown source
     * @returns {string} - HTML output
     */
    window.markdownToHtml = function markdownToHtml(md) {
        function escapeHtml(html) {
            return html.replace(/[&<>"']/, m => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m]));
        }

        const codeBlocks = [];
        let codeIndex = 0;

        // Extract code blocks first
        md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            const lines = code.replace(/\r/g, '').split('\n');
            while (lines[0].trim() === '') lines.shift();
            while (lines[lines.length - 1].trim() === '') lines.pop();

            const minIndent = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length)),
                cleaned = lines.map(line => line.slice(minIndent)).join('\n'),
                html = `<pre class="language-${lang ?? 'plaintext'}"><code>${escapeHtml(cleaned)}</code></pre>`,
                placeholder = `<!--codeblock_${codeIndex++}-->`;

            codeBlocks.push({ placeholder, html });
            return placeholder;
        });

        // Trim unnecessary indentation
        md = md.split('\n').map(line => {
            if (/^( *)(\d+\. |[-+*] )/.test(line) || line.startsWith('```') || line.startsWith('<!--codeblock_')) return line;
            return line.trimStart();
        }).join('\n');

        // Render checkbox lists
        md = md.replace(/((?:^ *[-+*] \[[ xX]\] .+(?:\n|$))+)/gm, block => {
            return '<ul>' + block.trim().split('\n').map(line => {
                const checked = /\[x\]/i.test(line);
                const content = line.replace(/^ *[-+*] \[[ xX]\] /, '');
                return `<li style="list-style: none;"><input type="checkbox"${checked ? ' checked' : ''} disabled> ${content}</li>`;
            }).join('') + '</ul>';
        });

        // Render nested lists
        md = md.replace(/((?:^ *(?:[-+*]|\d+\.) .+(?:\n|$))+)/gm, block => {
            const lines = block.trimEnd().split('\n');
            let html = '';
            const stack = [];

            lines.forEach(line => {
                const match = line.match(/^( *)([-+*]|\d+)\. (.+)$/) || line.match(/^( *)([-+*]) (.+)$/);
                if (!match) return;

                const
                    indent = match[1].length,
                    marker = match[2],
                    content = match[3],
                    type = /^\d+$/.test(marker) ? 'ol' : 'ul',
                    isOrdered = type === 'ol',
                    depth = indent;


                while (stack.length && stack[stack.length - 1].indent >= depth) {
                    html += `</li></${stack.pop().type}>`;
                }

                if (!stack.length || stack[stack.length - 1].indent < depth) {
                    html += `<${type}><li>`;
                    stack.push({ indent: depth, type });
                } else {
                    html += '</li><li>';
                }

                if (isOrdered) {
                    html += `<span style="display:none" data-md-index="${marker}"></span>${content}`;
                } else {
                    html += content;
                }
            });

            while (stack.length) html += `</li></${stack.pop().type}>`;
            return html.replace(/<li><span style="display:none" data-md-index="(\d+)"><\/span>/g, '<li value="$1">');
        });

        // Inline markdown replacements
        const patterns = [
            [/^###### (.*)$/gm, '<h6>$1</h6>'],
            [/^##### (.*)$/gm, '<h5>$1</h5>'],
            [/^#### (.*)$/gm, '<h4>$1</h4>'],
            [/^### (.*)$/gm, '<h3>$1</h3>'],
            [/^## (.*)$/gm, '<h2>$1</h2>'],
            [/^# (.*)$/gm, '<h1>$1</h1>'],
            [/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr>'],
            [/~~(.*?)~~/g, '<del>$1</del>'],
            [/(^|\W)\*\*\*(?!\*)(.+?)(?<!\*\*)\*\*\*(?=\W|$)/g, '$1<strong><em>$2</em></strong>'],
            [/(^|\W)___(?!_)(.+?)(?<!___)___(?=\W|$)/g, '$1<strong><em>$2</em></strong>'],
            [/(^|\W)\*\*(?!\*)(.+?)(?<!\*\*)\*\*(?=\W|$)/g, '$1<strong>$2</strong>'],
            [/(^|\W)__(?!_)(.+?)(?<!__)__(?=\W|$)/g, '$1<strong>$2</strong>'],
            [/(^|\W)\*(?!\*)(.+?)(?<!\*)\*(?=\W|$)/g, '$1<em>$2</em>'],
            [/(^|\W)_(?!_)(.+?)(?<!_)_(?=\W|$)/g, '$1<em>$2</em>'],
            [/`([^`]+?)`/g, '<code>$1</code>'],
            [/<((https?|ftp):\/\/[^>\s]+)>/g, '<a href="$1" target="_blank">$1</a>']
        ];

        for (const [regex, replacement] of patterns) md = md.replace(regex, replacement);

        // Render images
        md = md.replace(/!\[([^\]]*)\]\((\S+?)(?: +"([^"]+)")?\)/g, (_, alt, src, title) => {
            const t = title ? ` title="${title}"` : '';
            return `<img alt="${alt}" src="${src}"${t} style="max-width: 100%;">`;
        });

        // Render links
        md = md.replace(/\[([^\]]+)\]\((\S+?)(?: +"([^"]+)")?\)/g, (_, text, href, title) => {
            const t = title ? ` title="${title}"` : '';
            return `<a href="${href}"${t} target="_blank">${text}</a>`;
        });

        // Render blockquotes
        md = md.replace(/^((?:> ?.*(?:\n|$))+)/gm, block => {
            const lines = block.trim().split('\n');
            let html = '',
                openTags = 0;

            lines.forEach(line => {
                const match = line.match(/^(>+)\s?(.*)$/);
                if (!match) return;
                const level = match[1].length;
                const content = match[2];

                while (openTags > level) {
                    html += '</blockquote>';
                    openTags--;
                }
                while (openTags < level) {
                    html += '<blockquote>';
                    openTags++;
                }
                html += content + '\n';
            });

            while (openTags-- > 0) html += '</blockquote>';
            return html;
        });

        // Render tables
        md = md.replace(/((?:^\|.*\|\n?)+)/gm, block => {
            const lines = block.trim().split('\n');
            if (lines.length < 2) return block;
            const divider = lines[1];
            if (!/^\|(?:[\s\-:]+\|)+$/.test(divider)) return block;

            const alignments = divider.trim().slice(1, -1).split('|').map(cell => {
                const t = cell.trim();
                if (t.startsWith(':') && t.endsWith(':')) return 'center';
                if (t.startsWith(':')) return 'left';
                if (t.endsWith(':')) return 'right';
                return 'left';
            });

            const renderRow = (row, tag) => {
                const cells = row.trim().slice(1, -1).split('|').map(c => c.trim());
                return '<tr>' + cells.map((c, i) => `<${tag} style="text-align:${alignments[i] || 'left'};">${c}</${tag}>`).join('') + '</tr>';
            };

            const thead = renderRow(lines[0], 'th');
            const tbody = lines.slice(2).map(row => renderRow(row, 'td')).join('');
            return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
        });

        // Render paragraphs
        const lines = md.split('\n'),
            result = [],
            paragraph = [];

        const blockTags = [
            'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
            'b', 'base', 'bdi', 'bdo', 'big', 'blockquote', 'body', 'br',
            'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
            'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog',
            'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption',
            'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'head', 'header', 'hr', 'html', 'i', 'iframe', 'img', 'input',
            'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
            'mark', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
            'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre',
            'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script',
            'section', 'select', 'small', 'source', 'span', 'strong', 'style',
            'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template',
            'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
            'u', 'ul', 'var', 'video', 'wbr'
        ];

        const isBlock = line => {
            const tagMatch = line.match(/^<\/?([^\s/>]+)/i);
            if (!tagMatch) return false;
            const tagName = tagMatch[1].toLowerCase();
            return blockTags.includes(tagName);
        };

        const flush = () => {
            if (paragraph.length) result.push('<p>' + paragraph.join(' ') + '</p>');
            paragraph.length = 0;
        };

        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed) { flush(); continue; }
            if (trimmed.startsWith('<!--codeblock_') || isBlock(trimmed)) {
                flush();
                result.push(trimmed);
                continue;
            }
            paragraph.push(trimmed);
        }
        flush();

        let html = result.join('\n');
        for (const { placeholder, html: codeHtml }
            of codeBlocks) {
            html = html.replace(placeholder, codeHtml);
        }
        return html.trim();
    };

    /**
     * Automatically renders all markdown tags on the page or inside a given root.
     * @param {HTMLElement} root - Optional root element to scope rendering
     */
    document.renderAllMarkdownTags = function(root = document) {
        const elements = MARKDOWN_SELECTORS.flatMap(sel => [...root.querySelectorAll(sel)]);
        elements.forEach(el => {
            const html = markdownToHtml(el.textContent);
            const div = document.createElement('div');
            for (const attr of el.attributes) div.setAttribute(attr.name, attr.value);
            div.innerHTML = html;
            el.replaceWith(div);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => document.renderAllMarkdownTags());
    } else {
        document.renderAllMarkdownTags();
    }
})();