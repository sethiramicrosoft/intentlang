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

/* App layout */
#app-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  gap: 16px;
  padding: 20px;
}

#advanced-tools-section {
  border: 1px solid var(--cp-border);
  border-radius: 10px;
  background: var(--cp-surface);
  overflow: hidden;
}
#advanced-tools-section > summary {
  cursor: pointer;
  list-style: none;
  padding: 14px 16px;
  font-weight: 600;
}
#advanced-tools-section > summary::-webkit-details-marker { display: none; }
#advanced-tools-section > summary::after {
  content: "Show the full Studio editor, Describe App mode, AI assist, diagnostics, and generated outputs.";
  display: block;
  margin-top: 4px;
  font-weight: 400;
  font-size: 12px;
  color: var(--cp-text-muted);
}

#studio-main {
  display: flex;
  min-height: 720px;
  border-top: 1px solid var(--cp-border);
}

/* Wizard view panel */
#wizard-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  padding: 24px;
}

/* Wizard step indicator */
.wizard-steps-indicator {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 24px;
}
#wizard-stepper { width: 100%; }
#wizard-stepper ol {
  display: flex;
  align-items: center;
  list-style: none;
  padding: 0;
  margin: 0;
}
.wizard-step-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.4;
}
.wizard-step-indicator.active { opacity: 1; }
.wizard-step-indicator.done { opacity: 0.75; }
.wizard-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--cp-border);
  color: var(--cp-text-muted);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wizard-step-indicator.active .wizard-step-num { background: var(--cp-accent); color: var(--cp-accent-fg); }
.wizard-step-indicator.done .wizard-step-num { background: var(--cp-success); color: var(--cp-accent-fg); }
.wizard-step-label { font-size: 12px; font-weight: 600; color: var(--cp-text-muted); }
.wizard-step-indicator.active .wizard-step-label { color: var(--cp-text); }
.wizard-step-divider { color: var(--cp-border-strong); font-size: 12px; margin: 0 4px; }
.wizard-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.wizard-hero-copy h2 { margin: 0 0 6px 0; font-size: 28px; }
.wizard-hero-copy p { margin: 0; color: var(--cp-text-muted); max-width: 760px; }
.wizard-hero-badge { align-self: flex-start; }
.wizard-existing-card {
  border: 1px solid var(--cp-border);
  border-left: 4px solid var(--cp-accent);
  border-radius: 8px;
  padding: 14px 16px;
  background: var(--cp-surface-soft);
}
.wizard-existing-card[hidden] { display: none; }
.wizard-clarification-question {
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 12px 0 0 0;
}
.wizard-clarification-question legend {
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
}
.wizard-radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

/* Wizard step panels */
.wizard-step-panel { max-width: 640px; width: 100%; }
.wizard-step-panel[hidden] { display: none; }
.wiz-step { display: block; }
.wiz-step[hidden] { display: none; }
.wizard-step-title { font-size: 18px; font-weight: 700; color: var(--cp-text); margin: 0 0 6px 0; }
.wizard-step-desc { font-size: 13px; color: var(--cp-text-muted); margin: 0 0 16px 0; line-height: 1.6; }
.wizard-label { display: block; font-size: 12px; font-weight: 600; color: var(--cp-text-muted); margin-bottom: 6px; }
.wizard-textarea {
  width: 100%;
  resize: vertical;
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  background: var(--cp-surface);
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  font-family: inherit;
  margin-bottom: 14px;
}
.wizard-textarea:focus-visible { border-color: var(--cp-accent); }
.wizard-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.btn-primary {
  background: var(--cp-accent);
  color: var(--cp-accent-fg);
  border-color: var(--cp-accent);
}
.btn-cta {
  background: var(--cp-success);
  color: var(--cp-accent-fg);
  border-color: var(--cp-success);
  font-weight: 700;
}
.wizard-build-stages {
  list-style: none;
  padding: 0;
  margin: 0 0 14px 0;
  display: grid;
  gap: 8px;
}
.wizard-build-stages li {
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--cp-text-muted);
  background: var(--cp-surface-soft);
}
.wizard-build-stages li.active {
  border-color: var(--cp-accent);
  color: var(--cp-text);
}
.wizard-build-stages li.done {
  border-color: var(--cp-success);
  color: var(--cp-success);
}
.wizard-error-box {
  background: var(--cp-accent-soft);
  border: 1px solid var(--cp-danger);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--cp-danger);
  line-height: 1.6;
  margin-top: 10px;
}
.wizard-error-box[hidden] { display: none; }
.wizard-unsupported-box {
  background: var(--cp-accent-soft);
  border: 1px solid var(--cp-warning);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.6;
  margin-bottom: 12px;
}
.wizard-unsupported-box ul { margin: 4px 0 0 16px; padding: 0; font-size: 12px; }
.wizard-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--cp-border);
  border-top-color: var(--cp-accent);
  border-radius: 50%;
  animation: wiz-spin .7s linear infinite;
  display: inline-block;
}
.wizard-spinner[hidden] { display: none; }
@keyframes wiz-spin { to { transform: rotate(360deg); } }
.wizard-review-card {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-left: 3px solid var(--cp-accent);
  border-radius: 4px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.wizard-review-title { font-size: 14px; font-weight: 700; color: var(--cp-text); margin: 0 0 6px 0; }
.wizard-assumption { font-size: 12px; color: var(--cp-text-muted); padding: 2px 0; margin: 0; }
.wizard-source-preview {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: "Cascadia Code", "Fira Mono", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  color: var(--cp-text);
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.wizard-build-status { display: flex; align-items: center; gap: 10px; padding: 12px 0; font-size: 13px; color: var(--cp-text-muted); }
.wizard-build-result {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  font-family: "Cascadia Code", "Fira Mono", "Consolas", monospace;
  white-space: pre;
  overflow: auto;
  max-height: 160px;
  color: var(--cp-text);
  margin-bottom: 12px;
}
.wizard-build-result[hidden] { display: none; }
.wizard-preview-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  color: var(--cp-text-muted);
  margin-bottom: 12px;
}
.wizard-preview-badge.running {
  background: var(--cp-accent-soft);
  border-color: var(--cp-success);
  color: var(--cp-success);
}
.wizard-preview-url-box {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 12px 14px;
  margin-top: 10px;
  font-size: 13px;
}
.wizard-preview-url-box a { color: var(--cp-link); font-weight: 600; }
.wizard-preview-url-box[hidden] { display: none; }
.wizard-preview-note { font-size: 11px; color: var(--cp-text-muted); margin-top: 8px; line-height: 1.5; }

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

/* Diagnostics summary bar — visible first-error summary above editor */
#diag-summary {
  display: none;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 12px;
  background: rgba(220, 38, 38, 0.06);
  border-bottom: 1px solid var(--cp-danger);
  flex-shrink: 0;
}
#diag-summary.visible { display: flex; }
.diag-summary-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--cp-danger);
  color: var(--cp-accent-fg);
  white-space: nowrap;
  flex-shrink: 0;
  font-family: monospace;
}
.diag-summary-loc {
  font-size: 11px;
  color: var(--cp-danger);
  font-family: monospace;
  white-space: nowrap;
  flex-shrink: 0;
}
.diag-summary-msg {
  font-size: 11px;
  color: var(--cp-text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.diag-summary-hint {
  font-size: 10px;
  color: var(--cp-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
#btn-show-all-problems {
  background: var(--cp-surface);
  border: 1px solid var(--cp-danger);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--cp-danger);
  white-space: nowrap;
  flex-shrink: 0;
}
#btn-show-all-problems:hover { background: rgba(220, 38, 38, 0.08); }

/* Mode tabs above editor toolbar */
#editor-mode-tabs {
  display: flex;
  border-bottom: 1px solid var(--cp-border);
  background: var(--cp-bg-elevated);
  padding: 0 10px;
  gap: 2px;
  flex-shrink: 0;
}
.mode-tab {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px 4px 0 0;
  color: var(--cp-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.mode-tab:hover { color: var(--cp-text); }
.mode-tab[aria-selected="true"] {
  color: var(--cp-accent);
  border-bottom-color: var(--cp-accent);
}

/* Prose warning banner inside editor area */
#prose-banner {
  display: none;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: var(--cp-accent-soft);
  border-bottom: 2px solid var(--cp-accent);
  flex-shrink: 0;
}
#prose-banner.visible { display: flex; }
.prose-banner-icon {
  font-size: 15px;
  flex-shrink: 0;
  line-height: 1.3;
}
.prose-banner-text {
  flex: 1;
  font-size: 12px;
  color: var(--cp-text);
  font-weight: 600;
}
.prose-banner-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--cp-text-soft);
  margin-top: 1px;
}
.prose-banner-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: flex-start;
}
.prose-banner-btn {
  background: var(--cp-accent);
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--cp-accent-fg);
  cursor: pointer;
  white-space: nowrap;
}
.prose-banner-btn:hover { background: var(--cp-accent-hover); }
.prose-banner-btn.secondary {
  background: var(--cp-surface);
  border: 1px solid var(--cp-accent);
  color: var(--cp-accent);
}
.prose-banner-btn.secondary:hover { background: var(--cp-highlight); }

/* Describe App pane */
#describe-pane {
  display: none;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
