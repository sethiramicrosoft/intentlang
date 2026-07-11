import type { BuildManifest, EntityIr, FieldIr, ProgramIr, RelationshipIr, ActionIr } from "./model.js";
import { entityTableName, generateAddColumnClause } from "./generator.js";

export type PlanItemKind =
  | "entity-added"
  | "entity-removed"
  | "entity-renamed"
  | "field-added"
  | "field-removed"
  | "field-renamed"
  | "field-type-changed"
  | "field-required-changed"
  | "field-length-changed"
  | "field-unique-added"
  | "field-unique-removed"
  | "relationship-added"
  | "relationship-removed"
  | "relationship-renamed"
  | "relationship-target-changed"
  | "relationship-on-delete-changed"
  | "action-added"
  | "action-removed"
  | "action-changed"
  | "authentication-added"
  | "authentication-removed"
  | "authentication-changed"
  | "role-added"
  | "role-removed"
  | "permission-added"
  | "permission-removed"
  | "permission-changed";

export interface PlanItem {
  kind: PlanItemKind;
  stableId: string;
  description: string;
  destructive: boolean;
  migrationSql?: string;
  migrationNote?: string;
}

export interface SchemaPlan {
  items: PlanItem[];
  isDestructive: boolean;
  isSecurityDestructive: boolean;
  hasChanges: boolean;
}

export function planMigration(
  previous: BuildManifest,
  current: ProgramIr
): SchemaPlan {
  const items: PlanItem[] = [];
  const prevIr = previous.ir;

  const prevEntities = new Map<string, EntityIr>(prevIr.entities.map((entity) => [entity.id, entity]));
  const currEntities = new Map<string, EntityIr>(current.entities.map((entity) => [entity.id, entity]));
  const prevRels = new Map<string, RelationshipIr>(prevIr.relationships.map((relationship) => [relationship.id, relationship]));
  const currRels = new Map<string, RelationshipIr>(current.relationships.map((relationship) => [relationship.id, relationship]));

  for (const [id, currEntity] of currEntities) {
    const prevEntity = prevEntities.get(id);

    if (!prevEntity) {
      items.push({
        kind: "entity-added",
        stableId: id,
        description: `Entity "${currEntity.name}" (table "${entityTableName(currEntity.name)}") added.`,
        destructive: false
      });
      continue;
    }

    if (prevEntity.name !== currEntity.name) {
      const oldTable = entityTableName(prevEntity.name);
      const newTable = entityTableName(currEntity.name);
      items.push({
        kind: "entity-renamed",
        stableId: id,
        description: `Entity "${prevEntity.name}" renamed to "${currEntity.name}" (table "${oldTable}" → "${newTable}").`,
        destructive: false,
        migrationSql: `ALTER TABLE "${oldTable}" RENAME TO "${newTable}";`
      });
    }

    diffFields(items, prevEntity, currEntity);
  }

  for (const [id, prevEntity] of prevEntities) {
    if (!currEntities.has(id)) {
      const tableName = entityTableName(prevEntity.name);
      items.push({
        kind: "entity-removed",
        stableId: id,
        description: `Entity "${prevEntity.name}" (table "${tableName}") removed.`,
        destructive: true,
        migrationNote: `-- DESTRUCTIVE: DROP TABLE "${tableName}" is not auto-generated. Handle manually.`
      });
    }
  }

  for (const [id, currRel] of currRels) {
    const prevRel = prevRels.get(id);

    if (!prevRel) {
      const fromEntity = current.entities.find((entity) => entity.id === currRel.fromEntityId);
      const tableName = fromEntity ? entityTableName(fromEntity.name) : "?";
      items.push({
        kind: "relationship-added",
        stableId: id,
        description: `Relationship "${currRel.name}" (column "${currRel.name}_id") added to "${tableName}".`,
        destructive: false,
        migrationNote:
          `-- NOTE: Adding required FK column "${currRel.name}_id" to "${tableName}" cannot be done` +
          ` via ADD COLUMN (NOT NULL without default). Recreate the table if migrating existing data.`
      });
      continue;
    }

    if (prevRel.name !== currRel.name) {
      const fromEntity = current.entities.find((entity) => entity.id === currRel.fromEntityId);
      const tableName = fromEntity ? entityTableName(fromEntity.name) : "?";
      items.push({
        kind: "relationship-renamed",
        stableId: id,
        description: `Relationship "${prevRel.name}" renamed to "${currRel.name}".`,
        destructive: false,
        migrationSql: `ALTER TABLE "${tableName}" RENAME COLUMN "${prevRel.name}_id" TO "${currRel.name}_id";`
      });
    }

    if (prevRel.toEntityId !== currRel.toEntityId) {
      items.push({
        kind: "relationship-target-changed",
        stableId: id,
        description: `Relationship "${currRel.name}" target entity changed.`,
        destructive: true,
        migrationNote: `-- DESTRUCTIVE: FK target change for "${currRel.name}_id" requires manual migration.`
      });
    }

    if (prevRel.onDelete !== currRel.onDelete) {
      const fromEntity = current.entities.find((entity) => entity.id === currRel.fromEntityId);
      const tableName = fromEntity ? entityTableName(fromEntity.name) : "?";
      items.push({
        kind: "relationship-on-delete-changed",
        stableId: id,
        description: `Relationship "${currRel.name}" on-delete changed from "${prevRel.onDelete}" to "${currRel.onDelete}".`,
        destructive: true,
        migrationNote:
          `-- DESTRUCTIVE: ON DELETE change for FK "${currRel.name}_id" in "${tableName}" requires manual migration.`
      });
    }
  }

  for (const [id, prevRel] of prevRels) {
    if (!currRels.has(id)) {
      const fromEntity = prevIr.entities.find((entity) => entity.id === prevRel.fromEntityId);
      const tableName = fromEntity ? entityTableName(fromEntity.name) : "?";
      items.push({
        kind: "relationship-removed",
        stableId: id,
        description: `Relationship "${prevRel.name}" removed from "${tableName}".`,
        destructive: true,
        migrationNote:
          `-- DESTRUCTIVE: DROP FK column "${prevRel.name}_id" from "${tableName}" is not auto-generated.`
      });
    }
  }

  diffActions(items, prevIr, current);
  diffSecurity(items, prevIr, current);

  const isDestructive = items.some((item) => item.destructive);
  const isSecurityDestructive = items.some((item) =>
    item.kind === "authentication-removed" || item.kind === "authentication-changed"
  );
  return { items, isDestructive, isSecurityDestructive, hasChanges: items.length > 0 };
}

