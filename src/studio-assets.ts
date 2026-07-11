import { SCOUT_THEME_SCRIPT, THEME_SCRIPT } from "./ui-codegen.js";

export { SCOUT_THEME_SCRIPT, THEME_SCRIPT };

export const STUDIO_CSS = `
:root {
  color-scheme: light;
  --cp-bg: #f7f4ef;
  --cp-bg-elevated: #fcfbf8;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f5f5f5;
  --cp-border: #dedede;
  --cp-border-strong: #919191;
  --cp-text: #242424;
  --cp-text-muted: #5c5c5c;
  --cp-text-soft: #6f6f6f;
  --cp-accent: #b11f4b;
  --cp-accent-hover: #9a1a41;
  --cp-accent-soft: rgba(177, 31, 75, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #16a34a;
  --cp-danger: #dc2626;
  --cp-warning: #f59e0b;
  --cp-link: #0078d4;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: rgba(177, 31, 75, 0.12);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #3d3b3a;
  --cp-bg-elevated: #343231;
  --cp-surface: #292929;
  --cp-surface-soft: #2e2e2e;
  --cp-border: #474747;
  --cp-border-strong: #5f5f5f;
  --cp-text: #dedede;
  --cp-text-muted: #919191;
  --cp-text-soft: #b0b0b0;
  --cp-accent: #fd8ea1;
  --cp-accent-hover: #fb7b91;
  --cp-accent-soft: rgba(253, 142, 161, 0.14);
  --cp-accent-fg: #1a1a1a;
  --cp-success: #4ade80;
  --cp-danger: #f87171;
  --cp-warning: #fbbf24;
  --cp-link: #4da6ff;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  --cp-overlay: rgba(41, 41, 41, 0.88);
  --cp-panel: rgba(41, 41, 41, 0.72);
  --cp-panel-strong: rgba(41, 41, 41, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(253, 142, 161, 0.12);
}
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  font-family: "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--cp-bg);
  color: var(--cp-text);
  display: flex;
  flex-direction: column;
  font-size: 14px;
  line-height: 1.5;
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; border: none; background: none; }
button:disabled { cursor: not-allowed; opacity: .6; }
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible { outline: 3px solid var(--cp-accent); outline-offset: 2px; }

/* Header */
#studio-header {
  background: var(--cp-surface);
  border-bottom: 1px solid var(--cp-border);
  padding: 0 16px;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
#studio-header h1 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--cp-text);
}
#studio-header .filename {
  font-size: 12px;
  color: var(--cp-text-muted);
  font-family: "Cascadia Code", "Fira Mono", "Consolas", monospace;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--cp-accent-soft);
  color: var(--cp-accent);
  font-weight: 600;
  letter-spacing: .3px;
  white-space: nowrap;
}
.spacer { flex: 1; }
#btn-theme {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
}
#btn-theme:hover { background: var(--cp-highlight); color: var(--cp-text); }

/* Main layout */
#studio-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Editor pane */
#editor-pane {
  width: 50%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--cp-border);
  overflow: hidden;
}

/* Toolbar */
#editor-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--cp-border);
  background: var(--cp-bg-elevated);
  flex-shrink: 0;
}
.toolbar-btn {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--cp-text);
}
.toolbar-btn:hover:not(:disabled) { background: var(--cp-highlight); border-color: var(--cp-accent); color: var(--cp-accent); }
.toolbar-btn.primary {
  background: var(--cp-accent);
  border-color: var(--cp-accent);
  color: var(--cp-accent-fg);
}
.toolbar-btn.primary:hover:not(:disabled) { background: var(--cp-accent-hover); }

/* Templates */
#btn-templates {
  background: none;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-left: auto;
}
#btn-templates:hover { background: var(--cp-surface-soft); color: var(--cp-text); }

/* Editor area */
#editor-wrap {
  flex: 1;
  display: flex;
  overflow: hidden;
  font-family: "Cascadia Code", "Fira Mono", "Consolas", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
}
#line-numbers {
  padding: 10px 8px 10px 10px;
  background: var(--cp-bg-elevated);
  border-right: 1px solid var(--cp-border);
  color: var(--cp-text-muted);
  text-align: right;
  user-select: none;
  overflow-y: hidden;
  flex-shrink: 0;
  min-width: 40px;
  white-space: pre;
}
#editor {
  flex: 1;
  resize: none;
  border: none;
  padding: 10px 12px;
  background: var(--cp-surface);
  color: var(--cp-text);
  outline: none;
  white-space: pre;
  overflow-wrap: normal;
  overflow: auto;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

/* Status bar */
#status-bar {
  padding: 4px 12px;
  font-size: 11px;
  border-top: 1px solid var(--cp-border);
  background: var(--cp-bg-elevated);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.status-valid { color: var(--cp-success); font-weight: 600; }
.status-error { color: var(--cp-danger); font-weight: 600; }
.status-checking { color: var(--cp-text-muted); }
#unsaved-dot {
  display: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--cp-accent);
}
#unsaved-dot.visible { display: inline-block; }

/* Right panels */
#panels {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
[role="tablist"] {
  display: flex;
  border-bottom: 1px solid var(--cp-border);
  background: var(--cp-bg-elevated);
  padding: 0 8px;
  flex-shrink: 0;
  gap: 2px;
}
[role="tab"] {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px 4px 0 0;
  color: var(--cp-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
[role="tab"]:hover { color: var(--cp-text); }
[role="tab"][aria-selected="true"] {
  color: var(--cp-accent);
  border-bottom-color: var(--cp-accent);
}
[role="tabpanel"] {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: none;
}
[role="tabpanel"].active { display: flex; flex-direction: column; gap: 8px; }

/* Problems panel */
.diagnostic-item {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-left: 3px solid var(--cp-danger);
  border-radius: 4px;
  padding: 8px 10px;
  cursor: pointer;
}
.diagnostic-item:hover { border-left-color: var(--cp-accent); }
.diagnostic-code { font-weight: 600; color: var(--cp-danger); font-size: 11px; font-family: monospace; }
.diagnostic-location { color: var(--cp-text-muted); font-size: 11px; font-family: monospace; }
.diagnostic-message { color: var(--cp-text); font-size: 12px; margin: 2px 0; }
.diagnostic-hint { color: var(--cp-text-soft); font-size: 11px; }
.zero-problems { color: var(--cp-success); font-weight: 600; font-size: 13px; padding: 8px 0; }

/* Model panel */
.model-section { margin-bottom: 16px; }
.model-section h3 {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--cp-text-muted);
  margin: 0 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--cp-border);
}
.model-card {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 6px;
}
.model-card-name { font-weight: 600; font-size: 13px; color: var(--cp-text); }
.model-card-meta { font-size: 11px; color: var(--cp-text-muted); margin-top: 4px; }
.model-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--cp-accent-soft);
  color: var(--cp-accent);
  margin-left: 4px;
}
.model-field { font-size: 12px; padding: 2px 0; color: var(--cp-text-soft); font-family: monospace; }
.model-field strong { color: var(--cp-text); }
.perm-deny { color: var(--cp-text-muted); font-size: 11px; }
.perm-allow { color: var(--cp-success); font-size: 11px; font-weight: 600; }
.perm-table { border-collapse: collapse; width: 100%; font-size: 11px; }
.perm-table th, .perm-table td { border: 1px solid var(--cp-border); padding: 4px 8px; text-align: left; }
.perm-table th { background: var(--cp-surface-soft); font-weight: 600; color: var(--cp-text-muted); }
.safety-ok { color: var(--cp-success); }
.safety-warn { color: var(--cp-warning); }

/* Canonical / Raw IR panes */
.code-pane {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 12px;
  font-family: "Cascadia Code", "Fira Mono", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre;
  overflow: auto;
  color: var(--cp-text);
  flex: 1;
}
.ir-collapsible summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  padding: 6px 0;
  color: var(--cp-text-muted);
  user-select: none;
}
.ir-collapsible summary:hover { color: var(--cp-text); }

/* Dialogs */
dialog {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 10px;
  padding: 20px 24px;
  color: var(--cp-text);
  max-width: min(520px, 92vw);
  width: 100%;
  box-shadow: var(--cp-shadow);
}
dialog::backdrop { background: rgba(0,0,0,.4); }
.dialog-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--cp-text);
}
.dialog-body { font-size: 13px; color: var(--cp-text-muted); margin-bottom: 16px; line-height: 1.6; }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.diff-pane {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.6;
  max-height: 280px;
  overflow: auto;
  white-space: pre;
  margin-bottom: 16px;
}
.diff-add { color: var(--cp-success); }
.diff-remove { color: var(--cp-danger); }
.diff-same { color: var(--cp-text-muted); }
.plan-list {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
}
.plan-list li {
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 4px;
}
.plan-item-ok { background: rgba(22,163,74,.08); color: var(--cp-success); }
.plan-item-destructive { background: rgba(220,38,38,.08); color: var(--cp-danger); }
.plan-item-review { background: var(--cp-accent-soft); color: var(--cp-accent); }
.generation-result {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.7;
  max-height: 200px;
  overflow: auto;
  white-space: pre;
  color: var(--cp-text);
}

/* Live region */
#live-region {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
}

/* Template list */
.template-item {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  margin-bottom: 8px;
}
.template-item:hover { border-color: var(--cp-accent); background: var(--cp-highlight); }
.template-name { font-weight: 600; font-size: 13px; }
.template-desc { font-size: 12px; color: var(--cp-text-muted); margin-top: 2px; }
`.trim();