#describe-pane.visible { display: flex; }
#describe-pane-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.describe-mode-note {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.6;
}
.describe-mode-note strong { color: var(--cp-text); }
#describe-textarea {
  width: 100%;
  resize: none;
  min-height: 80px;
  max-height: 160px;
  padding: 8px 10px;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  background: var(--cp-surface);
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  font-family: inherit;
}
#describe-textarea:focus-visible { border-color: var(--cp-accent); }
.describe-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.describe-path-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--cp-text-muted);
  margin-bottom: 2px;
}
#describe-result {
  display: none;
  flex-direction: column;
  gap: 8px;
}
#describe-result.visible { display: flex; }
.describe-interpretation-card {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-left: 3px solid var(--cp-accent);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
}
.describe-interpretation-card h4 {
  margin: 0 0 4px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--cp-text);
}
.describe-assumptions { color: var(--cp-text-muted); }
.describe-unsupported {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid var(--cp-warning);
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.6;
}
.describe-unsupported h4 {
  margin: 0 0 4px 0;
  font-weight: 700;
  color: var(--cp-warning);
}
.describe-warning-list {
  margin: 4px 0 0 0;
  padding: 0 0 0 16px;
  font-size: 11px;
  color: var(--cp-text-soft);
}
.describe-proposal-source {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: "Cascadia Code", "Fira Mono", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  color: var(--cp-text);
  max-height: 200px;
  overflow-y: auto;
}
.describe-apply-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
#unsupported-ack-row {
  display: none;
  align-items: flex-start;
  gap: 8px;
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid var(--cp-warning);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--cp-text);
}
#unsupported-ack-row.visible { display: flex; }
#unsupported-ack-checkbox { flex-shrink: 0; margin-top: 2px; }
.describe-questions-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--cp-text);
}
.describe-question-item {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 6px;
}
.describe-question-text { font-size: 12px; font-weight: 600; color: var(--cp-text); margin-bottom: 6px; }
.describe-option-btn {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  margin-right: 6px;
  margin-bottom: 4px;
  color: var(--cp-text);
  cursor: pointer;
}
.describe-option-btn:hover { border-color: var(--cp-accent); color: var(--cp-accent); background: var(--cp-highlight); }
.describe-option-btn.selected { background: var(--cp-accent-soft); border-color: var(--cp-accent); color: var(--cp-accent); }
.describe-unrecognized {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.6;
}

/* Right panels — responsive fix */
#panels {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
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
  min-height: 0;
  max-height: 100%;
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

