import * as path from "path";
import * as vscode from "vscode";

const VIEW_TYPE = "ericHaddan.markdownEditor";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new MarkdownEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.commands.registerCommand("ericHaddan.markdownEditor.open", async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) {
        void vscode.window.showInformationMessage("Open a Markdown file first.");
        return;
      }
      await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE);
    })
  );
}

export function deactivate(): void {}

class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const hugoContext = await findHugoContext(document.uri);
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
        vscode.Uri.file(path.dirname(document.uri.fsPath))
      ]
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, document, hugoContext);

    const sendDocument = (): void => {
      void webviewPanel.webview.postMessage({
        type: "documentChanged",
        text: document.getText()
      });
    };

    const documentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        sendDocument();
      }
    });

    webviewPanel.onDidDispose(() => documentSubscription.dispose());

    webviewPanel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isEditorMessage(message)) {
        return;
      }

      switch (message.type) {
        case "ready":
          sendDocument();
          break;
        case "edit":
          await this.applyEdit(document, message.text);
          break;
        case "save":
          await this.applyEdit(document, message.text);
          await document.save();
          break;
        case "pickImage":
          await this.pickImage(document, webviewPanel.webview);
          break;
        case "pickShortcodeFile":
          await this.pickShortcodeFile(document, webviewPanel.webview, message.field);
          break;
        case "resolveImages":
          await this.resolveImages(document, webviewPanel.webview, message.paths);
          break;
      }
    });
  }

  private async applyEdit(document: vscode.TextDocument, text: string): Promise<void> {
    if (text === document.getText()) {
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    const end = document.lineAt(document.lineCount - 1).range.end;
    edit.replace(document.uri, new vscode.Range(new vscode.Position(0, 0), end), text);
    await vscode.workspace.applyEdit(edit);
  }

  private async pickImage(document: vscode.TextDocument, webview: vscode.Webview): Promise<void> {
    const selection = await vscode.window.showOpenDialog({
      canSelectMany: false,
      defaultUri: vscode.Uri.file(path.dirname(document.uri.fsPath)),
      filters: {
        Images: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]
      },
      openLabel: "Insert Image"
    });

    if (!selection?.[0]) {
      return;
    }

    const documentDirectory = path.dirname(document.uri.fsPath);
    let relativePath = path.relative(documentDirectory, selection[0].fsPath).replace(/\\/g, "/");
    if (!relativePath.startsWith(".") && !relativePath.startsWith("/")) {
      relativePath = `./${relativePath}`;
    }

    const imageBytes = await vscode.workspace.fs.readFile(selection[0]);
    const previewUri = `data:${getImageMimeType(selection[0])};base64,${Buffer.from(imageBytes).toString("base64")}`;

    await webview.postMessage({
      type: "imageSelected",
      path: relativePath,
      previewUri
    });
  }

  private async pickShortcodeFile(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    field: string
  ): Promise<void> {
    const selection = await vscode.window.showOpenDialog({
      canSelectMany: false,
      defaultUri: vscode.Uri.file(path.dirname(document.uri.fsPath)),
      openLabel: "Use File"
    });

    if (!selection?.[0]) {
      return;
    }

    const documentDirectory = path.dirname(document.uri.fsPath);
    let relativePath = path.relative(documentDirectory, selection[0].fsPath).replace(/\\/g, "/");
    if (!relativePath.startsWith(".") && !relativePath.startsWith("/")) {
      relativePath = `./${relativePath}`;
    }

    await webview.postMessage({
      type: "shortcodeFileSelected",
      field,
      path: relativePath
    });
  }

  private async resolveImages(
    document: vscode.TextDocument,
    webview: vscode.Webview,
    paths: string[]
  ): Promise<void> {
    const previews = await Promise.all(paths.map(async (markdownPath) => {
      if (/^(?:data:|https?:\/\/)/i.test(markdownPath)) {
        return { path: markdownPath, previewUri: markdownPath };
      }

      try {
        const decodedPath = decodeURIComponent(markdownPath);
        const imageUri = vscode.Uri.file(path.resolve(path.dirname(document.uri.fsPath), decodedPath));
        const imageBytes = await vscode.workspace.fs.readFile(imageUri);
        return {
          path: markdownPath,
          previewUri: `data:${getImageMimeType(imageUri)};base64,${Buffer.from(imageBytes).toString("base64")}`
        };
      } catch {
        return { path: markdownPath, previewUri: "" };
      }
    }));

    await webview.postMessage({ type: "imagePreviews", previews });
  }

  private getHtml(webview: vscode.Webview, document: vscode.TextDocument, hugoContext?: HugoContext): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "editor.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "editor.css"));
    const nonce = getNonce();
    const documentBaseUri = webview.asWebviewUri(vscode.Uri.file(`${path.dirname(document.uri.fsPath)}${path.sep}`));
    const shortcodeData = JSON.stringify(hugoContext?.shortcodes ?? []).replace(/</g, "\\u003c");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <base href="${documentBaseUri}">
  <link rel="stylesheet" href="${styleUri}">
  <title>${escapeHtml(path.basename(document.uri.fsPath))}</title>
