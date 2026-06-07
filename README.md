# Markdown Reader & WYSIWYG Editor

A VS Code extension by **Eric Haddan** for reading and editing Markdown files in either a visual WYSIWYG editor or plain-text Markdown.

## Features

- Open Markdown in a read-only **View** mode by default.
- Click the pencil button to begin editing, then close editing to save or discard the draft.
- Format headings from level 1 through 6.
- Apply bold, italic, strikethrough, quotes, code blocks, links, lists, and horizontal rules.
- Insert links with text, URL, and optional tooltip title.
- Select an image file and insert it using a relative path, with alt text, title, width, and alignment options.
- Keep the underlying document as portable Markdown.

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
