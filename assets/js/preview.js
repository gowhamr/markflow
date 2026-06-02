/**
 * Markflow — Preview Engine
 * Handles Markdown parsing, syntax highlighting, and Mermaid diagrams.
 */

// ── 1. Marked.js setup ────────────────────────
const MERMAID_LANGS = new Set(['mermaid','flowchart','flowcharttd','flowchartlr',
  'sequencediagram','sequence','classdiagram','class','erdiagram','er',
  'gantt','pie','gitgraph','git','mindmap','timeline','xychart','sankey']);

const renderer = new marked.Renderer();
renderer.code = function(code, lang) {
  const safeCode = String(code || '');
  const rawLang  = String(lang || '').trim();
  const safeLang = rawLang.toLowerCase().replace(/\s+/g,'');
  if (MERMAID_LANGS.has(safeLang) || safeLang.startsWith('mermaid')) {
    return `<div class="mermaid-placeholder" data-src="${encodeURIComponent(safeCode)}" data-lang="${rawLang||'mermaid'}"></div>`;
  }
  let highlighted;
  if (safeLang && hljs.getLanguage(safeLang)) {
    try { highlighted = hljs.highlight(safeCode, { language: safeLang }).value; }
    catch(e) { highlighted = hljs.highlightAuto(safeCode).value; }
  } else {
    highlighted = hljs.highlightAuto(safeCode).value;
  }
  return `<pre data-lang="${safeLang}"><code class="hljs${safeLang?' language-'+safeLang:''}">${highlighted}</code></pre>`;
};
marked.setOptions({ renderer, gfm: true, breaks: true, pedantic: false, sanitize: false, smartLists: true });

function parseMarkdown(md) {
  try {
    // Basic KaTeX integration (inline and block)
    let processedMd = md
      // Block math: $$ ... $$
      .replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, formula) => {
        try { return `<div class="katex-block">${katex.renderToString(formula, { displayMode: true, throwOnError: false })}</div>`; }
        catch(e) { return match; }
      })
      // Inline math: $ ... $ (avoiding matches within words or escaped $)
      .replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix, formula) => {
        try { return prefix + katex.renderToString(formula, { displayMode: false, throwOnError: false }); }
        catch(e) { return match; }
      });

    const r = marked.parse(processedMd);
    return typeof r === 'string' ? r : '';
  } catch(e) { return `<p style="color:var(--c-error)">Parse error: ${e.message}</p>`; }
}

