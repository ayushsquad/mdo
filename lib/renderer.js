"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const MarkdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItTaskLists = require("markdown-it-task-lists");
const hljs = require("highlight.js");
const { mathPlugin } = require("./math-plugin");
const {
  DARK_HLJS_THEME,
  DEFAULT_ARTICLE_TITLE,
  GITHUB_MARKDOWN_LIGHT_CSS,
  GITHUB_MARKDOWN_DARK_CSS,
  LIGHT_HLJS_THEME,
  MERMAID_CDN_URL,
  PACKAGE_ROOT
} = require("./constants");
const {
  ensureFileIsReadableMarkdown,
  escapeHtml
} = require("./utils");

function loadCss(relativePath) {
  const cssPath = require.resolve(relativePath, { paths: [PACKAGE_ROOT] });
  return fs.readFileSync(cssPath, "utf8");
}

const markdownCssLight = loadCss(`github-markdown-css/${GITHUB_MARKDOWN_LIGHT_CSS}`);
const markdownCssDark = loadCss(`github-markdown-css/${GITHUB_MARKDOWN_DARK_CSS}`);
const hljsCssLight = loadCss(`highlight.js/styles/${LIGHT_HLJS_THEME}`);
const hljsCssDark = loadCss(`highlight.js/styles/${DARK_HLJS_THEME}`);
const PRINT_WRAP_GUIDE_MARKER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='20' viewBox='0 0 24 20'%3E%3Ctext x='0' y='14' font-family='monospace' font-size='14' fill='%23999999'%3E%E2%86%B3%3C/text%3E%3C/svg%3E";

function wrapCodeHtml(content) {
  return `<span class="mdo-wrap-guide">${content}</span>`;
}

function createMarkdownRenderer(tex2svgHtml) {
  return new MarkdownIt({
    html: true,
    linkify: true,
    highlight(code, language) {
      if (language && language.toLowerCase() === "mermaid") {
        return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
      }

      if (language && hljs.getLanguage(language)) {
        const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
        return `<pre><code class="hljs language-${escapeHtml(language)}">${wrapCodeHtml(highlighted)}</code></pre>`;
      }

      return `<pre><code class="hljs">${wrapCodeHtml(escapeHtml(code))}</code></pre>`;
    }
  })
    .enable(["table", "strikethrough"])
    .use(mathPlugin, { tex2svgHtml })
    .use(markdownItAnchor)
    .use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true });
}

let rendererPromise;

async function getRenderer() {
  if (!rendererPromise) {
    rendererPromise = import("mathxyjax3").then((mathjax) => createMarkdownRenderer(mathjax.tex2svgHtml));
  }
  return rendererPromise;
}