</head>
<body>
  <header class="topbar">
    <div class="mode-switch" role="group" aria-label="Editor mode">
      <button id="editMode" class="icon-button" type="button" title="Edit document" aria-label="Edit document">&#9998;</button>
      <button id="closeEditButton" class="icon-button hidden" type="button" title="Close editing" aria-label="Close editing">&#10005;</button>
      <button id="viewSourceMode" type="button">Plain Text</button>
      <button id="viewVisualMode" class="hidden" type="button">Visual</button>
      <button id="sourceMode" class="hidden" type="button">Plain Text</button>
      <button id="visualEditMode" class="hidden" type="button">Visual</button>
    </div>
    <div id="toolbar" class="toolbar hidden" role="toolbar" aria-label="Formatting">
      <select id="blockStyle" aria-label="Block style" title="Block style">
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
        <option value="blockquote">Quote</option>
        <option value="pre">Code Block</option>
      </select>
      <span class="divider"></span>
      <button class="icon-button" type="button" data-command="undo" title="Undo" aria-label="Undo">&#8630;</button>
      <button class="icon-button" type="button" data-command="redo" title="Redo" aria-label="Redo">&#8631;</button>
      <span class="divider"></span>
      <button class="icon-button" type="button" data-command="bold" title="Bold" aria-label="Bold"><strong>B</strong></button>
      <button class="icon-button" type="button" data-command="italic" title="Italic" aria-label="Italic"><em>I</em></button>
      <button class="icon-button" type="button" data-command="strikeThrough" title="Strikethrough" aria-label="Strikethrough"><s>S</s></button>
      <button class="icon-button" type="button" data-command="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">&#8226;&#8801;</button>
      <button class="icon-button" type="button" data-command="insertOrderedList" title="Numbered list" aria-label="Numbered list">1&#8801;</button>
      <button class="icon-button" type="button" data-command="insertHorizontalRule" title="Horizontal rule" aria-label="Horizontal rule">&#8212;</button>
      <button id="linkButton" class="icon-button" type="button" title="Insert link" aria-label="Insert link">&#128279;</button>
      <button id="imageButton" class="icon-button" type="button" title="Insert image" aria-label="Insert image">&#128444;</button>
      <button id="shortcodeButton" class="hidden" type="button" title="Insert Hugo shortcode">Shortcode</button>
    </div>
  </header>
  <main>
    <article id="visualEditor" class="editor visual-editor content markdown-body post-content" contenteditable="false" spellcheck="true" aria-label="Markdown document"></article>
    <textarea id="sourceEditor" class="editor source-editor hidden" spellcheck="false" aria-label="Plain text Markdown editor"></textarea>
  </main>
  <dialog id="linkDialog">
    <form method="dialog">
      <h2>Insert Link</h2>
      <label>Text<input id="linkText" type="text"></label>
      <label>URL<input id="linkUrl" type="url" placeholder="https://example.com" required></label>
      <label>Title<input id="linkTitle" type="text" placeholder="Optional tooltip"></label>
      <div class="dialog-actions">
        <button type="button" data-close-dialog>Cancel</button>
        <button id="insertLinkButton" type="submit">Insert Link</button>
      </div>
    </form>
  </dialog>
  <dialog id="imageDialog">
    <form method="dialog">
      <h2>Image Options</h2>
      <label>Alt text<input id="imageAlt" type="text" placeholder="Describe the image"></label>
      <label>Title<input id="imageTitle" type="text" placeholder="Optional tooltip"></label>
      <label>Width
        <select id="imageWidth">
          <option value="">Original / responsive</option>
          <option value="25%">25%</option>
          <option value="50%">50%</option>
          <option value="75%">75%</option>
          <option value="100%">100%</option>
        </select>
      </label>
      <label>Alignment
        <select id="imageAlign">
          <option value="">Inline</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <div class="dialog-actions">
        <button type="button" data-close-dialog>Cancel</button>
        <button id="insertImageButton" type="submit">Insert Image</button>
      </div>
    </form>
  </dialog>
  <dialog id="unsavedDialog">
    <form method="dialog">
      <h2>Save changes?</h2>
      <p>You have unsaved changes. Save them before returning to View mode?</p>
      <div class="dialog-actions">
        <button id="cancelCloseButton" type="button">Cancel</button>
        <button id="discardChangesButton" type="button">Discard</button>
        <button id="saveChangesButton" type="submit">Save</button>
      </div>
    </form>
  </dialog>
  <dialog id="shortcodeDialog">
    <form method="dialog">
      <h2 id="shortcodeDialogTitle">Insert Hugo Shortcode</h2>
      <label>Shortcode<select id="shortcodeSelect"></select></label>
      <div id="shortcodeFields" class="dynamic-fields"></div>
      <div class="dialog-actions">
        <button type="button" data-close-dialog>Cancel</button>
        <button id="insertShortcodeButton" type="submit">Insert Shortcode</button>
      </div>
    </form>
  </dialog>
  <div id="status" class="status">View mode</div>
  <script nonce="${nonce}">window.hugoShortcodes = ${shortcodeData};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

