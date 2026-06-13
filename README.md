# Markdown WYSIWYG Editor with Hugo Support

A visual and plain-text Markdown editor for VS Code. Read and edit any `.md` or
`.markdown` file while keeping the underlying document as portable Markdown.
Optional Hugo project integration adds shortcode discovery, visual previews,
theme CSS support, and autocomplete.

## Markdown Editing

- Opens `.md` and `.markdown` files in a clean read-only visual view by default.
- Switches between visual and syntax-highlighted plain-text views.
- Provides draft-based WYSIWYG editing with save and discard confirmation.
- Preserves approximate caret and scroll position when switching views.
- Keeps toolbar block styles and inline-format buttons synchronized with the caret.
- Supports headings, bold, italic, strikethrough, quotes, lists, links, images,
  horizontal rules, fenced code blocks, and GitHub-style pipe tables.
- Highlights fenced code using its language identifier while preserving the fence.
- Inserts relative-path images with alt text, titles, width, and alignment options.
- Reopens image settings by right-clicking an image in visual edit mode.

## Hugo Support

No Hugo project is required. When the current Markdown file belongs to a trusted
Hugo workspace, the editor additionally:

- Discovers custom shortcodes from project and theme `layouts/shortcodes` folders.
- Autocompletes standard and custom shortcode names in plain-text edit mode.
- Autocompletes detected shortcode properties and inserts `property=""`.
- Provides a dynamic visual dialog for named, positional, and inner-content values.
- Adds a local file picker for shortcode properties named `src`.
- Renders best-effort visual previews for shortcode templates.
- Lets you right-click a rendered shortcode to edit its properties.
- Resolves shortcode images against the Markdown file, Hugo root, and `static` folder.
- Scans theme CSS files and applies matching styles only to rendered shortcodes.
- Provides an optional hover inspector for generated HTML, computed CSS, and
  matched theme CSS rules.

Enable the debugging inspector with the VS Code setting:

```json
"ericHaddan.markdownEditor.enableShortcodeInspector": true
```

Shortcode previews support common parameter substitutions, defaults, and simple
conditional templates. They do not execute Hugo or compile Sass, so complex Go
template logic may render differently from the generated site.

## Tables And Code

GitHub-style pipe tables render as editable visual tables and convert back to
Markdown when saving or switching modes. Column alignment and escaped pipes are
preserved.

Fenced code blocks recognize their language identifier, apply visual syntax
highlighting, and preserve the language when converting back to Markdown.

## Usage

Open a `.md` or `.markdown` file. Click the pencil button to begin editing, then
use the toolbar or switch between Visual and Plain Text modes. Close editing to
save or discard the draft.

To use VS Code's built-in text editor, run **Reopen Editor With...** and choose
**Text Editor**.

## Support

Report issues and request features at
[github.com/ehaddan/MD-Editor/issues](https://github.com/ehaddan/MD-Editor/issues).

## Development

```sh
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.

## Privacy

This extension does not collect or transmit telemetry or personal information.
See [PRIVACY.md](PRIVACY.md) for details.
