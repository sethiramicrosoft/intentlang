import { entityTableName, generateSchema } from "../generator.js";
import { buildManifest } from "../manifest.js";
import type { ProgramIr } from "../model.js";
import { generateRuntime } from "../runtime-codegen.js";
import { generateUi } from "../ui-codegen.js";

export interface BackendParityResult {
  valid: boolean;
  failures: Array<{
    backend: "database" | "runtime" | "ui";
    nodeId: string;
    message: string;
  }>;
}

export function validateBackendParity(
  ir: ProgramIr,
  supplied: { schema?: string; runtime?: string; ui?: string } = {}
): BackendParityResult {
  const generatedUi = generateUi(ir);
  const schema = supplied.schema ?? generateSchema(ir).migrationSql;
  const runtime =
    supplied.runtime ??
    generateRuntime(ir, buildManifest(ir), generatedUi).appMjs;
  const uiText =
    supplied.ui ?? `${generatedUi.indexHtml}\n${generatedUi.appJs}`;
  const failures: BackendParityResult["failures"] = [];
  for (const entity of ir.entities) {
    const table = `"${entityTableName(entity.name)}"`;
    if (!schema.includes(table)) {
      failures.push({
        backend: "database",
        nodeId: entity.id,
        message: `Database output omits entity ${entity.name}.`
      });
    }
    if (!runtime.includes(entity.id)) {
      failures.push({
        backend: "runtime",
        nodeId: entity.id,
        message: `Runtime output omits entity ${entity.name}.`
      });
    }
    if (!uiText.includes(entity.id)) {
      failures.push({
        backend: "ui",
        nodeId: entity.id,
        message: `UI output omits entity ${entity.name}.`
      });
    }
    for (const field of entity.fields) {
      if (!schema.includes(`"${field.name}"`)) {
        failures.push({
          backend: "database",
          nodeId: field.id,
          message: `Database output omits field ${entity.name}.${field.name}.`
        });
      }
      if (!runtime.includes(field.id)) {
        failures.push({
          backend: "runtime",
          nodeId: field.id,
          message: `Runtime output omits field ${entity.name}.${field.name}.`
        });
      }
      if (!uiText.includes(field.id)) {
        failures.push({
          backend: "ui",
          nodeId: field.id,
          message: `UI output omits field ${entity.name}.${field.name}.`
        });
      }
    }
  }
  for (const action of ir.actions) {
    if (!runtime.includes(action.id)) {
      failures.push({
        backend: "runtime",
        nodeId: action.id,
        message: `Runtime output omits action ${action.name}.`
      });
    }
    if (!uiText.includes(action.id)) {
      failures.push({
        backend: "ui",
        nodeId: action.id,
        message: `UI output omits action ${action.name}.`
      });
    }
  }
  for (const permission of ir.permissions) {
    if (!runtime.includes(permission.id)) {
      failures.push({
        backend: "runtime",
        nodeId: permission.id,
        message: `Runtime output omits permission ${permission.id}.`
      });
    }
  }
  for (const role of ir.roles) {
    if (!runtime.includes(role.id)) {
      failures.push({
        backend: "runtime",
        nodeId: role.id,
        message: `Runtime output omits role ${role.name}.`
      });
    }
    if (!uiText.includes(role.id)) {
      failures.push({
        backend: "ui",
        nodeId: role.id,
        message: `UI output omits role ${role.name}.`
      });
    }
  }
  return { valid: failures.length === 0, failures };
}
