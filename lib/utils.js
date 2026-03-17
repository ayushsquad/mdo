"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const {
  MAX_FILE_SIZE_BYTES,
  MAX_PORT
} = require("./constants");

function isMarkdownPath(targetPath) {
  return /\.(md|markdown)$/i.test(targetPath);
}

async function ensureFileIsReadableMarkdown(filePath) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error("Path must be a markdown file.");
  }
  if (!isMarkdownPath(filePath)) {
    throw new Error("Only .md and .markdown files are supported.");
  }
  if (stats.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Markdown file exceeds the 10 MiB limit.");
  }
  return stats;
}

function validatePort(portValue) {
  if (portValue === undefined) {
    return undefined;
  }
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`Port must be an integer between 1 and ${MAX_PORT}.`);
  }
  return port;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function safeRelativePath(fromPath, targetPath) {
  const relativePath = path.relative(fromPath, targetPath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return relativePath;
}

function humanUrlPath(cwdRealPath, fileRealPath) {
  const relativePath = safeRelativePath(cwdRealPath, fileRealPath);
  const visiblePath = relativePath || path.basename(fileRealPath);
  return `/${toPosixPath(visiblePath).split("/").map(encodeURIComponent).join("/")}`;
}

function tempHtmlPath(cwdRealPath, fileRealPath) {
  const relativePath = safeRelativePath(cwdRealPath, fileRealPath) || path.basename(fileRealPath);
  const sanitizedPath = relativePath
    .split(path.sep)
    .join(path.sep)
    .replace(/[<>:"|?*]/g, "_");
  const uniqueId = crypto.randomBytes(6).toString("hex");
  return path.join(os.tmpdir(), "mdopen", uniqueId, `${sanitizedPath}.html`);
}

async function writeUtf8File(targetPath, content) {
  await fs.writeFile(targetPath, content, "utf8");
}

module.exports = {
  ensureFileIsReadableMarkdown,
  escapeHtml,
  humanUrlPath,
  isMarkdownPath,
  safeRelativePath,
  tempHtmlPath,
  toPosixPath,
  validatePort,
  writeUtf8File
};
