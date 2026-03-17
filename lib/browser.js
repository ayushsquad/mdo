"use strict";

const { spawn } = require("node:child_process");

function getBrowserCommand(target) {
  switch (process.platform) {
    case "darwin":
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(target)) {
        return { command: "/usr/bin/open", args: ["-u", target] };
      }
      return { command: "/usr/bin/open", args: [target] };
    case "win32":
      return {
        command: "cmd",
        args: ["/c", "start", "", target]
      };
    default:
      return { command: "xdg-open", args: [target] };
  }
}

function openInBrowser(target) {
  const { command, args } = getBrowserCommand(target);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

module.exports = {
  getBrowserCommand,
  openInBrowser
};