/* AI Assist panel */
#ai-panel {
  border-top: 1px solid var(--cp-border);
  background: var(--cp-bg-elevated);
  padding: 10px 12px;
  flex-shrink: 0;
  max-height: 50%;
  overflow-y: auto;
}
#ai-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ai-provider-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  color: var(--cp-text-muted);
  font-weight: 600;
  white-space: nowrap;
}
.ai-provider-badge.ai-active {
  background: var(--cp-accent-soft);
  border-color: var(--cp-accent);
  color: var(--cp-accent);
}
.ai-notice {
  background: var(--cp-accent-soft);
  border: 1px solid var(--cp-accent);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: var(--cp-text);
  line-height: 1.6;
  margin-bottom: 8px;
}
.ai-notice-off {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-bottom: 8px;
}
#ai-description-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-muted);
  margin-bottom: 4px;
}
#ai-description {
  width: 100%;
  resize: vertical;
  min-height: 60px;
  max-height: 160px;
  padding: 7px 10px;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  background: var(--cp-surface);
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  font-family: inherit;
}
#ai-description:focus-visible { border-color: var(--cp-accent); }
.ai-buttons { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
#ai-spinner {
  display: none;
  width: 14px; height: 14px;
  border: 2px solid var(--cp-border);
  border-top-color: var(--cp-accent);
  border-radius: 50%;
  animation: ai-spin .7s linear infinite;
}
#ai-spinner.visible { display: inline-block; }
@keyframes ai-spin { to { transform: rotate(360deg); } }
#ai-result {
  margin-top: 10px;
  border-top: 1px solid var(--cp-border);
  padding-top: 10px;
}
.ai-error-box {
  background: rgba(220,38,38,.07);
  border: 1px solid var(--cp-danger);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--cp-danger);
  line-height: 1.6;
}
.ai-error-diags { margin-top: 6px; font-family: monospace; font-size: 11px; }
.ai-questions-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--cp-text); }
.ai-question-item {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.ai-question-text { font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--cp-text); }
.ai-option-btn {
  background: var(--cp-surface-soft);
  border: 1px solid var(--cp-border);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  margin-right: 6px;
  margin-bottom: 4px;
  color: var(--cp-text);
  cursor: pointer;
}
.ai-option-btn:hover { border-color: var(--cp-accent); color: var(--cp-accent); background: var(--cp-highlight); }
.ai-option-btn.ai-selected { background: var(--cp-accent-soft); border-color: var(--cp-accent); color: var(--cp-accent); }
.ai-proposal-ok {
  font-size: 12px;
  color: var(--cp-success);
  font-weight: 600;
  margin-bottom: 6px;
}
.ai-proposal-summary { font-size: 13px; color: var(--cp-text); margin-bottom: 6px; }
.ai-guided-link {
  margin-top: 10px;
  font-size: 11px;
  color: var(--cp-text-muted);
}
.ai-guided-link a { color: var(--cp-link); }
`.trim();

export const STUDIO_JS = `
/* IntentLang Studio v0.8.0 client */
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
    planError: null,
    editorMode: 'code',        // 'code' | 'describe'
    userSelectedTab: false     // true once user intentionally clicks a tab
  };

  var describeState = {
    pending: null,            // last interpretation result
    questionAnswers: {},
    unsupportedAcknowledged: false
  };

  var aiState = {
    provider: 'none',
    model: '',
    endpointOrigin: '',
    isLocal: true,
    configError: null,
    active: false,
    pendingProposal: null,
    questionAnswers: {},
    priorAnswers: []
  };

  var wizardState = {
    step: 1,
    description: '',
    proposalToken: null,
    proposedSource: '',
    proposalData: null,
    buildResult: null,
    clarificationQuestions: [],
    clarificationAnswers: {},
    unsupportedAcknowledged: false,
    previewUrl: null
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
      initAiFromState(data.ai || { provider: 'none', model: '', endpointOrigin: '', isLocal: true, configError: null });
      initWizard(data);
      // Default to Write IntentLang if there is existing source; Describe App if file is empty
      if (!state.source || state.source.trim().length === 0) {
        setEditorMode('describe');
      }
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

    // Mode tabs
    el('tab-mode-code').addEventListener('click', function () { setEditorMode('code'); });
    el('tab-mode-describe').addEventListener('click', function () { setEditorMode('describe'); });

    // Diagnostics summary — Show all problems button
    el('btn-show-all-problems').addEventListener('click', function () {
      activateTab('problems');
      state.userSelectedTab = true;
      var panel = el('panel-problems');
      if (panel) { panel.scrollTop = 0; }
    });

    // Prose banner buttons
    el('btn-prose-move').addEventListener('click', function () {
      var txt = el('editor').value;
      setEditorMode('describe');
      el('describe-textarea').value = txt;
    });
    el('btn-prose-examples').addEventListener('click', function () {
      openTemplates();
    });

    // Describe mode
    el('btn-interpret-offline').addEventListener('click', onInterpretOffline);
    el('btn-interpret-ai').addEventListener('click', function () {
      // Delegate to existing AI panel with description pre-filled
      var desc = el('describe-textarea').value.trim();
      setEditorMode('code');
      el('ai-panel').removeAttribute('hidden');
      openAiPanel();
      if (desc) el('ai-description').value = desc;
    });
    el('btn-describe-send-answers').addEventListener('click', function () {
      onInterpretOfflineWithAnswers();
    });

    // Describe Apply
    el('btn-describe-apply').addEventListener('click', applyDescribeProposal);

    // Theme
    el('btn-theme').addEventListener('click', toggleTheme);

    // Tabs — mark user intent
    document.querySelectorAll('[role="tab"]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.userSelectedTab = true;
        activateTab(tab.getAttribute('data-tab'));
      });
      tab.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); state.userSelectedTab = true; activateTab(tab.getAttribute('data-tab')); }
        if (e.key === 'ArrowRight') { focusNextTab(tab, 1); }
        if (e.key === 'ArrowLeft') { focusNextTab(tab, -1); }
      });
    });

    // Dialogs — close on backdrop click
    ['dlg-format', 'dlg-save', 'dlg-plan', 'dlg-generate-done', 'dlg-templates', 'dlg-unsaved-template',
     'dlg-ai-apply', 'dlg-ai-guided', 'dlg-ai-setup'].forEach(function (id) {
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

    // AI panel
    el('btn-ai-open').addEventListener('click', openAiPanel);
    el('btn-ai-close').addEventListener('click', closeAiPanel);
    el('btn-ai-propose').addEventListener('click', onAiProposeClick);
    el('btn-ai-cancel').addEventListener('click', onAiCancelClick);
    el('btn-ai-guided-mode').addEventListener('click', function (e) {
      e.preventDefault();
      el('dlg-ai-guided').showModal();
      el('btn-ai-guided-close').focus();
    });
    el('btn-ai-apply-cancel').addEventListener('click', function () { el('dlg-ai-apply').close(); });
    el('btn-ai-apply-confirm').addEventListener('click', applyAiProposal);
    el('btn-ai-guided-close').addEventListener('click', function () { el('dlg-ai-guided').close(); });
    el('btn-ai-setup-close').addEventListener('click', function () { el('dlg-ai-setup').close(); });

    bindWizardEvents();
  }

  // ── Editor ────────────────────────────────────────────────────────────────────

  function onEditorInput() {
    updateLineNumbers();
    markUnsaved();
    checkProseBanner();
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

  // ── Prose detection ──────────────────────────────────────────────────────────

  var TOP_LEVEL_KW = ['application ', 'authentication ', 'role ', 'a ', 'an ', 'each ', 'action ', 'allow ', 'entity ', '--', '#'];

  function isProseInput(source) {
    var lines = source.split('\\n');
    var firstNonBlank = null;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 0) { firstNonBlank = lines[i].trim(); break; }
    }
    if (!firstNonBlank) return false;
    var lower = firstNonBlank.toLowerCase();
    for (var k = 0; k < TOP_LEVEL_KW.length; k++) {
      if (lower.startsWith(TOP_LEVEL_KW[k].toLowerCase())) return false;
    }
    var wordCount = firstNonBlank.split(/\\s+/).length;
    return wordCount >= 4 || /[,?!;]/.test(firstNonBlank);
  }

  function checkProseBanner() {
    if (state.editorMode !== 'code') return;
    var src = el('editor').value;
    var banner = el('prose-banner');
    if (isProseInput(src)) {
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
    }
  }

  // ── Editor mode ───────────────────────────────────────────────────────────────

  function setEditorMode(mode) {
    state.editorMode = mode;
    var codeTab = el('tab-mode-code');
    var descTab = el('tab-mode-describe');
    var editorWrap = el('editor-wrap');
    var editorToolbar = el('editor-toolbar');
    var describePaneEl = el('describe-pane');
    var statusBar = el('status-bar');
    var aiPanel = el('ai-panel');

    if (mode === 'describe') {
      codeTab.setAttribute('aria-selected', 'false');
      descTab.setAttribute('aria-selected', 'true');
      editorWrap.setAttribute('hidden', '');
      editorToolbar.setAttribute('hidden', '');
      statusBar.setAttribute('hidden', '');
      el('prose-banner').classList.remove('visible');
      el('diag-summary').classList.remove('visible');
      describePaneEl.classList.add('visible');
      if (aiPanel && !aiPanel.hasAttribute('hidden')) aiPanel.setAttribute('hidden', '');
      // Update AI button availability in describe pane
      var aiBtn = el('btn-interpret-ai');
      if (aiBtn) {
        aiBtn.disabled = (aiState.provider === 'none');
        aiBtn.title = aiState.provider === 'none'
          ? 'AI provider is not configured. Start Studio with --ai-provider to enable.'
          : 'Ask the configured AI provider (' + aiState.provider + ')';
      }
      announce('Describe App mode active. Enter a description below.');
    } else {
      codeTab.setAttribute('aria-selected', 'true');
      descTab.setAttribute('aria-selected', 'false');
      editorWrap.removeAttribute('hidden');
      editorToolbar.removeAttribute('hidden');
      statusBar.removeAttribute('hidden');
      describePaneEl.classList.remove('visible');
      checkProseBanner();
      renderDiagSummary();
      announce('Write IntentLang mode active.');
    }
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
    renderDiagSummary();
    // Auto-switch to Problems tab on errors, unless user explicitly chose another tab
    if (state.diagnostics && state.diagnostics.length > 0 && !state.userSelectedTab && state.editorMode === 'code') {
      activateTab('problems');
    }
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

  function renderDiagSummary() {
    var bar = el('diag-summary');
    var diags = state.diagnostics || [];
    if (diags.length === 0 || state.editorMode === 'describe') {
      bar.classList.remove('visible');
      return;
    }
    var d = diags[0];
    bar.classList.add('visible');
    // Update content using textContent (no innerHTML)
    var badge = bar.querySelector('.diag-summary-badge');
    var loc = bar.querySelector('.diag-summary-loc');
    var msg = bar.querySelector('.diag-summary-msg');
    var hint = bar.querySelector('.diag-summary-hint');
    var showAll = el('btn-show-all-problems');
    if (badge) badge.textContent = d.code;
    if (loc) loc.textContent = 'line ' + d.line + ':' + d.column;
    if (msg) msg.textContent = d.message;
    if (hint) hint.textContent = d.hint ? ('Fix: ' + d.hint) : '';
    if (showAll) showAll.textContent = 'Show all ' + diags.length + ' problem' + (diags.length > 1 ? 's' : '');
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

  // ── AI Assist panel ───────────────────────────────────────────────────────────

  function initAiFromState(ai) {
    aiState.provider = ai.provider || 'none';
    aiState.model = ai.model || '';
    aiState.endpointOrigin = ai.endpointOrigin || '';
    aiState.isLocal = ai.isLocal !== false;
    aiState.configError = ai.configError || null;
    var badge = el('ai-provider-badge');
    if (!badge) return;
    if (aiState.provider === 'none') {
      badge.textContent = 'AI assistance: Off';
      badge.classList.remove('ai-active');
    } else {
      var providerNames = { 'ollama': 'Ollama', 'openai-compatible': 'OpenAI-compat', 'gemini': 'Gemini' };
      var displayName = providerNames[aiState.provider] || aiState.provider;
      var label = displayName + (aiState.model ? ' / ' + aiState.model : '');
      badge.textContent = 'AI: ' + label;
      badge.classList.add('ai-active');
    }
  }

  function openAiPanel() {
    var panel = el('ai-panel');
    panel.removeAttribute('hidden');
    el('ai-notice').textContent = '';
    el('ai-notice').className = '';
    el('ai-notice').removeAttribute('hidden');
    if (aiState.provider === 'none') {
      el('ai-notice').className = 'ai-notice-off';
      el('ai-notice').textContent = 'AI assistance is off. Start Studio with --ai-provider to enable it. The compiler and guided mode work without AI.';
      el('btn-ai-propose').disabled = true;
    } else {
      el('ai-notice').className = 'ai-notice';
      var notice;
      if (aiState.provider === 'gemini') {
        notice = 'Your description and current source are sent to Google Gemini endpoint (' + escText(aiState.endpointOrigin) + '). ' +
          'Free-tier availability, quotas, billing, and terms are controlled by your Google account and may change. ' +
          'Compiler and generated app remain AI-free.';
      } else if (aiState.isLocal) {
        notice = 'Your description and current source are sent to the configured provider. ' +
          'Data stays on this machine (subject to local server behaviour). Compiler and generated app remain AI-free.';
      } else {
        notice = 'Your description and current source are sent to the configured remote provider (' + escText(aiState.endpointOrigin) + '). ' +
          'Costs and privacy depend on that provider. Compiler and generated app remain AI-free.';
      }
      el('ai-notice').textContent = notice;
      el('btn-ai-propose').disabled = false;
    }
    if (aiState.configError) {
      var errDiv = document.createElement('div');
      errDiv.className = 'ai-error-box';
      errDiv.style.marginTop = '6px';
      errDiv.textContent = 'Configuration error: ' + aiState.configError;
      el('ai-notice').parentNode.insertBefore(errDiv, el('ai-notice').nextSibling);
      el('btn-ai-propose').disabled = true;
    }
    el('ai-description').focus();
    announce('AI Assist panel opened.');
  }

  function closeAiPanel() {
    el('ai-panel').setAttribute('hidden', '');
    aiState.pendingProposal = null;
    aiState.questionAnswers = {};
    aiState.priorAnswers = [];
    var resultEl = el('ai-result');
    resultEl.textContent = '';
    resultEl.setAttribute('hidden', '');
    announce('AI Assist panel closed.');
  }

  async function onAiProposeClick() {
    var desc = el('ai-description').value.trim();
    if (!desc) {
      announce('Please enter a description before generating a proposal.');
      el('ai-description').focus();
      return;
    }
    if (aiState.active) return;

    var answers = buildAnswers();
    await doAiPropose(desc, answers);
  }

  function buildAnswers() {
    var result = [];
    Object.keys(aiState.questionAnswers).forEach(function (qid) {
      result.push({ questionId: qid, selectedOption: aiState.questionAnswers[qid] });
    });
    return result.concat(aiState.priorAnswers);
  }

  async function doAiPropose(description, answers) {
    aiState.active = true;
    setAiWorking(true);
    clearAiResult();

    try {
      var body = { description: description, currentSource: el('editor').value };
      if (answers && answers.length > 0) body.clarificationAnswers = answers;

      var resp = await postJson('/api/ai/propose', body);
      var data = await resp.json();

      if (!resp.ok || data.kind === 'error') {
        renderAiError(data.error || 'Request failed.', data.diagnostics || []);
        return;
      }

      if (data.kind === 'questions') {
        renderAiQuestions(data.questions || []);
      } else if (data.kind === 'proposal') {
        aiState.pendingProposal = data;
        aiState.questionAnswers = {};
        renderAiProposalSummary(data);
      } else {
        renderAiError('Unexpected response from AI provider.', []);
      }
    } catch (err) {
      renderAiError('Request error: ' + String(err), []);
    } finally {
      aiState.active = false;
      setAiWorking(false);
    }
  }

  function onAiCancelClick() {
    postJson('/api/ai/propose', { description: '__cancel__', currentSource: '' }).catch(function () {});
    aiState.active = false;
    setAiWorking(false);
    clearAiResult();
    announce('AI request cancelled.');
  }

  function setAiWorking(working) {
    el('btn-ai-propose').disabled = working || aiState.provider === 'none';
    var cancelBtn = el('btn-ai-cancel');
    if (working) {
      cancelBtn.removeAttribute('hidden');
    } else {
      cancelBtn.setAttribute('hidden', '');
    }
    var spinner = el('ai-spinner');
    if (spinner) {
      if (working) spinner.classList.add('visible');
      else spinner.classList.remove('visible');
    }
  }

  function clearAiResult() {
    var r = el('ai-result');
    r.textContent = '';
    r.setAttribute('hidden', '');
  }

  function renderAiError(msg, diags) {
    var r = el('ai-result');
    r.textContent = '';
    r.removeAttribute('hidden');

    var box = document.createElement('div');
    box.className = 'ai-error-box';
    var msgEl = document.createElement('div');
    msgEl.textContent = msg;
    box.appendChild(msgEl);

    if (diags && diags.length > 0) {
      var diagsEl = document.createElement('div');
      diagsEl.className = 'ai-error-diags';
      diags.forEach(function (d) {
        var dd = document.createElement('div');
        dd.textContent = 'Line ' + d.line + ':' + d.column + ' [' + d.code + '] ' + d.message;
        diagsEl.appendChild(dd);
      });
      box.appendChild(diagsEl);
    }
    r.appendChild(box);
    announce('AI proposal error: ' + msg);
  }

  function renderAiQuestions(questions) {
    var r = el('ai-result');
    r.textContent = '';
    r.removeAttribute('hidden');

    aiState.questionAnswers = {};

    var title = document.createElement('div');
    title.className = 'ai-questions-title';
    title.textContent = 'AI needs clarification:';
    r.appendChild(title);

    questions.forEach(function (q) {
      var item = document.createElement('div');
      item.className = 'ai-question-item';

      var qText = document.createElement('div');
      qText.className = 'ai-question-text';
      qText.textContent = q.question;
      item.appendChild(qText);

      (q.options || []).forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-option-btn';
        btn.textContent = opt;
        btn.setAttribute('data-qid', q.id);
        btn.setAttribute('data-opt', opt);
        btn.addEventListener('click', function () {
          item.querySelectorAll('.ai-option-btn').forEach(function (b) {
            b.classList.remove('ai-selected');
          });
          btn.classList.add('ai-selected');
          aiState.questionAnswers[q.id] = opt;
        });
        item.appendChild(btn);
      });

      r.appendChild(item);
    });

    var sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'toolbar-btn primary';
    sendBtn.textContent = 'Send Answers';
    sendBtn.style.marginTop = '8px';
    sendBtn.addEventListener('click', function () {
      var answers = buildAnswers();
      var desc = el('ai-description').value.trim();
      doAiPropose(desc, answers);
    });
    r.appendChild(sendBtn);

    announce('AI has clarification questions. Please select answers.');
  }

  function renderAiProposalSummary(proposal) {
    var r = el('ai-result');
    r.textContent = '';
    r.removeAttribute('hidden');

    var okLabel = document.createElement('div');
    okLabel.className = 'ai-proposal-ok';
    okLabel.textContent = '\\u2705 Valid proposal — compiler accepted';
    r.appendChild(okLabel);

    var summaryEl = document.createElement('div');
    summaryEl.className = 'ai-proposal-summary';
    summaryEl.textContent = proposal.summary || '';
    r.appendChild(summaryEl);

    if (proposal.assumptions && proposal.assumptions.length > 0) {
      var aLabel = document.createElement('div');
      aLabel.style.cssText = 'font-size:11px;color:var(--cp-text-muted);margin-bottom:4px;';
      aLabel.textContent = 'Assumptions:';
      r.appendChild(aLabel);
      var aList = document.createElement('ul');
      aList.style.cssText = 'font-size:11px;color:var(--cp-text-muted);margin:0 0 8px 16px;padding:0;';
      (proposal.assumptions || []).forEach(function (a) {
        var li = document.createElement('li');
        li.textContent = a;
        aList.appendChild(li);
      });
      r.appendChild(aList);
    }

    var reviewBtn = document.createElement('button');
    reviewBtn.type = 'button';
    reviewBtn.className = 'toolbar-btn primary';
    reviewBtn.textContent = 'Review & Apply Proposal';
    reviewBtn.addEventListener('click', function () { showAiApplyDialog(proposal); });
    r.appendChild(reviewBtn);

    announce('AI proposal ready. Click Review & Apply to see the diff.');
  }

  function showAiApplyDialog(proposal) {
    var summaryEl = el('ai-proposal-summary-dlg');
    summaryEl.textContent = proposal.summary || '';

    var asmEl = el('ai-assumptions-dlg');
    if (proposal.assumptions && proposal.assumptions.length > 0) {
      asmEl.textContent = 'Assumptions: ' + proposal.assumptions.join('; ');
      asmEl.removeAttribute('hidden');
    } else {
      asmEl.setAttribute('hidden', '');
    }

    var diffPane = el('ai-diff-pane');
    diffPane.textContent = '';
    (proposal.diff || []).forEach(function (item) {
      var span = document.createElement('span');
      if (item.op === 'add') {
        span.className = 'diff-add';
        span.textContent = '+ ' + item.line + '\\n';
      } else if (item.op === 'remove') {
        span.className = 'diff-remove';
        span.textContent = '- ' + item.line + '\\n';
      } else {
        span.className = 'diff-same';
        span.textContent = '  ' + item.line + '\\n';
      }
      diffPane.appendChild(span);
    });

    el('dlg-ai-apply').showModal();
    el('btn-ai-apply-cancel').focus();
  }

  function applyAiProposal() {
    el('dlg-ai-apply').close();
    if (!aiState.pendingProposal) return;
    var src = aiState.pendingProposal.source;
    el('editor').value = src;
    updateLineNumbers();
    markUnsaved();
    runCheck(src);
    aiState.pendingProposal = null;
    aiState.priorAnswers = [];
    aiState.questionAnswers = {};
    clearAiResult();
    announce('AI proposal applied to editor. Source file unchanged until you Save.');
    // Does NOT call save or generate — user must confirm separately
  }

  // ── Offline Description Interpreter ──────────────────────────────────────────

  async function onInterpretOffline() {
    var desc = el('describe-textarea').value.trim();
    if (!desc) {
      announce('Please enter a description first.');
      el('describe-textarea').focus();
      return;
    }
    describeState.questionAnswers = {};
    describeState.unsupportedAcknowledged = false;
    await doInterpret(desc, undefined);
  }

  async function onInterpretOfflineWithAnswers() {
    var desc = el('describe-textarea').value.trim();
    if (!desc) return;
    var usersAnswer = describeState.questionAnswers['entity-type'];
    var optionAnswer = usersAnswer === 'Person records (no login required)' ? 'person'
                     : usersAnswer === 'Authenticated user accounts (login required)' ? 'auth-user'
                     : undefined;
    await doInterpret(desc, optionAnswer);
  }

  async function doInterpret(description, usersAnswer) {
    var resultEl = el('describe-result');
    resultEl.textContent = '';
    resultEl.classList.remove('visible');

    var btnOffline = el('btn-interpret-offline');
    if (btnOffline) btnOffline.disabled = true;

    try {
      var reqBody = { description: description };
      if (usersAnswer) reqBody.usersAnswer = usersAnswer;
      var resp = await postJson('/api/interpret', reqBody);
      var data = await resp.json();

      resultEl.classList.add('visible');
      resultEl.textContent = '';

      if (!resp.ok) {
        renderDescribeError(resultEl, data.error || 'Interpretation failed.');
        return;
      }

      if (data.kind === 'unrecognized') {
        renderDescribeUnrecognized(resultEl, data.reason || 'Could not interpret description.');
        return;
      }

      if (data.kind === 'clarification') {
        renderDescribeClarification(resultEl, data.questions || [], data.partialAssumptions || []);
        return;
      }

      if (data.kind === 'proposal') {
        describeState.pending = data;
        renderDescribeProposal(resultEl, data);
        return;
      }

      renderDescribeError(resultEl, 'Unexpected response from interpreter.');
    } catch (err) {
      resultEl.classList.add('visible');
      renderDescribeError(resultEl, 'Request error: ' + String(err));
    } finally {
      if (btnOffline) btnOffline.disabled = false;
    }
  }

  function renderDescribeError(container, msg) {
    var box = document.createElement('div');
    box.className = 'describe-unrecognized';
    var p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = 'Error: ' + msg;
    box.appendChild(p);
    container.appendChild(box);
    announce('Interpretation error: ' + msg);
  }

  function renderDescribeUnrecognized(container, reason) {
    var box = document.createElement('div');
    box.className = 'describe-unrecognized';
    var h4 = document.createElement('h4');
    h4.style.cssText = 'margin:0 0 4px 0;font-size:12px;font-weight:700;color:var(--cp-text-muted);';
    h4.textContent = 'Could not interpret description';
    var p = document.createElement('p');
    p.style.margin = '0';
    p.style.fontSize = '12px';
    p.textContent = reason;
    box.appendChild(h4);
    box.appendChild(p);
    container.appendChild(box);
    announce('Description not recognised. ' + reason);
  }

  function renderDescribeClarification(container, questions, partialAssumptions) {
    var title = document.createElement('div');
    title.className = 'describe-questions-title';
    title.textContent = 'A few questions to clarify:';
    container.appendChild(title);

    if (partialAssumptions && partialAssumptions.length > 0) {
      var noteEl = document.createElement('div');
      noteEl.className = 'describe-mode-note';
      partialAssumptions.forEach(function (a) {
        var p = document.createElement('p');
        p.style.margin = '0';
        p.textContent = a;
        noteEl.appendChild(p);
      });
      container.appendChild(noteEl);
    }

    describeState.questionAnswers = {};

    questions.forEach(function (q) {
      var item = document.createElement('div');
      item.className = 'describe-question-item';
      var qText = document.createElement('div');
      qText.className = 'describe-question-text';
      qText.textContent = q.question;
      item.appendChild(qText);
      (q.options || []).forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'describe-option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', function () {
          item.querySelectorAll('.describe-option-btn').forEach(function (b) { b.classList.remove('selected'); });
          btn.classList.add('selected');
          describeState.questionAnswers[q.id] = opt;
        });
        item.appendChild(btn);
      });
      container.appendChild(item);
    });

    var sendBtn = el('btn-describe-send-answers');
    if (sendBtn) sendBtn.style.display = 'inline-block';
    announce('Clarification needed. Please answer the questions.');
  }

  function renderDescribeProposal(container, data) {
    // Interpretation card
    var card = document.createElement('div');
    card.className = 'describe-interpretation-card';
    var cardTitle = document.createElement('h4');
    cardTitle.textContent = 'Interpretation: ' + data.appName + ' (' + data.entityName + ' records)';
    card.appendChild(cardTitle);

    if (data.assumptions && data.assumptions.length > 0) {
      data.assumptions.forEach(function (a) {
        var p = document.createElement('p');
        p.className = 'describe-assumptions';
        p.style.margin = '2px 0';
        p.style.fontSize = '12px';
        p.textContent = a;
        card.appendChild(p);
      });
    }
    container.appendChild(card);

    // Unsupported capabilities warning
    if (data.unsupportedCapabilities && data.unsupportedCapabilities.length > 0) {
      var unsupCard = document.createElement('div');
      unsupCard.className = 'describe-unsupported';
      var unsupTitle = document.createElement('h4');
      unsupTitle.textContent = 'Not generated yet — unsupported capabilities:';
      unsupCard.appendChild(unsupTitle);
      var ul = document.createElement('ul');
      ul.className = 'describe-warning-list';
      data.unsupportedCapabilities.forEach(function (u) {
        var li = document.createElement('li');
        li.textContent = u.capability + ': ' + u.message;
        ul.appendChild(li);
      });
      unsupCard.appendChild(ul);
      container.appendChild(unsupCard);
    }

    // Field warnings
    if (data.warnings && data.warnings.length > 0) {
      var warnCard = document.createElement('div');
      warnCard.className = 'describe-unsupported';
      warnCard.style.borderColor = 'var(--cp-text-muted)';
      warnCard.style.background = 'var(--cp-surface-soft)';
      var warnTitle = document.createElement('h4');
      warnTitle.style.color = 'var(--cp-text-muted)';
      warnTitle.textContent = 'Type notes:';
      warnCard.appendChild(warnTitle);
      var warnUl = document.createElement('ul');
      warnUl.className = 'describe-warning-list';
      data.warnings.forEach(function (w) {
        var li = document.createElement('li');
        li.textContent = w;
        warnUl.appendChild(li);
      });
      warnCard.appendChild(warnUl);
      container.appendChild(warnCard);
    }

    // Proposed source preview
    var srcLabel = document.createElement('div');
    srcLabel.className = 'describe-path-label';
    srcLabel.textContent = 'Proposed IntentLang source:';
    container.appendChild(srcLabel);

    var srcPre = document.createElement('pre');
    srcPre.className = 'describe-proposal-source';
    srcPre.setAttribute('aria-label', 'Proposed IntentLang source');
    srcPre.textContent = data.source || '';
    container.appendChild(srcPre);

    // Acknowledgement row (if there are unsupported capabilities)
    var ackRow = el('unsupported-ack-row');
    var applyBtn = el('btn-describe-apply');
    if (data.unsupportedCapabilities && data.unsupportedCapabilities.length > 0) {
      ackRow.classList.add('visible');
      ackRow.querySelector('label').textContent =
        'I understand that ' +
        data.unsupportedCapabilities.map(function (u) { return u.capability; }).join(', ') +
        ' were not generated and will need to be added manually or are not supported.';
      var ackBox = el('unsupported-ack-checkbox');
      ackBox.checked = false;
      describeState.unsupportedAcknowledged = false;
      if (applyBtn) applyBtn.disabled = true;
      ackBox.addEventListener('change', function () {
        describeState.unsupportedAcknowledged = ackBox.checked;
        if (applyBtn) applyBtn.disabled = !ackBox.checked;
      });
    } else {
      ackRow.classList.remove('visible');
      if (applyBtn) applyBtn.disabled = false;
    }

    // Apply row
    var applyRow = el('describe-apply-row');
    if (applyRow) applyRow.style.display = 'flex';

    announce('Proposal ready: ' + data.appName + ' with ' + data.supportedFieldCount + ' field(s). ' +
      (data.unsupportedCapabilities && data.unsupportedCapabilities.length > 0
        ? 'Acknowledge unsupported items to enable Apply.' : 'Click Apply to Editor.'));
  }

  function applyDescribeProposal() {
    if (!describeState.pending) return;
    var data = describeState.pending;
    if (data.unsupportedCapabilities && data.unsupportedCapabilities.length > 0 && !describeState.unsupportedAcknowledged) {
      announce('Please acknowledge the unsupported capabilities before applying.');
      return;
    }
    var src = data.source;
    // Switch to Write IntentLang mode
    setEditorMode('code');
    el('editor').value = src;
    updateLineNumbers();
    markUnsaved();
    runCheck(src);
    describeState.pending = null;
    describeState.unsupportedAcknowledged = false;
    announce('Proposal applied to editor. Source file unchanged until you Save. Generate App is a separate step.');
  }

  // ── Wizard ────────────────────────────────────────────────────────────────────

  function openAdvancedTools() {
    var details = el('advanced-tools-section');
    if (!details) return;
    details.open = true;
    announce('Advanced tools opened.');
  }

  function syncAdvancedEditorWithProposal() {
    if (!wizardState.proposedSource) return;
    el('editor').value = wizardState.proposedSource;
    updateLineNumbers();
    markUnsaved();
    runCheck(wizardState.proposedSource);
    setEditorMode('code');
  }

  function initWizard(data) {
    var existingCard = el('existing-app-card');
    var existingText = el('existing-app-card-text');
    var hasSource = !!(data.source && data.source.trim().length > 0);
    if (hasSource) {
      existingCard.removeAttribute('hidden');
      existingText.textContent = 'This file already has IntentLang source. The wizard stays visible and will only replace the source if you build a new proposal.';
    } else {
      existingCard.setAttribute('hidden', '');
      existingText.textContent = '';
    }
    el('advanced-tools-section').open = false;
    el('wiz-description').value = wizardState.description;
    el('btn-wizard-continue').disabled = wizardState.description.trim().length === 0;
    showWizStep(1);
    refreshPreviewStatus();
  }

  function bindWizardEvents() {
    el('wiz-description').addEventListener('input', function () {
      el('btn-wizard-continue').disabled = el('wiz-description').value.trim().length === 0;
    });
    el('btn-wizard-continue').addEventListener('click', onWizContinue);
    el('btn-wizard-use-template').addEventListener('click', function () {
      openAdvancedTools();
      openTemplates();
    });
    el('btn-existing-open-advanced').addEventListener('click', openAdvancedTools);
    el('btn-wizard-back-to-describe').addEventListener('click', function () { showWizStep(1); });
    el('btn-wizard-build').addEventListener('click', onWizBuild);
    el('btn-wizard-edit-advanced').addEventListener('click', function () {
      syncAdvancedEditorWithProposal();
      openAdvancedTools();
    });
    el('btn-wizard-back-to-review').addEventListener('click', function () { showWizStep(2); });
    el('btn-wizard-start-preview').addEventListener('click', startPreview);
    el('btn-wizard-stop-preview').addEventListener('click', stopPreview);
    el('btn-wizard-open-app').addEventListener('click', function () {
      if (wizardState.previewUrl) {
        window.open(wizardState.previewUrl, '_blank', 'noopener,noreferrer');
      }
    });
    document.querySelectorAll('[data-open-advanced="true"]').forEach(function (button) {
      button.addEventListener('click', openAdvancedTools);
    });
    el('wiz-ack-checkbox').addEventListener('change', function () {
      wizardState.unsupportedAcknowledged = !!el('wiz-ack-checkbox').checked;
      updateWizardBuildButton();
    });
  }

  function showWizStep(step) {
    wizardState.step = step;
    [1, 2, 3, 4].forEach(function (s) {
      var panel = el('wiz-step-' + s);
      if (!panel) return;
      if (s === step) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
    [1, 2, 3, 4].forEach(function (s) {
      var indicator = el('step-indicator-' + s);
      if (!indicator) return;
      indicator.classList.remove('active', 'done', 'completed');
      indicator.removeAttribute('aria-current');
      if (s === step) {
        indicator.classList.add('active');
        indicator.setAttribute('aria-current', 'step');
      } else if (s < step) {
        indicator.classList.add('done', 'completed');
      }
    });
  }

  function updateWizardBuildButton() {
    var buildBtn = el('btn-wizard-build');
    var needsAck = !!(
      wizardState.proposalData &&
      wizardState.proposalData.unsupportedCapabilities &&
      wizardState.proposalData.unsupportedCapabilities.length > 0
    );
    buildBtn.disabled = needsAck && !wizardState.unsupportedAcknowledged;
  }

  function resetClarificationUi() {
    var clarificationBox = el('wizard-clarification-box');
    clarificationBox.textContent = '';
    clarificationBox.setAttribute('hidden', '');
    wizardState.clarificationQuestions = [];
    wizardState.clarificationAnswers = {};
  }

  function renderClarification(data) {
    var clarificationBox = el('wizard-clarification-box');
    clarificationBox.textContent = '';
    clarificationBox.removeAttribute('hidden');
    wizardState.clarificationQuestions = data.questions || [];
    wizardState.clarificationAnswers = {};

    var title = document.createElement('strong');
    title.textContent = 'One quick clarification';
    clarificationBox.appendChild(title);

    if (data.partialAssumptions && data.partialAssumptions.length > 0) {
      data.partialAssumptions.forEach(function (item) {
        var p = document.createElement('p');
        p.className = 'wizard-assumption';
        p.textContent = item;
        clarificationBox.appendChild(p);
      });
    }

    (data.questions || []).forEach(function (question) {
      var fieldset = document.createElement('fieldset');
      fieldset.className = 'wizard-clarification-question';
      var legend = document.createElement('legend');
      legend.textContent = question.question;
      fieldset.appendChild(legend);
      (question.options || []).forEach(function (option) {
        var label = document.createElement('label');
        label.className = 'wizard-radio-option';
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = question.id;
        input.value = option;
        input.addEventListener('change', function () {
          wizardState.clarificationAnswers[question.id] = option;
        });
        label.appendChild(input);
        var span = document.createElement('span');
        span.textContent = option;
        label.appendChild(span);
        fieldset.appendChild(label);
      });
      clarificationBox.appendChild(fieldset);
    });
  }

  async function onWizContinue() {
    var desc = el('wiz-description').value.trim();
    if (!desc) {
      showWizardError('wizard-describe-error', 'Please enter a description first.');
      el('wiz-description').focus();
      return;
    }

    wizardState.description = desc;
    hideWizardError('wizard-describe-error');
    var btn = el('btn-wizard-continue');
    btn.disabled = true;
    el('wizard-interpret-spinner').removeAttribute('hidden');

    var payload = { description: desc };
    if (wizardState.clarificationQuestions.length > 0) {
      var question = wizardState.clarificationQuestions[0];
      var selected = wizardState.clarificationAnswers[question.id];
      if (!selected) {
        showWizardError('wizard-describe-error', 'Choose one of the clarification options to continue.');
        btn.disabled = false;
        el('wizard-interpret-spinner').setAttribute('hidden', '');
        return;
      }
      payload.usersAnswer = selected === 'auth-user' ? 'auth-user' : 'person';
    }

    try {
      var resp = await postJson('/api/wizard/interpret', payload);
      var data = await resp.json();
      if (!resp.ok) {
        showWizardError('wizard-describe-error', data.error || 'Interpretation failed.');
        return;
      }
      if (data.kind === 'unrecognized') {
        resetClarificationUi();
        showWizardError('wizard-describe-error', data.reason || 'Could not interpret that description.');
        return;
      }
      if (data.kind === 'clarification') {
        renderClarification(data);
        announce('Clarification needed before the proposal can be built.');
        return;
      }
      resetClarificationUi();
      wizardState.proposalToken = data.proposalToken || null;
      wizardState.proposedSource = data.source || '';
      wizardState.proposalData = data;
      wizardState.unsupportedAcknowledged = false;
      el('wiz-ack-checkbox').checked = false;
      showReview(data);
      showWizStep(2);
      announce('Proposal ready for review.');
    } catch (err) {
      showWizardError('wizard-describe-error', 'Request error: ' + String(err));
    } finally {
      btn.disabled = false;
      el('wizard-interpret-spinner').setAttribute('hidden', '');
    }
  }

  function showReview(data) {
    var container = el('wizard-review-content');
    var ackRow = el('wizard-ack-row');
    var ackText = el('wiz-ack-text');
    container.textContent = '';

    var card = document.createElement('div');
    card.className = 'wizard-review-card';
    var title = document.createElement('h3');
    title.className = 'wizard-review-title';
    title.textContent = 'Ready to build ' + data.appName;
    card.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'wizard-step-desc';
    sub.textContent = 'Entity: ' + data.entityName + '. Review the proposed source and any assumptions below.';
    card.appendChild(sub);

    (data.assumptions || []).forEach(function (item) {
      var assumption = document.createElement('p');
      assumption.className = 'wizard-assumption';
      assumption.textContent = item;
      card.appendChild(assumption);
    });

    (data.warnings || []).forEach(function (item) {
      var warning = document.createElement('p');
      warning.className = 'wizard-assumption';
      warning.textContent = item;
      card.appendChild(warning);
    });

    container.appendChild(card);

    if (data.unsupportedCapabilities && data.unsupportedCapabilities.length > 0) {
      var unsupported = document.createElement('div');
      unsupported.className = 'wizard-unsupported-box';
      var unsupportedTitle = document.createElement('strong');
      unsupportedTitle.textContent = 'Unsupported items were left out of the generated source:';
      unsupported.appendChild(unsupportedTitle);
      var list = document.createElement('ul');
      data.unsupportedCapabilities.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item.capability + ': ' + item.message;
        list.appendChild(li);
      });
      unsupported.appendChild(list);
      container.appendChild(unsupported);
      ackRow.removeAttribute('hidden');
      ackText.textContent = 'I understand unsupported items were not generated and I still want to build the supported app.';
    } else {
      ackRow.setAttribute('hidden', '');
      ackText.textContent = '';
    }

    var sourceLabel = document.createElement('label');
    sourceLabel.className = 'wizard-label';
    sourceLabel.textContent = 'Proposed IntentLang source';
    container.appendChild(sourceLabel);

    var sourcePreview = document.createElement('pre');
    sourcePreview.className = 'wizard-source-preview';
    sourcePreview.textContent = data.source || '';
    container.appendChild(sourcePreview);

    updateWizardBuildButton();
  }

  function setBuildStage(stageId) {
    ['review', 'compile', 'generate', 'preview'].forEach(function (id) {
      var item = el('wizard-build-stage-' + id);
      if (!item) return;
      item.classList.remove('active', 'done');
      if (id === stageId) item.classList.add('active');
    });
  }

  function markBuildStageDone(stageId) {
    var item = el('wizard-build-stage-' + stageId);
    if (item) {
      item.classList.remove('active');
      item.classList.add('done');
    }
  }

  async function onWizBuild() {
    if (!wizardState.proposalToken || !wizardState.proposedSource) {
      showWizardError('wizard-review-error', 'Interpret the description again before building.');
      showWizStep(2);
      return;
    }
    if (el('wiz-ack-checkbox').offsetParent !== null && !el('wiz-ack-checkbox').checked) {
      showWizardError('wizard-review-error', 'Acknowledge the unsupported items before building.');
      return;
    }

    hideWizardError('wizard-review-error');
    hideWizardError('wizard-build-error');
    showWizStep(3);
    el('wizard-build-spinner').removeAttribute('hidden');
    el('wizard-build-result').setAttribute('hidden', '');
    el('wizard-build-actions').setAttribute('hidden', '');
    setBuildStage('compile');

    try {
      var resp = await postJson('/api/wizard/build', {
        proposalToken: wizardState.proposalToken,
        proposedSource: wizardState.proposedSource
      });
      var data = await resp.json();
      wizardState.proposalToken = null;

      if (!resp.ok) {
        el('wizard-build-spinner').setAttribute('hidden', '');
        showWizardError('wizard-build-error', data.error || 'Build failed.');
        el('wizard-build-actions').removeAttribute('hidden');
        return;
      }

      wizardState.buildResult = data;
      markBuildStageDone('compile');
      setBuildStage('generate');
      markBuildStageDone('generate');
      el('wizard-build-spinner').setAttribute('hidden', '');

      var resultBox = el('wizard-build-result');
      var lines = ['Generated in: ' + (data.outputDir || ''), '', 'Artifacts:'];
      (data.artifacts || []).forEach(function (item) { lines.push('  ' + item); });
      if (data.authEnabled) {
        lines.push('');
        lines.push('Authentication is enabled, so wizard preview stays off.');
        lines.push('Run the generated app manually after setting:');
        lines.push('  INTENTLANG_BOOTSTRAP_NAME');
        lines.push('  INTENTLANG_BOOTSTRAP_EMAIL');
        lines.push('  INTENTLANG_BOOTSTRAP_PASSWORD');
      }
      resultBox.textContent = lines.join('\\n');
      resultBox.removeAttribute('hidden');
      el('wizard-build-actions').removeAttribute('hidden');

      if (data.authEnabled) {
        showWizStep(4);
        el('wiz-auth-guidance').removeAttribute('hidden');
        el('wiz-run-command').textContent = 'node ' + (data.outputDir || 'app-output') + '\\app.mjs';
        updateWizardPreviewBadge(false, null, 'Preview blocked for authenticated apps.');
        announce('Build complete. Authentication guidance is shown instead of auto-preview.');
        return;
      }

      markBuildStageDone('preview');
      showWizStep(4);
      el('wiz-auth-guidance').setAttribute('hidden', '');
      await startPreview();
    } catch (err) {
      el('wizard-build-spinner').setAttribute('hidden', '');
      showWizardError('wizard-build-error', 'Request error: ' + String(err));
      el('wizard-build-actions').removeAttribute('hidden');
    }
  }

  async function refreshPreviewStatus() {
    try {
      var resp = await fetch('/api/preview/status');
      if (!resp.ok) return;
      var data = await resp.json();
      updateWizardPreviewBadge(!!data.running, data.url || null, data.running ? null : null);
    } catch {
      // Non-fatal
    }
  }

  async function startPreview() {
    var btn = el('btn-wizard-start-preview');
    btn.disabled = true;
    hideWizardError('wizard-preview-error');
    try {
      var resp = await postJson('/api/preview/start', {});
      var data = await resp.json();
      if (!data.ok) {
        updateWizardPreviewBadge(false, null, data.reason || 'Preview could not start.');
        showWizardError('wizard-preview-error', data.reason || 'Preview could not start.');
        return;
      }
      markBuildStageDone('preview');
      wizardState.previewUrl = data.url || null;
      updateWizardPreviewBadge(true, data.url || null, null);
      announce('Preview started at ' + data.url);
    } catch (err) {
      showWizardError('wizard-preview-error', 'Request error: ' + String(err));
    } finally {
      btn.disabled = false;
    }
  }

  async function stopPreview() {
    var btn = el('btn-wizard-stop-preview');
    btn.disabled = true;
    try {
      await postJson('/api/preview/stop', {});
      wizardState.previewUrl = null;
      updateWizardPreviewBadge(false, null, null);
      announce('Preview stopped.');
    } catch (err) {
      showWizardError('wizard-preview-error', 'Request error: ' + String(err));
    } finally {
      btn.disabled = false;
    }
  }

  function updateWizardPreviewBadge(running, url, reason) {
    var badge = el('wizard-preview-badge');
    var urlBox = el('wizard-preview-url');
    var startBtn = el('btn-wizard-start-preview');
    var stopBtn = el('btn-wizard-stop-preview');
    var openBtn = el('btn-wizard-open-app');

    urlBox.textContent = '';
    if (running && url) {
      wizardState.previewUrl = url;
      badge.textContent = '● Running';
      badge.className = 'wizard-preview-badge running';
      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = url;
      urlBox.appendChild(link);
      urlBox.removeAttribute('hidden');
      startBtn.setAttribute('hidden', '');
      stopBtn.removeAttribute('hidden');
      openBtn.removeAttribute('hidden');
    } else {
      wizardState.previewUrl = null;
      badge.textContent = reason || 'Not running';
      badge.className = 'wizard-preview-badge';
      urlBox.setAttribute('hidden', '');
      startBtn.removeAttribute('hidden');
      stopBtn.setAttribute('hidden', '');
      openBtn.setAttribute('hidden', '');
    }
  }

  function showWizardError(id, msg) {
    var box = el(id);
    if (!box) return;
    box.textContent = msg;
    box.removeAttribute('hidden');
    announce('Error: ' + msg);
  }

  function hideWizardError(id) {
    var box = el(id);
    if (!box) return;
    box.setAttribute('hidden', '');
    box.textContent = '';
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
    <h1>IntentLang App Builder</h1>
    <span class="badge">Studio</span>
    <span class="filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>
    <span class="badge" title="Experimental offline authoring tool — no AI tokens required">experimental · offline · no-AI</span>
    <div class="spacer"></div>
    <button id="btn-theme" type="button" aria-label="Toggle dark/light theme">🌙 Dark</button>
  </header>

  <main id="app-body" role="main">
    <section id="wizard-view" aria-label="App Builder wizard">
      <div class="wizard-hero">
        <div class="wizard-hero-copy">
          <h2>IntentLang App Builder</h2>
          <p>Describe the app you want in one sentence, review the generated IntentLang, build safely, then open the preview if authentication is not required.</p>
        </div>
        <span class="badge wizard-hero-badge">Studio</span>
      </div>

      <div class="wizard-existing-card" id="existing-app-card" hidden>
        <strong>Existing app source found</strong>
        <p id="existing-app-card-text"></p>
        <div class="wizard-actions">
          <button id="btn-existing-open-advanced" class="toolbar-btn" type="button">Open advanced tools</button>
        </div>
      </div>

      <nav id="wizard-stepper" aria-label="App Builder steps">
      <ol class="wizard-steps-indicator">
        <li class="wizard-step-indicator step active" id="step-indicator-1" aria-current="step">
          <span class="wizard-step-num">1</span>
          <span class="wizard-step-label">Describe</span>
        </li>
        <li class="wizard-step-divider" aria-hidden="true">›</li>
        <li class="wizard-step-indicator step" id="step-indicator-2">
          <span class="wizard-step-num">2</span>
          <span class="wizard-step-label">Review</span>
        </li>
        <li class="wizard-step-divider" aria-hidden="true">›</li>
        <li class="wizard-step-indicator step" id="step-indicator-3">
          <span class="wizard-step-num">3</span>
          <span class="wizard-step-label">Build</span>
        </li>
        <li class="wizard-step-divider" aria-hidden="true">›</li>
        <li class="wizard-step-indicator step" id="step-indicator-4">
          <span class="wizard-step-num">4</span>
          <span class="wizard-step-label">Open app</span>
        </li>
      </ol>
      </nav>

      <!-- Step 1: Describe -->
      <div class="wizard-step-panel wiz-step" id="wiz-step-1">
        <h2 class="wizard-step-title">Describe your app</h2>
        <p class="wizard-step-desc">Describe the app in plain English. Example: I want to build an app that lets people add their name, age, address, and date of birth.</p>
        <label class="wizard-label" for="wiz-description">Describe the app you want to build</label>
        <textarea id="wiz-description" class="wizard-textarea" rows="5"
          placeholder="Example: I want to build an app that lets people add their name, age, address, and date of birth."
          aria-label="App description"></textarea>
        <div class="wizard-unsupported-box" id="wizard-clarification-box" hidden></div>
        <div class="wizard-actions">
          <button id="btn-wizard-continue" class="toolbar-btn primary btn-primary" type="button" disabled>Continue →</button>
          <button id="btn-wizard-use-template" class="toolbar-btn" type="button">Use a template in advanced tools</button>
        </div>
        <div class="wizard-spinner" id="wizard-interpret-spinner" aria-hidden="true" hidden></div>
        <div class="wizard-error-box" id="wizard-describe-error" role="alert" hidden></div>
      </div>

      <!-- Step 2: Review -->
      <div class="wizard-step-panel wiz-step" id="wiz-step-2" hidden>
        <h2 class="wizard-step-title">Review your app</h2>
        <p class="wizard-step-desc">Review the supported source, confirm any unsupported items, then build the app.</p>
        <div id="wizard-review-content" aria-live="polite"></div>
        <div class="wizard-actions" id="wizard-ack-row" hidden>
          <label class="wizard-radio-option" for="wiz-ack-checkbox">
            <input id="wiz-ack-checkbox" type="checkbox">
            <span id="wiz-ack-text"></span>
          </label>
        </div>
        <div class="wizard-error-box" id="wizard-review-error" role="alert" hidden></div>
        <div class="wizard-actions">
          <button id="btn-wizard-back-to-describe" class="toolbar-btn" type="button">← Back</button>
          <button id="btn-wizard-build" class="toolbar-btn primary btn-primary" type="button">Build App →</button>
          <button id="btn-wizard-edit-advanced" class="toolbar-btn" type="button">Edit in advanced tools ↗</button>
        </div>
      </div>

      <!-- Step 3: Build -->
      <div class="wizard-step-panel wiz-step" id="wiz-step-3" hidden>
        <h2 class="wizard-step-title">Building your app…</h2>
        <ol class="wizard-build-stages" aria-label="Build progress stages">
          <li id="wizard-build-stage-review">Review confirmed</li>
          <li id="wizard-build-stage-compile">Compile and validate</li>
          <li id="wizard-build-stage-generate">Generate artifacts safely</li>
          <li id="wizard-build-stage-preview">Auto-preview when allowed</li>
        </ol>
        <div class="wizard-build-status">
          <div class="wizard-spinner" id="wizard-build-spinner" aria-hidden="true"></div>
          <span id="wizard-build-msg">Compiling and generating…</span>
        </div>
        <pre class="wizard-build-result" id="wizard-build-result" aria-live="polite" hidden></pre>
        <div class="wizard-error-box" id="wizard-build-error" role="alert" hidden></div>
        <div class="wizard-actions" id="wizard-build-actions" hidden>
          <button id="btn-wizard-back-to-review" class="toolbar-btn" type="button">← Back</button>
          <button id="btn-wizard-open-advanced" class="toolbar-btn" type="button" data-open-advanced="true">Open advanced tools</button>
        </div>
      </div>

      <!-- Step 4: Preview -->
      <div class="wizard-step-panel wiz-step" id="wiz-step-4" hidden>
        <h2 class="wizard-step-title">Open your app</h2>
        <p class="wizard-step-desc">The wizard auto-starts preview for unauthenticated apps. Authenticated apps show guidance instead.</p>
        <div id="wizard-preview-badge" class="wizard-preview-badge" aria-live="polite">Not running</div>
        <div id="wizard-preview-url" class="wizard-preview-url-box" hidden></div>
        <div id="wiz-auth-guidance" class="wizard-existing-card" hidden>
          <h3>Authentication setup required</h3>
          <p>Set these environment variables before running the generated app:</p>
          <ul>
            <li><code>INTENTLANG_BOOTSTRAP_NAME</code></li>
            <li><code>INTENTLANG_BOOTSTRAP_EMAIL</code></li>
            <li><code>INTENTLANG_BOOTSTRAP_PASSWORD</code></li>
          </ul>
          <p>Then run: <code id="wiz-run-command"></code></p>
        </div>
        <div class="wizard-actions">
          <button id="btn-wizard-start-preview" class="toolbar-btn primary" type="button">Start preview</button>
          <button id="btn-wizard-stop-preview" class="toolbar-btn" type="button" hidden>Stop Preview</button>
          <button id="btn-wizard-open-app" class="toolbar-btn primary btn-cta" type="button" hidden>Open app</button>
          <button id="btn-wizard-open-advanced-2" class="toolbar-btn" type="button" data-open-advanced="true">Open advanced tools</button>
        </div>
        <div class="wizard-error-box" id="wizard-preview-error" role="alert" hidden></div>
      </div>
    </section>

    <details id="advanced-tools-section">
      <summary>Advanced tools</summary>
      <div id="studio-main">
      <section id="editor-pane" aria-label="Source editor">
        <div id="editor-mode-tabs" role="tablist" aria-label="Editor mode">
          <button role="tab" id="tab-mode-code" class="mode-tab" aria-selected="true" aria-controls="editor-wrap" tabindex="0" title="Write IntentLang controlled grammar">Write IntentLang</button>
          <button role="tab" id="tab-mode-describe" class="mode-tab" aria-selected="false" aria-controls="describe-pane" tabindex="-1" title="Describe your app in plain English (offline interpreter + optional AI)">Describe App</button>
        </div>
        <div id="editor-toolbar" role="toolbar" aria-label="Editor actions">
          <button id="btn-check" class="toolbar-btn" type="button" title="Check source (Ctrl+Enter)">Check</button>
          <button id="btn-format" class="toolbar-btn" type="button" title="Format source (Ctrl+Shift+F)">Format</button>
          <button id="btn-save" class="toolbar-btn" type="button" title="Save source (Ctrl+S)">Save</button>
          <button id="btn-generate" class="toolbar-btn primary" type="button" title="Generate App">Generate App</button>
          <button id="btn-templates" type="button" title="Load a template">Templates ▾</button>
          <button id="btn-ai-open" class="toolbar-btn" type="button" title="Describe with AI (optional — off by default)">AI Assist ✦</button>
        </div>
        <div id="diag-summary" aria-live="assertive" aria-atomic="true" aria-label="First diagnostic">
          <span class="diag-summary-badge" aria-hidden="true"></span>
          <span class="diag-summary-loc"></span>
          <span class="diag-summary-msg"></span>
          <span class="diag-summary-hint"></span>
          <button id="btn-show-all-problems" type="button" aria-label="Show all problems in Problems panel">Show all problems</button>
        </div>
        <div id="prose-banner" role="alert" aria-live="polite" aria-atomic="true">
          <span class="prose-banner-icon" aria-hidden="true">💬</span>
          <div>
            <div class="prose-banner-text">This looks like a description, not IntentLang code.</div>
            <div class="prose-banner-sub">Use <strong>Describe App</strong> mode for plain-English input, or <strong>Write IntentLang</strong> for the controlled grammar.</div>
          </div>
          <div class="prose-banner-actions">
            <button id="btn-prose-move" class="prose-banner-btn" type="button">Move to Describe App</button>
            <button id="btn-prose-examples" class="prose-banner-btn secondary" type="button">Show valid examples</button>
          </div>
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
        <div id="describe-pane" aria-label="Describe App mode" aria-live="off">
          <div id="describe-pane-body">
            <div class="describe-mode-note">
              <strong>Describe App</strong> accepts supported plain-English descriptions.
              The <em>offline interpreter</em> works without AI for simple CRUD apps using a finite vocabulary.
              Optional AI handles broader descriptions if a provider is configured.
              <br>This is <strong>not</strong> unrestricted natural language — unsupported features will be listed, not silently omitted.
            </div>
            <label for="describe-textarea" style="font-size:12px;font-weight:600;color:var(--cp-text-muted);">Describe the app you want to build:</label>
            <textarea
              id="describe-textarea"
              rows="4"
              placeholder="e.g. I want to build an app that allows users to add their name, age, address, DOB"
              aria-label="App description"
            ></textarea>
            <div class="describe-actions">
              <div>
                <div class="describe-path-label">Path 1 — always available</div>
                <button id="btn-interpret-offline" class="toolbar-btn primary" type="button">Use offline guided interpretation</button>
              </div>
              <div>
                <div class="describe-path-label">Path 2 — requires AI provider</div>
                <button id="btn-interpret-ai" class="toolbar-btn" type="button" disabled title="AI provider is not configured. Start Studio with --ai-provider to enable.">Ask configured AI ✦</button>
              </div>
            </div>
            <div id="describe-result"></div>
            <div id="unsupported-ack-row" aria-live="polite">
              <input type="checkbox" id="unsupported-ack-checkbox" aria-label="Acknowledge unsupported capabilities">
              <label for="unsupported-ack-checkbox"></label>
            </div>
            <div id="describe-apply-row" class="describe-apply-row" style="display:none;">
              <button id="btn-describe-apply" class="toolbar-btn primary" type="button" disabled>Apply supported source to Editor</button>
              <button id="btn-describe-send-answers" class="toolbar-btn" type="button" style="display:none;">Send Answers</button>
              <span style="font-size:11px;color:var(--cp-text-muted);">Apply updates the editor only — no auto-save, no auto-generate.</span>
            </div>
          </div>
        </div>
        <div id="status-bar" role="status" aria-live="polite">
          <span id="unsaved-dot" aria-hidden="true" title="Unsaved changes"></span>
          <span id="status-text" class="status-checking">Loading…</span>
          <span class="spacer"></span>
          <span style="color:var(--cp-text-muted);font-size:10px;">Port ${port} · localhost only</span>
        </div>

        <section id="ai-panel" aria-label="Describe with AI" hidden>
          <div id="ai-panel-header">
            <span id="ai-provider-badge" class="ai-provider-badge">AI assistance: Off</span>
            <span class="spacer"></span>
            <button id="btn-ai-close" class="toolbar-btn" type="button" aria-label="Close AI panel" style="padding:2px 8px;">✕</button>
          </div>
          <div id="ai-panel-body">
            <div id="ai-notice" class="ai-notice-off">AI assistance is off. Start Studio with --ai-provider to enable it.</div>
            <label id="ai-description-label" for="ai-description">Describe the app or change you want:</label>
            <textarea
              id="ai-description"
              rows="3"
              placeholder="e.g. I want to create an inventory app with products, suppliers, and stock levels."
              aria-label="Describe the app or change you want"
            ></textarea>
            <div class="ai-buttons" role="toolbar" aria-label="AI request actions">
              <button id="btn-ai-propose" class="toolbar-btn primary" type="button" disabled>Generate Proposal</button>
              <button id="btn-ai-cancel" class="toolbar-btn" type="button" hidden>Cancel</button>
              <span id="ai-spinner" aria-hidden="true" title="Requesting…"></span>
            </div>
            <div id="ai-result" hidden aria-live="polite" aria-atomic="false"></div>
            <p class="ai-guided-link"><a href="#" id="btn-ai-guided-mode">Use deterministic guided mode instead ↗</a></p>
          </div>
        </section>
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
      </div>
    </details>
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
      <button id="btn-unsaved-proceed" class="toolbar-btn primary" type="button">Discard &amp; load template</button>
    </div>
  </dialog>

  <!-- AI Proposal review dialog -->
  <dialog id="dlg-ai-apply" aria-labelledby="dlg-ai-apply-title" aria-modal="true" style="max-width:640px;">
    <h2 class="dialog-title" id="dlg-ai-apply-title">Review AI Proposal</h2>
    <p class="dialog-body">Applying updates the editor only — the source file remains unchanged until you Save separately. Generate App is a separate step.</p>
    <div id="ai-proposal-summary-dlg" class="ai-proposal-summary" style="margin-bottom:8px;"></div>
    <div id="ai-assumptions-dlg" style="font-size:11px;color:var(--cp-text-muted);margin-bottom:8px;" hidden></div>
    <div class="diff-pane" id="ai-diff-pane" aria-label="Proposal diff" aria-readonly="true" role="region" aria-live="off"></div>
    <div class="dialog-actions">
      <button id="btn-ai-apply-cancel" class="toolbar-btn" type="button">Cancel</button>
      <button id="btn-ai-apply-confirm" class="toolbar-btn primary" type="button">Apply to Editor</button>
    </div>
  </dialog>

  <!-- AI Guided mode explanation dialog -->
  <dialog id="dlg-ai-guided" aria-labelledby="dlg-ai-guided-title" aria-modal="true">
    <h2 class="dialog-title" id="dlg-ai-guided-title">Deterministic Guided Mode</h2>
    <p class="dialog-body">IntentLang is fully usable without AI. The compiler provides instant, precise error messages and hints for every supported statement.</p>
    <p class="dialog-body">Use the built-in templates to explore what the language supports. All compiler, Studio, and generation features work without any AI provider configured.</p>
    <p class="dialog-body" style="font-size:11px;color:var(--cp-text-muted);">AI assistance is always optional and consumes zero tokens for compilation, checking, formatting, and app generation.</p>
    <div class="dialog-actions">
      <button id="btn-ai-guided-close" class="toolbar-btn primary" type="button">Got it</button>
    </div>
  </dialog>

  <!-- AI Setup instructions dialog (shown when provider is none) -->
  <dialog id="dlg-ai-setup" aria-labelledby="dlg-ai-setup-title" aria-modal="true" style="max-width:580px;">
    <h2 class="dialog-title" id="dlg-ai-setup-title">Configure AI Assistance</h2>
    <p class="dialog-body">AI assistance is off by default. To enable, start Studio with provider flags:</p>
    <pre class="generation-result" style="font-size:11px;white-space:pre-wrap;">  # Ollama (local, free to run):
  intentlang studio app.intent \\
    --ai-provider ollama \\
    --ai-model llama3.2

  # LM Studio / OpenAI-compatible (local):
  intentlang studio app.intent \\
    --ai-provider openai-compatible \\
    --ai-model &lt;model-name&gt; \\
    --ai-endpoint http://127.0.0.1:1234

  # OpenAI-compatible cloud (requires HTTPS + --allow-remote-ai):
  # Set env INTENTLANG_AI_API_KEY before starting Studio.
  intentlang studio app.intent \\
    --ai-provider openai-compatible \\
    --ai-model &lt;model-name&gt; \\
    --ai-endpoint https://&lt;your-gateway&gt; \\
    --allow-remote-ai

  # Google Gemini (direct REST API, requires --allow-remote-ai):
  # Set env INTENTLANG_AI_API_KEY before starting Studio.
  intentlang studio app.intent \\
    --ai-provider gemini \\
    --ai-model &lt;your-gemini-model&gt; \\
    --allow-remote-ai</pre>
    <p class="dialog-body" style="font-size:11px;color:var(--cp-text-muted);">AI output is untrusted text and cannot write files, execute commands, or override compiler errors. The compiler and generated app remain AI-free.</p>
    <div class="dialog-actions">
      <button id="btn-ai-setup-close" class="toolbar-btn primary" type="button">Close</button>
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
