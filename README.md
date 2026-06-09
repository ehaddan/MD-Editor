# Markdown Reader & WYSIWYG Editor

A VS Code extension by **Eric Haddan** for reading and editing Markdown files in either a visual WYSIWYG editor or plain-text Markdown.

## Features

- Open Markdown in a read-only **View** mode by default.
- Toggle between read-only visual and plain-text views without entering Edit mode.
- Click the pencil button to begin editing, then close editing to save or discard the draft.
- Format headings from level 1 through 6.
- Apply bold, italic, strikethrough, quotes, code blocks, links, lists, and horizontal rules.
- Insert links with text, URL, and optional tooltip title.
- Select an image file and insert it using a relative path, with alt text, title, width, and alignment options.
- Right-click an image while editing to reopen and change its image settings.
- Preserve the approximate caret and scroll location when switching between visual and plain-text editing.
- Keep the underlying document as portable Markdown.

## Hugo Projects

When a Markdown file is inside a trusted Hugo workspace, the editor automatically
detects the nearest standard Hugo configuration file solely to support shortcode
discovery.

- Discovers shortcodes from project and active-theme `layouts/shortcodes` folders.
- Adds an **Insert Shortcode** tool with detected properties for named, positional, and inner-content values.
- Renders a best-effort visual preview for simple shortcode templates.
- Right-clicks rendered shortcodes to reopen and edit their dynamic properties.
- Adds a file browser for shortcode properties named `src`, inserting a path relative to the Markdown file.
- Resolves shortcode-generated local images against the Markdown file, Hugo root, and Hugo `static` folder.
- Displays an unresolved-image diagnostic when a shortcode image file cannot be found.

This built-in preview does not run Hugo or compile Sass. Shortcode previews
substitute common parameters into their templates without executing Go template
logic, so complex shortcode rendering may differ from the generated site. The
extension does not load project styles or project elements; it reads only
shortcode definitions and local images referenced by rendered shortcodes.

## Usage

Open a `.md` or `.markdown` file. The rendered document opens in read-only **View** mode. Click **Edit** to make changes, then use the mode buttons at the top to switch views.

To use VS Code's built-in text editor instead, run **Reopen Editor With...** from the Command Palette and choose **Text Editor**.

## Development

```sh
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.

## Privacy

This extension does not collect or transmit telemetry or personal information.
The packaged extension includes the full privacy statement in `PRIVACY.md`.
