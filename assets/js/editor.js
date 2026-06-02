/**
 * Markflow — Editor Engine
 * Handles editor input, stats, toolbar, and splitting.
 */

const SAMPLE_MARKDOWN = `# MarkFlow — Complete Markdown Reference

> 📖 A **comprehensive showcase** of every Markdown feature — text formatting, code, tables, lists, diagrams, math notation, and more. Use this as your reference guide.

---

## Table of Contents

- [Text Formatting](#text-formatting)
- [Headings](#headings)
- [Paragraphs & Line Breaks](#paragraphs--line-breaks)
- [Blockquotes](#blockquotes)
- [Lists](#lists)
- [Task Lists](#task-lists)
- [Code](#code)
- [Tables](#tables)
- [Links & Images](#links--images)
- [Horizontal Rules](#horizontal-rules)
- [Footnotes & Definitions](#footnotes--definitions)
- [Diagrams & Flowcharts](#diagrams--flowcharts)
- [Math Notation](#math-notation)
- [Keyboard & Special Elements](#keyboard--special-elements)

---

## Text Formatting

| Style | Markdown | Result |
|-------|----------|--------|
| Bold | **text** | **bold** |
| Italic | *text* | *italic* |
| Bold + Italic | ***text*** | ***bold italic*** |
| Strikethrough | ~~text~~ | ~~strikethrough~~ |
| Inline code | \`code\` | \`code\` |

You can **combine** *different* ***styles*** in a ~~single~~ sentence with \`inline code\` and [links](https://example.com).

---

## Headings

# H1 — Page Title
## H2 — Major Section
### H3 — Sub-section
#### H4 — Sub-sub-section
##### H5 — Minor heading
###### H6 — Smallest heading

---

## Paragraphs & Line Breaks

This is the first paragraph. It contains multiple sentences. Paragraphs are separated by a blank line.

This is the second paragraph. To force a **line break** within a paragraph,
end a line with two spaces or a backslash.\\
This line follows a forced break.

---

## Blockquotes

> This is a simple blockquote.

> **Nested blockquotes** are also supported:
>
> > This is a nested blockquote inside the outer one.

---

## Lists

### Unordered Lists

- First item
- Second item
- Third item
  - Nested item 3.1

### Ordered Lists

1. First step
2. Second step
3. Third step

---

## Task Lists

- [x] ✅ Set up project repository
- [x] ✅ Configure Markdown parser
- [ ] 🔲 Collaborative editing (coming soon)

---

## Code

\`\`\`javascript
function hello() {
  console.log("Hello, Markflow!");
}
\`\`\`

---

## Tables

| Column A | Column B | Column C |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |

---

## Diagrams & Flowcharts

\`\`\`mermaid
flowchart TD
    A([Start]) --> B{Is it working?}
    B -- Yes --> C[Ship it! 🚀]
    B -- No  --> D[Debug]
    D --> E[Fix the bug]
    E --> B
    C --> F([Done])
\`\`\`

---

## Math Notation

MarkFlow supports LaTeX math notation via KaTeX.

**Inline Math:** The Pythagorean theorem is $a^2 + b^2 = c^2$.

**Block Math:**

$$
e^{i\pi} + 1 = 0
$$

---

## Escaping Characters

\\*not italic\\*
\\# not a heading

---

## Summary

🎉 **Happy writing with MarkFlow!**
`;

let _emptyStateEl = null;
let _scrollSyncOn = true;
let _debounceTimer = null;
let _wordGoal = 500;

function onEditorInput() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(updatePreview, 80);
}

function updatePreview() {
  const markdown = document.getElementById('md-editor').value;
  localStorage.setItem('markflow-content', markdown);

  const preview  = document.getElementById('editor-preview');
  if (!markdown.trim()) {
    preview.innerHTML = '';
    if (_emptyStateEl && !preview.contains(_emptyStateEl)) preview.appendChild(_emptyStateEl);
    updateStats(''); return;
  }
  const html = parseMarkdown(markdown);
  preview.innerHTML = html;
  injectCopyButtons(preview); renderMermaid(preview);
  updateStats(markdown);
}

