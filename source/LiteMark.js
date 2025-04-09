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
 * Version:      1.1.0
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
         * Convert Markdown string to HTML
         * @param {string} md - Markdown source
         * @returns {string} - HTML output
         */
        window.markdownToHtml = function markdownToHtml(md) {
                function escapeHtml(html) {
                    // Не экранируем уже экранированные сущности
                    return html.replace(/&(?![a-zA-Z]+;)|[<>"']/g, m => ({
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    }[m] || m));
                }


                const codeBlocks = [],
                    inlineCodeBlocks = [],
                    escapePlaceholders = [];
                let codeIndex = 0,
                    inlineIndex = 0,
                    escapeIndex = 0;

                // Handle escaped characters
                md = md.replace(/\\([\\`*_{}\[\]()#+\-.!~>])/g, (_, ch) => {
                    const placeholder = `<!--escaped_${escapeIndex++}-->`;
                    escapePlaceholders.push({ placeholder, ch });
                    return placeholder;
                });

                /**
                 * Single-pass parser for backticks:
                 * - Fenced code blocks (```...```)
                 * - Double backtick inline (``...``)
                 * - Single backtick inline (`...`)
                 *
                 * Places placeholders like <!--codeblock_#--> or <!--inlinecode_#--> in MD,
                 * then we'll replace them later.
                 */
                function parseBackticks(src) {
                    let i = 0,
                        n = src.length,
                        out = '';

                    // Simple function to see if substring at pos == str
                    function match(pos, str) {
                        return src.substr(pos, str.length) === str;
                    }

                    while (i < n) {
                        // Check for fenced code block: "```"
                        if (match(i, '```')) {
                            let lang = '',
                                codeStart = i + 3;

                            // Find language name (if any) right after ```

                            while (codeStart < n && /[^\s\n]/.test(src[codeStart])) {
                                if (src[codeStart] === '\r' || src[codeStart] === '\n') break;
                                lang += src[codeStart++];
                            }

                            // Skip at most one \n or \r\n after language
                            if (src[codeStart] === '\r') codeStart++;
                            if (src[codeStart] === '\n') codeStart++;

                            // Now gather code until next ```
                            let codeEnd = codeStart,
                                fenceFound = false;
                            while (codeEnd < n) {
                                if (match(codeEnd, '```')) {
                                    fenceFound = true;
                                    break;
                                }
                                codeEnd++;
                            }

                            // codeEnd указывает на начало закрывающих ```
                            const codeText = src.substring(codeStart, fenceFound ? codeEnd : n);
                            const placeholder = `<!--codeblock_${codeIndex++}-->`;

                            // Сохраняем как <pre><code>...</code></pre> (будет вставлено позже)
                            // Убираем минимальную общую индентацию
                            const lines = codeText.replace(/\r/g, '').split('\n');

                            while (lines.length && lines[0].trim() === '') lines.shift();
                            while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

                            let minIndent = 9999;
                            lines.forEach(l => {
                                if (l.trim()) {
                                    const spaces = l.match(/^ */)[0].length;
                                    if (spaces < minIndent) minIndent = spaces;
                                }
                            });
                            if (!isFinite(minIndent)) minIndent = 0; // защита от пустого
                            const cleaned = lines.map(l => l.slice(minIndent)).join('\n');

                            const html = `<pre class="language-${lang.trim() || 'plaintext'}"><code>${escapeHtml(cleaned)}</code></pre>`;
                            codeBlocks.push({ placeholder, html });

                            out += placeholder; // вставляем
                            // Сдвигаем i: если нашли закрывающий ```, пропускаем их
                            i = fenceFound ? codeEnd + 3 : codeEnd;
                            continue;
                        }

                        // Check for double backtick inline: ``
                        if (match(i, '``')) {
                            let j = i + 2;

                            while (j < n) {
                                if (match(j, '``')) {
                                    break;
                                }
                                j++;
                            }

                            const codeText = src.substring(i + 2, j < n ? j : n);
                            const placeholder = `<!--inlinecode_${inlineIndex++}-->`;

                            inlineCodeBlocks.push({ placeholder, code: codeText });
                            out += placeholder;
                            i = j < n ? j + 2 : n; // пропустить закрывающие бэктики, если были
                            continue;
                        }

                        // Check for single backtick: `
                        if (src[i] === '`') {
                            let j = i + 1;
                            while (j < n && src[j] !== '`') j++;

                            const codeText = src.substring(i + 1, j < n ? j : n);
                            const placeholder = `<!--inlinecode_${inlineIndex++}-->`;

                            inlineCodeBlocks.push({ placeholder, code: codeText });
                            i = j < n ? j + 1 : n; // пропустить закрывающую кавычку
                            out += placeholder;
                            continue;
                        }

                        // Else just a normal character
                        out += src[i++];
                    }

                    return out;
                }

                // Полностью заменяем старый разрозненный replace() на единый парсер
                md = parseBackticks(md);

                // Trim unnecessary indentation (не трогаем те места, где уже стоят плейсхолдеры)
                md = md.split('\n').map(line => {
                    if (/^( *)(\d+\. |[-+*] )/.test(line) || line.indexOf('```') === 0 || line.indexOf('<!--codeblock_') === 0) {
                        return line;
                    }
                    return line.replace(/^\s+/, '');
                }).join('\n');

                // Handle checkbox lists
                md = md.replace(/((?:^ *[-+*] \[[ xX]\] .+(?:\n|$))+)/gm, block => {
                    return '<ul>' + block.trim().split('\n').map(line => {
                        const checked = /\[x\]/i.test(line);
                        const content = line.replace(/^ *[-+*] \[[ xX]\] /, '');
                        return `<li style="list-style: none;"><input type="checkbox"${checked ? ' checked' : ''} disabled> ${content}</li>`;
                    }).join('') + '</ul>';
                });

                // Handle nested lists
                md = md.replace(/((?:^ *(?:[-+*]|\d+\.) .+(?:\n|$))+)/gm, block => {
                    const lines = block.trimEnd().split('\n');
                    let html = '',
                        stack = [];

                    lines.forEach(line => {
                        const match = line.match(/^( *)([-+*]|\d+)\. (.+)$/) || line.match(/^( *)([-+*]) (.+)$/);
                        if (!match) return;

                        const indent = match[1].length,
                            marker = match[2],
                            content = match[3],
                            type = /^\d+$/.test(marker) ? 'ol' : 'ul',
                            isOrdered = type === 'ol';

                        while (stack.length && stack[stack.length - 1].indent >= indent) {
                            html += `</li></${stack.pop().type}>`;
                        }

                        if (!stack.length || stack[stack.length - 1].indent < indent) {
                            html += `<${type}><li>`;
                            stack.push({ indent, type });
                        } else {
                            html += '</li><li>';
                        }

                        html += isOrdered ? `<span style="display:none" data-md-index="${marker}"></span>${content}` : content;
                    });

                    while (stack.length) html += `</li></${stack.pop().type}>`;
                    return html.replace(/<li><span style="display:none" data-md-index="(\d+)"><\/span>/g, '<li value="$1">');
                });

                // Inline markdown patterns
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
                    [/<((https?|ftp):\/\/[^>\s]+)>/g, '<a href="$1" target="_blank">$1</a>']
                ];
                for (let [regex, replacement] of patterns) {
                    md = md.replace(regex, replacement);
                }

                // Images
                md = md.replace(/!\[([^\]]*)\]\((\S+?)(?: +"([^"]+)")?\)/g, (_, alt, src, title) => {
                            return `<img alt="${alt}" src="${src}"${title ? ` title="${title}"` : ''} style="max-width: 100%;">`;
    });

    // Links
    md = md.replace(/\[([^\]]+)\]\((\S+?)(?: +"([^"]+)")?\)/g, (_, text, href, title) => {
        return `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank">${text}</a>`;
    });

    // Blockquotes
    md = md.replace(/^((&gt; ?.*(?:\n|$))+)/gm, raw => {
        const lines = raw.trim().split('\n').map(line => {
            const match = line.match(/^((&gt;)+)\s?(.*)$/);
            if (!match) return null;
            return { level: match[1].split('&gt;').length - 1, content: match[3] };
        }).filter(Boolean);

        function renderQuote(items, level) {
            let result = [];
            for (let i = 0; i < items.length; i++) {
                const { level: l, content } = items[i];
                if (l === level) {
                    result.push(content === '' ? '<br>' : markdownToHtml(content));
                } else if (l > level) {
                    let nested = [];
                    while (i < items.length && items[i].level >= l) nested.push(items[i++]);
                    i--;
                    result.push(renderQuote(nested, l));
                }
            }
            return `<blockquote>${result.join('\n')}</blockquote>`;
        }
        return renderQuote(lines, 1);
    });

    // Tables
    md = md.replace(/((?:^\|.*\|\n?)+)/gm, block => {
        const lines = block.trim().split('\n');
        if (lines.length < 2 || !/^\|(?:[\s\-:]+\|)+$/.test(lines[1])) return block;
        const alignments = lines[1].trim().slice(1, -1).split('|').map(cell => {
            const t = cell.trim();

            if (t.charAt(0) === ':' && t.charAt(t.length - 1) === ':') return 'center';
            if (t.charAt(0) === ':') return 'left';
            if (t.charAt(t.length - 1) === ':') return 'right';

            return 'left';
        });
        function renderRow(row, tag) {
            const cells = row.trim().slice(1, -1).split('|').map(c => c.trim());
            return '<tr>' + cells.map((c, i) => `<${tag} style="text-align:${alignments[i] || 'left'};">${c}</${tag}>`).join('') + '</tr>';
        }
        const thead = renderRow(lines[0], 'th');
        const tbody = lines.slice(2).map(row => renderRow(row, 'td')).join('');
        return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    });

    // Paragraphs
    const splitted = md.split('\n'), result = [], paragraph = [];
    function isHtmlTagLike(line) {
        return /^<\/?[a-zA-Z][\w\-]*(\s[^>]*)?>/.test(line.trim());
    }

    function flush() {
        if (paragraph.length) result.push('<p>' + paragraph.join('<br>') + '</p>');
        paragraph.length = 0;
    }
    
    for (let i = 0; i < splitted.length; i++) {
        const trimmed = splitted[i].trim();
        if (!trimmed) {
            flush(); 
            continue;
        }
        if (trimmed.indexOf('<!--codeblock_') === 0 || isHtmlTagLike(trimmed)) {
            flush();
            result.push(trimmed);
            continue;
        }
        paragraph.push(trimmed);
    }
    flush();

    let html = result.join('\n');

    // Replace code block placeholders
    for (let i = 0; i < codeBlocks.length; i++) {
        html = html.replace(codeBlocks[i].placeholder, codeBlocks[i].html);
    }
    // Replace inline code placeholders
    for (let i = 0; i < inlineCodeBlocks.length; i++) {
        // Inline code always <code>...</code>
        html = html.replace(inlineCodeBlocks[i].placeholder,
                            `<code>${escapeHtml(inlineCodeBlocks[i].code)}</code>`);
    }
    // Replace escaped placeholders
    for (let i = 0; i < escapePlaceholders.length; i++) {
        html = html.replace(escapePlaceholders[i].placeholder, escapePlaceholders[i].ch);
    }
    return html.trim();
};

/**
 * Automatically render all custom markdown tags
 * @param {HTMLElement} root - Root container to process
 */
document.renderAllMarkdownTags = function(root) {
    if (!root) root = document;
    const elements = MARKDOWN_SELECTORS.flatMap(sel => [].slice.call(root.querySelectorAll(sel)));
    elements.forEach(el => {
        const html = markdownToHtml(el.innerHTML);

        const div = document.createElement('div');
        
        for (let i = 0; i < el.attributes.length; i++) {
            div.setAttribute(el.attributes[i].name, el.attributes[i].value);
        }

        div.innerHTML = html;
        el.replaceWith(div);
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        document.renderAllMarkdownTags();
    });
} else {
    document.renderAllMarkdownTags();
}
})();