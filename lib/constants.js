"use strict";

const path = require("node:path");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_PORT = 20001;
const MAX_PORT = 30000;
const PORT_RETRIES = 3;
const LOOPBACK_HOST = "127.0.0.1";
const MERMAID_VERSION = "11.12.0";
const MERMAID_CDN_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
const LIGHT_HLJS_THEME = "github.css";
const DARK_HLJS_THEME = "github-dark.css";
const GITHUB_MARKDOWN_CSS = "github-markdown.css";
const GITHUB_MARKDOWN_DARK_CSS = "github-markdown-dark.css";
const DEFAULT_ARTICLE_TITLE = "Markdown Preview";
const PACKAGE_ROOT = path.resolve(__dirname, "..");

module.exports = {
	DARK_HLJS_THEME,
	DEFAULT_ARTICLE_TITLE,
	GITHUB_MARKDOWN_CSS,
	GITHUB_MARKDOWN_DARK_CSS,
	LIGHT_HLJS_THEME,
	LOOPBACK_HOST,
	MAX_FILE_SIZE_BYTES,
	MAX_PORT,
	MERMAID_CDN_URL,
	MIN_PORT,
	PACKAGE_ROOT,
	PORT_RETRIES
};
