# mdopen npm CLI spec

**Version:** `0.1.0`
**Package name:** `mdopen`
**CLI command:** `mdo`
**Distribution:** Published to the npm registry as an installable CLI package

## Install and run

The tool must be usable through standard npm workflows:

- `npm install -g mdopen`
- `npx mdopen ...`
- `pnpm dlx mdopen ...`
- `yarn dlx mdopen ...`
- `mdo` with no positional argument opens the current working directory

The published package must expose the `mdo` executable via the `bin` field in `package.json`.

- Package entry point: `bin/mdo.js` or equivalent executable JS file
- Shebang required: `#!/usr/bin/env node`
- Supported runtime: active LTS Node.js versions; minimum supported version should be declared in `package.json` `engines.node`
- The CLI must work on macOS, Linux, and Windows

## Implementation approach

Prefer established third-party npm packages for standard CLI concerns and keep custom code minimal.

- Use off-the-shelf packages as much as possible for argument parsing, markdown rendering, syntax highlighting, browser opening, static file serving, MIME detection, path-to-route mapping, and ANSI/help formatting
- Avoid writing custom implementations for common infrastructure when a mature, well-maintained package already fits the requirement
- Custom code should focus on composing package behavior and project-specific glue, not reimplementing generic tooling
- When choosing between similar approaches, prefer the one that reduces bespoke code while keeping behavior explicit and debuggable
- Favor packages with active maintenance, clear documentation, permissive licensing, and broad ecosystem adoption
- Keep the dependency graph practical rather than maximal; do not add a package for a trivial one-line operation

## Modes

### Default target mode — `mdo`

If no positional path argument is provided, the CLI behaves as `mdo .`.

- Resolves the current working directory at runtime
- Enters folder mode using that directory as the root
- `--output` remains invalid in this mode because it is folder mode
- Help text and examples must document this as the default behavior

### File mode — `mdo <file.md>`

Renders a single markdown file to a temporary HTML file and opens it in the default browser.

- Accepts `.md` and `.markdown` extensions, case-insensitive
- `--dark` uses GitHub dark theme
- `--output <path>` writes self-contained HTML to disk instead of opening the browser
- When opened in a browser, the URL path should reflect the markdown file path relative to the current working directory when such a relative path exists
- Output files must be written with UTF-8 encoding
- Parent directories for `--output` are not created automatically unless explicitly implemented and documented

### Folder mode — `mdo <dir>`

Starts a local HTTP server and opens a browsable directory listing.

