# Change Log

## 0.8.5

- Repositioned Marketplace branding around general Markdown editing with optional
  Hugo support.
- Updated display names, description, keywords, and README ordering.

## 0.8.4

- Updated Marketplace branding, description, categories, and search keywords for
  Markdown and Hugo discovery.
- Added repository, homepage, issue tracker, and Q&A links.
- Expanded Marketplace documentation for current Markdown and Hugo features.

## 0.8.3

- Added language-aware visual syntax highlighting for fenced code blocks.
- Preserved fenced-code language identifiers when switching modes and saving.

## 0.8.2

- Added active/depressed toolbar states for bold, italic, strikethrough, and lists.

## 0.8.1

- Added automatic Block Style detection based on the WYSIWYG caret position.

## 0.8.0

- Added editable GitHub-style pipe tables with alignment preservation.
- Added a WYSIWYG table insertion tool.
- Added shortcode-property autocomplete in plain-text edit mode.

## 0.7.9

- Made the shortcode hover inspector opt-in through VS Code settings.
- Improved dark-mode rendering with transparent shortcode wrappers.

## 0.7.8

- Added matched theme CSS rule diagnostics to the shortcode inspector.
- Increased supported theme stylesheet size limits.

## 0.7.7

- Added an interactive shortcode inspector for generated HTML and computed CSS.

## 0.7.6

- Added Hugo theme CSS loading scoped to rendered shortcode previews.
- Added Markdown syntax highlighting and shortcode autocomplete in plain-text mode.
- Removed shortcode bounding rectangles from display mode.

## 0.7.5

- Removed generated HTML display when hovering over rendered shortcodes.

## 0.7.4

- Added Hugo-root and Hugo-static fallback resolution for shortcode-generated local images.
- Added visible unresolved-image diagnostics when a local image cannot be found.

## 0.7.3

- Added local image preview resolution for images generated inside rendered shortcodes.
- Preserved original shortcode HTML and paths while replacing only the on-screen image source.

## 0.7.2

- Added shortcode variable assignment and default-value evaluation.
- Added support for simple `if ne ... end` blocks in shortcode previews.
- Protected generated shortcode HTML from Markdown inline formatting.

## 0.7.1

- Replaced shortcode HTML hover text with an interactive, scrollable hover panel.
- Kept the generated HTML panel open while moving the pointer onto it.

## 0.7.0

- Added generated HTML hover details for rendered shortcodes.
- Limited Hugo project-root integration to shortcode discovery only.
- Removed project/theme stylesheet loading, Hugo static image resolution, and the Hugo project badge.

## 0.6.0

- Added best-effort visual rendering of Hugo shortcode templates.
- Added right-click editing for existing shortcode properties.
- Added local file browsing for shortcode properties named `src`.

## 0.5.0

- Added Hugo shortcode discovery from project and active-theme `layouts/shortcodes` folders.
- Added a dynamic Insert Shortcode dialog with detected named, positional, and inner-content fields.
- Added visual shortcode placeholders that preserve Hugo shortcode markup.

## 0.4.0

- Added a read-only Plain Text toggle in View mode.
- Preserved caret and scroll-location synchronization between both read-only views.

## 0.3.0

- Added automatic Hugo project detection in trusted workspaces.
- Added project and active-theme CSS loading from Hugo `static` and `assets` folders.
- Added Hugo `static` resolution for root-relative image paths.
- Added visual front-matter hiding with source preservation.

## 0.2.0

- Added right-click editing for existing image settings.
- Added a context-aware **Save Changes** action when editing an image.
- Added approximate caret and scroll-position synchronization between visual and plain-text modes.

## 0.1.0

- Initial release with read-only viewing and draft-based visual editing.
- Added visual and plain-text editing modes.
- Added formatting toolbar, links, and configurable relative image insertion.
- Added save, discard, and cancel handling when closing Edit mode.
