import type {
  ActionIr,
  AssignmentIr,
  EntityIr,
  FieldIr,
  PermissionIr,
  PreconditionIr,
  ProgramIr,
  RelationshipIr,
  RoleIr
} from "./model.js";

export function formatSource(ir: ProgramIr): string {
  const lines: string[] = [];

  lines.push(`application ${ir.application.name} with id ${ir.application.id}`);

  if (ir.authentication) {
    const identityEntity = ir.entities.find((entity) => entity.id === ir.authentication?.identityEntityId);
    const identityField = identityEntity?.fields.find((field) => field.id === ir.authentication?.identityFieldId);
    if (identityEntity && identityField) {
      lines.push("");
      lines.push(`authentication uses ${identityEntity.name} identified by ${identityField.name}`);
    }
  }

  if (ir.roles.length > 0) {
    lines.push("");
    for (const role of ir.roles) {
      lines.push(formatRole(role));
    }
  }

  for (const entity of ir.entities) {
    lines.push("");
    lines.push(`entity ${entity.name} with id ${entity.id}`);
    for (const field of entity.fields) {
      lines.push(`  ${formatField(field)}`);
    }
  }

  for (const rel of ir.relationships) {
    const fromEntity = ir.entities.find((entity) => entity.id === rel.fromEntityId);
    const toEntity = ir.entities.find((entity) => entity.id === rel.toEntityId);
    if (!fromEntity || !toEntity) {
      continue;
    }
    lines.push("");
    lines.push(formatRelationship(rel, fromEntity.name, toEntity.name));
  }

  for (const action of ir.actions) {
    const entity = ir.entities.find((e) => e.id === action.entityId);
    if (!entity) {
      continue;
    }
    lines.push("");
    lines.push(formatActionBlock(action, entity.name));
  }

  if (ir.permissions.length > 0) {
    lines.push("");
    for (const permission of ir.permissions) {
      lines.push(formatPermission(permission, ir.entities, ir.relationships, ir.actions, ir.roles));
    }
  }

  return lines.join("\n") + "\n";
}

function formatRole(role: RoleIr): string {
  return `role ${role.name} with id ${role.id}`;
}

function formatField(field: FieldIr): string {
  const parts = [field.name, "is"];
  if (field.required) {
    parts.push("required");
  }
  if (field.unique) {
    parts.push("unique");
  }
  parts.push(field.type, "with", "id", field.id);
  if (field.length !== undefined) {
    parts.push("length", "between", String(field.length.min), "and", String(field.length.max));
  }
  if (field.default !== undefined) {
    parts.push("default", formatDefaultValue(field));
  }
  return parts.join(" ");
}

function formatDefaultValue(field: FieldIr): string {
  if (field.type === "text") {
    return JSON.stringify(field.default);
  }
  return String(field.default);
}

function formatRelationship(
  rel: RelationshipIr,
  fromName: string,
  toName: string
): string {
  return `${fromName} belongs to ${toName} as ${rel.name} with id ${rel.id} on delete ${rel.onDelete}`;
}

function formatActionBlock(action: ActionIr, entityName: string): string {
  const header = `action ${action.name} a ${entityName} with id ${action.id}`;
  const bodyLines: string[] = action.preconditions.map(formatPrecondition);
  bodyLines.push(...action.assignments.map(formatAssignment));
  return [header, ...bodyLines].join("\n");
}

function formatPrecondition(pre: PreconditionIr): string {
  const valueStr = formatLiteralValue(pre.value);
  const message = JSON.stringify(pre.message);
  return `  require ${pre.fieldName} ${pre.operator} ${valueStr} otherwise ${message}`;
}

function formatAssignment(assign: AssignmentIr): string {
  return `  set ${assign.fieldName} to ${formatLiteralValue(assign.value)}`;
}

function formatLiteralValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatPermission(
  permission: PermissionIr,
  entities: EntityIr[],
  relationships: RelationshipIr[],
  actions: ActionIr[],
  roles: RoleIr[]
): string {
  const role = roles.find((candidate) => candidate.id === permission.roleId);
  const roleName = role?.name ?? permission.roleId;
  if (permission.operation === "provision") {
    return `allow ${roleName} to provision accounts`;
  }
  const entity = entities.find((candidate) => candidate.id === permission.entityId);
  const entityName = entity?.name ?? permission.entityId ?? "Unknown";

  if (permission.operation === "run") {
    const action = actions.find((candidate) => candidate.id === permission.actionId);
    const base = `allow ${roleName} to run ${action?.name ?? permission.actionId ?? "unknown"} on ${entityName}`;
    return withScope(base, permission, relationships);
  }

  if (permission.operation === "create" && permission.scope?.kind === "force-owner") {
    return `allow ${roleName} to create ${entityName} with owner as self`;
  }

  const base = `allow ${roleName} to ${permission.operation} ${entityName}`;
  return withScope(base, permission, relationships);
}

function withScope(base: string, permission: PermissionIr, relationships: RelationshipIr[]): string {
  const scope = permission.scope;
  if (!scope) {
    return base;
  }
  if (scope.kind === "self") {
    return `${base} where self`;
  }
  if (scope.kind === "owner") {
    return `${base} where owner is self`;
  }
  return `${base} with owner as self`;
}
