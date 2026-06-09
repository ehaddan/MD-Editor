# Change Log

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