// ── 2. Mermaid ────────────────────────────────
let _mermaidId = 0;
const DIAGRAM_LABELS = {
  'mermaid':'Diagram','flowchart':'Flowchart','flowcharttd':'Flowchart',
  'flowchartlr':'Flowchart','sequencediagram':'Sequence Diagram','sequence':'Sequence Diagram',
  'classdiagram':'Class Diagram','class':'Class Diagram','erdiagram':'ER Diagram','er':'ER Diagram',
  'gantt':'Gantt Chart','pie':'Pie Chart','gitgraph':'Git Graph','git':'Git Graph',
  'mindmap':'Mind Map','timeline':'Timeline','xychart':'XY Chart','sankey':'Sankey',
};
const DIAGRAM_ICONS = {
  'Flowchart':'account_tree','Sequence Diagram':'swap_horiz','Class Diagram':'schema',
  'ER Diagram':'device_hub','Gantt Chart':'view_timeline','Pie Chart':'pie_chart',
  'Git Graph':'merge_type','Mind Map':'grain','Timeline':'timeline',
  'XY Chart':'show_chart','Sankey':'waterfall_chart','Diagram':'polyline',
};
function detectDiagramLabel(src, rawLang) {
  const key = rawLang.toLowerCase().replace(/\s+/g,'');
  if (DIAGRAM_LABELS[key] && DIAGRAM_LABELS[key] !== 'Diagram') return DIAGRAM_LABELS[key];
  const firstWord = src.trim().split(/[\s\n{]/)[0].toLowerCase();
  return DIAGRAM_LABELS[firstWord] || DIAGRAM_LABELS[key] || 'Diagram';
}

async function renderMermaid(container) {
  const phs = container.querySelectorAll('.mermaid-placeholder');
  for (const ph of phs) {
    const src  = decodeURIComponent(ph.getAttribute('data-src') || '');
    const lang = ph.getAttribute('data-lang') || 'mermaid';
    if (!src.trim()) continue;
    const label = detectDiagramLabel(src, lang);
    const icon  = DIAGRAM_ICONS[label] || 'polyline';
    const id    = `mmd-${++_mermaidId}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-wrapper';
    wrapper.innerHTML = `
      <div class="mermaid-toolbar">
        <span class="mermaid-toolbar__badge">
          <span class="material-icons" style="font-size:11px">${icon}</span>${label}
        </span>
        <div class="mermaid-toolbar__spacer"></div>
        <button class="mermaid-copy-btn"><span class="material-icons">content_copy</span> Copy</button>
        <button class="mermaid-zoom-btn"><span class="material-icons">zoom_out_map</span> Zoom</button>
      </div>
      <div class="mermaid-body" id="${id}-body">
        <div style="display:flex;align-items:center;gap:8px;color:var(--c-text-2);font-size:.82rem;">
          <div class="spinner"></div> Rendering…
        </div>
      </div>`;
    ph.replaceWith(wrapper);
    wrapper.querySelector('.mermaid-copy-btn').addEventListener('click', function() {
      navigator.clipboard.writeText(src).then(() => {
        this.innerHTML = '<span class="material-icons">check</span> Copied!';
        this.style.color = 'var(--c-success)';
        setTimeout(() => { this.innerHTML = '<span class="material-icons">content_copy</span> Copy'; this.style.color = ''; }, 2000);
      });
    });
    wrapper.querySelector('.mermaid-zoom-btn').addEventListener('click', function() {
      const svg = wrapper.querySelector('svg');
      if (svg) openDiagramLightbox(svg.outerHTML);
    });
    try {
      const { svg } = await mermaid.render(id, src);
      const body = document.getElementById(`${id}-body`);
      if (body) body.innerHTML = svg;
    } catch(err) {
      const body = document.getElementById(`${id}-body`);
      if (body) { body.innerHTML = ''; const e = document.createElement('div'); e.className = 'mermaid-error'; e.textContent = '⚠ ' + (err.message || err); wrapper.appendChild(e); }
    }
  }
}

function openDiagramLightbox(svgHTML) {
  const overlay = document.createElement('div');
  overlay.className = 'diagram-lightbox';
  overlay.innerHTML = `<div class="diagram-lightbox__inner"><button class="diagram-lightbox__close"><span class="material-icons">close</span></button>${svgHTML}</div>`;
  overlay.querySelector('.diagram-lightbox__close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── 3. UI Helpers ─────────────────────────────
function injectCopyButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-code-btn')) return;
    const lang = pre.getAttribute('data-lang') || '';
    if (lang) {
      const badge = document.createElement('span');
      badge.className = 'code-lang-badge'; badge.textContent = lang;
      pre.insertBefore(badge, pre.firstChild);
    }
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn'; btn.title = 'Copy code';
    btn.innerHTML = '<span class="material-icons" aria-hidden="true">content_copy</span>';
    btn.setAttribute('aria-label', 'Copy code block');
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const code = pre.querySelector('code');
      if (!code) return;
      navigator.clipboard.writeText(code.innerText).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<span class="material-icons">check</span>';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '<span class="material-icons">content_copy</span>'; }, 2000);
      }).catch(() => showSnackbar('Copy failed.', 'error'));
    });
    pre.appendChild(btn);
  });
}

function getCleanPreviewEl(source) {
  const el = source === 'upload'
    ? document.getElementById('upload-preview')
    : document.getElementById('editor-preview');
  if (!el) return null;
  const clone = el.cloneNode(true);

  clone.querySelectorAll(
    '.copy-code-btn, .code-lang-badge, .preview-empty, ' +
    '.mermaid-toolbar, .mermaid-copy-btn, .mermaid-zoom-btn, ' +
    '.mermaid-toolbar__badge, .mermaid-toolbar__spacer'
  ).forEach(n => n.remove());

  clone.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
    const svg = wrapper.querySelector('svg');
    const body = wrapper.querySelector('.mermaid-body');
    if (svg) {
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
      svg.style.margin = '1.25em auto';
      wrapper.replaceWith(svg);
    } else if (body && body.textContent.trim()) {
      const p = document.createElement('p');
      p.style.color = '#c62828';
      p.style.fontStyle = 'italic';
      p.textContent = '[Diagram could not be rendered]';
      wrapper.replaceWith(p);
    } else {
      wrapper.remove();
    }
  });

  return clone;
}

function getCleanInnerHTML(source) {
  const clone = getCleanPreviewEl(source);
  return clone ? clone.innerHTML : '';
}
