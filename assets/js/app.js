/**
 * Markflow — Main Application
 * Handles theme, mode switching, file uploads, exports, and initialization.
 */

// ── 1. Theme Logic ────────────────────────────
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('theme-icon').textContent = dark ? 'light_mode' : 'dark_mode';
  document.getElementById('theme-btn').setAttribute('aria-pressed', dark);
  document.getElementById('hljs-light').disabled = dark;
  document.getElementById('hljs-dark').disabled  = !dark;
  localStorage.setItem('em-theme', dark ? 'dark' : 'light');
  
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default',
    securityLevel: 'loose', fontFamily: 'DM Sans, sans-serif',
    flowchart: { curve: 'basis', useMaxWidth: true },
    sequence: { useMaxWidth: true }, gantt: { useMaxWidth: true }
  });

  // Re-render diagrams if content exists
  const editorMarkdown = document.getElementById('md-editor').value;
  if (editorMarkdown) updatePreview();

  const uploadPreview = document.getElementById('upload-preview');
  if (uploadPreview.innerHTML.trim()) {
    // If we have an uploaded file, we might need to re-render its mermaid
    // Since we don't store the raw markdown for upload globally in a simple way 
    // besides the UI, we can just trigger a re-parse if we had a way.
    // For now, let's at least ensure the editor preview is updated.
  }
}

function toggleTheme() {
  document.body.classList.add('theme-transitioning');
  setTimeout(() => document.body.classList.remove('theme-transitioning'), 280);
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  applyTheme(dark);
}

// ── 2. Mode & View ────────────────────────────
function switchMode(mode) {
  document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => { 
    b.classList.remove('active'); 
    b.setAttribute('aria-selected','false'); 
  });
  document.getElementById(`panel-${mode}`).classList.add('active');
  const tab = document.getElementById(`tab-${mode}`);
  tab.classList.add('active'); 
  tab.setAttribute('aria-selected','true');
  document.getElementById('mobile-view-toggle').style.display = mode === 'editor' ? '' : 'none';
}

let _mobileView = 'editor';
function setMobileView(v) {
  _mobileView = v;
  document.getElementById('editor-pane').classList.toggle('mobile-hidden', v !== 'editor');
  document.getElementById('preview-pane').classList.toggle('mobile-hidden', v !== 'preview');
  
  const editBtn = document.getElementById('mvt-edit');
  const prevBtn = document.getElementById('mvt-preview');
  
  editBtn.classList.toggle('active', v === 'editor');
  editBtn.setAttribute('aria-selected', v === 'editor');
  
  prevBtn.classList.toggle('active', v === 'preview');
  prevBtn.setAttribute('aria-selected', v === 'preview');
}

function currentSource() {
  return document.getElementById('panel-upload').classList.contains('active') ? 'upload' : 'editor';
}

// ── 3. Upload Logic ───────────────────────────
function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); document.getElementById('drop-zone').classList.add('drag-over'); }
function handleDragLeave(e) { document.getElementById('drop-zone').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) processFile(files[0]);
}
function handleFileInput(e) { if (e.target.files.length > 0) processFile(e.target.files[0]); }

function processFile(file) {
  if (!file.name.match(/\.(md|markdown)$/i)) { 
    showSnackbar('Only .md files supported.', 'error', 'error'); return; 
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const md = e.target.result;
    renderUploadPreview(md);
    document.getElementById('file-name-display').textContent = file.name;
    document.getElementById('file-info').classList.add('visible');
    showSnackbar(`"${file.name}" loaded.`, 'check_circle');
  };
  reader.onerror = () => showSnackbar('Failed to read file.', 'error');
  reader.readAsText(file);
}

function renderUploadPreview(markdown) {
  const html = parseMarkdown(markdown);
  const preview = document.getElementById('upload-preview');
  preview.innerHTML = html;
  injectCopyButtons(preview); renderMermaid(preview);
  document.getElementById('upload-preview-card').style.display = 'block';
  const wc = markdown.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('upload-word-count').textContent = `${wc.toLocaleString()} words`;
}