const THEMES = {
  "github-light": {
    accent: "#0969da",
    background: "#ffffff",
    color: "#1f2328",
    darkMode: false,
    hljsCss: hljsCssLight,
    markdownCss: markdownCssLight,
    mermaidTheme: "default",
    navFontColor: "#57606a",
    overlayCss: ""
  },
  "github-dark": {
    accent: "#58a6ff",
    background: "#0d1117",
    color: "#c9d1d9",
    darkMode: true,
    hljsCss: hljsCssDark,
    markdownCss: markdownCssDark,
    mermaidTheme: "dark",
    navFontColor: "#8b949e",
    overlayCss: ""
  },
  "belafonte-day": {
    accent: "#8f5a2b",
    background: "#f6f1e7",
    color: "#3d3126",
    darkMode: false,
    hljsCss: hljsCssLight,
    markdownCss: markdownCssLight,
    mermaidTheme: "neutral",
    navFontColor: "#6f5a46",
    overlayCss: `
body { background-image: linear-gradient(135deg, rgba(143, 90, 43, 0.08), rgba(191, 143, 84, 0.05)); }
.markdown-body {
  color: #3d3126;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: #2b2219;
}
.markdown-body pre, .markdown-body code, .markdown-body blockquote {
  background-color: rgba(120, 90, 59, 0.09);
}
.markdown-body table tr {
  background-color: rgba(255, 248, 238, 0.5);
}
.markdown-body a, .mdo-nav a {
  color: #8f5a2b;
}
`
  },
  "belafonte-night": {
    accent: "#d7995b",
    background: "#20111b",
    color: "#f2e7d5",
    darkMode: true,
    hljsCss: hljsCssDark,
    markdownCss: markdownCssDark,
    mermaidTheme: "dark",
    navFontColor: "#ccb9a4",
    overlayCss: `
body { background-image: radial-gradient(circle at top, rgba(215, 153, 91, 0.2), rgba(32, 17, 27, 0) 42%); }
.markdown-body {
  color: #f2e7d5;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: #ffd7a8;
}
.markdown-body pre, .markdown-body code, .markdown-body blockquote {
  background-color: rgba(75, 49, 44, 0.94);
}
.markdown-body table tr {
  background-color: rgba(92, 62, 54, 0.45);
}
.markdown-body a, .mdo-nav a {
  color: #d7995b;
}
`
  },
  earth: {
    accent: "#8c5a2b",
    background: "#efe4d0",
    color: "#39281a",
    darkMode: false,
    hljsCss: hljsCssLight,
    markdownCss: markdownCssLight,
    mermaidTheme: "neutral",
    navFontColor: "#6f5840",
    overlayCss: `
body { background-image: linear-gradient(135deg, rgba(140, 90, 43, 0.08), rgba(95, 124, 84, 0.06)); }
.markdown-body {
  color: #39281a;
}
.markdown-body a, .mdo-nav a {
  color: #8c5a2b;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: #2d1f14;
}
.markdown-body pre, .markdown-body code, .markdown-body blockquote {
  background-color: rgba(115, 84, 52, 0.1);
}
.markdown-body hr, .markdown-body table th, .markdown-body table td {
  border-color: rgba(88, 63, 39, 0.22);
}
`
  },
  earthsong: {
    accent: "#b97732",
    background: "#2a211b",
    color: "#eadfce",
    darkMode: true,
    hljsCss: hljsCssDark,
    markdownCss: markdownCssDark,
    mermaidTheme: "dark",
    navFontColor: "#c6b49f",
    overlayCss: `
body { background-image: radial-gradient(circle at top, rgba(185, 119, 50, 0.2), rgba(42, 33, 27, 0) 42%); }
.markdown-body {
  color: #eadfce;
}
.markdown-body a, .mdo-nav a {
  color: #d89a51;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: #f2d7b1;
}
.markdown-body pre, .markdown-body code, .markdown-body blockquote {
  background-color: rgba(77, 58, 45, 0.94);
}
.markdown-body table tr {
  background-color: rgba(90, 66, 49, 0.48);
}
`
  },
  dracula: {
    accent: "#bd93f9",
    background: "#1e1f29",
    color: "#f8f8f2",
    darkMode: true,
    hljsCss: hljsCssDark,
    markdownCss: markdownCssDark,
    mermaidTheme: "dark",
    navFontColor: "#c0b8d8",
    overlayCss: `
body { background-image: radial-gradient(circle at top, rgba(189, 147, 249, 0.18), rgba(30, 31, 41, 0) 45%); }
.markdown-body {
  color: #f8f8f2;
}
.markdown-body a, .mdo-nav a {
  color: #bd93f9;
}
.markdown-body pre, .markdown-body code, .markdown-body blockquote {
  background-color: rgba(68, 71, 90, 0.95);
}
.markdown-body table tr {
  background-color: rgba(68, 71, 90, 0.45);
}
`
  },
  print: {
    accent: "#111111",
    background: "#ffffff",
    color: "#111111",
    darkMode: false,
    hljsCss: hljsCssLight,
    markdownCss: markdownCssLight,
    mermaidTheme: "neutral",
    navFontColor: "#444444",
    overlayCss: `
body {
  background-image: none;
}
.markdown-body,
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6,
.mdo-nav,
.mdo-nav a,
.markdown-body a {
  color: #111111;
}
.markdown-body a,
.mdo-nav a {
  text-decoration: underline;
}
.markdown-body hr,
.markdown-body table th,
.markdown-body table td,
.markdown-body blockquote,
.markdown-body h1,
.markdown-body h2 {
  border-color: #666666;
}
.markdown-body blockquote,
.markdown-body table tr {
  background: #ffffff;
}
.markdown-body pre {
  border: 0;
  border-radius: 0;
  background-color: #ffffff;
  background-image:
    radial-gradient(circle, #999999 0.75px, transparent 0.9px),
    radial-gradient(circle, #999999 0.75px, transparent 0.9px),
    radial-gradient(circle, #999999 0.75px, transparent 0.9px),
    radial-gradient(circle, #999999 0.75px, transparent 0.9px);
  background-position: top left, bottom left, top left, top right;
  background-size: 7px 1px, 7px 1px, 1px 7px, 1px 7px;
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
}
.markdown-body pre,
.markdown-body pre code,
.markdown-body .hljs {
  background-color: #ffffff;
}
.markdown-body pre code,
.markdown-body .hljs {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.markdown-body .mdo-wrap-guide {
  display: inline;
  padding-left: 7ch;
  white-space: break-spaces;
  overflow-wrap: anywhere;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  background-image: url("${PRINT_WRAP_GUIDE_MARKER}");
  background-position: 2ch 0.2em;
  background-repeat: no-repeat;
  background-size: 1ch 1.2em;
}
.markdown-body .hljs,
.markdown-body .hljs * {
  color: #111111 !important;
  background: transparent !important;
  font-style: normal !important;
}
`
  }
};

