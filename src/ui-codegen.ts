import { createHash } from "node:crypto";
import type { ProgramIr } from "./model.js";
import { entityTableName } from "./generator.js";

export interface GeneratedUi {
  indexHtml: string;
  appJs: string;
  stylesCss: string;
}

const SCOUT_THEME_SCRIPT = `
  (() => {
    const param = new URLSearchParams(window.location.search).get("scoutTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();`.trim();

const THEME_SCRIPT =
  "(function(){var t=localStorage.getItem('theme');if(t==='dark'&&!new URLSearchParams(window.location.search).get('scoutTheme')){document.documentElement.setAttribute('data-theme','dark');}})();";

const STYLES = `
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
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif; background: var(--cp-bg); color: var(--cp-text); }
button, input, select { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .65; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid var(--cp-accent); outline-offset: 2px; }
.page { max-width: 1080px; margin: 0 auto; padding: 16px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.app-header { justify-content: space-between; }
.identity { margin-left: auto; text-align: right; }
.card { background: var(--cp-surface); border: 1px solid var(--cp-border); border-radius: 16px; padding: 16px; margin-bottom: 12px; box-shadow: 0 0 2px var(--cp-border), 0 1px 2px var(--cp-border); }
.btn, .btn-secondary { border-radius: 0.625rem; padding: 8px 12px; min-height: 40px; }
.btn { background: var(--cp-accent); border: 1px solid var(--cp-accent); color: var(--cp-accent-fg); }
.btn:hover:not(:disabled) { background: var(--cp-accent-hover); }
.btn-secondary { background: var(--cp-surface); border: 1px solid var(--cp-border-strong); color: var(--cp-text); }
.btn-secondary:hover:not(:disabled) { background: var(--cp-surface-soft); }
.muted { color: var(--cp-text-muted); }
.hidden { display: none !important; }
.error, [role="alert"] { color: var(--cp-danger); }
.success { color: var(--cp-success); }
.status { min-height: 24px; margin-top: 8px; }
#entity-nav button[aria-current="page"] { font-weight: 600; border-color: var(--cp-accent); }
.table-wrap { overflow-x: auto; width: 100%; }
table { width: 100%; border-collapse: collapse; min-width: 520px; }
th, td { border-bottom: 1px solid var(--cp-border); padding: 10px 8px; text-align: left; vertical-align: middle; }
th { color: var(--cp-text-muted); font-weight: 600; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.empty-state { padding: 24px 8px; color: var(--cp-text-muted); }
form.auth-login-form, .dialog-form, .provision-form { display: grid; gap: 12px; }
form.auth-login-form { max-width: 360px; }
.provision-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.provision-form .form-actions { grid-column: 1 / -1; }
.field { display: grid; gap: 4px; }
.field input:not([type="checkbox"]), .field select, .provision-form input, .provision-form select { width: 100%; border: 1px solid var(--cp-border-strong); border-radius: 0.625rem; padding: 9px 10px; background: var(--cp-surface); color: var(--cp-text); min-height: 42px; }
.field-checkbox { display: flex; gap: 8px; align-items: center; }
.hint { color: var(--cp-text-muted); font-size: .875rem; }
dialog { width: min(560px, calc(100% - 32px)); max-height: calc(100% - 32px); overflow: auto; border: 1px solid var(--cp-border); border-radius: 16px; padding: 0; background: var(--cp-surface); color: var(--cp-text); box-shadow: var(--cp-shadow); }
dialog::backdrop { background: var(--cp-overlay); }
.dialog-body { padding: 20px; }
.dialog-body h2 { margin-top: 0; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.effects { margin: 12px 0; padding-left: 24px; }
@media (max-width: 640px) {
  .page { padding: 8px; }
  .app-header { align-items: flex-start; }
  .identity { width: 100%; margin-left: 0; text-align: left; }
  .provision-form { grid-template-columns: 1fr; }
  .provision-form .form-actions { grid-column: auto; }
  .actions { min-width: 140px; }
}
`;

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function uiSchema(ir: ProgramIr): unknown {
  return {
    name: ir.application.name,
    authEnabled: ir.authentication !== undefined,
    roles: ir.roles.map((role) => ({ id: role.id, name: role.name })),
    entities: ir.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      path: `/${entityTableName(entity.name)}`,
      fields: entity.fields.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required,
        unique: field.unique,
        ...(field.default === undefined ? {} : { default: field.default }),
        ...(field.length === undefined ? {} : { length: field.length })
      })),
      relationships: ir.relationships
        .filter((relationship) => relationship.fromEntityId === entity.id)
        .map((relationship) => {
          const target = ir.entities.find((candidate) => candidate.id === relationship.toEntityId);
          return {
            id: relationship.id,
            name: relationship.name,
            column: `${relationship.name}_id`,
            targetEntityId: relationship.toEntityId,
            targetName: target?.name ?? relationship.toEntityId,
            targetPath: target ? `/${entityTableName(target.name)}` : ""
          };
        }),
      forceOwnerRoleIds: ir.permissions
        .filter((permission) => permission.entityId === entity.id && permission.operation === "create" && permission.scope?.kind === "force-owner")
        .map((permission) => permission.roleId),
      actions: ir.actions
        .filter((action) => action.entityId === entity.id)
        .map((action) => ({
          id: action.id,
          name: action.name,
          effects: action.assignments.map((assignment) => `${assignment.fieldName} → ${String(assignment.value)}`),
          preconditionMessages: action.preconditions.map((precondition) => precondition.message)
        }))
    }))
  };
}