export const STUDIO_JS = `
/* IntentLang Studio v0.6 client */
(function () {
  'use strict';

  var state = {
    csrfToken: '',
    source: '',
    savedSource: '',
    checking: false,
    diagnostics: [],
    model: null,
    canonical: '',
    ir: null,
    activeTab: 'problems',
    planToken: null,
    planItems: [],
    planError: null
  };

  var TEMPLATES = [
    {
      id: 'todo',
      name: 'Todo App',
      description: 'Simple task management with user authentication, owner-scoped tasks.',
      source: ''
    },
    {
      id: 'issue-tracker',
      name: 'Issue Tracker',
      description: 'Projects and tickets with admin and member roles, status transitions.',
      source: ''
    }
  ];

  var debounceTimer = null;
  var DEBOUNCE_MS = 500;

  function el(id) { return document.getElementById(id); }

  function escText(str) {
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    try {
      var resp = await fetch('/api/state');
      if (!resp.ok) { showFatal('Could not load initial state: ' + resp.status); return; }
      var data = await resp.json();
      state.csrfToken = data.csrfToken || '';
      state.source = data.source || '';
      state.savedSource = data.source || '';
      TEMPLATES[0].source = data.templates && data.templates.todo ? data.templates.todo : '';
      TEMPLATES[1].source = data.templates && data.templates['issue-tracker'] ? data.templates['issue-tracker'] : '';
      applyStateData(data);
      el('editor').value = state.source;
      updateLineNumbers();
      renderFromState();
      bindEvents();
      announce('Studio loaded. Source: ' + data.filename);
    } catch (err) {
      showFatal('Failed to initialise Studio: ' + String(err));
    }
  }

  function applyStateData(data) {
    state.diagnostics = data.diagnostics || [];
    state.model = data.model || null;
    state.canonical = data.canonical || '';
    state.ir = data.ir || null;
  }

  function showFatal(msg) {
    var b = document.body;
    b.textContent = '';
    var p = document.createElement('p');
    p.style.cssText = 'padding:24px;color:var(--cp-danger);font-family:monospace;';
    p.textContent = 'Fatal: ' + msg;
    b.appendChild(p);
  }

  // ── Events ────────────────────────────────────────────────────────────────────

  function bindEvents() {
    // Editor
    el('editor').addEventListener('input', onEditorInput);
    el('editor').addEventListener('scroll', syncLineNumberScroll);
    el('editor').addEventListener('keydown', onEditorKeydown);

    // Toolbar
    el('btn-check').addEventListener('click', function () { runCheck(el('editor').value); });
    el('btn-format').addEventListener('click', onFormat);
    el('btn-save').addEventListener('click', onSaveClick);
    el('btn-generate').addEventListener('click', onGenerateClick);
    el('btn-templates').addEventListener('click', openTemplates);

    // Theme
    el('btn-theme').addEventListener('click', toggleTheme);

    // Tabs
    document.querySelectorAll('[role="tab"]').forEach(function (tab) {
      tab.addEventListener('click', function () { activateTab(tab.getAttribute('data-tab')); });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(tab.getAttribute('data-tab')); }
        if (e.key === 'ArrowRight') { focusNextTab(tab, 1); }
        if (e.key === 'ArrowLeft') { focusNextTab(tab, -1); }
      });
    });

    // Dialogs — close on backdrop click
    ['dlg-format', 'dlg-save', 'dlg-plan', 'dlg-generate-done', 'dlg-templates', 'dlg-unsaved-template'].forEach(function (id) {
      var dlg = el(id);
      if (!dlg) return;
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) dlg.close();
      });
    });

    // Dialog buttons
    el('btn-format-cancel').addEventListener('click', function () { el('dlg-format').close(); });
    el('btn-format-apply').addEventListener('click', applyFormat);
    el('btn-save-cancel').addEventListener('click', function () { el('dlg-save').close(); });
    el('btn-save-confirm').addEventListener('click', doSave);
    el('btn-plan-cancel').addEventListener('click', function () { el('dlg-plan').close(); });
    el('btn-plan-generate').addEventListener('click', doGenerate);
    el('btn-generate-done-close').addEventListener('click', function () { el('dlg-generate-done').close(); });
    el('btn-templates-cancel').addEventListener('click', function () { el('dlg-templates').close(); });
    el('btn-unsaved-cancel').addEventListener('click', function () { el('dlg-unsaved-template').close(); });
    el('btn-unsaved-proceed').addEventListener('click', doLoadTemplate);
  }

  // ── Editor ────────────────────────────────────────────────────────────────────

  function onEditorInput() {
    updateLineNumbers();
    markUnsaved();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { runCheck(el('editor').value); }, DEBOUNCE_MS);
  }

  function onEditorKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      onSaveClick();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      onFormat();
    }
  }

  function syncLineNumberScroll() {
    el('line-numbers').scrollTop = el('editor').scrollTop;
  }

  function updateLineNumbers() {
    var lines = el('editor').value.split('\\n');
    var nums = [];
    for (var i = 1; i <= lines.length; i++) nums.push(i);
    el('line-numbers').textContent = nums.join('\\n');
  }

  function markUnsaved() {
    el('unsaved-dot').classList.add('visible');
  }

  function markSaved() {
    state.savedSource = el('editor').value;
    el('unsaved-dot').classList.remove('visible');
  }

  function hasUnsavedChanges() {
    return el('editor').value !== state.savedSource;
  }

  // ── Check ─────────────────────────────────────────────────────────────────────

  async function runCheck(source) {
    if (state.checking) return;
    state.checking = true;
    setStatusChecking();
    try {
      var resp = await postJson('/api/check', { source: source });
      var data = await resp.json();
      applyStateData(data);
      renderFromState();
    } catch (err) {
      setStatusError('Check failed: ' + String(err));
    } finally {
      state.checking = false;
    }
  }

  // ── Format ────────────────────────────────────────────────────────────────────

  async function onFormat() {
    var source = el('editor').value;
    var resp = await postJson('/api/format', { source: source });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return { error: 'Format failed' }; });
      announce('Format failed: ' + (err.error || String(err)));
      return;
    }
    var data = await resp.json();
    var formatted = data.formatted || '';
    if (formatted === source) {
      announce('Source is already formatted.');
      return;
    }
    showFormatDiff(source, formatted);
  }

  function showFormatDiff(original, formatted) {
    var origLines = original.split('\\n');
    var fmtLines = formatted.split('\\n');
    var maxLen = Math.max(origLines.length, fmtLines.length);
    var diffHtml = '';
    for (var i = 0; i < maxLen; i++) {
      var o = origLines[i];
      var f = fmtLines[i];
      if (o === undefined) {
        diffHtml += '<span class="diff-add">+ ' + escText(f) + '\\n</span>';
      } else if (f === undefined) {
        diffHtml += '<span class="diff-remove">- ' + escText(o) + '\\n</span>';
      } else if (o === f) {
        diffHtml += '<span class="diff-same">  ' + escText(o) + '\\n</span>';
      } else {
        diffHtml += '<span class="diff-remove">- ' + escText(o) + '\\n</span>';
        diffHtml += '<span class="diff-add">+ ' + escText(f) + '\\n</span>';
      }
    }
    el('diff-pane').innerHTML = diffHtml;
    el('dlg-format').dataset.pending = formatted;
    el('dlg-format').showModal();
    el('btn-format-cancel').focus();
  }

  function applyFormat() {
    var pending = el('dlg-format').dataset.pending || '';
    el('editor').value = pending;
    el('dlg-format').close();
    updateLineNumbers();
    markUnsaved();
    runCheck(pending);
    announce('Format applied.');
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  function onSaveClick() {
    el('dlg-save').showModal();
    el('btn-save-cancel').focus();
  }

  async function doSave() {
    el('dlg-save').close();
    var source = el('editor').value;
    var resp = await postJson('/api/save', { source: source });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return { error: 'Save failed' }; });
      announce('Save failed: ' + (err.error || String(err)));
      return;
    }
    markSaved();
    announce('File saved.');
  }

  // ── Generate App ─────────────────────────────────────────────────────────────

  async function onGenerateClick() {
    var source = el('editor').value;
    var resp = await postJson('/api/plan', { source: source });
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return { error: 'Plan failed' }; });
      showPlanError(err.error || 'Plan request failed.');
      return;
    }
    var data = await resp.json();
    state.planToken = data.planToken || null;
    state.planItems = data.plan || [];
    state.planError = data.isDestructive ? 'Destructive changes detected. Proceed carefully.' : null;
    showPlanDialog(data);
  }

  function showPlanDialog(data) {
    var list = el('plan-list');
    list.textContent = '';
    var items = data.plan || [];
    if (items.length === 0) {
      var li = document.createElement('li');
      li.className = 'plan-item-ok';
      li.textContent = 'No schema changes detected.';
      list.appendChild(li);
    } else {
      items.forEach(function (item) {
        var li = document.createElement('li');
        li.className = item.destructive ? 'plan-item-destructive' : (item.kind && item.kind.startsWith('action') ? 'plan-item-review' : 'plan-item-ok');
        li.textContent = (item.destructive ? '[DESTRUCTIVE] ' : '[ok] ') + item.description;
        list.appendChild(li);
      });
    }
    var warnEl = el('plan-warning');
    if (data.isDestructive) {
      warnEl.textContent = 'Warning: this generation contains destructive changes. Studio refuses unsafe operations; use CLI with --allow-data-loss if needed.';
      warnEl.style.display = 'block';
      el('btn-plan-generate').disabled = true;
    } else if (data.isSecurityDestructive) {
      warnEl.textContent = 'Warning: authentication was removed or changed. Use CLI with --allow-security-downgrade if needed.';
      warnEl.style.display = 'block';
      el('btn-plan-generate').disabled = true;
    } else {
      warnEl.style.display = 'none';
      el('btn-plan-generate').disabled = false;
    }
    el('plan-dir').textContent = data.outputDir || '';
    el('dlg-plan').showModal();
    el('btn-plan-cancel').focus();
  }

  function showPlanError(msg) {
    el('plan-list').textContent = '';
    var li = document.createElement('li');
    li.className = 'plan-item-destructive';
    li.textContent = msg;
    el('plan-list').appendChild(li);
    el('plan-warning').style.display = 'none';
    el('btn-plan-generate').disabled = true;
    el('dlg-plan').showModal();
  }

  async function doGenerate() {
    el('dlg-plan').close();
    if (!state.planToken) { announce('No plan token. Run Generate App again.'); return; }
    var source = el('editor').value;
    var resp = await postJson('/api/generate', { source: source, planToken: state.planToken });
    state.planToken = null;
    if (!resp.ok) {
      var err = await resp.json().catch(function () { return { error: 'Generation failed' }; });
      showGenerateDone(false, err.error || 'Generation failed.', null);
      return;
    }
    var data = await resp.json();
    showGenerateDone(true, null, data);
  }

  function showGenerateDone(ok, errMsg, data) {
    var resultEl = el('generate-result');
    resultEl.textContent = '';
    if (!ok) {
      resultEl.textContent = 'Error: ' + (errMsg || 'Unknown error');
    } else {
      var lines = [];
      lines.push('Generated in: ' + (data.outputDir || ''));
      lines.push('');
      lines.push('Artifacts:');
      (data.artifacts || []).forEach(function (a) { lines.push('  ' + a); });
      lines.push('');
      lines.push('Next steps:');
      lines.push('  cd ' + (data.outputDir || '<output-dir>'));
      lines.push('  npm install');
      if (data.authEnabled) {
        lines.push('');
        lines.push('Authentication is enabled. Set these environment variables before running:');
        lines.push('  INTENTLANG_BOOTSTRAP_NAME=<your name>');
        lines.push('  INTENTLANG_BOOTSTRAP_EMAIL=<your email>');
        lines.push('  INTENTLANG_BOOTSTRAP_PASSWORD=<choose a secure password>');
        lines.push('');
        lines.push('Then run: node app.mjs');
      } else {
        lines.push('  node app.mjs');
      }
      resultEl.textContent = lines.join('\\n');
    }
    el('dlg-generate-done').showModal();
    el('btn-generate-done-close').focus();
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  var pendingTemplate = null;

  function openTemplates() {
    var list = el('template-list');
    list.textContent = '';
    TEMPLATES.forEach(function (tmpl) {
      var item = document.createElement('div');
      item.className = 'template-item';
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      var nameEl = document.createElement('div');
      nameEl.className = 'template-name';
      nameEl.textContent = tmpl.name;
      var descEl = document.createElement('div');
      descEl.className = 'template-desc';
      descEl.textContent = tmpl.description;
      item.appendChild(nameEl);
      item.appendChild(descEl);
      item.addEventListener('click', function () { selectTemplate(tmpl); });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTemplate(tmpl); }
      });
      list.appendChild(item);
    });
    el('dlg-templates').showModal();
  }

  function selectTemplate(tmpl) {
    el('dlg-templates').close();
    pendingTemplate = tmpl;
    if (hasUnsavedChanges()) {
      el('dlg-unsaved-template').showModal();
      el('btn-unsaved-cancel').focus();
    } else {
      doLoadTemplate();
    }
  }

  function doLoadTemplate() {
    el('dlg-unsaved-template').close();
    if (!pendingTemplate) return;
    var src = pendingTemplate.source;
    el('editor').value = src;
    updateLineNumbers();
    state.savedSource = '';
    markUnsaved();
    runCheck(src);
    announce('Template loaded: ' + pendingTemplate.name);
    pendingTemplate = null;
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  function activateTab(tabId) {
    if (!tabId) return;
    state.activeTab = tabId;
    document.querySelectorAll('[role="tab"]').forEach(function (tab) {
      var isSelected = tab.getAttribute('data-tab') === tabId;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
    document.querySelectorAll('[role="tabpanel"]').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + tabId);
    });
  }

  function focusNextTab(current, dir) {
    var tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    var idx = tabs.indexOf(current);
    var next = tabs[(idx + dir + tabs.length) % tabs.length];
    if (next) { next.focus(); next.click(); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function renderFromState() {
    renderProblems();
    renderModel();
    renderCanonical();
    renderIr();
    updateStatusBar();
  }

  function renderProblems() {
    var panel = el('panel-problems');
    panel.textContent = '';
    var diags = state.diagnostics || [];
    if (diags.length === 0) {
      var ok = document.createElement('p');
      ok.className = 'zero-problems';
      ok.textContent = '\\u2705 No problems detected.';
      panel.appendChild(ok);
    } else {
      diags.forEach(function (d, idx) {
        var item = document.createElement('div');
        item.className = 'diagnostic-item';
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', d.code + ' at line ' + d.line + ': ' + d.message);
        var codeSpan = document.createElement('span');
        codeSpan.className = 'diagnostic-code';
        codeSpan.textContent = d.code;
        var locSpan = document.createElement('span');
        locSpan.className = 'diagnostic-location';
        locSpan.textContent = ' line ' + d.line + ':' + d.column;
        var msgDiv = document.createElement('div');
        msgDiv.className = 'diagnostic-message';
        msgDiv.textContent = d.message;
        var hintDiv = document.createElement('div');
        hintDiv.className = 'diagnostic-hint';
        hintDiv.textContent = 'Fix: ' + d.hint;
        item.appendChild(codeSpan);
        item.appendChild(locSpan);
        item.appendChild(msgDiv);
        item.appendChild(hintDiv);
        item.addEventListener('click', function () { focusEditorLine(d.line); });
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusEditorLine(d.line); }
        });
        panel.appendChild(item);
        void idx;
      });
    }
  }

  function focusEditorLine(line) {
    var editor = el('editor');
    var lines = editor.value.split('\\n');
    var pos = 0;
    for (var i = 0; i < line - 1 && i < lines.length; i++) {
      pos += (lines[i] || '').length + 1;
    }
    editor.focus();
    editor.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
  }

  function renderModel() {
    var panel = el('panel-model');
    panel.textContent = '';
    var m = state.model;
    if (!m) {
      var p = document.createElement('p');
      p.className = 'status-error';
      p.textContent = 'Source has errors. Fix diagnostics to see application model.';
      panel.appendChild(p);
      return;
    }
    appendModelSection(panel, 'Application', renderApplicationCard(m));
    if (m.authentication && m.authentication.enabled) {
      appendModelSection(panel, 'Authentication', renderAuthCard(m.authentication));
    }
    if (m.roles && m.roles.length) {
      appendModelSection(panel, 'Roles', renderRoleCards(m.roles));
    }
    if (m.entities && m.entities.length) {
      appendModelSection(panel, 'Entities & Fields', renderEntityCards(m.entities));
    }
    if (m.relationships && m.relationships.length) {
      appendModelSection(panel, 'Relationships', renderRelCards(m.relationships));
    }
    if (m.actions && m.actions.length) {
      appendModelSection(panel, 'Actions', renderActionCards(m.actions));
    }
    if (m.permissionMatrix && m.permissionMatrix.length) {
      appendModelSection(panel, 'Permission Matrix', renderPermMatrix(m.permissionMatrix, m.roles || []));
    }
    if (m.safety) {
      appendModelSection(panel, 'Safety Summary', renderSafety(m.safety));
    }
  }

  function appendModelSection(parent, title, content) {
    var sec = document.createElement('div');
    sec.className = 'model-section';
    var h3 = document.createElement('h3');
    h3.textContent = title;
    sec.appendChild(h3);
    sec.appendChild(content);
    parent.appendChild(sec);
  }

  function renderApplicationCard(m) {
    var card = document.createElement('div');
    card.className = 'model-card';
    var name = document.createElement('div');
    name.className = 'model-card-name';
    name.textContent = m.applicationName;
    var meta = document.createElement('div');
    meta.className = 'model-card-meta';
    meta.textContent = 'ID: ' + m.applicationId;
    card.appendChild(name);
    card.appendChild(meta);
    return card;
  }

  function renderAuthCard(auth) {
    var card = document.createElement('div');
    card.className = 'model-card';
    var name = document.createElement('div');
    name.className = 'model-card-name';
    name.textContent = 'Enabled';
    var meta = document.createElement('div');
    meta.className = 'model-card-meta';
    meta.textContent = 'Identity: ' + (auth.identityEntity || '?') + ', field: ' + (auth.identityField || '?');
    card.appendChild(name);
    card.appendChild(meta);
    return card;
  }

  function renderRoleCards(roles) {
    var frag = document.createDocumentFragment();
    roles.forEach(function (role) {
      var card = document.createElement('div');
      card.className = 'model-card';
      var name = document.createElement('div');
      name.className = 'model-card-name';
      name.textContent = role.name;
      var meta = document.createElement('div');
      meta.className = 'model-card-meta';
      meta.textContent = 'ID: ' + role.id;
      card.appendChild(name);
      card.appendChild(meta);
      frag.appendChild(card);
    });
    return frag;
  }

  function renderEntityCards(entities) {
    var frag = document.createDocumentFragment();
    entities.forEach(function (entity) {
      var card = document.createElement('div');
      card.className = 'model-card';
      var name = document.createElement('div');
      name.className = 'model-card-name';
      name.textContent = entity.name;
      if (entity.isIdentityEntity) {
        var badge = document.createElement('span');
        badge.className = 'model-badge';
        badge.textContent = 'identity';
        name.appendChild(badge);
      }
      card.appendChild(name);
      entity.fields.forEach(function (field) {
        var fd = document.createElement('div');
        fd.className = 'model-field';
        var strong = document.createElement('strong');
        strong.textContent = field.name;
        fd.appendChild(strong);
        var rest = document.createTextNode(' — ' + (field.required ? 'required ' : '') + (field.unique ? 'unique ' : '') + field.type + (field.lengthMin != null ? ' [' + field.lengthMin + '..' + field.lengthMax + ']' : '') + (field.default != null ? ' default: ' + JSON.stringify(field.default) : ''));
        fd.appendChild(rest);
        card.appendChild(fd);
      });
      frag.appendChild(card);
    });
    return frag;
  }

  function renderRelCards(rels) {
    var frag = document.createDocumentFragment();
    rels.forEach(function (rel) {
      var card = document.createElement('div');
      card.className = 'model-card';
      var name = document.createElement('div');
      name.className = 'model-card-name';
      name.textContent = rel.fromEntity + ' \\u2192 ' + rel.toEntity + ' (as ' + rel.name + ')';
      var meta = document.createElement('div');
      meta.className = 'model-card-meta';
      meta.textContent = 'Column: ' + rel.column + ' | On delete: ' + rel.onDelete;
      card.appendChild(name);
      card.appendChild(meta);
      frag.appendChild(card);
    });
    return frag;
  }

  function renderActionCards(actions) {
    var frag = document.createDocumentFragment();
    actions.forEach(function (action) {
      var card = document.createElement('div');
      card.className = 'model-card';
      var name = document.createElement('div');
      name.className = 'model-card-name';
      name.textContent = action.name + ' on ' + action.entity;
      action.preconditions.forEach(function (pre) {
        var pd = document.createElement('div');
        pd.className = 'model-field';
        pd.textContent = 'Require: ' + pre.field + ' ' + pre.operator + ' ' + JSON.stringify(pre.value) + ' otherwise "' + pre.message + '"';
        card.appendChild(pd);
      });
      action.assignments.forEach(function (assign) {
        var ad = document.createElement('div');
        ad.className = 'model-field';
        ad.textContent = 'Set: ' + assign.field + ' to ' + JSON.stringify(assign.value);
        card.appendChild(ad);
      });
      frag.appendChild(card);
    });
    return frag;
  }

  function renderPermMatrix(matrix, roles) {
    var wrapper = document.createElement('div');
    wrapper.style.overflowX = 'auto';
    var table = document.createElement('table');
    table.className = 'perm-table';
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    var th0 = document.createElement('th');
    th0.textContent = 'Entity';
    headerRow.appendChild(th0);
    roles.forEach(function (role) {
      var th = document.createElement('th');
      th.textContent = role.name;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    matrix.forEach(function (row) {
      var tr = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.textContent = row.entity;
      td0.style.fontWeight = '600';
      tr.appendChild(td0);
      roles.forEach(function (role) {
        var td = document.createElement('td');
        var ops = (row.operations && row.operations[role.name]) || {};
        var lines = [];
        ['create','read','update','run','provision'].forEach(function (op) {
          if (ops[op] && ops[op] !== 'deny') {
            lines.push(op + ': ' + ops[op]);
          }
        });
        if (lines.length === 0) {
          td.className = 'perm-deny';
          td.textContent = 'deny (default)';
        } else {
          td.className = 'perm-allow';
          td.textContent = lines.join(', ');
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  function renderSafety(safety) {
    var card = document.createElement('div');
    card.className = 'model-card';
    var items = [
      ['Authentication', safety.authenticationEnabled ? '\\u2705 Enabled' : '\\u26a0\\ufe0f Disabled', safety.authenticationEnabled],
      ['Default deny', safety.defaultDeny ? '\\u2705 Yes' : '\\u26a0\\ufe0f No', safety.defaultDeny],
      ['Optimistic concurrency', safety.optimisticConcurrency ? '\\u2705 Yes' : '\\u274c No', safety.optimisticConcurrency],
      ['Safe deletes (no cascade)', safety.safeDeleteAbsent ? '\\u2705 Yes' : '\\u26a0\\ufe0f No', safety.safeDeleteAbsent]
    ];
    items.forEach(function (item) {
      var fd = document.createElement('div');
      fd.className = 'model-field';
      fd.textContent = item[0] + ': ' + item[1];
      card.appendChild(fd);
    });
    if (safety.uniqueFields && safety.uniqueFields.length) {
      var ud = document.createElement('div');
      ud.className = 'model-field';
      ud.textContent = 'Unique fields: ' + safety.uniqueFields.join(', ');
      card.appendChild(ud);
    }
    var nd = document.createElement('div');
    nd.className = 'model-card-meta';
    nd.style.marginTop = '8px';
    nd.textContent = safety.note || '';
    card.appendChild(nd);
    return card;
  }

  function renderCanonical() {
    var pane = el('canonical-pane');
    pane.textContent = state.canonical || '(source has errors)';
  }

  function renderIr() {
    var pane = el('ir-pane');
    pane.textContent = state.ir ? JSON.stringify(state.ir, null, 2) : '(source has errors)';
  }

  function updateStatusBar() {
    var statusEl = el('status-text');
    var diags = state.diagnostics || [];
    if (diags.length === 0 && state.model) {
      statusEl.className = 'status-valid';
      statusEl.textContent = '\\u2705 Valid';
    } else if (diags.length > 0) {
      statusEl.className = 'status-error';
      statusEl.textContent = diags.length + ' error' + (diags.length > 1 ? 's' : '');
    } else {
      statusEl.className = 'status-checking';
      statusEl.textContent = 'Checking\\u2026';
    }
  }

  function setStatusChecking() {
    var statusEl = el('status-text');
    statusEl.className = 'status-checking';
    statusEl.textContent = 'Checking\\u2026';
  }

  function setStatusError(msg) {
    var statusEl = el('status-text');
    statusEl.className = 'status-error';
    statusEl.textContent = msg;
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (_) {}
    el('btn-theme').textContent = next === 'dark' ? '\\u2600\\ufe0f Light' : '\\ud83c\\udf19 Dark';
    announce('Theme changed to ' + next);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Studio-CSRF-Token': state.csrfToken
      },
      body: JSON.stringify(body)
    });
  }

  function announce(msg) {
    var lr = el('live-region');
    if (!lr) return;
    lr.textContent = '';
    setTimeout(function () { lr.textContent = msg; }, 50);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`.trim();