function resolveTheme(themeName) {
  return THEMES[themeName] || THEMES["github-light"];
}

function buildStyles(themeName) {
  const theme = resolveTheme(themeName);
  const markdownCss = theme.markdownCss;
  const hljsCss = theme.hljsCss;

  return `
${markdownCss}
${hljsCss}
body {
  margin: 0;
  background: ${theme.background};
  color: ${theme.color};
}
.markdown-body {
  box-sizing: border-box;
  max-width: 980px;
  margin: 0 auto;
  padding: 45px;
}
.mdo-nav {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 45px 0;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: ${theme.navFontColor};
}
.mdo-nav a {
  color: ${theme.accent};
  text-decoration: none;
}
.mdo-nav a:hover {
  text-decoration: underline;
}
@media (max-width: 767px) {
  .markdown-body {
    padding: 15px;
  }
  .mdo-nav {
    padding: 15px 15px 0;
  }
}
${theme.overlayCss}
`;
}

function buildMermaidBootstrap(themeName) {
  const theme = resolveTheme(themeName);
  return `
<script src="${MERMAID_CDN_URL}"></script>
<script>
  mermaid.initialize({ startOnLoad: true, theme: "${theme.mermaidTheme}" });
</script>`;
}

function buildDocument({ bodyHtml, themeName, title, backHref, backLabel, hasMermaid }) {
  const navHtml = backHref
    ? `<nav class="mdo-nav"><a href="${escapeHtml(backHref)}">&larr; ${escapeHtml(backLabel || "Back")}</a></nav>`
    : "";
  const mermaidHtml = hasMermaid ? buildMermaidBootstrap(themeName) : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data: https: http:; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; media-src data: https: http:;">
    <title>${escapeHtml(title || DEFAULT_ARTICLE_TITLE)}</title>
    <style>${buildStyles(themeName)}</style>
  </head>
  <body>
    ${navHtml}
    <article class="markdown-body">
      ${bodyHtml}
    </article>
    ${mermaidHtml}
  </body>
</html>`;
}

async function renderMarkdownFile(filePath, options = {}) {
  await ensureFileIsReadableMarkdown(filePath);
  const source = await fsp.readFile(filePath, "utf8");
  const renderer = await getRenderer();
  const bodyHtml = renderer.render(source);
  const title = options.title || path.basename(filePath);

  return {
    html: buildDocument({
      bodyHtml,
      themeName: options.themeName || "github-light",
      title,
      backHref: options.backHref,
      backLabel: options.backLabel,
      hasMermaid: /<pre class="mermaid">/.test(bodyHtml)
    }),
    title
  };
}

function renderDirectoryListing({ directoryName, entries, themeName, requestPath, parentHref }) {
  const listItems = entries
    .map((entry) => {
      const suffix = entry.type === "directory" ? "/" : "";
      return `<li><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.name + suffix)}</a></li>`;
    })
    .join("\n");

  const heading = requestPath === "/" ? directoryName : `${directoryName} · ${requestPath}`;
  const backHref = parentHref
    ? `<nav class="mdo-nav"><a href="${escapeHtml(parentHref)}">&larr; Up</a></nav>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <title>${escapeHtml(heading)}</title>
    <style>${buildStyles(themeName || "github-light")}</style>
  </head>
  <body>
    ${backHref}
    <article class="markdown-body">
      <h1>${escapeHtml(heading)}</h1>
      <ul>
        ${listItems}
      </ul>
    </article>
  </body>
</html>`;
}

module.exports = {
  THEMES,
  renderDirectoryListing,
  renderMarkdownFile
};