function buildAppJs(): string {
  return `
'use strict';
let csrfToken = '';
let me = null;
const schema = APP_SCHEMA;
let activeIndex = 0;
let currentRows = [];
let entityDialogState = null;
let actionDialogState = null;
let provisionKey = crypto.randomUUID();
let provisioning = false;
const byId = (id) => document.getElementById(id);
const appRoot = byId('app-root');
const loginCard = byId('auth-login-card');
const loginForm = byId('auth-login-form');
const loginEmail = byId('auth-login-email');
const loginPassword = byId('auth-login-password');
const loginError = byId('auth-login-error');
const identityLabel = byId('auth-identity');
const roleLabel = byId('auth-role');
const logoutBtn = byId('auth-logout');
const nav = byId('entity-nav');
const tableHost = byId('entity-table');
const createBtn = byId('entity-create');
const entityHeading = byId('entity-heading');
const pageStatus = byId('page-status');
const provisionCard = byId('provision-card');
const provisionForm = byId('provision-form');
const provisionEmail = byId('provision-email');
const provisionName = byId('provision-name');
const provisionPassword = byId('provision-password');
const provisionRole = byId('provision-role');
const provisionError = byId('provision-error');
const provisionSubmit = byId('provision-submit');
const entityDialog = byId('entity-dialog');
const entityDialogTitle = byId('entity-dialog-title');
const entityForm = byId('entity-form');
const entityFields = byId('entity-fields');
const entityError = byId('entity-error');
const entityCancel = byId('entity-cancel');
const entityReload = byId('entity-reload');
const entitySubmit = byId('entity-submit');
const actionDialog = byId('action-dialog');
const actionDialogTitle = byId('action-dialog-title');
const actionTarget = byId('action-target');
const actionEffects = byId('action-effects');
const actionError = byId('action-error');
const actionCancel = byId('action-cancel');
const actionReload = byId('action-reload');
const actionConfirm = byId('action-confirm');
const roleNameById = new Map((schema.roles || []).map((role) => [role.id, role.name]));

function setStatus(element, message, isError) {
  element.textContent = message || '';
  element.classList.toggle('error', Boolean(message && isError));
  element.classList.toggle('success', Boolean(message && !isError));
  element.setAttribute('role', message && isError ? 'alert' : 'status');
}
async function responseBody(response) {
  try { return await response.json(); }
  catch (error) { console.error('Invalid API response:', error instanceof Error ? error.message : String(error)); return {}; }
}
function friendlyError(status, body) {
  if (body && body.code === 'PRECONDITION_FAILED') return body.error || 'This action is not currently available.';
  if (body && body.code === 'UNIQUE_CONFLICT') return body.field ? 'That ' + body.field + ' is already in use.' : 'A unique value is already in use.';
  if (body && body.code === 'VERSION_CONFLICT') return 'This record changed since you opened it. Reload the current values before trying again.';
  if (body && body.code === 'VALIDATION_ERROR') return body.error || 'Please check the highlighted values.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'This record is unavailable. It may have changed or you may not have access.';
  return body && body.error ? body.error : 'The request could not be completed. Please try again.';
}
async function request(path, init) {
  const cfg = Object.assign({}, init || {});
  cfg.headers = Object.assign({}, cfg.headers || {});
  const method = String(cfg.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') cfg.headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(path, cfg);
  if (response.status === 401) {
    csrfToken = ''; me = null; currentRows = []; showLogin();
    throw new Error('Your session expired. Please sign in again.');
  }
  return response;
}
function hasPermission(operation, entityId, actionId) {
  if (!me || !Array.isArray(me.permissions)) return !schema.authEnabled;
  return me.permissions.some((permission) =>
    permission.operation === operation &&
    (entityId === undefined || permission.entityId === entityId) &&
    (actionId === undefined || permission.actionId === actionId));
}
function accessibleEntities() {
  return schema.entities.map((entity, index) => ({ entity, index }))
    .filter((item) => !schema.authEnabled || hasPermission('read', item.entity.id));
}
function showLogin() {
  appRoot.classList.add('hidden');
  loginCard.classList.toggle('hidden', !schema.authEnabled);
  identityLabel.textContent = '';
  roleLabel.textContent = '';
  if (entityDialog.open) entityDialog.close();
  if (actionDialog.open) actionDialog.close();
  loginEmail.focus();
}
function showApp() {
  loginCard.classList.add('hidden');
  appRoot.classList.remove('hidden');
}
function recordLabel(entity, row) {
  const labelField = entity.fields.find((field) => field.type === 'text');
  return labelField && row[labelField.name] ? String(row[labelField.name]) : String(row.id);
}
function displayValue(field, value) {
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  return value === null || value === undefined || value === '' ? '—' : String(value);
}
function activeEntity() { return schema.entities[activeIndex]; }
function renderNav() {
  nav.textContent = '';
  const available = accessibleEntities();
  if (!available.some((item) => item.index === activeIndex) && available.length) activeIndex = available[0].index;
  available.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = item.entity.name; button.className = 'btn-secondary';
    button.setAttribute('aria-current', item.index === activeIndex ? 'page' : 'false');
    button.addEventListener('click', () => { activeIndex = item.index; renderNav(); void loadEntity(); });
    nav.appendChild(button);
  });
}
async function loadMe() {
  if (!schema.authEnabled) {
    showApp(); renderNav(); await loadEntity(); return;
  }
  const response = await fetch('/auth/me');
  if (!response.ok) { showLogin(); return; }
  const body = await responseBody(response);
  csrfToken = body.csrf_token || ''; me = body;
  identityLabel.textContent = body.identity_name || body.identity_email || 'Signed in';
  roleLabel.textContent = roleNameById.get(body.role_id || '') || body.role_id || '';
  showApp(); buildProvisionRoles(); updateProvisionVisibility(); renderNav(); await loadEntity();
}
function updateProvisionVisibility() {
  provisionCard.classList.toggle('hidden', !schema.authEnabled || !hasPermission('provision', ''));
}
function buildProvisionRoles() {
  provisionRole.textContent = '';
  (schema.roles || []).forEach((role) => {
    const option = document.createElement('option'); option.value = role.id; option.textContent = role.name;
    provisionRole.appendChild(option);
  });
}
function renderTable(entity, rows) {
  tableHost.textContent = '';
  if (!rows.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No records yet.';
    tableHost.appendChild(empty); return;
  }
  const wrap = document.createElement('div'); wrap.className = 'table-wrap'; wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', entity.name + ' records');
  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  entity.fields.forEach((field) => {
    const heading = document.createElement('th'); heading.scope = 'col'; heading.textContent = field.name;
    headRow.appendChild(heading);
  });
  entity.relationships.forEach((relationship) => {
    const heading = document.createElement('th'); heading.scope = 'col'; heading.textContent = relationship.name;
    headRow.appendChild(heading);
  });
  const actionHeading = document.createElement('th'); actionHeading.scope = 'col'; actionHeading.textContent = 'Actions';
  headRow.appendChild(actionHeading);
  const thead = document.createElement('thead'); thead.appendChild(headRow); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    entity.fields.forEach((field) => {
      const cell = document.createElement('td'); cell.textContent = displayValue(field, row[field.name]); tr.appendChild(cell);
    });
    entity.relationships.forEach((relationship) => {
      const cell = document.createElement('td'); cell.textContent = row[relationship.column] ? String(row[relationship.column]) : '—'; tr.appendChild(cell);
    });
    const actionCell = document.createElement('td'); const actions = document.createElement('div'); actions.className = 'actions';
    if (!schema.authEnabled || hasPermission('update', entity.id)) {
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn-secondary'; edit.textContent = 'Edit';
      edit.setAttribute('aria-label', 'Edit ' + recordLabel(entity, row));
      edit.addEventListener('click', () => void openEntityDialog('edit', entity, row));
      actions.appendChild(edit);
    }
    entity.actions.forEach((action) => {
      if (schema.authEnabled && !hasPermission('run', entity.id, action.id)) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-secondary'; button.textContent = action.name;
      button.setAttribute('aria-label', action.name + ' ' + recordLabel(entity, row));
      button.addEventListener('click', () => openActionDialog(entity, row, action));
      actions.appendChild(button);
    });
    actionCell.appendChild(actions); tr.appendChild(actionCell); tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); tableHost.appendChild(wrap);
}
async function loadEntity() {
  const entity = activeEntity();
  if (!entity || (schema.authEnabled && !hasPermission('read', entity.id))) {
    tableHost.textContent = '';
    const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No accessible entities.';
    tableHost.appendChild(empty); createBtn.classList.add('hidden'); return;
  }
  entityHeading.textContent = entity.name;
  const canCreate = !schema.authEnabled || hasPermission('create', entity.id);
  createBtn.classList.toggle('hidden', !canCreate); createBtn.disabled = !canCreate;
  createBtn.textContent = 'New ' + entity.name;
  setStatus(pageStatus, 'Loading…', false);
  try {
    const response = await request(entity.path, { method: 'GET' });
    const body = await responseBody(response);
    if (!response.ok) { currentRows = []; renderTable(entity, currentRows); setStatus(pageStatus, friendlyError(response.status, body), true); return; }
    currentRows = Array.isArray(body.data) ? body.data : [];
    renderTable(entity, currentRows); setStatus(pageStatus, '', false);
  } catch (error) { setStatus(pageStatus, error instanceof Error ? error.message : 'Unable to load records.', true); }
}
function makeField(field, value) {
  const wrapper = document.createElement('div'); wrapper.className = field.type === 'boolean' ? 'field-checkbox' : 'field';
  const input = document.createElement('input'); input.name = field.name; input.id = 'field-' + field.id;
  if (field.type === 'boolean') {
    input.type = 'checkbox'; input.checked = Boolean(value);
  } else {
    input.type = field.type === 'integer' ? 'number' : 'text';
    if (value !== undefined && value !== null) input.value = String(value);
    if (field.length) { input.minLength = field.length.min; input.maxLength = field.length.max; }
    input.required = Boolean(field.required);
  }
  const label = document.createElement('label'); label.htmlFor = input.id;
  label.textContent = field.name + (field.required ? ' (required)' : '');
  if (field.type === 'boolean') { wrapper.appendChild(input); wrapper.appendChild(label); }
  else {
    wrapper.appendChild(label); wrapper.appendChild(input);
    if (field.length) {
      const hint = document.createElement('span'); hint.className = 'hint';
      hint.textContent = field.length.min + '–' + field.length.max + ' characters'; wrapper.appendChild(hint);
    }
  }
  return { wrapper, input };
}
async function makeRelationshipField(relationship, selectedValue) {
  const wrapper = document.createElement('div'); wrapper.className = 'field';
  const label = document.createElement('label'); const select = document.createElement('select');
  select.name = relationship.column; select.id = 'relationship-' + relationship.id; select.required = true;
  label.htmlFor = select.id; label.textContent = relationship.name + ' (required)';
  const loading = document.createElement('option'); loading.value = ''; loading.textContent = 'Loading ' + relationship.targetName + '…';
  select.appendChild(loading); select.disabled = true; wrapper.appendChild(label); wrapper.appendChild(select);
  try {
    const response = await request(relationship.targetPath, { method: 'GET' });
    const body = await responseBody(response); select.textContent = '';
    if (!response.ok) throw new Error(friendlyError(response.status, body));
    const targets = Array.isArray(body.data) ? body.data : [];
    const prompt = document.createElement('option'); prompt.value = ''; prompt.textContent = targets.length ? 'Select ' + relationship.targetName : 'No available ' + relationship.targetName + ' records';
    select.appendChild(prompt);
    const targetEntity = schema.entities.find((entity) => entity.id === relationship.targetEntityId);
    targets.forEach((target) => {
      const option = document.createElement('option'); option.value = target.id;
      option.textContent = targetEntity ? recordLabel(targetEntity, target) : String(target.id);
      option.selected = String(target.id) === String(selectedValue || ''); select.appendChild(option);
    });
    select.disabled = targets.length === 0;
    if (!targets.length) setStatus(entityError, 'No available ' + relationship.targetName + ' record can be selected.', true);
  } catch (error) {
    select.textContent = ''; const unavailable = document.createElement('option'); unavailable.textContent = 'Unavailable'; unavailable.value = '';
    select.appendChild(unavailable); select.disabled = true;
    setStatus(entityError, error instanceof Error ? error.message : 'Relationship options are unavailable.', true);
  }
  return { wrapper, select };
}
function isForcedOwner(entity) {
  return Boolean(schema.authEnabled && me && entity.forceOwnerRoleIds.includes(me.role_id));
}
async function openEntityDialog(mode, entity, row) {
  entityFields.textContent = ''; setStatus(entityError, '', false); entityReload.classList.add('hidden');
  const operationKey = mode === 'create' ? crypto.randomUUID() : '';
  entityDialogState = { mode, entity, row, operationKey, submitting: false, controls: new Map(), initial: new Map() };
  entityDialogTitle.textContent = mode === 'create' ? 'New ' + entity.name : 'Edit ' + recordLabel(entity, row);
  entitySubmit.textContent = mode === 'create' ? 'Create' : 'Save';
  entity.fields.forEach((field) => {
    const initialValue = mode === 'create' ? field.default : row[field.name];
    const built = makeField(field, initialValue);
    entityDialogState.controls.set(field.name, { input: built.input, field });
    entityDialogState.initial.set(field.name, field.type === 'boolean' ? Boolean(initialValue) : initialValue);
    entityFields.appendChild(built.wrapper);
  });
  const relationships = entity.relationships.filter((relationship) => mode === 'create' ? !(relationship.name === 'owner' && isForcedOwner(entity)) : relationship.name !== 'owner');
  for (const relationship of relationships) {
    const built = await makeRelationshipField(relationship, row ? row[relationship.column] : undefined);
    entityDialogState.controls.set(relationship.column, { input: built.select, relationship });
    entityDialogState.initial.set(relationship.column, row ? row[relationship.column] : undefined);
    entityFields.appendChild(built.wrapper);
  }
  entityDialog.showModal();
  const first = entityFields.querySelector('input:not([type="checkbox"]), input[type="checkbox"], select');
  if (first) first.focus();
}
function controlValue(control) {
  if (control.field && control.field.type === 'boolean') return control.input.checked;
  if (control.field && control.field.type === 'integer') return control.input.value === '' ? null : Number(control.input.value);
  return control.input.value;
}
async function submitEntity(event) {
  event.preventDefault();
  const state = entityDialogState;
  if (!state || state.submitting || !entityForm.reportValidity()) return;
  state.submitting = true; entitySubmit.disabled = true; entityCancel.disabled = true;
  entitySubmit.textContent = state.mode === 'create' ? 'Creating…' : 'Saving…';
  setStatus(entityError, '', false); entityReload.classList.add('hidden');
  const payload = {};
  state.controls.forEach((control, name) => {
    const value = controlValue(control);
    if (state.mode === 'create' || value !== state.initial.get(name)) payload[name] = value;
  });
  if (state.mode === 'edit') payload.expectedVersion = Number(state.row.version);
  const init = { method: state.mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  if (state.mode === 'create') init.headers['Idempotency-Key'] = state.operationKey;
  const path = state.mode === 'create' ? state.entity.path : state.entity.path + '/' + encodeURIComponent(state.row.id);
  try {
    const response = await request(path, init); const body = await responseBody(response);
    if (!response.ok) {
      setStatus(entityError, friendlyError(response.status, body), true);
      if (body.code === 'UNIQUE_CONFLICT' && body.field) {
        const control = state.controls.get(body.field); if (control) { control.input.setAttribute('aria-invalid', 'true'); control.input.focus(); }
      }
      if (body.code === 'VERSION_CONFLICT') entityReload.classList.remove('hidden');
      return;
    }
    entityDialog.close(); entityDialogState = null; await loadEntity();
  } catch (error) { setStatus(entityError, error instanceof Error ? error.message : 'Unable to save.', true); }
  finally {
    if (entityDialogState === state) {
      state.submitting = false; entitySubmit.disabled = false; entityCancel.disabled = false;
      entitySubmit.textContent = state.mode === 'create' ? 'Create' : 'Save';
    }
  }
}
function closeEntityDialog() {
  if (entityDialogState && entityDialogState.submitting) return;
  entityDialog.close(); entityDialogState = null; createBtn.focus();
}
async function reloadEntityConflict() {
  if (!entityDialogState) return;
  const state = entityDialogState; closeEntityDialog(); await loadEntity();
  const current = currentRows.find((row) => String(row.id) === String(state.row.id));
  if (current) await openEntityDialog('edit', state.entity, current);
  else setStatus(pageStatus, 'This record is no longer available.', true);
}
function openActionDialog(entity, row, action) {
  actionDialogState = { entity, row, action, operationKey: crypto.randomUUID(), submitting: false };
  actionDialogTitle.textContent = 'Confirm ' + action.name;
  actionTarget.textContent = action.name + ' “' + recordLabel(entity, row) + '”?';
  actionEffects.textContent = '';
  action.effects.forEach((effect) => { const item = document.createElement('li'); item.textContent = effect; actionEffects.appendChild(item); });
  setStatus(actionError, '', false); actionReload.classList.add('hidden'); actionConfirm.disabled = false; actionConfirm.textContent = 'Confirm';
  actionDialog.showModal(); actionConfirm.focus();
}
async function confirmAction() {
  const state = actionDialogState;
  if (!state || state.submitting) return;
  state.submitting = true; actionConfirm.disabled = true; actionCancel.disabled = true; actionConfirm.textContent = 'Completing…';
  setStatus(actionError, '', false); actionReload.classList.add('hidden');
  try {
    const response = await request(state.entity.path + '/' + encodeURIComponent(state.row.id) + '/actions/' + encodeURIComponent(state.action.name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': state.operationKey },
      body: JSON.stringify({ expectedVersion: Number(state.row.version) })
    });
    const body = await responseBody(response);
    if (!response.ok) {
      setStatus(actionError, friendlyError(response.status, body), true);
      if (body.code === 'VERSION_CONFLICT') actionReload.classList.remove('hidden');
      return;
    }
    actionDialog.close(); actionDialogState = null; await loadEntity();
  } catch (error) { setStatus(actionError, error instanceof Error ? error.message : 'Unable to complete the action.', true); }
  finally {
    if (actionDialogState === state) { state.submitting = false; actionConfirm.disabled = false; actionCancel.disabled = false; actionConfirm.textContent = 'Confirm'; }
  }
}
function closeActionDialog() {
  if (actionDialogState && actionDialogState.submitting) return;
  actionDialog.close(); actionDialogState = null;
}
async function reloadActionConflict() {
  closeActionDialog(); await loadEntity(); setStatus(pageStatus, 'Current state loaded.', false);
}
if (loginForm) loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); setStatus(loginError, '', false);
  const submit = byId('auth-login-submit'); submit.disabled = true; submit.textContent = 'Signing in…';
  try {
    const response = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value }) });
    const body = await responseBody(response);
    if (!response.ok) { setStatus(loginError, response.status === 401 ? 'Email or password is incorrect.' : friendlyError(response.status, body), true); return; }
    csrfToken = body.csrf_token || ''; loginPassword.value = ''; await loadMe();
  } catch (error) { setStatus(loginError, error instanceof Error ? error.message : 'Unable to sign in.', true); }
  finally { submit.disabled = false; submit.textContent = 'Sign in'; }
});
logoutBtn.addEventListener('click', async () => {
  try { await request('/auth/logout', { method: 'POST' }); }
  catch (error) { console.error('Logout error:', error instanceof Error ? error.message : String(error)); }
  csrfToken = ''; me = null; currentRows = []; tableHost.textContent = ''; showLogin();
});
createBtn.addEventListener('click', () => { const entity = activeEntity(); if (entity) void openEntityDialog('create', entity, null); });
entityForm.addEventListener('submit', (event) => void submitEntity(event));
entityCancel.addEventListener('click', closeEntityDialog);
entityReload.addEventListener('click', () => void reloadEntityConflict());
entityDialog.addEventListener('cancel', (event) => { if (entityDialogState && entityDialogState.submitting) event.preventDefault(); else { event.preventDefault(); closeEntityDialog(); } });
actionConfirm.addEventListener('click', () => void confirmAction());
actionCancel.addEventListener('click', closeActionDialog);
actionReload.addEventListener('click', () => void reloadActionConflict());
actionDialog.addEventListener('cancel', (event) => { if (actionDialogState && actionDialogState.submitting) event.preventDefault(); else { event.preventDefault(); closeActionDialog(); } });
provisionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (provisioning || !provisionForm.reportValidity()) return;
  provisioning = true; provisionSubmit.disabled = true; provisionSubmit.textContent = 'Provisioning…'; setStatus(provisionError, '', false);
  const key = provisionKey;
  try {
    const response = await request('/auth/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ email: provisionEmail.value, name: provisionName.value, password: provisionPassword.value, role_id: provisionRole.value, idempotency_key: key })
    });
    const body = await responseBody(response);
    if (!response.ok) { setStatus(provisionError, friendlyError(response.status, body), true); return; }
    provisionEmail.value = ''; provisionName.value = ''; provisionPassword.value = ''; provisionKey = crypto.randomUUID();
    setStatus(provisionError, 'Account provisioned.', false);
  } catch (error) { setStatus(provisionError, error instanceof Error ? error.message : 'Unable to provision the account.', true); }
  finally { provisioning = false; provisionSubmit.disabled = false; provisionSubmit.textContent = 'Provision'; }
});
updateProvisionVisibility();
void loadMe();
`;
}

