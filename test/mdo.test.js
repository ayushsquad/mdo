"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

function requestRaw(url, rawPath) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = http.request(
      {
        host: target.hostname,
        method: "GET",
        path: rawPath,
        port: target.port
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({ body, statusCode: response.statusCode });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

test("file mode renders markdown to HTML output", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-file-test-"));
  const markdownPath = path.join(tmpDir, "README.md");
  const outputPath = path.join(tmpDir, "README.html");

  await fs.writeFile(markdownPath, "# Hello\n\n- [x] done\n\n```js\nconsole.log(1)\n```\n", "utf8");

  const { runFileMode } = require("../lib/file-mode");
  await runFileMode({
    cwdRealPath: await fs.realpath(tmpDir),
    filePath: markdownPath,
    outputPath,
    themeName: "sepia"
  });

  const html = await fs.readFile(outputPath, "utf8");
  assert.match(html, /<article class="markdown-body">/);
  assert.match(html, /language-js/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /#f6efe2/);
});

test("file mode supports new brown themes", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-theme-test-"));
  const markdownPath = path.join(tmpDir, "notes.md");
  const outputPath = path.join(tmpDir, "notes.html");

  await fs.writeFile(markdownPath, "# Notes\n\nParagraph.\n", "utf8");

  const { runFileMode } = require("../lib/file-mode");
  await runFileMode({
    cwdRealPath: await fs.realpath(tmpDir),
    filePath: markdownPath,
    outputPath,
    themeName: "earthsong"
  });

  const html = await fs.readFile(outputPath, "utf8");
  assert.match(html, /#2a211b/);
  assert.match(html, /#d89a51/);
});

test("folder mode blocks traversal and serves markdown", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-folder-test-"));
  const docsDir = path.join(tmpDir, "docs");
  const markdownPath = path.join(docsDir, "guide.md");

  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(markdownPath, "# Guide\n", "utf8");

  const openPath = require.resolve("open");
  require.cache[openPath] = {
    exports: async () => {}
  };

  delete require.cache[require.resolve("../lib/folder-mode")];
  const { runFolderMode } = require("../lib/folder-mode");
  const { server, url } = await runFolderMode({
    directoryPath: docsDir,
    fixedPort: 18080,
    themeName: "dracula"
  });

  try {
    const listingResponse = await fetch(url);
    assert.equal(listingResponse.status, 200);
    const listingHtml = await listingResponse.text();
    assert.match(listingHtml, /guide\.md/);
    assert.match(listingHtml, /#bd93f9/);

    const fileResponse = await fetch(new URL("/guide.md", url));
    assert.equal(fileResponse.status, 200);
    assert.match(await fileResponse.text(), /<h1.*?>Guide<\/h1>/);

    const traversalResponse = await requestRaw(url, "/%2e%2e/%2e%2e/etc/passwd");
    assert.equal(traversalResponse.statusCode, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("folder mode supports gruvbox theme", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-gruvbox-test-"));
  const docsDir = path.join(tmpDir, "docs");

  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, "guide.md"), "# Guide\n", "utf8");

  const openPath = require.resolve("open");
  require.cache[openPath] = {
    exports: async () => {}
  };

  delete require.cache[require.resolve("../lib/folder-mode")];
  const { runFolderMode } = require("../lib/folder-mode");
  const { server, url } = await runFolderMode({
    directoryPath: docsDir,
    fixedPort: 18083,
    themeName: "gruvbox"
  });

  try {
    const listingResponse = await fetch(url);
    assert.equal(listingResponse.status, 200);
    const listingHtml = await listingResponse.text();
    assert.match(listingHtml, /#282828/);
    assert.match(listingHtml, /#d79921/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
