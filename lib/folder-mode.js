"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { openInBrowser } = require("./browser");
const { LOOPBACK_HOST, MAX_PORT, MIN_PORT, PORT_RETRIES } = require("./constants");
const { renderDirectoryListing, renderMarkdownFile } = require("./renderer");
const { isMarkdownPath } = require("./utils");

async function resolveInsideRoot(rootRealPath, requestPath) {
  const normalized = decodeURIComponent(requestPath || "/");
  const candidatePath = path.resolve(rootRealPath, `.${normalized}`);
  const candidateRelativePath = path.relative(rootRealPath, candidatePath);

  if (candidateRelativePath.startsWith("..") || path.isAbsolute(candidateRelativePath)) {
    return { type: "forbidden", candidatePath };
  }

  let realCandidatePath;

  try {
    realCandidatePath = await fs.realpath(candidatePath);
  } catch (error) {
    return { type: "missing", candidatePath };
  }

  const relativePath = path.relative(rootRealPath, realCandidatePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return { type: "forbidden", candidatePath: realCandidatePath };
  }

  return { type: "ok", realPath: realCandidatePath };
}

async function buildDirectoryEntries(rootRealPath, realDirectoryPath, requestPath) {
  const children = await fs.readdir(realDirectoryPath, { withFileTypes: true });
  const visibleEntries = [];

  for (const child of children) {
    if (child.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(realDirectoryPath, child.name);
    let realChildPath;
    try {
      realChildPath = await fs.realpath(absolutePath);
    } catch {
      continue;
    }

    const relativeToRoot = path.relative(rootRealPath, realChildPath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      continue;
    }

    const isDirectory = child.isDirectory();
    const isFile = child.isFile();

    if (!isDirectory && !(isFile && isMarkdownPath(child.name))) {
      continue;
    }

    const baseHref = requestPath.endsWith("/") ? requestPath : `${requestPath}/`;
    visibleEntries.push({
      href: `${baseHref}${encodeURIComponent(child.name)}${isDirectory ? "/" : ""}`,
      name: child.name,
      type: isDirectory ? "directory" : "file"
    });
  }

  return visibleEntries.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function parentHrefFor(requestPath) {
  if (requestPath === "/") {
    return null;
  }
  const trimmed = requestPath.endsWith("/") ? requestPath.slice(0, -1) : requestPath;
  const parentPath = path.posix.dirname(trimmed);
  return parentPath === "/" ? "/" : `${parentPath}/`;
}

function chooseRandomPort() {
  return Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function startServerWithRetries(server, fixedPort) {
  let lastError;
  const attempts = fixedPort ? 1 : PORT_RETRIES;

  for (let index = 0; index < attempts; index += 1) {
    const port = fixedPort || chooseRandomPort();
    try {
      await listen(server, port);
      return port;
    } catch (error) {
      lastError = error;
      if (fixedPort) {
        throw new Error(`Port ${fixedPort} is unavailable.`);
      }
    }
  }

  throw new Error(lastError ? "Failed to start preview server." : "Failed to choose a port.");
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(message);
}

function installShutdownHandlers(server) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    server.close();
    if (signal === "SIGINT") {
      process.exit(130);
    }
    if (signal === "SIGTERM") {
      process.exit(143);
    }
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function runFolderMode({ directoryPath, fixedPort, themeName }) {
  const rootRealPath = await fs.realpath(directoryPath);
  const server = http.createServer(async (request, response) => {
    try {
      const requestPath = (request.url || "/").split("?")[0] || "/";
      const resolved = await resolveInsideRoot(rootRealPath, requestPath);

      if (resolved.type === "forbidden") {
        sendText(response, 403, "Forbidden");
        return;
      }

      if (resolved.type === "missing") {
        sendText(response, 404, "Not found");
        return;
      }

      const stats = await fs.stat(resolved.realPath);

      if (stats.isDirectory()) {
        const entries = await buildDirectoryEntries(rootRealPath, resolved.realPath, requestPath);
        const html = renderDirectoryListing({
          directoryName: path.basename(rootRealPath),
          entries,
          themeName,
          parentHref: parentHrefFor(requestPath),
          requestPath
        });
        sendHtml(response, 200, html);
        return;
      }

      if (!isMarkdownPath(resolved.realPath)) {
        sendText(response, 404, "Not found");
        return;
      }

      const parentHref = parentHrefFor(requestPath);
      const { html } = await renderMarkdownFile(resolved.realPath, {
        themeName,
        title: path.basename(resolved.realPath),
        backHref: parentHref,
        backLabel: "Back"
      });
      sendHtml(response, 200, html);
    } catch {
      sendText(response, 500, "Internal server error");
    }
  });

  const port = await startServerWithRetries(server, fixedPort);
  installShutdownHandlers(server);

  const url = `http://${LOOPBACK_HOST}:${port}/`;
  try {
    await openInBrowser(url);
  } catch {
    process.stderr.write(`Browser open failed. Server available at ${url}\n`);
    return { browserOpened: false, port, rootRealPath, url, server };
  }

  return { browserOpened: true, port, rootRealPath, url, server };
}

module.exports = {
  runFolderMode
};