- Random port in range `10001` to `65535`, with up to 3 bind retries
- Lists `.md` and `.markdown` files plus subdirectories; hidden entries excluded
- Directories sorted first, then files; both alphabetical
- Clicking a file renders it with a back link to the parent listing
- Rendered file routes must preserve the markdown file path structure within the served tree
- Path traversal outside the requested root is blocked with `403`
- Graceful shutdown on `SIGINT` and `SIGTERM` with a 2 second timeout
- `--output` is rejected in folder mode

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--dark` | `false` | Use dark mode styling |
| `--output <file>` | none | Export HTML to a file instead of opening the browser; file mode only |
| `--port <port>` | random | Optional fixed port for folder mode; reject invalid or unavailable ports |
| `--version` | — | Print package version and exit |
| `--help` | — | Print usage and exit |

## CLI behavior

- A missing positional argument defaults to the current working directory
- Exit code `0` on success
- Exit code non-zero on invalid input, unsupported paths, server startup failure, or browser launch failure
- Error messages must be short and actionable, printed to stderr
- `--help` output must include install-free usage examples with `npx mdopen`
- `--help` output must include examples for `mdo`, `mdo .`, `mdo README.md`, and `mdo docs --port 3000`
- `--version` prints the npm package version from package metadata

## Rendering

**Markdown parser:** Use a Node.js markdown pipeline that supports GitHub-flavored markdown features including:

- tables
- strikethrough
- autolinks
- task lists
- automatic heading IDs

Recommended implementation: `remark` + `remark-gfm` + `rehype` pipeline, or `markdown-it` with equivalent plugins. The exact library is implementation-defined as long as output behavior matches this spec.

**Syntax highlighting:** Light theme uses `github`. Dark theme uses `github-dark`. Language class-based highlighting is preferred over auto-detection for deterministic output.

**Mermaid diagrams:** Fenced code blocks tagged `mermaid` are rendered as `<pre class="mermaid">...</pre>` or equivalent Mermaid bootstrap markup. Mermaid 11.x or newer is acceptable. Theme follows `--dark` using `dark` vs `default`.

**MathJax equations:** TeX math should render correctly for inline and display math. Supported delimiters may include `$...$`, `$$...$$`, `\(...\)`, and `\[...\]`. Server-side MathJax rendering is acceptable and preferred when it avoids delimiter corruption during markdown parsing.

**Raw HTML:** Inline HTML inside markdown is passed through.

## Security and performance

- Folder mode must never serve or render files outside the selected root directory, including through symlinks if the resolved target escapes that root
- Relative-path URL generation must be based on normalized real paths before access checks are applied
- Hidden files and directories remain excluded from listings by default
- The server must only bind to loopback interfaces by default, for example `127.0.0.1` and/or `::1`, and must not expose the preview server on the local network unless a future explicit opt-in flag is added
- Implementations should read markdown files with bounded memory usage and fail clearly on oversized inputs rather than hanging or exhausting memory
- The spec should define a default maximum markdown file size of `10 MiB`; files above that limit must be rejected with a clear error unless a future override flag is introduced
- Directory listings should stay responsive in large folders; implementations may cap rendered listing size or paginate, but if they do, the behavior must be documented in help text or release notes
- Mermaid runtime must only be loaded when at least one Mermaid block is present in the rendered document
- Mermaid script loading should prefer a pinned package version or pinned CDN asset rather than a floating `latest` URL
- If a CDN is used for Mermaid, add Subresource Integrity when the chosen delivery mechanism supports it
- HTML output should include a conservative Content Security Policy when compatible with Mermaid and inline styling requirements; if a strict CSP is not feasible, document the relaxed directives explicitly in the implementation
- Syntax highlighting and markdown rendering should be deterministic for the same input and flags
- Folder mode may cache rendered HTML in memory for the lifetime of the process, but cache invalidation must occur when the source file changes if watch-based refresh is ever added
- Temporary files and local preview routes must avoid embedding raw absolute filesystem paths in browser-visible URLs when a cwd-relative representation is available

## HTML output

- GitHub-flavored markdown CSS is bundled with the npm package and inlined into generated HTML
- Content is wrapped in `<article class="markdown-body">`
- Max content width: `980px`, centered
- Responsive padding: `45px` desktop, `15px` below `767px`
- Output is self-contained except for Mermaid runtime if the implementation chooses CDN loading when diagrams are present
- If external Mermaid CDN loading is used, it must only be added when at least one Mermaid block exists

## Packaging

The npm package must include everything required to run the CLI after install.

- Ship executable CLI source in the published tarball
- Ship any CSS templates, HTML templates, and static assets needed for rendering
- Do not depend on repository-local files that are excluded from the published package
- Use the `files` field or equivalent packaging controls to ensure runtime assets are included
- `npm pack` should produce a tarball that can be installed and run without the source repository

## Browser opening

When not using `--output`, the CLI opens the generated page in the system default browser.

- macOS, Linux, and Windows behavior should be handled through a cross-platform npm package such as `open`, or equivalent native process launching
- The browser URL path must be a readable representation of the markdown file path relative to the current working directory whenever the target file is inside the current working directory
- Example: from cwd `/repo`, opening `/repo/docs/intro.md` should use a browser path like `/docs/intro.md` rather than an opaque temporary filename
- If the requested file is outside the current working directory, the implementation may fall back to another deterministic safe path representation, but should prefer human-readable segments over random identifiers
- URL path segments must be percent-encoded as needed for spaces and non-URL-safe characters
- Failure to open the browser should still leave the rendered file or local server available and print its path or URL to stderr

## Temporary files

- File mode should write generated HTML to the OS temporary directory unless `--output` is provided
- Temporary filenames should be unique enough to avoid collisions across concurrent runs
- Temporary files do not need automatic cleanup after the browser is opened unless explicitly implemented