function updateStats(md) {
  const lines = md ? md.split('\n').length : 0;
  
  // Improved word count: strip markdown syntax
  const cleanMd = md
    .replace(/^#+\s+/gm, '') // headings
    .replace(/^[*-+]\s+/gm, '') // lists
    .replace(/^\d+\.\s+/gm, '') // numbered lists
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links
    .replace(/(\*\*|__|~~|`)/g, '') // bold, italic, strikethrough, code
    .replace(/^\s*[-*_]{3,}\s*$/gm, ''); // horizontal rules
    
  const words = cleanMd.trim() ? cleanMd.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = md.length;
  const readMin = Math.max(1, Math.ceil(words / 200));
  document.getElementById('stat-lines').textContent = lines.toLocaleString();
  document.getElementById('stat-words').textContent = words.toLocaleString();
  document.getElementById('stat-chars').textContent = chars.toLocaleString();
  document.getElementById('stat-read').textContent  = `${readMin} min`;
  const pct = Math.min(100, Math.round(words / _wordGoal * 100));
  const fill = document.getElementById('stat-goal-fill');
  const bar = document.getElementById('goal-progress-bar');
  fill.style.width = pct + '%';
  fill.classList.toggle('done', pct >= 100);
  if (bar) bar.setAttribute('aria-valuenow', pct);
}

function insertSyntax(prefix, suffix) {
  const ta = document.getElementById('md-editor');
  const s = ta.selectionStart, e2 = ta.selectionEnd;
  const sel = ta.value.substring(s, e2);
  const ins = prefix + sel + suffix;
  ta.value = ta.value.substring(0, s) + ins + ta.value.substring(e2);
  ta.selectionStart = ta.selectionEnd = s + ins.length;
  ta.focus(); updatePreview();
}

function clearEditor() {
  if (document.getElementById('md-editor').value && !confirm('Clear all content?')) return;
  document.getElementById('md-editor').value = ''; updatePreview();
}

function loadSample() {
  document.getElementById('md-editor').value = SAMPLE_MARKDOWN;
  updatePreview();
  showSnackbar('Sample loaded!', 'auto_awesome');
}

// ── Table Picker ──────────────────────────────
const PICKER_ROWS = 8, PICKER_COLS = 8;
let _pickerOpen = false;

function initTablePickerGrid() {
  const grid = document.getElementById('table-picker-grid');
  if (grid.children.length > 0) return;
  for (let r = 1; r <= PICKER_ROWS; r++) {
    for (let c = 1; c <= PICKER_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'table-picker-cell';
      cell.dataset.row = r; cell.dataset.col = c;
      cell.addEventListener('mouseenter', () => highlightCells(r, c));
      cell.addEventListener('click', () => { insertTableGrid(r, c); closeTablePicker(); });
      grid.appendChild(cell);
    }
  }
}

function highlightCells(row, col) {
  document.querySelectorAll('.table-picker-cell').forEach(cell => {
    cell.classList.toggle('hovered', +cell.dataset.row <= row && +cell.dataset.col <= col);
  });
  document.getElementById('table-picker-size').textContent = `${col} × ${row} table`;
}

function toggleTablePicker(e) {
  e.stopPropagation();
  _pickerOpen = !_pickerOpen;
  const popup = document.getElementById('table-picker-popup');
  const btn   = document.getElementById('table-picker-btn');
  btn.setAttribute('aria-expanded', _pickerOpen);
  if (_pickerOpen) {
    initTablePickerGrid();
    document.querySelectorAll('.table-picker-cell').forEach(c => c.classList.remove('hovered'));
    document.getElementById('table-picker-size').textContent = 'Hover to select size';
    const rect = btn.getBoundingClientRect(), popupW = 220, viewW = window.innerWidth;
    let left = rect.left + rect.width/2 - popupW/2;
    left = Math.max(8, Math.min(left, viewW - popupW - 8));
    popup.style.top = (rect.bottom + 6) + 'px';
    popup.style.left = left + 'px';
    popup.style.width = popupW + 'px';
    requestAnimationFrame(() => popup.classList.add('open'));
  } else { closeTablePicker(); }
}

function closeTablePicker() {
  _pickerOpen = false;
  document.getElementById('table-picker-popup').classList.remove('open');
  document.getElementById('table-picker-btn').setAttribute('aria-expanded', 'false');
}

function insertTableGrid(rows, cols) {
  const ta = document.getElementById('md-editor');
  const pos = ta.selectionEnd;
  const before = ta.value.substring(0, pos), after = ta.value.substring(pos);
  const prefix = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '\n';
  const headers = Array.from({length:cols},(_,i)=>` Col ${i+1} `).join('|');
  const sep     = Array.from({length:cols},()=>'----------').join('|');
  let snippet = `|${headers}|\n|${sep}|\n`;
  for (let r=0; r<rows; r++) {
    const cells = Array.from({length:cols},(_,c)=>`    ${String.fromCharCode(65+r)}${c+1}    `).join('|');
    snippet += `|${cells}|\n`;
  }
  ta.value = before + prefix + snippet + after;
  ta.selectionStart = ta.selectionEnd = pos + prefix.length + snippet.length;
  ta.focus(); updatePreview();
  showSnackbar(`${cols}×${rows} table inserted!`, 'table_chart');
}

function insertTableCustom() {
  closeTablePicker();
  const input = prompt('Enter table size as Rows×Cols (e.g. 3x4):', '3x3');
  if (!input) return;
  const m = input.match(/^(\d+)[x×,\s](\d+)$/i);
  if (!m) { showSnackbar('Invalid. Use e.g. 3x4', 'error','error'); return; }
  insertTableGrid(Math.min(+m[1],20), Math.min(+m[2],15));
}

// ── Diagram snippets ──────────────────────
const DIAGRAM_SNIPPETS = {
  flowchart: "```mermaid\nflowchart TD\n    A([Start]) --> B{Is it working?}\n    B -- Yes --> C[Ship it! 🚀]\n    B -- No  --> D[Debug]\n    D --> E[Fix the bug]\n    E --> B\n    C --> F([Done])\n```",
  sequence:  "```mermaid\nsequenceDiagram\n    participant U as User\n    participant S as Server\n    participant DB as Database\n    U->>S: POST /login\n    S->>DB: Verify credentials\n    DB-->>S: User record\n    S-->>U: JWT Token ✓\n```",
  pie:       "```mermaid\npie title Export Usage\n    \"HTML\"  : 42\n    \"PDF\"   : 35\n    \"Word\"  : 23\n```",
  gantt:     "```mermaid\ngantt\n    title Project Timeline\n    section Planning\n    Reqs :done, 2024-01-01, 7d\n```",
  class:     "```mermaid\nclassDiagram\n    Animal <|-- Dog\n```",
  er:        "```mermaid\nerDiagram\n    USER ||--o{ ORDER : \"places\"\n```"
}
function insertDiagram(type) {
  const snippet = DIAGRAM_SNIPPETS[type]; if (!snippet) return;
  const ta = document.getElementById('md-editor');
  const pos = ta.selectionEnd;
  const before = ta.value.substring(0, pos), after = ta.value.substring(pos);
  const prefix = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '\n';
  ta.value = before + prefix + snippet + '\n' + after;
  ta.selectionStart = ta.selectionEnd = pos + prefix.length + snippet.length + 1;
  ta.focus(); updatePreview();
  showSnackbar(`${type.charAt(0).toUpperCase()+type.slice(1)} diagram inserted!`, 'account_tree');
}

// ── Resizer & Sync ──────────────────────────
function setupResizer() {
  const resizer = document.getElementById('pane-resizer');
  const container = resizer.parentElement;
  let isDragging = false;
  let savedRatio = localStorage.getItem('markflow-split-ratio') || 70;
  
  if (window.innerWidth > 860) {
    container.style.gridTemplateColumns = `${savedRatio}% 10px 1fr`;
  }

  resizer.addEventListener('mousedown', () => {
    isDragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const containerRect = container.getBoundingClientRect();
    let percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    percentage = Math.max(20, Math.min(percentage, 80));
    container.style.gridTemplateColumns = `${percentage}% 10px 1fr`;
    localStorage.setItem('markflow-split-ratio', percentage);
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

function setupScrollSync() {
  const editor  = document.getElementById('md-editor');
  const preview = document.getElementById('editor-preview');
  let _syncing = false;
  
  const handleScroll = (source, target) => {
    if (!_scrollSyncOn || _syncing) return;
    _syncing = true;
    const pct = source.scrollTop / (source.scrollHeight - source.clientHeight || 1);
    target.scrollTop = pct * (target.scrollHeight - target.clientHeight);
    setTimeout(() => { _syncing = false; }, 50);
  };

  editor.addEventListener('scroll', () => handleScroll(editor, preview));
  preview.addEventListener('scroll', () => handleScroll(preview, editor));
}

function toggleScrollSync() {
  _scrollSyncOn = !_scrollSyncOn;
  const btn = document.getElementById('sync-toggle-btn');
  const dot = document.getElementById('sync-dot');
  btn.style.color = _scrollSyncOn ? 'var(--c-primary)' : '';
  btn.setAttribute('aria-pressed', _scrollSyncOn);
  dot.classList.toggle('active', _scrollSyncOn);
  showSnackbar(_scrollSyncOn ? 'Scroll sync ON' : 'Scroll sync OFF', _scrollSyncOn ? 'sync' : 'sync_disabled');
}

// ── Find & Replace ────────────────────────
let _findMatches = [], _findIndex = 0;
function toggleFindBar() {
  const bar = document.getElementById('find-bar');
  const btn = document.getElementById('find-toggle-btn');
  const hidden = bar.classList.toggle('hidden');
  btn.setAttribute('aria-pressed', !hidden);
  if (!hidden) {
    document.getElementById('find-input').focus();
  } else {
    _findMatches = []; document.getElementById('find-count').textContent = '';
  }
}
function runFind() {
  const query = document.getElementById('find-input').value;
  const ta = document.getElementById('md-editor');
  _findMatches = []; _findIndex = 0;
  if (!query) { document.getElementById('find-count').textContent = ''; return; }
  const text = ta.value;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re = new RegExp(escapedQuery, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) _findMatches.push(m.index);
  const cnt = _findMatches.length;
  document.getElementById('find-count').textContent = cnt ? `${_findIndex+1}/${cnt}` : '0 found';
  if (cnt) { ta.setSelectionRange(_findMatches[0], _findMatches[0] + query.length); ta.focus(); }
}
function findKeyNav(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!_findMatches.length) return;
    _findIndex = (e.shiftKey ? _findIndex - 1 + _findMatches.length : _findIndex + 1) % _findMatches.length;
    const q = document.getElementById('find-input').value;
    const ta = document.getElementById('md-editor');
    ta.setSelectionRange(_findMatches[_findIndex], _findMatches[_findIndex] + q.length);
    ta.focus();
    document.getElementById('find-count').textContent = `${_findIndex+1}/${_findMatches.length}`;
  }
  if (e.key === 'Escape') toggleFindBar();
}
function doReplace(all) {
  const q = document.getElementById('find-input').value;
  const r = document.getElementById('replace-input').value;
  if (!q) return;
  const ta = document.getElementById('md-editor');
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  
  if (all) {
    const re = new RegExp(escapedQuery, 'gi');
    ta.value = ta.value.replace(re, r);
    showSnackbar('Replaced all occurrences.', 'find_replace');
  } else {
    if (!_findMatches.length) runFind();
    if (!_findMatches.length) return;
    const idx = _findMatches[_findIndex];
    ta.value = ta.value.substring(0, idx) + r + ta.value.substring(idx + q.length);
    showSnackbar('Replaced 1 occurrence.', 'find_replace');
  }
  updatePreview(); 
  runFind(); // Re-index after replacement
}
