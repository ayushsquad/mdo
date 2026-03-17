"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { Command } = require("commander");
const packageJson = require("../package.json");
const { runFileMode } = require("./file-mode");
const { runFolderMode } = require("./folder-mode");
const { THEMES } = require("./renderer");
const {
  ensureFileIsReadableMarkdown,
  validatePort
} = require("./utils");

function themeNames() {
  return Object.keys(THEMES);
}

function hasBareThemeFlag(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--theme") {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("-")) {
      return true;
    }
  }

  return false;
}

function printThemeList() {
  process.stdout.write(`Available themes:\n${themeNames().map((name) => `- ${name}`).join("\n")}\n`);
}

function resolveThemeOption(options) {
  if (options.theme) {
    if (!Object.hasOwn(THEMES, options.theme)) {
      throw new Error(`Theme must be one of: ${themeNames().join(", ")}.`);
    }
    return options.theme;
  }

  return options.dark ? "github-dark" : "github-light";
}

function buildProgram() {
  const program = new Command();

  program
    .name("mdo")
    .description("Open markdown files or folders in your browser.")
    .version(packageJson.version, "--version", "Print package version and exit.")
    .argument("[target]", "Markdown file or folder to open.", ".")
    .option("--dark", "Use GitHub dark theme.")
    .option(
      "--theme <name>",
      `Use a named theme: ${themeNames().join(", ")}.`
    )
    .option("--output <file>", "Write HTML to a file instead of opening the browser.")
    .option("--port <port>", "Use a fixed port for folder mode.", validatePort)
    .addHelpText(
      "after",
      `
Examples:
  npx mdopen
  npx mdopen README.md
  npx mdopen README.md --theme dracula
  mdo
  mdo .
  mdo README.md
  mdo docs --port 3000
`
    );

  return program;
}

async function runCli(argv = process.argv) {
  if (hasBareThemeFlag(argv.slice(2))) {
    printThemeList();
    return;
  }

  const program = buildProgram();
  program.exitOverride();

  let parsed;
  try {
    parsed = program.parse(argv, { from: "node" });
  } catch (error) {
    if (typeof error.exitCode === "number") {
      process.exitCode = error.exitCode;
      if (
        error.code !== "commander.helpDisplayed" &&
        error.code !== "commander.version"
      ) {
        process.stderr.write(`${error.message}\n`);
      }
      return;
    }
    throw error;
  }

  const options = parsed.opts();
  const themeName = resolveThemeOption(options);
  const targetPath = path.resolve(parsed.args[0] || ".");
  const cwdRealPath = await fs.realpath(process.cwd());
  const stats = await fs.stat(targetPath).catch(() => null);

  if (!stats) {
    throw new Error("Path does not exist.");
  }

  if (stats.isDirectory()) {
    if (options.output) {
      throw new Error("--output is only supported for file mode.");
    }
    await runFolderMode({
      directoryPath: targetPath,
      fixedPort: options.port,
      themeName
    });
    return;
  }

  if (options.port !== undefined) {
    throw new Error("--port is only supported for folder mode.");
  }

  await ensureFileIsReadableMarkdown(targetPath);
  await runFileMode({
    cwdRealPath,
    filePath: targetPath,
    outputPath: options.output ? path.resolve(options.output) : undefined,
    themeName
  });
}

module.exports = {
  runCli
};
