(function () {
  const vscode = acquireVsCodeApi();
  const visualEditor = document.getElementById("visualEditor");
  const sourceEditor = document.getElementById("sourceEditor");
  const editMode = document.getElementById("editMode");
  const closeEditButton = document.getElementById("closeEditButton");
  const viewSourceMode = document.getElementById("viewSourceMode");
  const viewVisualMode = document.getElementById("viewVisualMode");
  const sourceMode = document.getElementById("sourceMode");
  const visualEditMode = document.getElementById("visualEditMode");
  const toolbar = document.getElementById("toolbar");
  const blockStyle = document.getElementById("blockStyle");
  const linkButton = document.getElementById("linkButton");
  const imageButton = document.getElementById("imageButton");
  const shortcodeButton = document.getElementById("shortcodeButton");
  const linkDialog = document.getElementById("linkDialog");
  const linkText = document.getElementById("linkText");
  const linkUrl = document.getElementById("linkUrl");
  const linkTitle = document.getElementById("linkTitle");
  const imageDialog = document.getElementById("imageDialog");
  const imageAlt = document.getElementById("imageAlt");
  const imageTitle = document.getElementById("imageTitle");
  const imageWidth = document.getElementById("imageWidth");
  const imageAlign = document.getElementById("imageAlign");
  const insertImageButton = document.getElementById("insertImageButton");
  const unsavedDialog = document.getElementById("unsavedDialog");
  const cancelCloseButton = document.getElementById("cancelCloseButton");
  const discardChangesButton = document.getElementById("discardChangesButton");
  const shortcodeDialog = document.getElementById("shortcodeDialog");
  const shortcodeSelect = document.getElementById("shortcodeSelect");
  const shortcodeFields = document.getElementById("shortcodeFields");
  const status = document.getElementById("status");
  const hugoShortcodes = Array.isArray(window.hugoShortcodes) ? window.hugoShortcodes : [];

  let mode = "view";
  let currentMarkdown = "";
  let savedMarkdown = "";
  let draftDirty = false;
  let applyingExternalChange = false;
  let savedRange;
  let pendingImage;
  let editingImage;
  let frontMatter = "";

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inlineMarkdown(value) {
    let output = escapeHtml(value);
    output = output.replace(
      /\{\{(?:&lt;|%)\s*\/?[^{}]*?\s*(?:&gt;|%)\}\}/g,
      (shortcode) => {
        const label = shortcode
          .replace(/&lt;|&gt;|%|\{\{|}}|\//g, "")
          .trim()
          .split(/\s+/)[0] || "shortcode";
        return `<span class="hugo-shortcode" contenteditable="false" data-shortcode-markup="${shortcode}">Hugo shortcode: ${label}</span>`;
      }
    );
    output = output.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*?)&quot;)?\)(?:\{([^}]*)\})?/g,
      (_match, alt, imagePath, title, attributes) => {
        const width = attributes?.match(/(?:^|\s)width=([^\s]+)/)?.[1] || "";
        const align = attributes?.match(/(?:^|\s)align=([^\s]+)/)?.[1] || "";
        return `<img src="${imagePath}" alt="${alt}" title="${title || ""}" data-markdown-path="${imagePath}" data-width="${width}" data-align="${align}"${width ? ` style="width:${width}"` : ""}>`;
      }
    );
    output = output.replace(
      /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*?)&quot;)?\)/g,
      (_match, text, href, title) => `<a href="${href}"${title ? ` title="${title}"` : ""}>${text}</a>`
    );
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    output = output.replace(/~~([^~]+)~~/g, "<s>$1</s>");
    output = output.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    output = output.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
    return output;
  }

  function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listType = "";
    let inCode = false;
    let codeLines = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };
    const closeList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = "";
      }
    };

    for (const line of lines) {
      if (line.startsWith("```")) {
        flushParagraph();
        closeList();
        if (inCode) {
          html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          codeLines = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        closeList();
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
      const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
      const quote = line.match(/^>\s?(.*)$/);
      const rule = line.match(/^\s*(---+|\*\*\*+|___+)\s*$/);

      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      } else if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          html.push(`<${listType}>`);
        }
        html.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      } else if (quote) {
        flushParagraph();
        closeList();
        html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      } else if (rule) {
        flushParagraph();
        closeList();
        html.push("<hr>");
      } else {
        closeList();
        paragraph.push(line);
      }
    }

    if (inCode) {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }
    flushParagraph();
    closeList();
    return html.join("\n") || "<p><br></p>";
  }

  function splitFrontMatter(markdown) {
    const normalized = markdown.replace(/\r\n/g, "\n");
    const delimiter = normalized.startsWith("---\n") ? "---" : normalized.startsWith("+++\n") ? "+++" : "";
    if (!delimiter) return { frontMatter: "", body: markdown };

    const closingIndex = normalized.indexOf(`\n${delimiter}\n`, delimiter.length + 1);
    if (closingIndex < 0) return { frontMatter: "", body: markdown };
    const end = closingIndex + delimiter.length + 2;
    return {
      frontMatter: normalized.slice(0, end),
      body: normalized.slice(end)
    };
  }

  function renderVisual(markdown) {
    const parts = splitFrontMatter(markdown);
    frontMatter = parts.frontMatter;
    visualEditor.innerHTML = markdownToHtml(parts.body);
    refreshImagePreviews();
  }

  function refreshImagePreviews() {
    const paths = Array.from(visualEditor.querySelectorAll("img[data-markdown-path]"))
      .map((image) => image.dataset.markdownPath)
      .filter((imagePath) => Boolean(imagePath));
    if (paths.length) {
      vscode.postMessage({ type: "resolveImages", paths: [...new Set(paths)] });
    }
  }

  function inlineToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node;
    const content = Array.from(element.childNodes).map(inlineToMarkdown).join("");
    switch (element.tagName.toLowerCase()) {
      case "strong":
      case "b":
        return `**${content}**`;
      case "em":
      case "i":
        return `*${content}*`;
      case "s":
      case "strike":
        return `~~${content}~~`;
      case "code":
        return `\`${content}\``;
      case "a":
        return `[${content}](${element.getAttribute("href") || ""}${element.getAttribute("title") ? ` "${element.getAttribute("title")}"` : ""})`;
      case "img":
        {
          const title = element.getAttribute("title");
          const attributes = [
            element.dataset.width ? `width=${element.dataset.width}` : "",
            element.dataset.align ? `align=${element.dataset.align}` : ""
          ].filter(Boolean).join(" ");
          return `![${element.getAttribute("alt") || ""}](${element.dataset.markdownPath || element.getAttribute("src") || ""}${title ? ` "${title}"` : ""})${attributes ? `{${attributes}}` : ""}`;
        }
      case "span":
        if (element.classList.contains("hugo-shortcode")) {
          return element.dataset.shortcodeMarkup || "";
        }
        return content;
      case "br":
        return "\n";
      default:
        return content;
    }
  }

  function htmlToMarkdown() {
    const blocks = [];
    for (const node of visualEditor.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) blocks.push(text);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toLowerCase();
      const content = inlineToMarkdown(node).trim();
      if (/^h[1-6]$/.test(tag)) {
        blocks.push(`${"#".repeat(Number(tag[1]))} ${content}`);
      } else if (tag === "blockquote") {
        blocks.push(content.split("\n").map((line) => `> ${line}`).join("\n"));
      } else if (tag === "pre") {
        blocks.push(`\`\`\`\n${node.textContent || ""}\n\`\`\``);
      } else if (tag === "ul" || tag === "ol") {
        const items = Array.from(node.children).map((item, index) => {
          const marker = tag === "ul" ? "-" : `${index + 1}.`;
          return `${marker} ${inlineToMarkdown(item).trim()}`;
        });
        blocks.push(items.join("\n"));
      } else if (tag === "hr") {
        blocks.push("---");
      } else if (tag === "div") {
        blocks.push(content);
      } else if (content || tag === "p") {
        blocks.push(content);
      }
    }
    const body = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n");
    return frontMatter ? `${frontMatter}${body}` : body;
  }

  function scheduleEdit(markdown) {
    currentMarkdown = markdown;
    draftDirty = currentMarkdown !== savedMarkdown;
    status.textContent = `${mode === "edit" ? "Edit" : "Plain text"} mode${draftDirty ? " | Unsaved changes" : ""}`;
  }

  function setMode(nextMode) {
    if (nextMode === mode) return;

    const location = captureEditorLocation();
    if (nextMode === "edit" && (mode === "view" || mode === "view-source")) {
      currentMarkdown = savedMarkdown;
      draftDirty = false;
    }
    if (nextMode === "source" || nextMode === "view-source") {
      if (mode === "edit") {
        currentMarkdown = htmlToMarkdown();
      }
      if (nextMode === "view-source") {
        currentMarkdown = savedMarkdown;
      }
      sourceEditor.value = currentMarkdown;
    } else {
      if (mode === "source") {
        currentMarkdown = sourceEditor.value;
      }
      renderVisual(currentMarkdown);
    }

    mode = nextMode;
    const isView = mode === "view" || mode === "view-source";
    const isVisualView = mode === "view";
    const isEdit = mode === "edit";
    const isSource = mode === "source" || mode === "view-source";
    const isViewSource = mode === "view-source";

    visualEditor.classList.toggle("hidden", isSource);
    sourceEditor.classList.toggle("hidden", !isSource);
    sourceEditor.readOnly = isViewSource;
    visualEditor.contentEditable = isEdit ? "true" : "false";
    toolbar.classList.toggle("hidden", !isEdit);
    editMode.classList.toggle("hidden", !isView);
    closeEditButton.classList.toggle("hidden", isView);
    viewSourceMode.classList.toggle("hidden", !isVisualView);
    viewVisualMode.classList.toggle("hidden", !isViewSource);
    sourceMode.classList.toggle("hidden", !isEdit);
    visualEditMode.classList.toggle("hidden", !isSource || isViewSource);
    viewSourceMode.classList.toggle("active", isViewSource);
    viewVisualMode.classList.toggle("active", isVisualView);
    sourceMode.classList.toggle("active", isSource);
    visualEditMode.classList.toggle("active", isEdit);
    status.textContent = `${isView ? isViewSource ? "View plain text" : "View" : isEdit ? "Edit" : "Plain text"} mode${!isView && draftDirty ? " | Unsaved changes" : ""}`;
    (isSource ? sourceEditor : visualEditor).focus();
    restoreEditorLocation(location, isSource);
  }

  function draftMarkdown() {
    return mode === "edit" ? htmlToMarkdown() : sourceEditor.value;
  }

  function returnToView(markdown) {
    currentMarkdown = markdown;
    draftDirty = false;
    sourceEditor.value = markdown;
    mode = "source";
    setMode("view");
  }

  function requestCloseEditing() {
    currentMarkdown = draftMarkdown();
    if (!draftDirty || currentMarkdown === savedMarkdown) {
      returnToView(savedMarkdown);
      return;
    }
    unsavedDialog.showModal();
  }

  function runCommand(command, value) {
    visualEditor.focus();
    document.execCommand(command, false, value);
    scheduleEdit(htmlToMarkdown());
  }

  function selectionRangeInsideVisualEditor() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (container === visualEditor || visualEditor.contains(container)) {
      return range.cloneRange();
    }
    return null;
  }

  function rangeInsideVisualEditor(range) {
    if (!range) return false;
    const container = range.commonAncestorContainer;
    return container === visualEditor || visualEditor.contains(container);
  }

  function restoreSavedRange() {
    if (!rangeInsideVisualEditor(savedRange)) return null;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return selection.getRangeAt(0);
  }

  function captureEditorLocation() {
    if (mode === "source" || mode === "view-source") {
      const length = Math.max(sourceEditor.value.length, 1);
      const scrollRange = Math.max(sourceEditor.scrollHeight - sourceEditor.clientHeight, 1);
      return {
        progress: sourceEditor.selectionStart / length,
        scrollProgress: sourceEditor.scrollTop / scrollRange
      };
    }

    const range = selectionRangeInsideVisualEditor();
    const before = document.createRange();
    before.selectNodeContents(visualEditor);
    if (range) before.setEnd(range.startContainer, range.startOffset);
    const textLength = Math.max(visualEditor.textContent.length, 1);
    const scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    return {
      progress: range ? before.toString().length / textLength : window.scrollY / scrollRange,
      scrollProgress: window.scrollY / scrollRange
    };
  }

  function restoreEditorLocation(location, isSource) {
    requestAnimationFrame(() => {
      if (isSource) {
        const offset = Math.round(location.progress * sourceEditor.value.length);
        sourceEditor.setSelectionRange(offset, offset);
        const scrollRange = Math.max(sourceEditor.scrollHeight - sourceEditor.clientHeight, 0);
        sourceEditor.scrollTop = location.scrollProgress * scrollRange;
        return;
      }

      const targetOffset = Math.round(location.progress * visualEditor.textContent.length);
      const walker = document.createTreeWalker(visualEditor, NodeFilter.SHOW_TEXT);
      let remaining = targetOffset;
      let targetNode;
      while (walker.nextNode()) {
        targetNode = walker.currentNode;
        if (remaining <= targetNode.textContent.length) break;
        remaining -= targetNode.textContent.length;
      }
      if (targetNode) {
        const range = document.createRange();
        range.setStart(targetNode, Math.min(remaining, targetNode.textContent.length));
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      const scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      window.scrollTo(0, location.scrollProgress * scrollRange);
    });
  }

  function openImageDialog(image) {
    editingImage = image || null;
    insertImageButton.textContent = editingImage ? "Save Changes" : "Insert Image";
    imageAlt.value = image?.getAttribute("alt") || "";
    imageTitle.value = image?.getAttribute("title") || "";
    imageWidth.value = image?.dataset.width || "";
    imageAlign.value = image?.dataset.align || "";
    imageDialog.showModal();
    imageAlt.focus();
  }

  function buildShortcodeFields() {
    const shortcode = hugoShortcodes.find((item) => item.name === shortcodeSelect.value);
    shortcodeFields.replaceChildren();
    if (!shortcode) return;

    for (const position of shortcode.positionalParams) {
      shortcodeFields.appendChild(createShortcodeField(`Argument ${Number(position) + 1}`, `position-${position}`));
    }
    for (const param of shortcode.params) {
      shortcodeFields.appendChild(createShortcodeField(param, `param-${param}`));
    }
    if (shortcode.hasInner) {
      const label = document.createElement("label");
      label.textContent = "Inner content";
      const textarea = document.createElement("textarea");
      textarea.dataset.shortcodeInner = "true";
      textarea.rows = 5;
      label.appendChild(textarea);
      shortcodeFields.appendChild(label);
    }
    if (!shortcode.params.length && !shortcode.positionalParams.length && !shortcode.hasInner) {
      const note = document.createElement("p");
      note.className = "dialog-note";
      note.textContent = "This shortcode has no detected properties.";
      shortcodeFields.appendChild(note);
    }
  }

  function createShortcodeField(labelText, key) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.shortcodeField = key;
    label.appendChild(input);
    return label;
  }

  function escapeShortcodeValue(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function buildShortcodeMarkup() {
    const shortcode = hugoShortcodes.find((item) => item.name === shortcodeSelect.value);
    if (!shortcode) return "";

    const argumentsList = [];
    const positionalValues = [];
    for (const input of shortcodeFields.querySelectorAll("[data-shortcode-field]")) {
      const value = input.value.trim();
      const key = input.dataset.shortcodeField;
      if (key.startsWith("position-")) {
        positionalValues[Number(key.slice("position-".length))] = value;
      } else if (value) {
        argumentsList.push(`${key.slice("param-".length)}="${escapeShortcodeValue(value)}"`);
      }
    }
    while (positionalValues.length && !positionalValues.at(-1)) positionalValues.pop();
    argumentsList.unshift(...positionalValues.map((value) => `"${escapeShortcodeValue(value || "")}"`));
    const opening = `{{< ${shortcode.name}${argumentsList.length ? ` ${argumentsList.join(" ")}` : ""} >}}`;
    const inner = shortcodeFields.querySelector("[data-shortcode-inner]")?.value || "";
    return shortcode.hasInner ? `${opening}\n${inner}\n{{< /${shortcode.name} >}}` : opening;
  }

  editMode.addEventListener("click", () => setMode("edit"));
  closeEditButton.addEventListener("click", requestCloseEditing);
  viewSourceMode.addEventListener("click", () => setMode("view-source"));
  viewVisualMode.addEventListener("click", () => setMode("view"));
  sourceMode.addEventListener("click", () => setMode("source"));
  visualEditMode.addEventListener("click", () => setMode("edit"));
  sourceEditor.addEventListener("input", () => {
    if (mode === "source") scheduleEdit(sourceEditor.value);
  });
  visualEditor.addEventListener("input", () => {
    if (!applyingExternalChange) scheduleEdit(htmlToMarkdown());
  });
  visualEditor.addEventListener("contextmenu", (event) => {
    if (mode !== "edit") return;
    const image = event.target.closest?.("img[data-markdown-path]");
    if (!image) return;
    event.preventDefault();
    savedRange = null;
    pendingImage = null;
    openImageDialog(image);
  });

  toolbar.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => runCommand(button.dataset.command));
  });
  blockStyle.addEventListener("change", () => runCommand("formatBlock", blockStyle.value));
  linkButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    savedRange = selectionRangeInsideVisualEditor();
  });
  linkButton.addEventListener("click", () => {
    linkText.value = savedRange?.toString() || "";
    linkUrl.value = "";
    linkTitle.value = "";
    linkDialog.showModal();
    linkUrl.focus();
  });
  linkDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = linkUrl.value.trim();
    if (!url) return;

    visualEditor.focus();
    const range = restoreSavedRange();
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.textContent = linkText.value.trim() || url;
    if (linkTitle.value.trim()) anchor.title = linkTitle.value.trim();
    if (range) {
      range.deleteContents();
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
    } else {
      visualEditor.appendChild(anchor);
    }
    savedRange = null;
    linkDialog.close();
    scheduleEdit(htmlToMarkdown());
  });
  imageButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    savedRange = selectionRangeInsideVisualEditor();
  });
  imageButton.addEventListener("click", () => {
    vscode.postMessage({ type: "pickImage" });
  });
  shortcodeButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
    savedRange = selectionRangeInsideVisualEditor();
  });
  shortcodeButton.addEventListener("click", () => {
    buildShortcodeFields();
    shortcodeDialog.showModal();
  });
  shortcodeSelect.addEventListener("change", buildShortcodeFields);
  shortcodeDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const markup = buildShortcodeMarkup();
    if (!markup) return;

    visualEditor.focus();
    const range = restoreSavedRange();
    const placeholder = document.createElement("span");
    placeholder.className = "hugo-shortcode";
    placeholder.contentEditable = "false";
    placeholder.dataset.shortcodeMarkup = markup;
    placeholder.textContent = `Hugo shortcode: ${shortcodeSelect.value}`;
    if (range) {
      range.deleteContents();
      range.insertNode(placeholder);
      range.setStartAfter(placeholder);
      range.collapse(true);
    } else {
      visualEditor.appendChild(placeholder);
    }
    savedRange = null;
    shortcodeDialog.close();
    scheduleEdit(htmlToMarkdown());
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "documentChanged" && message.text !== savedMarkdown) {
      applyingExternalChange = true;
      savedMarkdown = message.text;
      if (mode === "view" || mode === "view-source") {
        currentMarkdown = savedMarkdown;
        draftDirty = false;
        sourceEditor.value = currentMarkdown;
        if (mode === "view") renderVisual(currentMarkdown);
      }
      applyingExternalChange = false;
    } else if (message.type === "imageSelected") {
      pendingImage = message;
      openImageDialog(null);
    } else if (message.type === "imagePreviews") {
      for (const preview of message.previews) {
        if (!preview.previewUri) continue;
        for (const image of visualEditor.querySelectorAll("img[data-markdown-path]")) {
          if (image.dataset.markdownPath === preview.path) {
            image.src = preview.previewUri;
          }
        }
      }
    }
  });

  imageDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pendingImage && !editingImage) return;

    visualEditor.focus();
    const range = editingImage ? null : restoreSavedRange();
    const image = editingImage || document.createElement("img");
    if (pendingImage) {
      image.src = pendingImage.previewUri;
      image.dataset.markdownPath = pendingImage.path;
    }
    image.alt = imageAlt.value.trim();
    if (imageTitle.value.trim()) {
      image.title = imageTitle.value.trim();
    } else {
      image.removeAttribute("title");
    }
    if (imageWidth.value) {
      image.dataset.width = imageWidth.value;
      image.style.width = imageWidth.value;
    } else {
      delete image.dataset.width;
      image.style.removeProperty("width");
    }
    if (imageAlign.value) {
      image.dataset.align = imageAlign.value;
    } else {
      delete image.dataset.align;
    }
    if (!editingImage && range) {
      range.deleteContents();
      range.insertNode(image);
      range.setStartAfter(image);
      range.collapse(true);
    } else if (!editingImage) {
      visualEditor.appendChild(image);
    }
    pendingImage = null;
    editingImage = null;
    savedRange = null;
    imageDialog.close();
    scheduleEdit(htmlToMarkdown());
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      pendingImage = null;
      editingImage = null;
      button.closest("dialog").close();
    });
  });

  if (hugoShortcodes.length) {
    shortcodeButton.classList.remove("hidden");
    for (const shortcode of hugoShortcodes) {
      const option = document.createElement("option");
      option.value = shortcode.name;
      option.textContent = shortcode.name;
      shortcodeSelect.appendChild(option);
    }
  }

  unsavedDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    currentMarkdown = draftMarkdown();
    savedMarkdown = currentMarkdown;
    vscode.postMessage({ type: "save", text: currentMarkdown });
    unsavedDialog.close();
    returnToView(currentMarkdown);
  });
  cancelCloseButton.addEventListener("click", () => unsavedDialog.close());
  discardChangesButton.addEventListener("click", () => {
    unsavedDialog.close();
    returnToView(savedMarkdown);
  });

  vscode.postMessage({ type: "ready" });
})();
