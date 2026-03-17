#!/usr/bin/env node

const { runCli } = require("../lib/cli");

runCli().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