function diffActions(
  items: PlanItem[],
  prevIr: { actions?: ActionIr[] },
  current: ProgramIr
): void {
  const prevActions = new Map<string, ActionIr>(
    (prevIr.actions ?? []).map((a) => [a.id, a])
  );
  const currActions = new Map<string, ActionIr>(
    current.actions.map((a) => [a.id, a])
  );

  for (const [id, currAction] of currActions) {
    const prevAction = prevActions.get(id);
    if (!prevAction) {
      const entity = current.entities.find((e) => e.id === currAction.entityId);
      items.push({
        kind: "action-added",
        stableId: id,
        description: `Action "${currAction.name}" on "${entity?.name ?? currAction.entityId}" added. No schema change required.`,
        destructive: false,
        migrationNote:
          `-- REVIEW: New action endpoint POST /${entityTableName(entity?.name ?? currAction.entityId)}/:id/actions/${currAction.name} added.`
      });
      continue;
    }
    const prevJson = JSON.stringify(prevAction);
    const currJson = JSON.stringify(currAction);
    if (prevJson !== currJson) {
      const entity = current.entities.find((e) => e.id === currAction.entityId);
      items.push({
        kind: "action-changed",
        stableId: id,
        description: `Action "${currAction.name}" on "${entity?.name ?? currAction.entityId}" changed. No schema change required.`,
        destructive: false,
        migrationNote:
          `-- REVIEW: Action "${currAction.name}" logic changed. Verify runtime behavior.`
      });
    }
  }

  for (const [id, prevAction] of prevActions) {
    if (!currActions.has(id)) {
      const entity = prevIr.actions ? prevIr.actions.find((a) => a.id === id) : undefined;
      void entity;
      items.push({
        kind: "action-removed",
        stableId: id,
        description: `Action "${prevAction.name}" removed. No schema change required.`,
        destructive: false,
        migrationNote:
          `-- REVIEW: Action endpoint for "${prevAction.name}" removed.`
      });
    }
  }
}

