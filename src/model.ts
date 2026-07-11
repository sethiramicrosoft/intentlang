export const fieldTypes = ["text", "integer", "boolean"] as const;

export type FieldType = (typeof fieldTypes)[number];
export type FieldDefault = string | number | boolean;
export type OnDelete = "restrict" | "cascade" | "set null";

export const preconditionOperators = [
  "is",
  "is not",
  "is greater than",
  "is at least",
  "is less than",
  "is at most"
] as const;

export type PreconditionOperator = (typeof preconditionOperators)[number];

export interface LengthConstraint {
  min: number;
  max: number;
}

export interface FieldIr {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  default?: FieldDefault;
  length?: LengthConstraint;
}

export interface RelationshipIr {
  id: string;
  name: string;
  fromEntityId: string;
  toEntityId: string;
  onDelete: OnDelete;
}

export interface EntityIr {
  id: string;
  name: string;
  fields: FieldIr[];
}

export interface PreconditionIr {
  fieldName: string;
  operator: PreconditionOperator;
  value: FieldDefault;
  message: string;
}

export interface AssignmentIr {
  fieldName: string;
  value: FieldDefault;
}

export interface ActionIr {
  id: string;
  name: string;
  entityId: string;
  preconditions: PreconditionIr[];
  assignments: AssignmentIr[];
}

export interface AuthenticationIr {
  identityEntityId: string;
  identityFieldId: string;
}

export interface RoleIr {
  id: string;
  name: string;
}

export const permissionOperations = [
  "create",
  "read",
  "update",
  "run",
  "provision"
] as const;

export type PermissionOperation = (typeof permissionOperations)[number];

export type OwnershipScope =
  | { kind: "self" }
  | { kind: "owner"; relationshipId: string }
  | { kind: "force-owner" };

export interface PermissionIr {
  id: string;
  roleId: string;
  operation: PermissionOperation;
  entityId: string;
  actionId?: string;
  scope?: OwnershipScope;
}

export interface ProgramIr {
  schemaVersion: "0.5.0";
  application: {
    id: string;
    name: string;
  };
  authentication?: AuthenticationIr;
  roles: RoleIr[];
  permissions: PermissionIr[];
  entities: EntityIr[];
  relationships: RelationshipIr[];
  actions: ActionIr[];
}

export interface Diagnostic {
  code: string;
  message: string;
  line: number;
  column: number;
  length: number;
  hint: string;
}

export type CompileResult =
  | {
      ok: true;
      ir: ProgramIr;
      output: string;
    }
  | {
      ok: false;
      diagnostics: Diagnostic[];
    };

export interface BuildManifest {
  compilerVersion: string;
  schemaVersion: string;
  ir: ProgramIr;
  irFingerprint: string;
}
