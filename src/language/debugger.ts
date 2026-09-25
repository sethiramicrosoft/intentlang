import type {
  ActionIr,
  FieldDefault,
  PermissionOperation,
  ProgramIr
} from "../model.js";

export interface WorkflowDebugResult {
  allowed: boolean;
  action: string;
  entity: string;
  checks: Array<{
    field: string;
    operator: string;
    expected: FieldDefault;
    actual: unknown;
    passed: boolean;
    message: string;
  }>;
  projectedRecord?: Record<string, unknown>;
}

export interface AuthorizationDebugResult {
  allowed: boolean;
  role: string;
  operation: PermissionOperation;
  entity: string;
  action?: string;
  reason: string;
  candidates: Array<{ permissionId: string; scope: string; passed: boolean }>;
}

function compare(actual: unknown, operator: string, expected: FieldDefault): boolean {
  if (operator === "is") return actual === expected;
  if (operator === "is not") return actual !== expected;
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  if (operator === "is greater than") return actual > expected;
  if (operator === "is at least") return actual >= expected;
  if (operator === "is less than") return actual < expected;
  return actual <= expected;
}

function findAction(ir: ProgramIr, entityName: string, actionName: string): ActionIr {
  const entity = ir.entities.find((candidate) => candidate.name === entityName);
  const action = ir.actions.find(
    (candidate) =>
      candidate.entityId === entity?.id && candidate.name === actionName
  );
  if (!entity || !action) throw new Error(`Unknown action ${entityName}.${actionName}.`);
  return action;
}

export function debugWorkflow(
  ir: ProgramIr,
  entityName: string,
  actionName: string,
  record: Record<string, unknown>
): WorkflowDebugResult {
  const action = findAction(ir, entityName, actionName);
  const checks = action.preconditions.map((precondition) => {
    const actual = record[precondition.fieldName];
    return {
      field: precondition.fieldName,
      operator: precondition.operator,
      expected: precondition.value,
      actual,
      passed: compare(actual, precondition.operator, precondition.value),
      message: precondition.message
    };
  });
  const allowed = checks.every((check) => check.passed);
  return {
    allowed,
    action: actionName,
    entity: entityName,
    checks,
    projectedRecord: allowed
      ? {
          ...record,
          ...Object.fromEntries(
            action.assignments.map((assignment) => [
              assignment.fieldName,
              assignment.value
            ])
          )
        }
      : undefined
  };
}

export function debugAuthorization(
  ir: ProgramIr,
  request: {
    role: string;
    operation: PermissionOperation;
    entity: string;
    action?: string;
    identityId?: string;
    record?: Record<string, unknown>;
  }
): AuthorizationDebugResult {
  if (!ir.authentication) {
    return { ...request, allowed: true, reason: "Authentication is disabled.", candidates: [] };
  }
  const role = ir.roles.find((candidate) => candidate.name === request.role);
  const entity = ir.entities.find((candidate) => candidate.name === request.entity);
  const action = request.action
    ? ir.actions.find(
        (candidate) =>
          candidate.entityId === entity?.id && candidate.name === request.action
      )
    : undefined;
  const permissions = ir.permissions.filter(
    (permission) =>
      permission.roleId === role?.id &&
      permission.entityId === entity?.id &&
      permission.operation === request.operation &&
      (request.action === undefined || permission.actionId === action?.id)
  );
  const candidates = permissions.map((permission) => {
    let passed = false;
    let scope = "all";
    if (!permission.scope) passed = true;
    else if (permission.scope.kind === "self") {
      scope = "self";
      passed =
        request.record !== undefined &&
        String(request.record.id ?? "") === request.identityId;
    } else if (permission.scope.kind === "owner") {
      scope = "owner";
      passed =
        request.record !== undefined &&
        String(request.record.owner_id ?? "") === request.identityId;
    } else {
      scope = "force-owner";
      passed =
        request.operation === "create" ||
        (request.record !== undefined &&
          String(request.record.owner_id ?? "") === request.identityId);
    }
    return { permissionId: permission.id, scope, passed };
  });
  const allowed = candidates.some((candidate) => candidate.passed);
  return {
    role: request.role,
    operation: request.operation,
    entity: request.entity,
    action: request.action,
    allowed,
    reason:
      permissions.length === 0
        ? "Default deny: no matching permission."
        : allowed
          ? "A matching permission and scope allow the request."
          : "Matching permissions exist, but ownership or identity scope failed.",
    candidates
  };
}

export function debugRequest(
  ir: ProgramIr,
  request: Parameters<typeof debugAuthorization>[1] & {
    record?: Record<string, unknown>;
  }
) {
  const authorization = debugAuthorization(ir, request);
  const workflow =
    authorization.allowed &&
    request.operation === "run" &&
    request.action &&
    request.record
      ? debugWorkflow(ir, request.entity, request.action, request.record)
      : undefined;
  return {
    allowed: authorization.allowed && (workflow?.allowed ?? true),
    authorization,
    workflow
  };
}
