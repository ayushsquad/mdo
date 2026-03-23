"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

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
    themeName: "belafonte-day"
  });

  const html = await fs.readFile(outputPath, "utf8");
  assert.match(html, /<article class="markdown-body">/);
  assert.match(html, /language-js/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /#f6f1e7/);
  assert.doesNotMatch(html, /prefers-color-scheme: dark/);
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
  assert.doesNotMatch(html, /#d79921/);
});

test("file mode renders MathJax expressions and leaves code blocks untouched", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-math-test-"));
  const markdownPath = path.join(tmpDir, "math.md");
  const outputPath = path.join(tmpDir, "math.html");

  await fs.writeFile(
    markdownPath,
    [
      "# Math",
      "",
      "Inline $a_b$ and \\(c_d\\).",
      "",
      "\\[",
      "\\frac{1}{2}",
      "\\]",
      "",
      "```txt",
      "$not_math$ and \\(still_not_math\\)",
      "```"
    ].join("\n"),
    "utf8"
  );

  const { runFileMode } = require("../lib/file-mode");
  await runFileMode({
    cwdRealPath: await fs.realpath(tmpDir),
    filePath: markdownPath,
    outputPath,
    themeName: "github-light"
  });

  const html = await fs.readFile(outputPath, "utf8");
  assert.equal((html.match(/<mjx-container/g) || []).length, 3);
  assert.equal((html.match(/\\\(/g) || []).length, 1);
  assert.doesNotMatch(html, /\\\[/);
  assert.match(html, /\$not_math\$ and \\\(still_not_math\\\)/);
  assert.match(html, /language-txt/);
});

test("file mode keeps generated html when browser open fails", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-file-open-fail-"));
  const markdownPath = path.join(tmpDir, "notes.md");

  await fs.writeFile(markdownPath, "# Notes\n", "utf8");

  const browserPath = require.resolve("../lib/browser");
  require.cache[browserPath] = {
    exports: {
      openInBrowser: async () => {
        throw new Error("open failed");
      }
    }
  };

  delete require.cache[require.resolve("../lib/file-mode")];
  const { runFileMode } = require("../lib/file-mode");
  const result = await runFileMode({
    cwdRealPath: await fs.realpath(tmpDir),
    filePath: markdownPath,
    themeName: "github-light"
  });

  assert.equal(result.browserOpened, false);
  assert.equal(result.visiblePath, "/notes.md");
  const html = await fs.readFile(result.outputPath, "utf8");
  assert.match(html, /<article class="markdown-body">/);
});

test("browser launcher uses open on macOS", () => {
  const originalPlatform = process.platform;
  const browserPath = require.resolve("../lib/browser");
  delete require.cache[browserPath];

  Object.defineProperty(process, "platform", {
    value: "darwin"
  });

  try {
    const { getBrowserCommand } = require("../lib/browser");
    assert.deepEqual(getBrowserCommand("http://127.0.0.1:12345/"), {
      command: "/usr/bin/open",
      args: ["-u", "http://127.0.0.1:12345/"]
    });
    assert.deepEqual(getBrowserCommand("/tmp/test.html"), {
      command: "/usr/bin/open",
      args: ["/tmp/test.html"]
    });
  } finally {
    Object.defineProperty(process, "platform", {
      value: originalPlatform
    });
    delete require.cache[browserPath];
  }
});

test("folder mode blocks traversal and serves markdown", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-folder-test-"));
  const docsDir = path.join(tmpDir, "docs");
  const markdownPath = path.join(docsDir, "guide.md");

  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(markdownPath, "# Guide\n", "utf8");

  const browserPath = require.resolve("../lib/browser");
  require.cache[browserPath] = {
    exports: {
      openInBrowser: async () => {}
    }
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

test("folder mode supports belafonte-night theme", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-belafonte-night-test-"));
  const docsDir = path.join(tmpDir, "docs");

  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, "guide.md"), "# Guide\n", "utf8");

  const browserPath = require.resolve("../lib/browser");
  require.cache[browserPath] = {
    exports: {
      openInBrowser: async () => {}
    }
  };

  delete require.cache[require.resolve("../lib/folder-mode")];
  const { runFolderMode } = require("../lib/folder-mode");
  const { server, url } = await runFolderMode({
    directoryPath: docsDir,
    fixedPort: 18083,
    themeName: "belafonte-night"
  });

  try {
    const listingResponse = await fetch(url);
    assert.equal(listingResponse.status, 200);
    const listingHtml = await listingResponse.text();
    assert.match(listingHtml, /#20111b/);
    assert.match(listingHtml, /#d7995b/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("folder mode keeps server running when browser open fails", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mdo-folder-open-fail-"));
  const docsDir = path.join(tmpDir, "docs");

  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, "guide.md"), "# Guide\n", "utf8");

  const browserPath = require.resolve("../lib/browser");
  require.cache[browserPath] = {
    exports: {
      openInBrowser: async () => {
        throw new Error("open failed");
      }
    }
  };

  delete require.cache[require.resolve("../lib/folder-mode")];
  const { runFolderMode } = require("../lib/folder-mode");
  const { browserOpened, server, url } = await runFolderMode({
    directoryPath: docsDir,
    fixedPort: 18084,
    themeName: "github-light"
  });

  try {
    assert.equal(browserOpened, false);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /guide\.md/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("folder mode exits promptly on SIGINT", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
const browserPath = require.resolve('./lib/browser');
require.cache[browserPath] = { exports: { openInBrowser: async () => { throw new Error('open failed'); } } };
const { runFolderMode } = require('./lib/folder-mode');
runFolderMode({ directoryPath: '.', themeName: 'github-light' }).catch((error) => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
`
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "ignore", "pipe"]
    }
  );

  const stderrChunks = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk);
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for startup")), 2000);
    child.stderr.on("data", (chunk) => {
      if (chunk.includes("Server available at http://127.0.0.1:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`process exited early with code ${code}`));
    });
  });

  const startedAt = Date.now();
  child.kill("SIGINT");

  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for SIGINT shutdown")), 1000);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve(code ?? signal);
    });
  });

  assert.equal(exitCode, 130);
  assert.ok(Date.now() - startedAt < 1000);
});

test("cli lists themes when --theme has no value", async () => {
  const child = spawn(process.execPath, ["bin/mdo.js", "README.md", "--theme"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });

  assert.equal(exitCode, 0);
  assert.match(stdout, /Available themes:/);
  assert.match(stdout, /github-light/);
  assert.match(stdout, /belafonte-night/);
  assert.equal(stderr, "");
});