type EditorMessage =
  | { type: "ready" }
  | { type: "edit"; text: string }
  | { type: "save"; text: string }
  | { type: "pickImage" }
  | { type: "pickShortcodeFile"; field: string }
  | { type: "resolveImages"; paths: string[] };

function isEditorMessage(value: unknown): value is EditorMessage {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const message = value as { type: unknown; text?: unknown; paths?: unknown; field?: unknown };
  return message.type === "ready"
    || message.type === "pickImage"
    || (message.type === "pickShortcodeFile" && typeof message.field === "string")
    || (message.type === "edit" && typeof message.text === "string")
    || (message.type === "save" && typeof message.text === "string")
    || (message.type === "resolveImages"
      && Array.isArray(message.paths)
      && message.paths.every((item) => typeof item === "string"));
}

function getNonce(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function getImageMimeType(uri: vscode.Uri): string {
  switch (path.extname(uri.fsPath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

interface HugoContext {
  shortcodes: HugoShortcode[];
}

interface HugoShortcode {
  name: string;
  params: string[];
  positionalParams: string[];
  hasInner: boolean;
  template: string;
}

const HUGO_CONFIG_NAMES = [
  "hugo.toml",
  "hugo.yaml",
  "hugo.yml",
  "hugo.json",
  "config.toml",
  "config.yaml",
  "config.yml",
  "config.json",
  "config/_default/hugo.toml",
  "config/_default/hugo.yaml",
  "config/_default/hugo.yml",
  "config/_default/hugo.json"
];

async function findHugoContext(documentUri: vscode.Uri): Promise<HugoContext | undefined> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (!workspaceFolder || documentUri.scheme !== "file" || !vscode.workspace.isTrusted) {
    return undefined;
  }

  let directory = path.dirname(documentUri.fsPath);
  const workspaceRoot = workspaceFolder.uri.fsPath;
  while (isPathWithin(directory, workspaceRoot)) {
    const configUri = await findFirstExistingFile(directory, HUGO_CONFIG_NAMES);
    if (configUri) {
      const theme = await readHugoTheme(configUri);
      const rootUri = vscode.Uri.file(directory);
      return {
        shortcodes: await findHugoShortcodes(rootUri, theme)
      };
    }

    if (path.resolve(directory) === path.resolve(workspaceRoot)) {
      break;
    }
    directory = path.dirname(directory);
  }
  return undefined;
}

async function findFirstExistingFile(directory: string, filenames: string[]): Promise<vscode.Uri | undefined> {
  for (const filename of filenames) {
    const uri = vscode.Uri.file(path.join(directory, filename));
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.File) {
        return uri;
      }
    } catch {
      // Continue searching for another supported Hugo config filename.
    }
  }
  return undefined;
}

async function readHugoTheme(configUri: vscode.Uri): Promise<string | undefined> {
  try {
    const config = Buffer.from(await vscode.workspace.fs.readFile(configUri)).toString("utf8");
    const match = config.match(/(?:^|\n)\s*theme\s*(?:=|:)\s*["']?([^"'\r\n#]+)["']?/i);
    return match?.[1].trim().replace(/[\],]$/, "");
  } catch {
    return undefined;
  }
}

async function findHugoShortcodes(rootUri: vscode.Uri, theme?: string): Promise<HugoShortcode[]> {
  const patterns = [
    ...(theme ? [`themes/${theme}/layouts/shortcodes/**/*.html`] : []),
    "layouts/shortcodes/**/*.html"
  ];
  const files = (await Promise.all(patterns.map((pattern) =>
    vscode.workspace.findFiles(new vscode.RelativePattern(rootUri, pattern), "**/node_modules/**", 80)
  ))).flat();

  const definitions = await Promise.all(files.map(async (uri) => {
    const template = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    const normalizedPath = uri.fsPath.replace(/\\/g, "/");
    const marker = "/layouts/shortcodes/";
    const name = normalizedPath.slice(normalizedPath.lastIndexOf(marker) + marker.length).replace(/\.html$/, "");
    const params = [...template.matchAll(/\.Get\s+["']([^"']+)["']/g)].map((match) => match[1]);
    params.push(...[...template.matchAll(/\.Params\.([A-Za-z][\w-]*)/g)].map((match) => match[1]));
    params.push(...[...template.matchAll(/index\s+\.Params\s+["']([^"']+)["']/g)].map((match) => match[1]));
    const positionalParams = [...template.matchAll(/\.Get\s+(\d+)/g)].map((match) => match[1]);
    return {
      name,
      params: [...new Set(params)].sort(),
      positionalParams: [...new Set(positionalParams)].sort((left, right) => Number(left) - Number(right)),
      hasInner: /\.Inner\b/.test(template),
      template
    };
  }));

  const byName = new Map<string, HugoShortcode>();
  for (const definition of definitions) {
    byName.set(definition.name, definition);
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function isPathWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