function cspHash(value: string): string {
  return `sha256-${createHash("sha256").update(value, "utf8").digest("base64")}`;
}

export function generateUi(ir: ProgramIr): GeneratedUi {
  const schemaJson = safeJson(uiSchema(ir));
  const appJs = buildAppJs();
  const stylesCss = STYLES.trim() + "\n";
  const title = escapeHtml(ir.application.name);
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script>${SCOUT_THEME_SCRIPT}</script>
<script>${THEME_SCRIPT}</script>
<link rel="stylesheet" href="/styles.css">
<script nonce="__INTENTLANG_NONCE__">window.__INTENTLANG_SCRIPT_HASHES__=${safeJson({ scout: cspHash(SCOUT_THEME_SCRIPT), theme: cspHash(THEME_SCRIPT) })};window.APP_SCHEMA=${schemaJson};</script>
</head>
<body>
<div class="page">
  <header class="card row app-header">
    <h1>${title}</h1>
    <div class="identity">
      <div id="auth-identity"></div>
      <div class="muted" id="auth-role"></div>
    </div>
    <button id="auth-logout" class="btn-secondary" type="button">Log out</button>
  </header>
  <section id="auth-login-card" class="card ${ir.authentication ? "" : "hidden"}">
    <h2>Sign in</h2>
    <form id="auth-login-form" class="auth-login-form">
      <div class="field"><label for="auth-login-email">Email</label><input id="auth-login-email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="auth-login-password">Password</label><input id="auth-login-password" type="password" autocomplete="current-password" required></div>
      <button id="auth-login-submit" class="btn" type="submit">Sign in</button>
      <div id="auth-login-error" class="status" aria-live="assertive"></div>
    </form>
  </section>
  <main id="app-root" class="${ir.authentication ? "hidden" : ""}">
    <section id="provision-card" class="card hidden" aria-labelledby="provision-heading">
      <h2 id="provision-heading">Provision account</h2>
      <form id="provision-form" class="provision-form">
        <div class="field"><label for="provision-name">Name</label><input id="provision-name" autocomplete="off" required></div>
        <div class="field"><label for="provision-email">Email</label><input id="provision-email" type="email" autocomplete="off" required></div>
        <div class="field"><label for="provision-password">Temporary password</label><input id="provision-password" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="field"><label for="provision-role">Role</label><select id="provision-role" required></select></div>
        <div class="form-actions"><button id="provision-submit" class="btn" type="submit">Provision</button></div>
      </form>
      <div id="provision-error" class="status" aria-live="polite"></div>
    </section>
    <section class="card" aria-labelledby="entity-heading">
      <nav id="entity-nav" class="row" aria-label="Entities"></nav>
      <div class="row">
        <h2 id="entity-heading">Records</h2>
        <button id="entity-create" class="btn" type="button">New record</button>
      </div>
      <div id="page-status" class="status" aria-live="polite"></div>
      <div id="entity-table"></div>
    </section>
  </main>
</div>
<dialog id="entity-dialog" aria-labelledby="entity-dialog-title">
  <div class="dialog-body">
    <h2 id="entity-dialog-title">Record</h2>
    <form id="entity-form" class="dialog-form">
      <div id="entity-fields"></div>
      <div id="entity-error" class="status" aria-live="assertive"></div>
      <div class="dialog-actions">
        <button id="entity-reload" class="btn-secondary hidden" type="button">Reload</button>
        <button id="entity-cancel" class="btn-secondary" type="button">Cancel</button>
        <button id="entity-submit" class="btn" type="submit">Save</button>
      </div>
    </form>
  </div>
</dialog>
<dialog id="action-dialog" aria-labelledby="action-dialog-title" aria-describedby="action-target">
  <div class="dialog-body">
    <h2 id="action-dialog-title">Confirm action</h2>
    <p id="action-target"></p>
    <p>Declared effects:</p>
    <ul id="action-effects" class="effects"></ul>
    <div id="action-error" class="status" aria-live="assertive"></div>
    <div class="dialog-actions">
      <button id="action-reload" class="btn-secondary hidden" type="button">Reload</button>
      <button id="action-cancel" class="btn-secondary" type="button">Cancel</button>
      <button id="action-confirm" class="btn" type="button">Confirm</button>
    </div>
  </div>
</dialog>
<script src="/app.js"></script>
</body>
</html>
`;
  return { indexHtml, appJs, stylesCss };
}

export { SCOUT_THEME_SCRIPT, THEME_SCRIPT };