function diffSecurity(items: PlanItem[], prevIr: ProgramIr, current: ProgramIr): void {
  const prevAuth = prevIr.authentication;
  const currAuth = current.authentication;
  if (!prevAuth && currAuth) {
      items.push({
        kind: "authentication-added",
        stableId: "authentication",
        description: "Authentication was enabled.",
        destructive: false,
        migrationNote: "-- REVIEW: Authentication enabled. Verify bootstrap credentials and role mappings."
    });
  } else if (prevAuth && !currAuth) {
      items.push({
        kind: "authentication-removed",
        stableId: "authentication",
        description: "Authentication was removed.",
        destructive: false,
        migrationNote: "-- REVIEW: Security downgrade detected: authentication removed."
    });
  } else if (prevAuth && currAuth && JSON.stringify(prevAuth) !== JSON.stringify(currAuth)) {
      items.push({
        kind: "authentication-changed",
        stableId: "authentication",
        description: "Authentication identity changed.",
        destructive: false,
        migrationNote: "-- REVIEW: Security-impacting authentication change detected."
    });
  }

  const prevRoles = new Map((prevIr.roles ?? []).map((role) => [role.id, role]));
  const currRoles = new Map((current.roles ?? []).map((role) => [role.id, role]));
  for (const [roleId, role] of currRoles) {
    if (!prevRoles.has(roleId)) {
      items.push({
        kind: "role-added",
        stableId: roleId,
        description: `Role "${role.name}" added.`,
        destructive: false,
        migrationNote: "-- REVIEW: New role added."
      });
    }
  }
  for (const [roleId, role] of prevRoles) {
    if (!currRoles.has(roleId)) {
      items.push({
        kind: "role-removed",
        stableId: roleId,
        description: `Role "${role.name}" removed.`,
        destructive: false,
        migrationNote: "-- REVIEW: Role removed. Confirm permission impact."
      });
    }
  }

  const prevPermissions = new Map((prevIr.permissions ?? []).map((permission) => [permission.id, permission]));
  const currPermissions = new Map((current.permissions ?? []).map((permission) => [permission.id, permission]));
  for (const [permissionId, permission] of currPermissions) {
    const prevPermission = prevPermissions.get(permissionId);
    if (!prevPermission) {
      items.push({
        kind: "permission-added",
        stableId: permissionId,
        description: `Permission "${permissionId}" added.`,
        destructive: false,
        migrationNote: "-- REVIEW: Permission added."
      });
      continue;
    }
    if (JSON.stringify(prevPermission) !== JSON.stringify(permission)) {
      items.push({
        kind: "permission-changed",
        stableId: permissionId,
        description: `Permission "${permissionId}" changed.`,
        destructive: false,
        migrationNote: "-- REVIEW: Permission changed."
      });
    }
  }
  for (const [permissionId] of prevPermissions) {
    if (!currPermissions.has(permissionId)) {
      items.push({
        kind: "permission-removed",
        stableId: permissionId,
        description: `Permission "${permissionId}" removed.`,
        destructive: false,
        migrationNote: "-- REVIEW: Permission removed."
      });
    }
  }
}

