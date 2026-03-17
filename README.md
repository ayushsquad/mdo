# @ayushshanker/mdo

`@ayushshanker/mdo` is the npm package name. It installs the `mdo` CLI for previewing Markdown files and folders in your browser.

## Install

Global install:

```bash
npm install -g @ayushshanker/mdo
```

One-off usage without installing:

```bash
npx @ayushshanker/mdo README.md
pnpm dlx @ayushshanker/mdo README.md
yarn dlx @ayushshanker/mdo README.md
```

## Command Name

The package is published as `@ayushshanker/mdo`, but the executable command is:

```bash
mdo
```

## Usage

Open the current directory in folder mode:

```bash
mdo
```

Open a specific Markdown file:

```bash
mdo README.md
```

Open a folder on a fixed port:

```bash
mdo docs --port 3000
```

Export a Markdown file to HTML instead of opening the browser:

```bash
mdo README.md --output README.html
```

Use a theme:

```bash
mdo README.md --theme earthsong
mdo README.md --theme gruvbox
mdo README.md --dark
```

## Modes

### File Mode

When you pass a Markdown file, `mdo` renders it to HTML.

Examples:

```bash
mdo README.md
mdo docs/intro.markdown
mdo README.md --output README.html
```

### Folder Mode

When you pass a directory, `mdo` starts a local preview server and opens a directory listing in your browser.

Examples:

```bash
mdo .
mdo docs
mdo docs --port 3000
```

## Flags

- `--dark` uses the GitHub dark theme
- `--theme <name>` selects `github`, `github-dark`, `sepia`, `earth`, `earthsong`, `gruvbox`, or `dracula`
- `--output <file>` writes HTML to disk instead of opening the browser; file mode only
- `--port <port>` uses a fixed port for folder mode
- `--help` prints usage information
- `--version` prints the package version

## Notes

- `mdo` with no path is the same as `mdo .`
- `--output` only works for file mode
- Folder mode binds to loopback only and is intended for local preview
