(function () {
  const vscode = acquireVsCodeApi();
  const visualEditor = document.getElementById("visualEditor");
  const sourceContainer = document.getElementById("sourceContainer");
  const sourceHighlight = document.getElementById("sourceHighlight");
  const sourceEditor = document.getElementById("sourceEditor");
  const shortcodeAutocomplete = document.getElementById("shortcodeAutocomplete");
  const editMode = document.getElementById("editMode");
  const closeEditButton = document.getElementById("closeEditButton");
  const viewSourceMode = document.getElementById("viewSourceMode");
  const viewVisualMode = document.getElementById("viewVisualMode");
  const sourceMode = document.getElementById("sourceMode");
  const visualEditMode = document.getElementById("visualEditMode");
  const toolbar = document.getElementById("toolbar");
  const blockStyle = document.getElementById("blockStyle");
  const tableButton = document.getElementById("tableButton");
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
  const shortcodeDialogTitle = document.getElementById("shortcodeDialogTitle");
  const shortcodeSelect = document.getElementById("shortcodeSelect");
  const shortcodeFields = document.getElementById("shortcodeFields");
  const insertShortcodeButton = document.getElementById("insertShortcodeButton");
  const shortcodeInspector = document.getElementById("shortcodeInspector");
  const shortcodeInspectorTitle = document.getElementById("shortcodeInspectorTitle");
  const shortcodeInspectorHtml = document.getElementById("shortcodeInspectorHtml");
  const shortcodeInspectorCssTitle = document.getElementById("shortcodeInspectorCssTitle");
  const shortcodeInspectorCss = document.getElementById("shortcodeInspectorCss");
  const shortcodeInspectorRules = document.getElementById("shortcodeInspectorRules");
  const closeShortcodeInspector = document.getElementById("closeShortcodeInspector");
  const status = document.getElementById("status");
  const hugoShortcodes = Array.isArray(window.hugoShortcodes) ? window.hugoShortcodes : [];
  const hugoThemeStyles = Array.isArray(window.hugoThemeStyles) ? window.hugoThemeStyles : [];
  let shortcodeInspectorEnabled = window.shortcodeInspectorEnabled === true;
  const standardShortcodes = [
    { name: "figure", params: ["src", "link", "target", "rel", "alt", "title", "caption", "class", "height", "width", "loading"], positionalParams: [], hasInner: false, standard: true },
    { name: "gist", params: [], positionalParams: ["0", "1"], hasInner: false, standard: true },
    { name: "highlight", params: [], positionalParams: ["0", "1"], hasInner: true, standard: true },
    { name: "instagram", params: ["hidecaption"], positionalParams: ["0"], hasInner: false, standard: true },
    { name: "param", params: [], positionalParams: ["0"], hasInner: false, standard: true },
    { name: "ref", params: ["path", "lang", "outputFormat"], positionalParams: ["0"], hasInner: false, standard: true },
    { name: "relref", params: ["path", "lang", "outputFormat"], positionalParams: ["0"], hasInner: false, standard: true },
    { name: "vimeo", params: ["class", "title"], positionalParams: ["0"], hasInner: false, standard: true },
    { name: "x", params: [], positionalParams: ["0"], hasInner: false, standard: true },
    { name: "youtube", params: ["id", "title"], positionalParams: ["0"], hasInner: false, standard: true }
  ];
  const shortcodeCompletions = [...new Map(
    [...standardShortcodes, ...hugoShortcodes.map((shortcode) => ({ ...shortcode, standard: false }))]
      .map((shortcode) => [shortcode.name, shortcode])
  ).values()].sort((left, right) => left.name.localeCompare(right.name));

  let mode = "view";
  let currentMarkdown = "";
  let savedMarkdown = "";
  let draftDirty = false;
  let applyingExternalChange = false;
  let savedRange;
  let pendingImage;
  let editingImage;
  let editingShortcode;
  let frontMatter = "";
  let shortcodeCompletionState;
  let shortcodeInspectorShowTimer;
  let shortcodeInspectorHideTimer;
  let inspectedShortcode;

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function highlightInlineMarkdown(value) {
    const pattern = /(\{\{[<%][\s\S]*?[>%]\}\}|<\/?[A-Za-z][^>\n]*>|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;
    let html = "";
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      html += escapeHtml(value.slice(cursor, match.index));
      const token = match[0];
      const className = token.startsWith("{{")
        ? "syntax-shortcode"
        : token.startsWith("<")
          ? "syntax-html"
        : token.startsWith("![")
          ? "syntax-image"
          : token.startsWith("[")
            ? "syntax-link"
            : token.startsWith("`")
              ? "syntax-code"
              : token.startsWith("~~")
                ? "syntax-strike"
                : token.startsWith("**") || token.startsWith("__")
                  ? "syntax-bold"
                  : "syntax-italic";
      html += `<span class="${className}">${escapeHtml(token)}</span>`;
      cursor = match.index + token.length;
    }
    return html + escapeHtml(value.slice(cursor));
  }

  function highlightMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    let inFence = false;
    let frontMatterDelimiter = lines[0] === "---" || lines[0] === "+++" ? lines[0] : "";
    return lines.map((line, index) => {
      if (frontMatterDelimiter) {
        const html = `<span class="syntax-frontmatter">${escapeHtml(line)}</span>`;
        if (index > 0 && line === frontMatterDelimiter) frontMatterDelimiter = "";
        return html;
      }
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence;
        return `<span class="syntax-code">${escapeHtml(line)}</span>`;
      }
      if (inFence) return `<span class="syntax-code">${escapeHtml(line)}</span>`;

      const heading = line.match(/^(\s*)(#{1,6})(\s+.*)$/);
      if (heading) {
        return `${escapeHtml(heading[1])}<span class="syntax-heading-marker">${escapeHtml(heading[2])}</span><span class="syntax-heading">${highlightInlineMarkdown(heading[3])}</span>`;
      }
      const quote = line.match(/^(\s*)(>+)(\s?.*)$/);
      if (quote) {
        return `${escapeHtml(quote[1])}<span class="syntax-quote-marker">${escapeHtml(quote[2])}</span><span class="syntax-quote">${highlightInlineMarkdown(quote[3])}</span>`;
      }
      const list = line.match(/^(\s*)([-+*]|\d+\.)(\s+.*)$/);
      if (list) {
        return `${escapeHtml(list[1])}<span class="syntax-list-marker">${escapeHtml(list[2])}</span>${highlightInlineMarkdown(list[3])}`;
      }
      if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
        return `<span class="syntax-rule">${escapeHtml(line)}</span>`;
      }
      return highlightInlineMarkdown(line);
    }).join("\n");
  }

  function refreshSourceHighlight() {
    sourceHighlight.innerHTML = `${highlightMarkdown(sourceEditor.value)}\n`;
    sourceHighlight.scrollTop = sourceEditor.scrollTop;
    sourceHighlight.scrollLeft = sourceEditor.scrollLeft;
  }

  function elementDebugLabel(element) {
    const id = element.id ? `#${element.id}` : "";
    const classes = Array.from(element.classList)
      .filter((className) => className !== "hugo-shortcode")
      .map((className) => `.${className}`)
      .join("");
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  }

  function formatGeneratedHtml(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("[data-preview-path], .unresolved-image").forEach((child) => {
      child.removeAttribute("data-preview-path");
      child.classList.remove("unresolved-image");
    });
    clone.querySelectorAll("img[data-markdown-path]").forEach((image) => {
      image.setAttribute("src", image.dataset.markdownPath);
      image.removeAttribute("data-markdown-path");
    });
    const container = document.createElement("div");
    container.append(...clone.childNodes);
    return container.innerHTML
      .replace(/></g, ">\n<")
      .replace(/^\s+|\s+$/g, "");
  }

  function computedCssText(element) {
    const computed = getComputedStyle(element);
    return Array.from(computed)
      .sort()
      .map((property) => `${property}: ${computed.getPropertyValue(property).trim()};`)
      .join("\n");
  }

  function matchingThemeRules(element) {
    const matches = [];
    for (const style of hugoThemeStyles) {
      const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
      let match;
      while ((match = rulePattern.exec(style.css))) {
        const selectors = match[1].trim();
        if (!selectors || selectors.startsWith("@")) continue;
        const matchingSelectors = selectors.split(",").map((selector) => selector.trim()).filter((selector) => {
          try {
            return selector && element.matches(selector);
          } catch {
            return false;
          }
        });
        if (matchingSelectors.length) {
          matches.push(`${style.name}\n${matchingSelectors.join(", ")} {\n${match[2].trim()}\n}`);
        }
      }
    }
    if (matches.length) return matches.join("\n\n");
    const loadedFiles = hugoThemeStyles.map((style) => `- ${style.name}`).join("\n");
    return `No matching rules found in loaded theme CSS files.\n\nLoaded theme CSS files:\n${loadedFiles || "- None"}`;
  }

  function positionShortcodeInspector(shortcode) {
    const rectangle = shortcode.getBoundingClientRect();
    const width = Math.min(560, window.innerWidth - 24);
    const fitsRight = rectangle.right + 12 + width <= window.innerWidth;
    const left = fitsRight
      ? rectangle.right + 12
      : Math.max(12, rectangle.left - width - 12);
    shortcodeInspector.style.width = `${width}px`;
    shortcodeInspector.style.left = `${left}px`;
    shortcodeInspector.style.top = `${Math.max(12, Math.min(window.innerHeight - 420, rectangle.top))}px`;
  }

  function showShortcodeInspector(shortcode, target) {
    if (!shortcodeInspectorEnabled) return;
    clearTimeout(shortcodeInspectorHideTimer);
    inspectedShortcode = shortcode;
    const parsed = parseShortcodeMarkup(shortcode.dataset.shortcodeMarkup || "");
    const inspectedElement = target instanceof Element && shortcode.contains(target) ? target : shortcode;
    shortcodeInspectorTitle.textContent = `${parsed?.name || "Shortcode"} Inspector`;
    shortcodeInspectorHtml.textContent = formatGeneratedHtml(shortcode);
    shortcodeInspectorCssTitle.textContent = `Computed CSS: ${elementDebugLabel(inspectedElement)}`;
    shortcodeInspectorCss.textContent = computedCssText(inspectedElement);
    shortcodeInspectorRules.textContent = matchingThemeRules(inspectedElement);
    positionShortcodeInspector(shortcode);
    shortcodeInspector.classList.remove("hidden");
  }

  function scheduleShortcodeInspector(shortcode, target) {
    if (!shortcodeInspectorEnabled) return;
    clearTimeout(shortcodeInspectorShowTimer);
    clearTimeout(shortcodeInspectorHideTimer);
    shortcodeInspectorShowTimer = setTimeout(() => showShortcodeInspector(shortcode, target), 350);
  }

  function scheduleHideShortcodeInspector() {
    clearTimeout(shortcodeInspectorShowTimer);
    clearTimeout(shortcodeInspectorHideTimer);
    shortcodeInspectorHideTimer = setTimeout(() => {
      shortcodeInspector.classList.add("hidden");
      inspectedShortcode = null;
    }, 300);
  }

  function shortcodeCompletionContext() {
    if (mode !== "source" || sourceEditor.selectionStart !== sourceEditor.selectionEnd) return null;
    const beforeCaret = sourceEditor.value.slice(0, sourceEditor.selectionStart);
    const nameMatch = beforeCaret.match(/\{\{([<%])\s*(\/?)([A-Za-z0-9_./-]*)$/);
    if (nameMatch) {
      return {
        type: "shortcode",
        delimiter: nameMatch[1],
        closing: nameMatch[2] === "/",
        query: nameMatch[3].toLowerCase(),
        start: sourceEditor.selectionStart - nameMatch[0].length,
        end: sourceEditor.selectionStart
      };
    }

    const propertyMatch = beforeCaret.match(/\{\{([<%])\s*([A-Za-z0-9_./-]+)\s+([^{}]*?)$/);
    if (!propertyMatch || /[>%]\}\}/.test(propertyMatch[3])) return null;
    const shortcode = shortcodeCompletions.find((item) => item.name === propertyMatch[2]);
    if (!shortcode?.params?.length) return null;
    const queryMatch = propertyMatch[3].match(/(?:^|\s)([\w-]*)$/);
    if (!queryMatch) return null;
    const usedProperties = new Set([...propertyMatch[3].matchAll(/(?:^|\s)([\w-]+)\s*=/g)].map((match) => match[1]));
    return {
      type: "property",
      shortcode,
      query: queryMatch[1].toLowerCase(),
      usedProperties,
      start: sourceEditor.selectionStart - queryMatch[1].length,
      end: sourceEditor.selectionStart
    };
  }

  function hideShortcodeAutocomplete() {
    shortcodeAutocomplete.classList.add("hidden");
    shortcodeAutocomplete.replaceChildren();
    shortcodeCompletionState = null;
  }

  function positionShortcodeAutocomplete() {
    const style = getComputedStyle(sourceEditor);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const beforeCaret = sourceEditor.value.slice(0, sourceEditor.selectionStart);
    const lines = beforeCaret.split("\n");
    const row = lines.length - 1;
    const column = lines.at(-1).length;
    const characterWidth = measureSourceCharacterWidth(style);
    const left = Math.max(4, Math.min(sourceContainer.clientWidth - 270, 2 + column * characterWidth - sourceEditor.scrollLeft));
    const top = Math.max(4, Math.min(sourceContainer.clientHeight - 190, 2 + (row + 1) * lineHeight - sourceEditor.scrollTop));
    shortcodeAutocomplete.style.left = `${left}px`;
    shortcodeAutocomplete.style.top = `${top}px`;
  }

  function measureSourceCharacterWidth(style) {
    const probe = document.createElement("span");
    probe.textContent = "MMMMMMMMMM";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.fontFamily = style.fontFamily;
    probe.style.fontSize = style.fontSize;
    sourceContainer.appendChild(probe);
    const width = probe.getBoundingClientRect().width / 10;
    probe.remove();
    return width || 8;
  }

  function renderShortcodeAutocomplete(selectedIndex = 0) {
    const context = shortcodeCompletionContext();
    if (!context) {
      hideShortcodeAutocomplete();
      return;
    }
    const matches = context.type === "property"
      ? context.shortcode.params
        .filter((property) => !context.usedProperties.has(property) && property.toLowerCase().includes(context.query))
        .map((property) => ({
          name: property,
          property: true,
          shortcodeName: context.shortcode.name,
          params: [],
          standard: false,
          hasInner: false
        }))
        .slice(0, 12)
      : shortcodeCompletions
        .filter((shortcode) => shortcode.name.toLowerCase().includes(context.query))
        .slice(0, 12);
    if (!matches.length) {
      hideShortcodeAutocomplete();
      return;
    }

    shortcodeCompletionState = {
      context,
      matches,
      selectedIndex: Math.max(0, Math.min(selectedIndex, matches.length - 1))
    };
    shortcodeAutocomplete.replaceChildren(...matches.map((shortcode, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `shortcode-suggestion${index === shortcodeCompletionState.selectedIndex ? " selected" : ""}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", index === shortcodeCompletionState.selectedIndex ? "true" : "false");
      option.innerHTML = `<strong>${shortcodeCompletionState.context.closing ? "/" : ""}${escapeHtml(shortcode.name)}</strong><span>${shortcode.standard ? "Hugo" : "Project"} shortcode${shortcode.params.length ? ` · ${escapeHtml(shortcode.params.join(", "))}` : ""}</span>`;
      if (shortcode.property) {
        option.innerHTML = `<strong>${escapeHtml(shortcode.name)}</strong><span>${escapeHtml(shortcode.shortcodeName)} property</span>`;
      }
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => acceptShortcodeCompletion(index));
      return option;
    }));
    shortcodeAutocomplete.classList.remove("hidden");
    positionShortcodeAutocomplete();
    shortcodeAutocomplete.children[shortcodeCompletionState.selectedIndex]?.scrollIntoView({ block: "nearest" });
  }

  function acceptShortcodeCompletion(index = shortcodeCompletionState?.selectedIndex || 0) {
    if (!shortcodeCompletionState) return;
    const shortcode = shortcodeCompletionState.matches[index];
    const { start, end } = shortcodeCompletionState.context;
    if (shortcodeCompletionState.context.type === "property") {
      const replacement = `${shortcode.name}=""`;
      sourceEditor.setRangeText(replacement, start, end, "end");
      const caret = start + shortcode.name.length + 2;
      sourceEditor.setSelectionRange(caret, caret);
      hideShortcodeAutocomplete();
      refreshSourceHighlight();
      scheduleEdit(sourceEditor.value);
      sourceEditor.focus();
      return;
    }
    const { delimiter, closing } = shortcodeCompletionState.context;
    const closingDelimiter = delimiter === "<" ? ">" : "%";
    const opening = `{{${delimiter} ${closing ? "/" : ""}${shortcode.name} ${closingDelimiter}}}`;
    const replacement = shortcode.hasInner && !closing
      ? `${opening}\n\n{{${delimiter} /${shortcode.name} ${closingDelimiter}}}`
      : opening;
    const caretOffset = shortcode.hasInner && !closing
      ? opening.length + 1
      : closing ? opening.length : opening.length - 4;
    sourceEditor.setRangeText(replacement, start, end, "end");
    const caret = start + caretOffset;
    sourceEditor.setSelectionRange(caret, caret);
    hideShortcodeAutocomplete();
    refreshSourceHighlight();
    scheduleEdit(sourceEditor.value);
    sourceEditor.focus();
  }

  function inlineMarkdown(value, shortcodeBlocks = []) {
    let output = escapeHtml(value);
    const shortcodeHtml = [];
    const protectShortcode = (markup) => {
      const index = shortcodeHtml.push(shortcodeToHtml(markup)) - 1;
      return `HUGORENDEREDTOKEN${index}END`;
    };
    output = output.replace(/HUGOSHORTCODETOKEN(\d+)END/g, (_match, index) => protectShortcode(shortcodeBlocks[Number(index)]));
    output = output.replace(
      /\{\{(?:&lt;|%)\s*\/?[^{}]*?\s*(?:&gt;|%)\}\}/g,
      (shortcode) => protectShortcode(decodeHtml(shortcode))
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
    output = output.replace(/HUGORENDEREDTOKEN(\d+)END/g, (_match, index) => shortcodeHtml[Number(index)]);
    return output;
  }

  function splitMarkdownTableRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells = [];
    let cell = "";
    let escaped = false;
    let inCode = false;

    for (const character of trimmed) {
      if (escaped) {
        cell += character === "|" ? "|" : `\\${character}`;
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "`") {
        inCode = !inCode;
        cell += character;
      } else if (character === "|" && !inCode) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += character;
      }
    }
    if (escaped) cell += "\\";
    cells.push(cell.trim());
    return cells;
  }

  function parseTableDelimiter(line) {
    const cells = splitMarkdownTableRow(line);
    if (!cells.length || cells.some((cell) => !/^:?-{3,}:?$/.test(cell))) return null;
    return cells.map((cell) => cell.startsWith(":") && cell.endsWith(":")
      ? "center"
      : cell.endsWith(":")
        ? "right"
        : cell.startsWith(":")
          ? "left"
          : "");
  }

  function tableToHtml(headerLine, delimiterLine, bodyLines, shortcodeBlocks) {
    const headers = splitMarkdownTableRow(headerLine);
    const alignments = parseTableDelimiter(delimiterLine) || [];
    const columnCount = Math.max(headers.length, alignments.length);
    const cellHtml = (cell, index, tag) => {
      const alignment = alignments[index] || "";
      return `<${tag}${alignment ? ` data-align="${alignment}" style="text-align:${alignment}"` : ""}>${inlineMarkdown(cell || "", shortcodeBlocks)}</${tag}>`;
    };
    const header = Array.from({ length: columnCount }, (_value, index) => cellHtml(headers[index], index, "th")).join("");
    const body = bodyLines.map((line) => {
      const cells = splitMarkdownTableRow(line);
      return `<tr>${Array.from({ length: columnCount }, (_value, index) => cellHtml(cells[index], index, "td")).join("")}</tr>`;
    }).join("");
    return `<table><thead><tr>${header}</tr></thead>${body ? `<tbody>${body}</tbody>` : ""}</table>`;
  }

  function markdownToHtml(markdown) {
    const shortcodeBlocks = [];
    const protectedMarkdown = markdown.replace(
      /\{\{[<%]\s*([^\s/>%]+)[^{}]*?[>%]\}\}[\s\S]*?\{\{[<%]\s*\/\1\s*[>%]\}\}/g,
      (shortcode) => {
        const index = shortcodeBlocks.push(shortcode) - 1;
        return `HUGOSHORTCODETOKEN${index}END`;
      }
    );
    const lines = protectedMarkdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listType = "";
    let inCode = false;
    let codeLines = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        html.push(`<p>${inlineMarkdown(paragraph.join(" "), shortcodeBlocks)}</p>`);
        paragraph = [];
      }
    };
    const closeList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = "";
      }
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
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
      const tableAlignments = line.includes("|") && lineIndex + 1 < lines.length
        ? parseTableDelimiter(lines[lineIndex + 1])
        : null;

      if (tableAlignments) {
        flushParagraph();
        closeList();
        const bodyLines = [];
        lineIndex += 2;
        while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
          bodyLines.push(lines[lineIndex]);
          lineIndex += 1;
        }
        lineIndex -= 1;
        html.push(tableToHtml(line, lines[lineIndex - bodyLines.length], bodyLines, shortcodeBlocks));
      } else if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${inlineMarkdown(heading[2], shortcodeBlocks)}</h${level}>`);
      } else if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          html.push(`<${listType}>`);
        }
        html.push(`<li>${inlineMarkdown((unordered || ordered)[1], shortcodeBlocks)}</li>`);
      } else if (quote) {
        flushParagraph();
        closeList();
        html.push(`<blockquote>${inlineMarkdown(quote[1], shortcodeBlocks)}</blockquote>`);
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
    const paths = Array.from(visualEditor.querySelectorAll("img"))
      .map((image) => {
        const imagePath = image.dataset.markdownPath
          || image.dataset.previewPath
          || image.getAttribute("src");
        if (!imagePath || /^(?:data:|https?:\/\/)/i.test(imagePath)) {
          return "";
        }
        image.dataset.previewPath = imagePath;
        return imagePath;
      })
      .filter(Boolean);
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
    if (element.classList.contains("hugo-shortcode")) {
      return element.dataset.shortcodeMarkup || "";
    }
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
      case "br":
        return "\n";
      default:
        return content;
    }
  }

  function escapeTableCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
  }

  function tableToMarkdown(table) {
    const headerCells = Array.from(table.querySelectorAll("thead th"));
    const firstBodyRow = table.querySelector("tbody tr");
    const headers = headerCells.length
      ? headerCells
      : firstBodyRow
        ? Array.from(firstBodyRow.children)
        : [];
    if (!headers.length) return "";

    const rowMarkdown = (cells) => `| ${cells.map((cell) => escapeTableCell(inlineToMarkdown(cell))).join(" | ")} |`;
    const delimiter = `| ${headers.map((cell) => {
      const alignment = cell.dataset.align || cell.style.textAlign;
      return alignment === "center" ? ":---:" : alignment === "right" ? "---:" : alignment === "left" ? ":---" : "---";
    }).join(" | ")} |`;
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    if (!headerCells.length && rows.length) rows.shift();
    return [rowMarkdown(headers), delimiter, ...rows.map((row) => rowMarkdown(Array.from(row.children)))].join("\n");
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
      } else if (tag === "table") {
        blocks.push(tableToMarkdown(node));
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
      refreshSourceHighlight();
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
    sourceContainer.classList.toggle("hidden", !isSource);
    if (!isSource || isViewSource) hideShortcodeAutocomplete();
    if (isSource) scheduleHideShortcodeInspector();
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
    if (isEdit) requestAnimationFrame(updateToolbarState);
  }

  function draftMarkdown() {
    return mode === "edit" ? htmlToMarkdown() : sourceEditor.value;
  }

  function returnToView(markdown) {
    currentMarkdown = markdown;
    draftDirty = false;
    sourceEditor.value = markdown;
    refreshSourceHighlight();
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
    updateToolbarState();
  }

  function updateToolbarState() {
    if (mode !== "edit") return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    let node = selection.anchorNode;
    if (!node || (node !== visualEditor && !visualEditor.contains(node))) return;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node.closest?.("h1, h2, h3, h4, h5, h6, blockquote, pre, p");
    blockStyle.value = block ? block.tagName.toLowerCase() : "p";

    const stateCommands = ["bold", "italic", "strikeThrough", "insertUnorderedList", "insertOrderedList"];
    for (const command of stateCommands) {
      const button = toolbar.querySelector(`[data-command="${command}"]`);
      if (!button) continue;
      let active = false;
      try {
        active = document.queryCommandState(command);
      } catch {
        active = false;
      }
      if (!active) {
        const selector = command === "bold"
          ? "strong, b"
          : command === "italic"
            ? "em, i"
            : command === "strikeThrough"
              ? "s, strike, del"
              : command === "insertUnorderedList"
                ? "ul"
                : "ol";
        active = Boolean(node.closest?.(selector));
      }
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function insertTable() {
    visualEditor.focus();
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead><tbody><tr><td>Value</td><td>Value</td><td>Value</td></tr></tbody>";
    const range = selectionRangeInsideVisualEditor();
    if (range) {
      range.deleteContents();
      range.insertNode(table);
      range.setStartAfter(table);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      visualEditor.appendChild(table);
    }
    scheduleEdit(htmlToMarkdown());
    table.querySelector("th")?.focus();
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

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function shortcodeToHtml(markup) {
    const parsed = parseShortcodeMarkup(markup);
    const rendered = parsed ? renderShortcode(parsed) : "";
    const label = parsed?.name || "shortcode";
    return `<div class="hugo-shortcode" contenteditable="false" data-shortcode-markup="${escapeAttribute(markup)}" title="Right-click to edit shortcode">${rendered || `Hugo shortcode: ${escapeHtml(label)}`}</div>`;
  }

  function parseShortcodeMarkup(markup) {
    const trimmed = markup.trim();
    const open = trimmed.match(/^\{\{[<%]\s*([^\s/>%]+)(.*?)\s*[>%]\}\}/s);
    if (!open || open[1].startsWith("/")) return null;

    const name = open[1];
    const closePattern = new RegExp(`\\{\\{[<%]\\s*\\/${escapeRegExp(name)}\\s*[>%]\\}\\}\\s*$`, "s");
    const close = trimmed.match(closePattern);
    const inner = close ? trimmed.slice(open[0].length, trimmed.length - close[0].length).replace(/^\n|\n$/g, "") : "";
    const named = {};
    const positional = [];
    const tokenPattern = /([\w-]+)=("([^"]*)"|'([^']*)'|([^\s]+))|"([^"]*)"|'([^']*)'|([^\s]+)/g;
    let match;
    while ((match = tokenPattern.exec(open[2] || ""))) {
      if (match[1]) {
        named[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
      } else {
        positional.push(match[6] ?? match[7] ?? match[8] ?? "");
      }
    }
    return { name, named, positional, inner };
  }

  function renderShortcode(parsed) {
    const shortcode = hugoShortcodes.find((item) => item.name === parsed.name);
    if (!shortcode?.template) return "";

    const variables = {};
    let rendered = shortcode.template.replace(/<!--[\s\S]*?-->/g, "");

    rendered = rendered.replace(
      /\{\{\s*\$([\w-]+)\s*:=\s*([\s\S]*?)\s*\}\}/g,
      (_match, name, expression) => {
        variables[name] = evaluateShortcodeExpression(expression, parsed, variables);
        return "";
      }
    );
    rendered = rendered.replace(
      /\{\{\s*if\s+ne\s+([\s\S]*?)\s+("[^"]*"|'[^']*'|\S+)\s*\}\}([\s\S]*?)\{\{\s*end\s*\}\}/g,
      (_match, leftExpression, rightExpression, content) => {
        const left = evaluateShortcodeExpression(leftExpression, parsed, variables);
        const right = evaluateShortcodeExpression(rightExpression, parsed, variables);
        return left !== right ? content : "";
      }
    );
    rendered = rendered.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_match, expression) =>
      escapeHtml(evaluateShortcodeExpression(expression, parsed, variables))
    );
    return rendered.trim();
  }

  function evaluateShortcodeExpression(expression, parsed, variables) {
    const parts = expression.split("|").map((part) => part.trim()).filter(Boolean);
    let value = evaluateShortcodeAtom(parts.shift() || "", parsed, variables);
    for (const operation of parts) {
      const defaultMatch = operation.match(/^default\s+(.+)$/s);
      if (defaultMatch && !value) {
        value = evaluateShortcodeAtom(defaultMatch[1], parsed, variables);
      }
    }
    return String(value ?? "");
  }

  function evaluateShortcodeAtom(expression, parsed, variables) {
    const atom = expression.trim();
    const quoted = atom.match(/^(["'])([\s\S]*)\1$/);
    if (quoted) return quoted[2];
    if (atom.startsWith("$")) return variables[atom.slice(1)] || "";
    if (atom === ".Inner") return parsed.inner || "";

    const namedGet = atom.match(/^\.Get\s+["']([^"']+)["']$/);
    if (namedGet) return parsed.named[namedGet[1]] || "";
    const positionalGet = atom.match(/^\.Get\s+(\d+)$/);
    if (positionalGet) return parsed.positional[Number(positionalGet[1])] || "";
    const params = atom.match(/^\.Params\.([A-Za-z][\w-]*)$/);
    if (params) return parsed.named[params[1]] || "";
    const indexedParams = atom.match(/^index\s+\.Params\s+["']([^"']+)["']$/);
    if (indexedParams) return parsed.named[indexedParams[1]] || "";
    return atom;
  }

  function buildShortcodeFields(values) {
    const shortcode = hugoShortcodes.find((item) => item.name === shortcodeSelect.value);
    shortcodeFields.replaceChildren();
    if (!shortcode) return;

    for (const position of shortcode.positionalParams) {
      shortcodeFields.appendChild(createShortcodeField(`Argument ${Number(position) + 1}`, `position-${position}`, values?.positional?.[Number(position)] || ""));
    }
    for (const param of shortcode.params) {
      shortcodeFields.appendChild(createShortcodeField(param, `param-${param}`, values?.named?.[param] || ""));
    }
    if (shortcode.hasInner) {
      const label = document.createElement("label");
      label.textContent = "Inner content";
      const textarea = document.createElement("textarea");
      textarea.dataset.shortcodeInner = "true";
      textarea.rows = 5;
      textarea.value = values?.inner || "";
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

  function createShortcodeField(labelText, key, value) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const wrapper = document.createElement("div");
    wrapper.className = "field-with-button";
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.dataset.shortcodeField = key;
    wrapper.appendChild(input);
    if (labelText.toLowerCase() === "src") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Browse...";
      button.addEventListener("click", () => {
        vscode.postMessage({ type: "pickShortcodeFile", field: key });
      });
      wrapper.appendChild(button);
    }
    label.appendChild(wrapper);
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

  function openShortcodeDialog(shortcodeElement) {
    editingShortcode = shortcodeElement || null;
    shortcodeDialogTitle.textContent = editingShortcode ? "Edit Hugo Shortcode" : "Insert Hugo Shortcode";
    insertShortcodeButton.textContent = editingShortcode ? "Save Changes" : "Insert Shortcode";
    const parsed = editingShortcode ? parseShortcodeMarkup(editingShortcode.dataset.shortcodeMarkup || "") : null;
    if (parsed && hugoShortcodes.some((item) => item.name === parsed.name)) {
      shortcodeSelect.value = parsed.name;
    }
    buildShortcodeFields(parsed);
    shortcodeDialog.showModal();
  }

  editMode.addEventListener("click", () => setMode("edit"));
  closeEditButton.addEventListener("click", requestCloseEditing);
  viewSourceMode.addEventListener("click", () => setMode("view-source"));
  viewVisualMode.addEventListener("click", () => setMode("view"));
  sourceMode.addEventListener("click", () => setMode("source"));
  visualEditMode.addEventListener("click", () => setMode("edit"));
  sourceEditor.addEventListener("input", () => {
    refreshSourceHighlight();
    if (mode === "source") {
      scheduleEdit(sourceEditor.value);
      renderShortcodeAutocomplete();
    }
  });
  sourceEditor.addEventListener("scroll", () => {
    refreshSourceHighlight();
    if (shortcodeCompletionState) positionShortcodeAutocomplete();
  });
  sourceEditor.addEventListener("click", () => {
    if (mode === "source") renderShortcodeAutocomplete();
  });
  sourceEditor.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.code === "Space" && mode === "source") {
      event.preventDefault();
      renderShortcodeAutocomplete();
      return;
    }
    if (!shortcodeCompletionState) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (shortcodeCompletionState.selectedIndex + direction + shortcodeCompletionState.matches.length) % shortcodeCompletionState.matches.length;
      renderShortcodeAutocomplete(next);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      acceptShortcodeCompletion();
    } else if (event.key === "Escape") {
      event.preventDefault();
      hideShortcodeAutocomplete();
    }
  });
  sourceEditor.addEventListener("blur", () => {
    setTimeout(hideShortcodeAutocomplete, 100);
  });
  visualEditor.addEventListener("input", () => {
    if (!applyingExternalChange) scheduleEdit(htmlToMarkdown());
    updateToolbarState();
  });
  visualEditor.addEventListener("click", updateToolbarState);
  visualEditor.addEventListener("keyup", updateToolbarState);
  document.addEventListener("selectionchange", updateToolbarState);
  visualEditor.addEventListener("mouseover", (event) => {
    const shortcode = event.target.closest?.(".hugo-shortcode");
    if (!shortcode) return;
    if (shortcode === inspectedShortcode && !shortcodeInspector.classList.contains("hidden")) {
      showShortcodeInspector(shortcode, event.target);
    } else {
      scheduleShortcodeInspector(shortcode, event.target);
    }
  });
  visualEditor.addEventListener("mouseout", (event) => {
    const shortcode = event.target.closest?.(".hugo-shortcode");
    if (!shortcode) return;
    if (event.relatedTarget instanceof Node && shortcode.contains(event.relatedTarget)) return;
    scheduleHideShortcodeInspector();
  });
  visualEditor.addEventListener("contextmenu", (event) => {
    if (mode !== "edit") return;
    const image = event.target.closest?.("img[data-markdown-path]");
    const shortcode = event.target.closest?.(".hugo-shortcode");
    if (!image && !shortcode) return;
    event.preventDefault();
    savedRange = null;
    pendingImage = null;
    if (image) {
      openImageDialog(image);
    } else {
      openShortcodeDialog(shortcode);
    }
  });
  shortcodeInspector.addEventListener("mouseenter", () => {
    clearTimeout(shortcodeInspectorHideTimer);
  });
  shortcodeInspector.addEventListener("mouseleave", scheduleHideShortcodeInspector);
  closeShortcodeInspector.addEventListener("click", () => {
    clearTimeout(shortcodeInspectorShowTimer);
    clearTimeout(shortcodeInspectorHideTimer);
    shortcodeInspector.classList.add("hidden");
    inspectedShortcode = null;
  });
  window.addEventListener("resize", () => {
    if (inspectedShortcode && !shortcodeInspector.classList.contains("hidden")) {
      positionShortcodeInspector(inspectedShortcode);
    }
  });

  toolbar.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => runCommand(button.dataset.command));
  });
  blockStyle.addEventListener("change", () => runCommand("formatBlock", blockStyle.value));
  tableButton.addEventListener("mousedown", (event) => event.preventDefault());
  tableButton.addEventListener("click", insertTable);
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
    openShortcodeDialog(null);
  });
  shortcodeSelect.addEventListener("change", () => buildShortcodeFields());
  shortcodeDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const markup = buildShortcodeMarkup();
    if (!markup) return;

    visualEditor.focus();
    const range = editingShortcode ? null : restoreSavedRange();
    const temporary = document.createElement("div");
    temporary.innerHTML = shortcodeToHtml(markup);
    const placeholder = temporary.firstElementChild;
    if (editingShortcode) {
      editingShortcode.replaceWith(placeholder);
    } else if (range) {
      range.deleteContents();
      range.insertNode(placeholder);
      range.setStartAfter(placeholder);
      range.collapse(true);
    } else {
      visualEditor.appendChild(placeholder);
    }
    savedRange = null;
    editingShortcode = null;
    shortcodeDialog.close();
    refreshImagePreviews();
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
        refreshSourceHighlight();
        if (mode === "view") renderVisual(currentMarkdown);
      }
      applyingExternalChange = false;
    } else if (message.type === "imageSelected") {
      pendingImage = message;
      openImageDialog(null);
    } else if (message.type === "shortcodeFileSelected") {
      const input = shortcodeFields.querySelector(`[data-shortcode-field="${CSS.escape(message.field)}"]`);
      if (input) input.value = message.path;
    } else if (message.type === "imagePreviews") {
      for (const preview of message.previews) {
        for (const image of visualEditor.querySelectorAll("img")) {
          const imagePath = image.dataset.markdownPath || image.dataset.previewPath;
          if (imagePath === preview.path) {
            if (preview.previewUri) {
              image.src = preview.previewUri;
              image.classList.remove("unresolved-image");
              image.removeAttribute("title");
            } else {
              image.classList.add("unresolved-image");
              image.title = preview.error || `Image not found: ${preview.path}`;
              image.alt = image.alt || preview.error || `Image not found: ${preview.path}`;
            }
          }
        }
      }
    } else if (message.type === "shortcodeInspectorSetting") {
      shortcodeInspectorEnabled = message.enabled === true;
      if (!shortcodeInspectorEnabled) {
        clearTimeout(shortcodeInspectorShowTimer);
        clearTimeout(shortcodeInspectorHideTimer);
        shortcodeInspector.classList.add("hidden");
        inspectedShortcode = null;
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
      editingShortcode = null;
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