function diffFields(
  items: PlanItem[],
  prevEntity: EntityIr,
  currEntity: EntityIr
): void {
  const tableName = entityTableName(currEntity.name);
  const prevFields = new Map<string, FieldIr>(prevEntity.fields.map((field) => [field.id, field]));
  const currFields = new Map<string, FieldIr>(currEntity.fields.map((field) => [field.id, field]));

  for (const [fieldId, currField] of currFields) {
    const prevField = prevFields.get(fieldId);

    if (!prevField) {
      const requiredNoDefault = currField.required && currField.default === undefined;
      const destructive = requiredNoDefault || currField.unique;
      let migrationNote: string | undefined;
      if (requiredNoDefault) {
        migrationNote = `-- DESTRUCTIVE: Cannot add required field "${currField.name}" without a default to "${tableName}". Add a default or supply --allow-data-loss.`;
      } else if (currField.unique) {
        migrationNote = `-- DESTRUCTIVE: Cannot safely add unique field "${currField.name}" to "${tableName}" if rows exist. Handle manually.`;
      }
      items.push({
        kind: "field-added",
        stableId: fieldId,
        description: `Field "${currEntity.name}.${currField.name}" added.`,
        destructive,
        migrationSql: destructive
          ? undefined
          : `ALTER TABLE "${tableName}" ADD COLUMN ${generateAddColumnClause(currField)};`,
        migrationNote
      });
      continue;
    }

    if (prevField.name !== currField.name) {
      items.push({
        kind: "field-renamed",
        stableId: fieldId,
        description: `Field "${prevEntity.name}.${prevField.name}" renamed to "${currField.name}".`,
        destructive: false,
        migrationSql: `ALTER TABLE "${tableName}" RENAME COLUMN "${prevField.name}" TO "${currField.name}";`
      });
    }

    if (prevField.type !== currField.type) {
      items.push({
        kind: "field-type-changed",
        stableId: fieldId,
        description: `Field "${currEntity.name}.${currField.name}" type changed from "${prevField.type}" to "${currField.type}".`,
        destructive: true,
        migrationNote:
          `-- DESTRUCTIVE: Column type change on "${tableName}"."${currField.name}" from ${prevField.type} to ${currField.type} is not auto-generated. Handle manually.`
      });
    }

    if (!prevField.required && currField.required && currField.default === undefined) {
      items.push({
        kind: "field-required-changed",
        stableId: fieldId,
        description: `Field "${currEntity.name}.${currField.name}" changed to required without a default.`,
        destructive: true,
        migrationNote:
          `-- DESTRUCTIVE: Adding NOT NULL to "${tableName}"."${currField.name}" is not auto-generated. Add a default or handle manually.`
      });
    }

    const prevLengthKey = JSON.stringify(prevField.length ?? null);
    const currLengthKey = JSON.stringify(currField.length ?? null);
    if (prevLengthKey !== currLengthKey) {
      items.push({
        kind: "field-length-changed",
        stableId: fieldId,
        description: `Field "${currEntity.name}.${currField.name}" length constraint changed.`,
        destructive: false,
        migrationNote:
          `-- NOTE: CHECK constraint change on "${tableName}"."${currField.name}" cannot be applied via ALTER TABLE. Recreate the table manually if needed.`
      });
    }

    if (!prevField.unique && currField.unique) {
      items.push({
        kind: "field-unique-added",
        stableId: fieldId,
        description: `Field "${currEntity.name}.${currField.name}" unique constraint added.`,
        destructive: true,
        migrationNote: `-- DESTRUCTIVE: Adding UNIQUE to "${tableName}"."${currField.name}" requires verifying no duplicates exist. Handle manually.`
      });
    }

    if (prevField.unique && !currField.unique) {
      items.push({
        kind: "field-unique-removed",
        stableId: fieldId,
        description: `Field "${currEntity.name}.${currField.name}" unique constraint removed.`,
        destructive: false,
        migrationNote: `-- NOTE: Removing UNIQUE from "${tableName}"."${currField.name}" requires recreating the table in SQLite. Handle manually.`
      });
    }
  }

  for (const [fieldId, prevField] of prevFields) {
    if (!currFields.has(fieldId)) {
      items.push({
        kind: "field-removed",
        stableId: fieldId,
        description: `Field "${prevEntity.name}.${prevField.name}" removed.`,
        destructive: true,
        migrationNote:
          `-- DESTRUCTIVE: DROP COLUMN "${tableName}"."${prevField.name}" is not auto-generated. Handle manually.`
      });
    }
  }
}
