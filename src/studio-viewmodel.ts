import type {
  ActionIr,
  EntityIr,
  PermissionIr,
  ProgramIr,
  RelationshipIr,
  RoleIr
} from "./model.js";

export interface StudioFieldView {
  id: string;
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  default?: string | number | boolean;
  lengthMin?: number;
  lengthMax?: number;
}

export interface StudioEntityView {
  id: string;
  name: string;
  fields: StudioFieldView[];
  isIdentityEntity: boolean;
}

export interface StudioRelationshipView {
  id: string;
  name: string;
  fromEntity: string;
  toEntity: string;
  onDelete: string;
  column: string;
}

export interface StudioPreconditionView {
  field: string;
  operator: string;
  value: string | number | boolean;
  message: string;
}

export interface StudioAssignmentView {
  field: string;
  value: string | number | boolean;
}

export interface StudioActionView {
  id: string;
  name: string;
  entity: string;
  preconditions: StudioPreconditionView[];
  assignments: StudioAssignmentView[];
}

export interface StudioRoleView {
  id: string;
  name: string;
}

export interface StudioPermissionEntry {
  role: string;
  operation: string;
  entity: string;
  action?: string;
  scope: string;
  note: string;
}

export interface StudioPermissionMatrixRow {
  entity: string;
  operations: {
    [role: string]: {
      [operation: string]: string;
    };
  };
}

export interface StudioSafetySummary {
  authenticationEnabled: boolean;
  uniqueFields: string[];
  idempotentActions: string[];
  optimisticConcurrency: boolean;
  safeDeleteAbsent: boolean;
  defaultDeny: boolean;
  note: string;
}

export interface StudioViewModel {
  applicationName: string;
  applicationId: string;
  authentication: {
    enabled: boolean;
    identityEntity?: string;
    identityField?: string;
  };
  entities: StudioEntityView[];
  relationships: StudioRelationshipView[];
  actions: StudioActionView[];
  roles: StudioRoleView[];
  permissions: StudioPermissionEntry[];
  permissionMatrix: StudioPermissionMatrixRow[];
  safety: StudioSafetySummary;
}

export function buildStudioViewModel(ir: ProgramIr): StudioViewModel {
  const entityById = new Map<string, EntityIr>(ir.entities.map((e) => [e.id, e]));
  const roleById = new Map<string, RoleIr>(ir.roles.map((r) => [r.id, r]));
  const actionById = new Map<string, ActionIr>(ir.actions.map((a) => [a.id, a]));
  const relById = new Map<string, RelationshipIr>(ir.relationships.map((rel) => [rel.id, rel]));

  const identityEntityId = ir.authentication?.identityEntityId;
  const identityFieldId = ir.authentication?.identityFieldId;

  const entities: StudioEntityView[] = ir.entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    isIdentityEntity: entity.id === identityEntityId,
    fields: entity.fields.map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      required: field.required,
      unique: field.unique,
      default: field.default,
      lengthMin: field.length?.min,
      lengthMax: field.length?.max
    }))
  }));

  const relationships: StudioRelationshipView[] = ir.relationships.map((rel) => ({
    id: rel.id,
    name: rel.name,
    fromEntity: entityById.get(rel.fromEntityId)?.name ?? rel.fromEntityId,
    toEntity: entityById.get(rel.toEntityId)?.name ?? rel.toEntityId,
    onDelete: rel.onDelete,
    column: `${rel.name}_id`
  }));

  const actions: StudioActionView[] = ir.actions.map((action) => ({
    id: action.id,
    name: action.name,
    entity: entityById.get(action.entityId)?.name ?? action.entityId,
    preconditions: action.preconditions.map((pre) => ({
      field: pre.fieldName,
      operator: pre.operator,
      value: pre.value,
      message: pre.message
    })),
    assignments: action.assignments.map((assign) => ({
      field: assign.fieldName,
      value: assign.value
    }))
  }));

  const roles: StudioRoleView[] = ir.roles.map((role) => ({
    id: role.id,
    name: role.name
  }));

  const permissions: StudioPermissionEntry[] = ir.permissions.map((perm) =>
    buildPermissionEntry(perm, entityById, roleById, actionById, relById)
  );

  const permissionMatrix = buildPermissionMatrix(ir, entityById, roleById, actionById);

  const uniqueFields: string[] = [];
  for (const entity of ir.entities) {
    for (const field of entity.fields) {
      if (field.unique) {
        uniqueFields.push(`${entity.name}.${field.name}`);
      }
    }
  }

  const idempotentActions = ir.actions
    .filter((action) => action.preconditions.length > 0)
    .map((action) => {
      const entity = entityById.get(action.entityId);
      return `${entity?.name ?? action.entityId}.${action.name}`;
    });

  const safeDeleteAbsent = ir.relationships.every((rel) => rel.onDelete !== "cascade");

  const safety: StudioSafetySummary = {
    authenticationEnabled: ir.authentication !== undefined,
    uniqueFields,
    idempotentActions,
    optimisticConcurrency: true,
    safeDeleteAbsent,
    defaultDeny: ir.authentication !== undefined,
    note: ir.authentication !== undefined
      ? "All access is denied by default. Permissions listed above are the only allowed operations."
      : "Authentication is disabled. All operations are permitted without authentication."
  };

  const authEntityName = identityEntityId
    ? entityById.get(identityEntityId)?.name
    : undefined;
  const authFieldName = identityEntityId && identityFieldId
    ? entityById.get(identityEntityId)?.fields.find((f) => f.id === identityFieldId)?.name
    : undefined;

  return {
    applicationName: ir.application.name,
    applicationId: ir.application.id,
    authentication: {
      enabled: ir.authentication !== undefined,
      identityEntity: authEntityName,
      identityField: authFieldName
    },
    entities,
    relationships,
    actions,
    roles,
    permissions,
    permissionMatrix,
    safety
  };
}

