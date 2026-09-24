import type {
  PermissionOperation,
  ProgramIr
} from "../model.js";

export interface AuthorizationSubject {
  identityId: string;
  roleId: string;
}

export interface AuthorizationRecord {
  id: string;
  [field: string]: unknown;
}

export interface AuthorizationDecision {
  allowed: boolean;
  forceOwner: boolean;
  permissionIds: string[];
}

export function authorizeOperation(
  ir: ProgramIr,
  subject: AuthorizationSubject | undefined,
  operation: PermissionOperation,
  entityId: string,
  actionId?: string,
  record?: AuthorizationRecord
): AuthorizationDecision {
  if (!ir.authentication) {
    return { allowed: true, forceOwner: false, permissionIds: [] };
  }
  if (!subject) {
    return { allowed: false, forceOwner: false, permissionIds: [] };
  }

  const candidates = ir.permissions.filter(
    (permission) =>
      permission.roleId === subject.roleId &&
      permission.operation === operation &&
      permission.entityId === entityId &&
      (operation !== "run" || permission.actionId === actionId)
  );
  const forceOwner = candidates.some(
    (permission) => permission.scope?.kind === "force-owner"
  );

  for (const permission of candidates) {
    if (!permission.scope || permission.scope.kind === "force-owner") {
      return {
        allowed: true,
        forceOwner,
        permissionIds: candidates.map(({ id }) => id)
      };
    }
    if (
      permission.scope.kind === "self" &&
      record?.id === subject.identityId
    ) {
      return {
        allowed: true,
        forceOwner,
        permissionIds: candidates.map(({ id }) => id)
      };
    }
    if (permission.scope.kind === "owner") {
      const scope = permission.scope;
      const relationship = ir.relationships.find(
        ({ id }) => id === scope.relationshipId
      );
      if (
        relationship &&
        record?.[`${relationship.name}_id`] === subject.identityId
      ) {
        return {
          allowed: true,
          forceOwner,
          permissionIds: candidates.map(({ id }) => id)
        };
      }
    }
  }

  return {
    allowed: false,
    forceOwner: false,
    permissionIds: candidates.map(({ id }) => id)
  };
}