export function buildStudioHtml(filename: string, port: number): string {
  const scoutScript = SCOUT_THEME_SCRIPT;
  const themeScript = THEME_SCRIPT;

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>IntentLang Studio — ${escapeHtml(filename)}</title>
  <link rel="stylesheet" href="/studio.css">
  <script>${scoutScript}</script>
</head>
<body>
  <div id="live-region" role="status" aria-live="polite" aria-atomic="true"></div>

  <header id="studio-header" role="banner">
    <h1>IntentLang Studio</h1>
    <span class="filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
    <span class="badge" title="Experimental offline authoring tool — no AI tokens required">experimental · offline · no-AI</span>
    <div class="spacer"></div>
    <button id="btn-theme" type="button" aria-label="Toggle dark/light theme">🌙 Dark</button>
  </header>

  <main id="studio-main" role="main">
    <section id="editor-pane" aria-label="Source editor">
      <div id="editor-toolbar" role="toolbar" aria-label="Editor actions">
        <button id="btn-check" class="toolbar-btn" type="button" title="Check source (Ctrl+Enter)">Check</button>
        <button id="btn-format" class="toolbar-btn" type="button" title="Format source (Ctrl+Shift+F)">Format</button>
        <button id="btn-save" class="toolbar-btn" type="button" title="Save source (Ctrl+S)">Save</button>
        <button id="btn-generate" class="toolbar-btn primary" type="button" title="Generate App">Generate App</button>
        <button id="btn-templates" type="button" title="Load a template">Templates ▾</button>
      </div>
      <div id="editor-wrap">
        <div id="line-numbers" aria-hidden="true">1</div>
        <textarea
          id="editor"
          aria-label="Source editor"
          aria-multiline="true"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          data-gramm="false"
          placeholder="Write your IntentLang source here…"
        ></textarea>
      </div>
      <div id="status-bar" role="status" aria-live="polite">
        <span id="unsaved-dot" aria-hidden="true" title="Unsaved changes"></span>
        <span id="status-text" class="status-checking">Loading…</span>
        <span class="spacer"></span>
        <span style="color:var(--cp-text-muted);font-size:10px;">Port ${port} · localhost only</span>
      </div>
    </section>

    <section id="panels" aria-label="Output panels">
      <div role="tablist" aria-label="Output panels">
        <button role="tab" data-tab="problems" id="tab-problems" aria-selected="true" aria-controls="panel-problems" tabindex="0">Problems</button>
        <button role="tab" data-tab="model" id="tab-model" aria-selected="false" aria-controls="panel-model" tabindex="-1">Application Model</button>
        <button role="tab" data-tab="canonical" id="tab-canonical" aria-selected="false" aria-controls="panel-canonical" tabindex="-1">Canonical Source</button>
        <button role="tab" data-tab="ir" id="tab-ir" aria-selected="false" aria-controls="panel-ir" tabindex="-1">Raw IR</button>
      </div>
      <div role="tabpanel" id="panel-problems" aria-labelledby="tab-problems" class="active"></div>
      <div role="tabpanel" id="panel-model" aria-labelledby="tab-model" hidden></div>
      <div role="tabpanel" id="panel-canonical" aria-labelledby="tab-canonical" hidden>
        <pre class="code-pane" id="canonical-pane" aria-label="Canonical source" aria-readonly="true"></pre>
      </div>
      <div role="tabpanel" id="panel-ir" aria-labelledby="tab-ir" hidden>
        <details class="ir-collapsible" open>
          <summary>Typed IR JSON</summary>
          <pre class="code-pane" id="ir-pane" aria-label="Raw IR JSON" aria-readonly="true"></pre>
        </details>
      </div>
    </section>
  </main>

  <!-- Format dialog -->
  <dialog id="dlg-format" aria-labelledby="dlg-format-title" aria-modal="true">
    <h2 class="dialog-title" id="dlg-format-title">Format Preview</h2>
    <p class="dialog-body">Review the formatting changes below. Lines with <span style="color:var(--cp-success)">+</span> are added, <span style="color:var(--cp-danger)">-</span> are removed.</p>
    <div class="diff-pane" id="diff-pane" aria-label="Diff preview" aria-readonly="true" role="region" aria-live="off"></div>
    <div class="dialog-actions">
      <button id="btn-format-cancel" class="toolbar-btn" type="button">Cancel</button>
      <button id="btn-format-apply" class="toolbar-btn primary" type="button">Apply Format</button>
    </div>
  </dialog>

  <!-- Save dialog -->
  <dialog id="dlg-save" aria-labelledby="dlg-save-title" aria-modal="true">
    <h2 class="dialog-title" id="dlg-save-title">Save Changes</h2>
    <p class="dialog-body">Save the current editor content to the original source file? This will overwrite the file on disk.</p>
    <div class="dialog-actions">
      <button id="btn-save-cancel" class="toolbar-btn" type="button">Cancel</button>
      <button id="btn-save-confirm" class="toolbar-btn primary" type="button">Save File</button>
    </div>
  </dialog>

  <!-- Plan dialog -->
  <dialog id="dlg-plan" aria-labelledby="dlg-plan-title" aria-modal="true" style="max-width:600px;">
    <h2 class="dialog-title" id="dlg-plan-title">Generation Plan</h2>
    <p class="dialog-body">Output directory: <code id="plan-dir"></code></p>
    <ul class="plan-list" id="plan-list" aria-label="Plan items"></ul>
    <p id="plan-warning" style="color:var(--cp-danger);font-size:12px;display:none;"></p>
    <div class="dialog-actions">
      <button id="btn-plan-cancel" class="toolbar-btn" type="button">Cancel</button>
      <button id="btn-plan-generate" class="toolbar-btn primary" type="button">Generate App</button>
    </div>
  </dialog>

  <!-- Generation result dialog -->
  <dialog id="dlg-generate-done" aria-labelledby="dlg-generate-done-title" aria-modal="true">
    <h2 class="dialog-title" id="dlg-generate-done-title">Generation Complete</h2>
    <pre class="generation-result" id="generate-result" aria-live="polite"></pre>
    <div class="dialog-actions">
      <button id="btn-generate-done-close" class="toolbar-btn primary" type="button">Close</button>
    </div>
  </dialog>

  <!-- Templates dialog -->
  <dialog id="dlg-templates" aria-labelledby="dlg-templates-title" aria-modal="true">
    <h2 class="dialog-title" id="dlg-templates-title">Load Template</h2>
    <p class="dialog-body">Select a template to load into the editor. This will replace the current unsaved content.</p>
    <div id="template-list" role="list" aria-label="Available templates"></div>
    <div class="dialog-actions">
      <button id="btn-templates-cancel" class="toolbar-btn" type="button">Cancel</button>
    </div>
  </dialog>

  <!-- Unsaved changes warning -->
  <dialog id="dlg-unsaved-template" aria-labelledby="dlg-unsaved-title" aria-modal="true">
    <h2 class="dialog-title" id="dlg-unsaved-title">Unsaved Changes</h2>
    <p class="dialog-body">You have unsaved changes. Loading a template will replace the current content. Continue?</p>
    <div class="dialog-actions">
      <button id="btn-unsaved-cancel" class="toolbar-btn" type="button">Keep editing</button>
      <button id="btn-unsaved-proceed" class="toolbar-btn primary" type="button">Discard & load template</button>
    </div>
  </dialog>

  <script>${themeScript}</script>
  <script src="/studio.js"></script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
