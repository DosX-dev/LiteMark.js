"use strict";
const assert = require("node:assert/strict");
// Own regression inputs; rules: https://github.github.com/gfm/#strikethrough-extension-
// and https://github.github.com/gfm/#autolinks-extension-.
exports.run = async function run(page) {
    const result = await page.evaluate(() => {
        const parse = text => { const node = document.createElement("div"); node.innerHTML = markdownToHtml(text); return node; };
        const strike = [];
        for (let left = 1; left <= 4; left++) for (let right = 1; right <= 4; right++) {
            const input = "~".repeat(left) + "x" + "~".repeat(right), node = parse("prefix " + input);
            strike.push({ left, right, count: node.querySelectorAll("del").length, text: node.textContent });
        }
        const urls = ["www.local", "www.a", "www.example.com", "www.foo_bar.example.com", "www.foo_bar.com", "https://localhost", "ftp://example.com"].map(input => {
            const node = parse(input), link = node.querySelector("a"); return { input, href: link && link.getAttribute("href"), text: node.textContent };
        });
        const brackets = "[".repeat(40000) + "]".repeat(40000); let begin = performance.now();
        const bracketNode = parse(brackets), bracketTime = performance.now() - begin;
        const backticks = "`x " + Array.from({ length: 800 }, (_, index) => "`".repeat(index + 2) + "x ").join(""); begin = performance.now();
        const backtickNode = parse(backticks), backtickTime = performance.now() - begin;
        const code = parse("`a` ``b`` `f\ng`");
        return { strike, urls, bracketText: bracketNode.textContent, bracketTime, backtickText: backtickNode.textContent, backtickTime, code: Array.from(code.querySelectorAll("code"), node => node.textContent) };
    });
    let count = 0;
    for (const row of result.strike) {
        const valid = row.left === row.right && row.left <= 2;
        assert.equal(row.count, valid ? 1 : 0, `Strike runs ${row.left}/${row.right}`); count++;
        assert.equal(row.text, "prefix " + (valid ? "x" : "~".repeat(row.left) + "x" + "~".repeat(row.right))); count++;
    }
    const expected = ["http://www.local", "http://www.a", "http://www.example.com", "http://www.foo_bar.example.com", null, null, "ftp://example.com"];
    result.urls.forEach((row, index) => { assert.equal(row.href, expected[index], row.input); assert.equal(row.text, row.input); count += 2; });
    assert.equal(result.bracketText, "[".repeat(40000) + "]".repeat(40000)); count++;
    assert.ok(result.bracketTime < 1500, `80KB brackets took ${result.bracketTime}ms`); count++;
    const backticks = "`x " + Array.from({ length: 800 }, (_, index) => "`".repeat(index + 2) + "x ").join("");
    assert.equal(result.backtickText, backticks.trimEnd()); count++;
    assert.ok(result.backtickTime < 1000, `322KB unmatched backticks took ${result.backtickTime}ms`); count++;
    assert.deepEqual(result.code, ["a", "b", "f g"]); count++;
    return count;
};

