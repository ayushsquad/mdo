"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const open = require("open");
const { renderMarkdownFile } = require("./renderer");
const {
  humanUrlPath,
  tempHtmlPath,
  writeUtf8File
} = require("./utils");

async function runFileMode({ filePath, outputPath, cwdRealPath, themeName }) {
  const { html } = await renderMarkdownFile(filePath, {
    themeName,
    title: path.basename(filePath)
  });

  if (outputPath) {
    await writeUtf8File(outputPath, html);
    return { outputPath, opened: false };
  }

  const htmlPath = tempHtmlPath(cwdRealPath, filePath);
  await fs.mkdir(path.dirname(htmlPath), { recursive: true });
  await writeUtf8File(htmlPath, html);

  try {
    await open(htmlPath);
  } catch (error) {
    process.stderr.write(`Browser open failed. File available at ${htmlPath}\n`);
    throw new Error(`Failed to open browser for ${humanUrlPath(cwdRealPath, filePath)}.`);
  }

  return { outputPath: htmlPath, opened: true };
}

module.exports = {
  runFileMode
};