function clearUpload() {
  document.getElementById('upload-preview').innerHTML = '';
  document.getElementById('upload-preview-card').style.display = 'none';
  document.getElementById('file-info').classList.remove('visible');
  document.getElementById('file-input').value = '';
  showSnackbar('Cleared.', 'delete_outline');
}

// ── 4. Export Functions ───────────────────────
function copyPreviewMarkdown(source) {
  const src = source || 'editor';
  const md = src === 'upload' 
    ? (document.getElementById('upload-preview').innerText || '') 
    : document.getElementById('md-editor').value;
  if (!md) { showSnackbar('Nothing to copy.', 'info'); return; }
  navigator.clipboard.writeText(md).then(() => {
    const btn = document.getElementById(src === 'upload' ? 'upload-copy-btn' : 'preview-copy-btn');
    const lbl = document.getElementById('preview-copy-label');
    btn.classList.add('copied');
    if (lbl) lbl.textContent = 'Copied!';
    showSnackbar('Markdown copied to clipboard!', 'content_copy');
    setTimeout(() => {
      btn.classList.remove('copied');
      if (lbl) lbl.textContent = 'Copy MD';
    }, 2200);
  }).catch(() => showSnackbar('Copy failed.', 'error'));
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getExportFilename(extension) {
  const markdown = document.getElementById('md-editor').value;
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  let name = 'easy-markdown-export';
  if (h1Match && h1Match[1]) {
    name = h1Match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  return `${name || 'easy-markdown-export'}.${extension}`;
}

function exportHTML(source) {
  const inner = getCleanInnerHTML(source);
  if (!inner || !inner.trim()) { showSnackbar('Nothing to export.', 'warning'); return; }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Exported by Easy Markdown</title>
  <style>
    :root {
      --bg: #ffffff; --text: #24292e; --link: #0366d6; --border: #eaecef;
      --code-bg: #f6f8fa; --quote-border: #dfe2e5; --quote-text: #6a737d;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117; --text: #c9d1d9; --link: #58a6ff; --border: #21262d;
        --code-bg: #161b22; --quote-border: #30363d; --quote-text: #8b949e;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      font-size: 16px; line-height: 1.5; color: var(--text); background-color: var(--bg);
      max-width: 900px; margin: 0 auto; padding: 40px; word-wrap: break-word;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { padding-bottom: .3em; font-size: 2em; border-bottom: 1px solid var(--border); }
    h2 { padding-bottom: .3em; font-size: 1.5em; border-bottom: 1px solid var(--border); }
    h3 { font-size: 1.25em; } h4 { font-size: 1em; }
    p, blockquote, ul, ol, dl, table, pre, details { margin-top: 0; margin-bottom: 16px; }
    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    blockquote { padding: 0 1em; color: var(--quote-text); border-left: .25em solid var(--quote-border); }
    ul, ol { padding-left: 2em; }
    table { border-spacing: 0; border-collapse: collapse; display: block; width: 100%; overflow: auto; }
    table th, table td { padding: 6px 13px; border: 1px solid var(--border); }
    table tr { background-color: var(--bg); border-top: 1px solid var(--border); }
    table tr:nth-child(2n) { background-color: var(--code-bg); }
    img, svg { max-width: 100%; box-sizing: content-box; background-color: var(--bg); display: block; margin: 0 auto; }
    code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 85%; background-color: rgba(175, 184, 193, 0.2); padding: .2em .4em; border-radius: 6px; }
    pre { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 85%; line-height: 1.45; background-color: var(--code-bg); border-radius: 6px; padding: 16px; overflow: auto; }
    pre code { background-color: transparent; padding: 0; border-radius: 0; }
  </style>
</head>
<body>
  ${inner}
</body>
</html>`;

  downloadBlob(html, getExportFilename('html'), 'text/html');
  showSnackbar('HTML file downloaded!', 'check_circle');
}

async function exportPDF(source) {
  const content = getCleanPreviewEl(source);
  if (!content || !content.innerHTML.trim()) { showSnackbar('Nothing to export.', 'warning'); return; }

  showSnackbar('Preparing PDF...', 'sync');

  const originalTheme = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', 'light');

  const master = document.createElement('div');
  master.className = 'export-mode';
  master.style.cssText = 'position:absolute; top:-99999px; left:0; width:850px; background:#ffffff; padding:40px; box-sizing:border-box; color:#24292e; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6;';
  master.innerHTML = content.innerHTML;
  document.body.appendChild(master);

  try {
    if (window.renderMermaid) await renderMermaid(master);
    await document.fonts.ready;
    const images = Array.from(master.querySelectorAll('img'));
    await Promise.all(images.map(img => 
      img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
    ));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise(r => setTimeout(r, 500));

    const masterRect = master.getBoundingClientRect();
    const canvas = await html2canvas(master, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: master.offsetWidth,
      height: master.offsetHeight
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = 210, pageH = 297, margin = 12;
    const printW = pageW - (margin * 2);
    const printH = pageH - (margin * 2);
    const scaleFactor = printW / master.offsetWidth; // px to mm
    const pxScale = 2;

    // 1. Map IDs to Y-positions (mm)
    const idMap = {};
    master.querySelectorAll('[id]').forEach(el => {
      const rect = el.getBoundingClientRect();
      idMap[el.id] = (rect.top - masterRect.top) * scaleFactor;
    });

    // 2. Precise breakpoint detection
    const breakPoints = [0];
    Array.from(master.children).forEach(child => {
      const rect = child.getBoundingClientRect();
      const childTop = (rect.top - masterRect.top) * scaleFactor;
      const childBottom = (rect.bottom - masterRect.top) * scaleFactor;
      
      if (childBottom - breakPoints[breakPoints.length - 1] > printH) {
        if (childTop > breakPoints[breakPoints.length - 1]) {
          breakPoints.push(childTop);
        }
      }
    });
    breakPoints.push(master.offsetHeight * scaleFactor);

    // 3. Sliced Rendering with tempCanvas
    for (let i = 0; i < breakPoints.length - 1; i++) {
      if (i > 0) pdf.addPage();
      
      const startY_mm = breakPoints[i];
      const endY_mm = breakPoints[i+1];
      const sliceH_mm = endY_mm - startY_mm;
      
      const startY_px = (startY_mm / scaleFactor) * pxScale;
      const sliceH_px = (sliceH_mm / scaleFactor) * pxScale;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = sliceH_px;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, startY_px, canvas.width, sliceH_px, 0, 0, canvas.width, sliceH_px);

      pdf.addImage(tempCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, printW, sliceH_mm, undefined, 'FAST');

      // 4. Anchor links
      master.querySelectorAll('a[href^="#"]').forEach(link => {
        const targetId = link.getAttribute('href').substring(1);
        const targetY_mm = idMap[targetId];
        if (targetY_mm !== undefined) {
          const rect = link.getBoundingClientRect();
          const lTop = (rect.top - masterRect.top) * scaleFactor;
          const lLeft = (rect.left - masterRect.left) * scaleFactor;

          if (lTop >= startY_mm && lTop < endY_mm) {
            let targetPage = 1;
            for (let j = 0; j < breakPoints.length - 1; j++) {
              if (targetY_mm >= breakPoints[j] && targetY_mm < breakPoints[j+1]) {
                targetPage = j + 1; break;
              }
            }
            pdf.link(margin + lLeft, margin + (lTop - startY_mm), rect.width * scaleFactor, rect.height * scaleFactor, {
              pageNumber: targetPage,
              top: margin + (targetY_mm - breakPoints[targetPage - 1])
            });
          }
        }
      });
    }

    pdf.save(getExportFilename('pdf'));
    showSnackbar('PDF exported successfully!', 'check_circle');

  } catch (err) {
    console.error('PDF Export Error:', err);
    showSnackbar('PDF export failed: ' + err.message, 'error');
  } finally {
    if (document.body.contains(master)) document.body.removeChild(master);
    document.documentElement.setAttribute('data-theme', originalTheme);
  }
}

function exportWord(source) {
  const inner = getCleanInnerHTML(source);
  if (!inner || !inner.trim()) { showSnackbar('Nothing to export.', 'warning'); return; }
  
  // Create an XML-based MS Word document wrapper
  const wordHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Exported Document</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; }
    h1 { font-size: 24pt; font-weight: bold; color: #2F5496; margin-bottom: 12pt; }
    h2 { font-size: 18pt; font-weight: bold; color: #2F5496; margin-bottom: 10pt; }
    h3 { font-size: 14pt; font-weight: bold; color: #1F3763; margin-bottom: 8pt; }
    p { margin-bottom: 10pt; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 15pt; }
    th, td { border: 1pt solid #8EA9DB; padding: 5pt; text-align: left; }
    th { background-color: #D9E1F2; font-weight: bold; }
    code { font-family: 'Consolas', 'Courier New', monospace; font-size: 10pt; background: #F2F2F2; }
    pre { background: #F2F2F2; padding: 10pt; font-family: 'Consolas', monospace; }
    blockquote { border-left: 3pt solid #D9D9D9; padding-left: 10pt; color: #595959; font-style: italic; }
  </style>
</head>
<body>
  ${inner}
</body>
</html>`;

  downloadBlob(wordHtml, getExportFilename('doc'), 'application/msword');
  showSnackbar('Word document downloaded!', 'check_circle');
}

// ── 5. Feedback ───────────────────────────────
let _snackTimer;
function showSnackbar(msg, icon='info', type='default') {
  const bar = document.getElementById('snackbar');
  document.getElementById('snackbar-text').textContent = msg;
  document.getElementById('snackbar-icon').textContent = icon;
  bar.style.background = type==='error' ? 'var(--c-error)' : type==='warning' ? 'var(--c-warn)' : '';
  bar.classList.add('show');
  clearTimeout(_snackTimer);
  _snackTimer = setTimeout(() => bar.classList.remove('show'), 3200);
}

// ── 6. Initialisation ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _emptyStateEl = document.getElementById('editor-empty-state');
  const editor = document.getElementById('md-editor');

  // Smart Typing
  editor.addEventListener('keydown', e => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    if (e.key === 'Tab') {
      e.preventDefault();
      editor.value = val.substring(0, start) + '  ' + val.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      updatePreview();
    }

    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const pair = pairs[e.key];
      if (start !== end) {
        const selected = val.substring(start, end);
        editor.value = val.substring(0, start) + e.key + selected + pair + val.substring(end);
        editor.selectionStart = start + 1; editor.selectionEnd = end + 1;
      } else {
        editor.value = val.substring(0, start) + e.key + pair + val.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 1;
      }
      updatePreview();
    }

    if (e.key === 'Enter') {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s+/);
      if (listMatch) {
        const prefix = listMatch[0];
        const content = currentLine.substring(prefix.length).trim();
        if (content.length > 0) {
          e.preventDefault();
          let nextPrefix = prefix;
          if (prefix.match(/\d+\.\s+/)) {
            const num = parseInt(prefix);
            nextPrefix = prefix.replace(/\d+/, num + 1);
          }
          editor.value = val.substring(0, start) + '\n' + nextPrefix + val.substring(end);
          editor.selectionStart = editor.selectionEnd = start + 1 + nextPrefix.length;
          updatePreview();
        } else {
          e.preventDefault();
          editor.value = val.substring(0, lineStart) + '\n' + val.substring(end);
          editor.selectionStart = editor.selectionEnd = lineStart + 1;
          updatePreview();
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insertSyntax('**','**'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insertSyntax('*','*'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); toggleFindBar(); }
  });

  // Drop zone
  document.getElementById('drop-zone').addEventListener('keypress', e => {
    if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-input').click();
  });

  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop',     e => e.preventDefault());

  // Systems
  setupScrollSync();
  setupResizer();

  // Restore
  const savedContent = localStorage.getItem('markflow-content');
  if (savedContent) {
    editor.value = savedContent;
    updatePreview();
  }

  document.getElementById('sync-dot').classList.add('active');

  // Theme Init
  const savedTheme = localStorage.getItem('em-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('em-theme')) applyTheme(e.matches);
  });
});