function buildPermissionEntry(
  perm: PermissionIr,
  entityById: Map<string, EntityIr>,
  roleById: Map<string, RoleIr>,
  actionById: Map<string, ActionIr>,
  _relById: Map<string, RelationshipIr>
): StudioPermissionEntry {
  const role = roleById.get(perm.roleId)?.name ?? perm.roleId;
  const entity = entityById.get(perm.entityId)?.name ?? perm.entityId;
  const action = perm.actionId ? actionById.get(perm.actionId)?.name : undefined;

  let scope = "all records";
  let note = "";

  if (perm.operation === "provision") {
    scope = "accounts";
    note = "Can create the first administrator account via bootstrap env vars.";
  } else if (perm.scope?.kind === "self") {
    scope = "own identity record only";
    note = `${role} can only access their own ${entity} row.`;
  } else if (perm.scope?.kind === "owner") {
    scope = "records where owner is self";
    note = `${role} can only access ${entity} records they own (owner_id = caller's id).`;
  } else if (perm.scope?.kind === "force-owner") {
    scope = "create with owner forced to self";
    note = `${role} creates ${entity} with owner_id automatically set to caller's id.`;
  } else {
    scope = "all records (unscoped)";
    note = `${role} has full ${perm.operation} access to all ${entity} records.`;
  }

  return {
    role,
    operation: perm.operation,
    entity,
    action,
    scope,
    note
  };
}

function buildPermissionMatrix(
  ir: ProgramIr,
  entityById: Map<string, EntityIr>,
  roleById: Map<string, RoleIr>,
  actionById: Map<string, ActionIr>
): StudioPermissionMatrixRow[] {
  const entityNames = ir.entities.map((e) => e.name);
  const roleNames = ir.roles.map((r) => r.name);

  const matrix: StudioPermissionMatrixRow[] = entityNames.map((entityName) => {
    const entity = ir.entities.find((e) => e.name === entityName)!;
    const operations: StudioPermissionMatrixRow["operations"] = {};

    for (const roleName of roleNames) {
      const role = ir.roles.find((r) => r.name === roleName)!;
      const rolePerms = ir.permissions.filter(
        (p) => p.roleId === role.id && p.entityId === entity.id
      );
      operations[roleName] = {};

      const ops = ["create", "read", "update", "run", "provision"] as const;
      for (const op of ops) {
        const matching = rolePerms.filter((p) => p.operation === op);
        if (matching.length === 0) {
          operations[roleName]![op] = "deny";
        } else {
          const scopes = matching.map((p) => {
            if (!p.scope) return "all";
            if (p.scope.kind === "self") return "self";
            if (p.scope.kind === "owner") return "owner";
            if (p.scope.kind === "force-owner") return "owner(forced)";
            return "?";
          });
          const actionNames = matching
            .filter((p) => p.actionId)
            .map((p) => actionById.get(p.actionId!)?.name ?? p.actionId!);
          const label = actionNames.length > 0
            ? `allow(${actionNames.join(",")}) [${scopes.join("/")}]`
            : `allow [${scopes.join("/")}]`;
          operations[roleName]![op] = label;
        }
      }
    }

    return { entity: entityName, operations };
  });

  // Add provision row if any permission uses it
  const hasProvision = ir.permissions.some((p) => p.operation === "provision");
  if (hasProvision) {
    const provOps: StudioPermissionMatrixRow["operations"] = {};
    for (const roleName of roleNames) {
      const role = ir.roles.find((r) => r.name === roleName)!;
      const hasProv = ir.permissions.some((p) => p.roleId === role.id && p.operation === "provision");
      provOps[roleName] = { provision: hasProv ? "allow" : "deny" };
    }
    matrix.push({ entity: "Accounts (provision)", operations: provOps });
  }

  return matrix;
}
