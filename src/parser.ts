import {
  fieldTypes,
  type ActionIr,
  type AuthenticationIr,
  type AssignmentIr,
  type Diagnostic,
  type EntityIr,
  type FieldDefault,
  type FieldIr,
  type FieldType,
  type LengthConstraint,
  type OnDelete,
  type PreconditionIr,
  type PreconditionOperator,
  type PermissionIr,
  type PermissionOperation,
  type ProgramIr,
  type RoleIr,
  type RelationshipIr
} from "./model.js";

// ── Canonical regexes (parent spec) ──────────────────────────────────────────

const applicationPattern =
  /^application ([A-Z][A-Za-z0-9]*) with id ([a-z][a-z0-9-]*)$/;

const entityPattern =
  /^entity ([A-Z][A-Za-z0-9]*) with id ([a-z][a-z0-9-]*)$/;

const relationshipPattern =
  /^([A-Z][A-Za-z0-9]*) belongs to ([A-Z][A-Za-z0-9]*) as ([a-z][A-Za-z0-9]*) with id ([a-z][a-z0-9-]*) on delete (restrict|cascade|set null)$/;

const naturalApplicationPattern =
  /^application ([A-Z][A-Za-z0-9]*)\s*$/;

const naturalFieldPattern =
  /^(a|an) ([A-Z][A-Za-z0-9]*) has (a|an) (required )?(unique )?([a-z][A-Za-z0-9]*) as (text|integer|boolean)(?: length between (\d+) and (\d+))?(?: default (.+))?$/;

const naturalRelationshipPattern =
  /^each ([A-Z][A-Za-z0-9]*) belongs to (a|an) ([A-Z][A-Za-z0-9]*) as ([a-z][A-Za-z0-9]*) on delete (restrict|cascade|set null)$/;

const authenticationPattern =
  /^authentication uses ([A-Z][A-Za-z0-9]*) identified by ([a-z][A-Za-z0-9]*)$/;

const rolePattern =
  /^role ([A-Z][A-Za-z0-9]*)(?: with id ([a-z][a-z0-9-]*))?$/;

const allowBasicPattern =
  /^allow ([A-Z][A-Za-z0-9]*) to (create|read|update) ([A-Z][A-Za-z0-9]*)$/;
const allowSelfReadPattern =
  /^allow ([A-Z][A-Za-z0-9]*) to read ([A-Z][A-Za-z0-9]*) where self$/;
const allowOwnerPattern =
  /^allow ([A-Z][A-Za-z0-9]*) to (read|update) ([A-Z][A-Za-z0-9]*) where owner is self$/;
const allowForceOwnerCreatePattern =
  /^allow ([A-Z][A-Za-z0-9]*) to create ([A-Z][A-Za-z0-9]*) with owner as self$/;
const allowRunPattern =
  /^allow ([A-Z][A-Za-z0-9]*) to run ([a-z][a-z0-9]*) on ([A-Z][A-Za-z0-9]*)(?: where owner is self)?$/;
const allowProvisionPattern =
  /^allow ([A-Z][A-Za-z0-9]*) to provision accounts$/;

// Explicit field: strict canonical `(required )?(unique )?` before the type.
const explicitFieldPattern =
  /^  ([a-z][A-Za-z0-9]*) is (required )?(unique )?(text|integer|boolean) with id ([a-z][a-z0-9-]*)(?: length between (\d+) and (\d+))?(?: default (.+))?$/;

// Any indented "<name> is …" line — used to route into field diagnostics.
const fieldLinePattern = /^  ([a-z][A-Za-z0-9]*) is /;

const fieldSyntaxHint =
  "Use: '<name> is [required ][unique ]<type>...'";

// ── Action patterns ────────────────────────────────────────────────────────────

const explicitActionPattern =
  /^action ([a-z][a-z0-9]*) (?:a|an) ([A-Z][A-Za-z0-9]*) with id ([a-z][a-z0-9-]*)$/;
const naturalActionPattern =
  /^action ([a-z][a-z0-9]*) (?:a|an) ([A-Z][A-Za-z0-9]*)$/;

// Literal: quoted string (with escape support), boolean, or integer
const QUOTED_LITERAL_SRC = '"(?:[^"\\\\]|\\\\.)*"';
const LITERAL_SRC = `(?:${QUOTED_LITERAL_SRC}|true|false|-?\\d+)`;
const PREC_OP_SRC = "is greater than|is at least|is less than|is at most|is not|is";

const actionPreconditionPattern = new RegExp(
  `^  require ([a-z][A-Za-z0-9]*) (${PREC_OP_SRC}) (${LITERAL_SRC}) otherwise (${QUOTED_LITERAL_SRC})$`
);
const actionAssignmentPattern = new RegExp(
  `^  set ([a-z][A-Za-z0-9]*) to (${LITERAL_SRC})$`
);
const actionBodyLinePattern = /^  (require|set) /;

interface ParsedFieldDefinition {
  ok: true;
  field: FieldIr;
}

interface InvalidFieldDefinition {
  ok: false;
  diagnostic: Diagnostic;
}

interface PendingRelationship {
  id: string;
  name: string;
  fromEntityName: string;
  toEntityName: string;
  onDelete: OnDelete;
  lineNumber: number;
  sourceLine: string;
}

interface ParsedDefault {
  ok: true;
  value: FieldDefault;
}

interface InvalidDefault {
  ok: false;
  message: string;
}

interface RawPrecondition {
  fieldName: string;
  operator: string;
  rawValue: string;
  message: string;
  lineNumber: number;
  sourceLine: string;
}

interface RawAssignment {
  fieldName: string;
  rawValue: string;
  lineNumber: number;
  sourceLine: string;
}

interface PendingAction {
  id: string;
  name: string;
  entityName: string;
  preconditions: RawPrecondition[];
  assignments: RawAssignment[];
  lineNumber: number;
  sourceLine: string;
}

interface PendingRole {
  name: string;
  id: string;
  lineNumber: number;
  sourceLine: string;
}

interface PendingAuthentication {
  identityEntityName: string;
  identityFieldName: string;
  lineNumber: number;
  sourceLine: string;
}

interface PendingPermission {
  roleName: string;
  operation: PermissionOperation;
  entityName?: string;
  actionName?: string;
  scopeKind?: "self" | "owner" | "force-owner";
  lineNumber: number;
  sourceLine: string;
}

// ── Public entry ──────────────────────────────────────────────────────────────

export function parseSource(
  source: string
): { ir?: ProgramIr; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const entities: EntityIr[] = [];
  const stableIds = new Set<string>();
  const entityNames = new Map<string, string>();
  const naturalEntityNames = new Set<string>();
  const pendingRelationships: PendingRelationship[] = [];
  const pendingActions: PendingAction[] = [];
  const pendingRoles: PendingRole[] = [];
  const pendingPermissions: PendingPermission[] = [];
  let pendingAuthentication: PendingAuthentication | undefined;

  let application: ProgramIr["application"] | undefined;
  let currentEntity: EntityIr | undefined;
  let currentAction: PendingAction | undefined;

  const lines = source.replaceAll("\r\n", "\n").split("\n");

  for (const [index, originalLine] of lines.entries()) {
    const lineNumber = index + 1;
    const line = originalLine.trimEnd();

    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }

    // 1) application
    const applicationMatch = applicationPattern.exec(line);
    if (applicationMatch) {
      const name = requiredCapture(applicationMatch, 1);
      const id = requiredCapture(applicationMatch, 2);

      if (application) {
        diagnostics.push(
          diagnostic(
            "E002",
            "An application has already been declared.",
            lineNumber,
            line,
            "A source file must contain exactly one application declaration."
          )
        );
        continue;
      }

      if (stableIds.has(id)) {
        diagnostics.push(duplicateId(lineNumber, line, id));
        continue;
      }

      stableIds.add(id);
      application = { name, id };
      currentEntity = undefined;
      continue;
    }

    // 2) entity
    const entityMatch = entityPattern.exec(line);
    if (entityMatch) {
      const name = requiredCapture(entityMatch, 1);
      const id = requiredCapture(entityMatch, 2);

      if (entityNames.has(name)) {
        diagnostics.push(
          diagnostic(
            "E006",
            `Entity name "${name}" is already declared.`,
            lineNumber,
            line,
            "Entity names must be unique within an application."
          )
        );
        continue;
      }

      if (stableIds.has(id)) {
        diagnostics.push(duplicateId(lineNumber, line, id));
        continue;
      }

      stableIds.add(id);
      entityNames.set(name, id);
      currentEntity = { name, id, fields: [] };
      currentAction = undefined;
      entities.push(currentEntity);
      continue;
    }

    // 2b) action header
    const explicitActionMatch = explicitActionPattern.exec(line);
    const naturalActionMatch = !explicitActionMatch ? naturalActionPattern.exec(line) : null;
    const actionHeaderMatch = explicitActionMatch ?? naturalActionMatch;
    if (actionHeaderMatch) {
      const actionName = requiredCapture(actionHeaderMatch, 1);
      const entityName = requiredCapture(actionHeaderMatch, 2);
      const id = explicitActionMatch
        ? requiredCapture(explicitActionMatch, 3)
        : `${slugId(entityName)}-${actionName}`;

      if (stableIds.has(id)) {
        diagnostics.push(duplicateId(lineNumber, line, id));
        currentAction = undefined;
        currentEntity = undefined;
        continue;
      }

      stableIds.add(id);
      currentEntity = undefined;
      currentAction = {
        id,
        name: actionName,
        entityName,
        preconditions: [],
        assignments: [],
        lineNumber,
        sourceLine: line
      };
      pendingActions.push(currentAction);
      continue;
    }

    // 2c) action body lines (require / set) — must come before field check
    if (actionBodyLinePattern.test(line)) {
      if (currentAction === undefined) {
        diagnostics.push(
          diagnostic(
            "E029",
            "Action body lines must appear inside an action block.",
            lineNumber,
            line,
            'Add an "action <name> a <Entity>" header before this line.'
          )
        );
        continue;
      }
      const precMatch = actionPreconditionPattern.exec(line);
      if (precMatch) {
        currentAction.preconditions.push({
          fieldName: requiredCapture(precMatch, 1),
          operator: requiredCapture(precMatch, 2),
          rawValue: requiredCapture(precMatch, 3),
          message: parseQuotedString(requiredCapture(precMatch, 4)),
          lineNumber,
          sourceLine: line
        });
        continue;
      }
      const assignMatch = actionAssignmentPattern.exec(line);
      if (assignMatch) {
        currentAction.assignments.push({
          fieldName: requiredCapture(assignMatch, 1),
          rawValue: requiredCapture(assignMatch, 2),
          lineNumber,
          sourceLine: line
        });
        continue;
      }
      diagnostics.push(
        diagnostic(
          "E029",
          "Malformed action body line.",
          lineNumber,
          line,
          'Use: "  require <field> <op> <value> otherwise \\"<message>\\"" or "  set <field> to <value>"'
        )
      );
      continue;
    }

    const authenticationMatch = authenticationPattern.exec(line);
    if (authenticationMatch) {
      if (pendingAuthentication !== undefined) {
        diagnostics.push(
          diagnostic(
            "E047",
            "Authentication is already declared.",
            lineNumber,
            line,
            "Declare authentication at most once."
          )
        );
        continue;
      }
      pendingAuthentication = {
        identityEntityName: requiredCapture(authenticationMatch, 1),
        identityFieldName: requiredCapture(authenticationMatch, 2),
        lineNumber,
        sourceLine: line
      };
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const roleMatch = rolePattern.exec(line);
    if (roleMatch) {
      const roleName = requiredCapture(roleMatch, 1);
      const roleId = slugId(roleName);
      if (pendingRoles.some((role) => role.name === roleName || role.id === roleId)) {
        diagnostics.push(
          diagnostic("E040", `Role "${roleName}" is already declared.`, lineNumber, line, "Role names and ids must be unique.")
        );
        continue;
      }
      if (stableIds.has(roleId)) {
        diagnostics.push(duplicateId(lineNumber, line, roleId));
        continue;
      }
      stableIds.add(roleId);
      pendingRoles.push({
        name: roleName,
        id: roleId,
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const allowBasicMatch = allowBasicPattern.exec(line);
    if (allowBasicMatch) {
      pendingPermissions.push({
        roleName: requiredCapture(allowBasicMatch, 1),
        operation: requiredCapture(allowBasicMatch, 2) as PermissionOperation,
        entityName: requiredCapture(allowBasicMatch, 3),
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const allowSelfReadMatch = allowSelfReadPattern.exec(line);
    if (allowSelfReadMatch) {
      pendingPermissions.push({
        roleName: requiredCapture(allowSelfReadMatch, 1),
        operation: "read",
        entityName: requiredCapture(allowSelfReadMatch, 2),
        scopeKind: "self",
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const allowOwnerMatch = allowOwnerPattern.exec(line);
    if (allowOwnerMatch) {
      pendingPermissions.push({
        roleName: requiredCapture(allowOwnerMatch, 1),
        operation: requiredCapture(allowOwnerMatch, 2) as PermissionOperation,
        entityName: requiredCapture(allowOwnerMatch, 3),
        scopeKind: "owner",
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const allowForceOwnerCreateMatch = allowForceOwnerCreatePattern.exec(line);
    if (allowForceOwnerCreateMatch) {
      pendingPermissions.push({
        roleName: requiredCapture(allowForceOwnerCreateMatch, 1),
        operation: "create",
        entityName: requiredCapture(allowForceOwnerCreateMatch, 2),
        scopeKind: "force-owner",
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const allowRunMatch = allowRunPattern.exec(line);
    if (allowRunMatch) {
      const scopeKind = line.endsWith(" where owner is self") ? "owner" : undefined;
      pendingPermissions.push({
        roleName: requiredCapture(allowRunMatch, 1),
        operation: "run",
        actionName: requiredCapture(allowRunMatch, 2),
        entityName: requiredCapture(allowRunMatch, 3),
        scopeKind,
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    const allowProvisionMatch = allowProvisionPattern.exec(line);
    if (allowProvisionMatch) {
      pendingPermissions.push({
        roleName: requiredCapture(allowProvisionMatch, 1),
        operation: "provision",
        lineNumber,
        sourceLine: line
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    // 3) field — explicit, then natural, then diagnose
    if (fieldLinePattern.test(line)) {
      if (!currentEntity) {
        diagnostics.push(
          diagnostic(
            "E003",
            "A field must appear beneath an entity declaration.",
            lineNumber,
            line,
            "Declare an entity before declaring its fields."
          )
        );
        continue;
      }

      const parsed = parseField(line, lineNumber);
      if (!parsed.ok) {
        diagnostics.push(parsed.diagnostic);
        continue;
      }

      const field = parsed.field;

      if (currentEntity.fields.some((existing) => existing.name === field.name)) {
        diagnostics.push(
          diagnostic(
            "E006",
            `Field name "${field.name}" is already declared on ${currentEntity.name}.`,
            lineNumber,
            line,
            "Field names must be unique within an entity."
          )
        );
        continue;
      }

      if (stableIds.has(field.id)) {
        diagnostics.push(duplicateId(lineNumber, line, field.id));
        continue;
      }

      stableIds.add(field.id);
      currentEntity.fields.push(field);
      continue;
    }

    // 4) relationship
    const relationshipMatch = relationshipPattern.exec(line);
    if (relationshipMatch) {
      const fromName = requiredCapture(relationshipMatch, 1);
      const toName = requiredCapture(relationshipMatch, 2);
      const relName = requiredCapture(relationshipMatch, 3);
      const id = requiredCapture(relationshipMatch, 4);
      const onDelete = requiredCapture(relationshipMatch, 5) as OnDelete;

      if (onDelete === "set null") {
        diagnostics.push(
          diagnostic(
            "E012",
            `Relationship "${relName}" uses "on delete set null" but belongs-to relationships are always required.`,
            lineNumber,
            line,
            'Use "on delete restrict" or "on delete cascade" for required relationships.'
          )
        );
        continue;
      }

      if (stableIds.has(id)) {
        diagnostics.push(duplicateId(lineNumber, line, id));
        continue;
      }

      stableIds.add(id);
      pendingRelationships.push({
        id,
        name: relName,
        fromEntityName: fromName,
        toEntityName: toName,
        onDelete,
        lineNumber,
        sourceLine: line
      });
      continue;
    }

    // 5) natural application
    const naturalApplicationMatch = naturalApplicationPattern.exec(line);
    if (naturalApplicationMatch) {
      const name = requiredCapture(naturalApplicationMatch, 1);
      const id = slugId(name);
      if (application) {
        diagnostics.push(
          diagnostic(
            "E002",
            "An application has already been declared.",
            lineNumber,
            line,
            "A source file must contain exactly one application declaration."
          )
        );
        continue;
      }
      if (stableIds.has(id)) {
        diagnostics.push(naturalDuplicateId(lineNumber, line, id));
        continue;
      }
      stableIds.add(id);
      application = { name, id };
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    // 6) natural field
    const naturalFieldMatch = naturalFieldPattern.exec(line);
    if (naturalFieldMatch) {
      const entityName = requiredCapture(naturalFieldMatch, 2);
      const entityId = slugId(entityName);
      const fieldName = requiredCapture(naturalFieldMatch, 6);
      const fieldId = `${entityId}-${slugId(fieldName)}`;
      const type = requiredCapture(naturalFieldMatch, 7) as FieldType;
      let entity = entities.find((candidate) => candidate.name === entityName);

      if (entity && !naturalEntityNames.has(entityName)) {
        diagnostics.push(
          diagnostic(
            "E006",
            `Entity name "${entityName}" is already declared.`,
            lineNumber,
            line,
            "Natural field declarations cannot extend an explicitly declared entity."
          )
        );
        continue;
      }
      if (!entity) {
        if (stableIds.has(entityId)) {
          diagnostics.push(naturalDuplicateId(lineNumber, line, entityId));
          continue;
        }
        entity = { id: entityId, name: entityName, fields: [] };
        stableIds.add(entityId);
        entityNames.set(entityName, entityId);
        naturalEntityNames.add(entityName);
        entities.push(entity);
      }
      if (entity.fields.some((field) => field.name === fieldName)) {
        diagnostics.push(
          diagnostic(
            "E006",
            `Field name "${fieldName}" is already declared on ${entityName}.`,
            lineNumber,
            line,
            "Field names must be unique within an entity."
          )
        );
        continue;
      }
      if (stableIds.has(fieldId)) {
        diagnostics.push(naturalDuplicateId(lineNumber, line, fieldId));
        continue;
      }

      const rawMin = naturalFieldMatch[8];
      const rawMax = naturalFieldMatch[9];
      let length: LengthConstraint | undefined;
      if (rawMin !== undefined && rawMax !== undefined) {
        if (type !== "text") {
          diagnostics.push(
            diagnostic(
              "E009",
              `Length constraints can only be applied to text fields, not "${type}".`,
              lineNumber,
              line,
              "Remove the length constraint or change the field type to text."
            )
          );
          continue;
        }
        const min = Number.parseInt(rawMin, 10);
        const max = Number.parseInt(rawMax, 10);
        if (min < 1 || min >= max) {
          diagnostics.push(
            diagnostic(
              "E010",
              `Invalid length range: between ${min} and ${max}. Minimum must be at least 1 and less than maximum.`,
              lineNumber,
              line,
              "Example: length between 1 and 200"
            )
          );
          continue;
        }
        length = { min, max };
      }

      const rawDefault = naturalFieldMatch[10];
      let defaultValue: FieldDefault | undefined;
      if (rawDefault !== undefined) {
        const parsedDefault = parseDefault(type, rawDefault);
        if (!parsedDefault.ok) {
          diagnostics.push(
            diagnostic("E008", parsedDefault.message, lineNumber, line, defaultHint(type))
          );
          continue;
        }
        defaultValue = parsedDefault.value;
      }

      stableIds.add(fieldId);
      entity.fields.push({
        id: fieldId,
        name: fieldName,
        type,
        required: naturalFieldMatch[4] !== undefined,
        unique: naturalFieldMatch[5] !== undefined,
        ...(length === undefined ? {} : { length }),
        ...(defaultValue === undefined ? {} : { default: defaultValue })
      });
      currentEntity = undefined;
      currentAction = undefined;
      continue;
    }

    // 7) natural relationship
    const naturalRelationshipMatch = naturalRelationshipPattern.exec(line);
    if (naturalRelationshipMatch) {
      const fromName = requiredCapture(naturalRelationshipMatch, 1);
      const toName = requiredCapture(naturalRelationshipMatch, 3);
      const relName = requiredCapture(naturalRelationshipMatch, 4);
      const onDelete = requiredCapture(naturalRelationshipMatch, 5) as OnDelete;
      const id = `${slugId(fromName)}-${slugId(relName)}`;
      if (onDelete === "set null") {
        diagnostics.push(
          diagnostic(
            "E012",
            `Relationship "${relName}" uses "on delete set null" but belongs-to relationships are always required.`,
            lineNumber,
            line,
            'Use "on delete restrict" or "on delete cascade" for required relationships.'
          )
        );
        continue;
      }
      if (stableIds.has(id)) {
        diagnostics.push(naturalDuplicateId(lineNumber, line, id));
        continue;
      }
      stableIds.add(id);
      pendingRelationships.push({
        id,
        name: relName,
        fromEntityName: fromName,
        toEntityName: toName,
        onDelete,
        lineNumber,
        sourceLine: line
      });
      continue;
    }

    diagnostics.push(
      diagnostic(
        "E001",
        "This statement is not part of the IntentLang grammar.",
        lineNumber,
        line,
        "Use an application, entity, two-space-indented field, action, or relationship declaration."
      )
    );
  }

  const relationships: RelationshipIr[] = [];

  for (const pending of pendingRelationships) {
    const fromId = entityNames.get(pending.fromEntityName);
    const toId = entityNames.get(pending.toEntityName);

    if (fromId === undefined) {
      diagnostics.push(
        diagnostic(
          "E011",
          `Entity "${pending.fromEntityName}" referenced in relationship "${pending.name}" is not declared.`,
          pending.lineNumber,
          pending.sourceLine,
          `Declare "entity ${pending.fromEntityName} with id <stable-id>" before using it in a relationship.`
        )
      );
      continue;
    }

    if (toId === undefined) {
      diagnostics.push(
        diagnostic(
          "E011",
          `Entity "${pending.toEntityName}" referenced in relationship "${pending.name}" is not declared.`,
          pending.lineNumber,
          pending.sourceLine,
          `Declare "entity ${pending.toEntityName} with id <stable-id>" before using it in a relationship.`
        )
      );
      continue;
    }

    relationships.push({
      id: pending.id,
      name: pending.name,
      fromEntityId: fromId,
      toEntityId: toId,
      onDelete: pending.onDelete
    });
  }

  if (!application) {
    diagnostics.push({
      code: "E004",
      message: "The application declaration is missing.",
      line: 1,
      column: 1,
      length: 1,
      hint: "Start with: application Name with id stable-id"
    });
  }

  if (diagnostics.length > 0 || !application) {
    return { diagnostics };
  }

  // ── Action resolution & validation ──────────────────────────────────────────
  const actions: ActionIr[] = [];
  const actionNamesByEntity = new Map<string, Set<string>>();

  for (const pending of pendingActions) {
    const entityId = entityNames.get(pending.entityName);
    if (entityId === undefined) {
      diagnostics.push(
        diagnostic(
          "E011",
          `Entity "${pending.entityName}" referenced in action "${pending.name}" is not declared.`,
          pending.lineNumber,
          pending.sourceLine,
          `Declare "entity ${pending.entityName} with id <stable-id>" before using it in an action.`
        )
      );
      continue;
    }

    const entity = entities.find((e) => e.id === entityId);
    if (entity === undefined) {
      continue;
    }

    // Check for duplicate action names on the same entity
    let entityActionNames = actionNamesByEntity.get(entityId);
    if (entityActionNames === undefined) {
      entityActionNames = new Set<string>();
      actionNamesByEntity.set(entityId, entityActionNames);
    }
    if (entityActionNames.has(pending.name)) {
      diagnostics.push(
        diagnostic(
          "E026",
          `Action name "${pending.name}" is already declared for entity "${pending.entityName}".`,
          pending.lineNumber,
          pending.sourceLine,
          "Action names must be unique per entity."
        )
      );
      continue;
    }
    entityActionNames.add(pending.name);

    // Require at least one precondition
    if (pending.preconditions.length === 0) {
      diagnostics.push(
        diagnostic(
          "E020",
          `Action "${pending.name}" has no preconditions. All v0.4 actions require at least one precondition.`,
          pending.lineNumber,
          pending.sourceLine,
          'Add: "  require <field> is <value> otherwise \\"<message>\\""'
        )
      );
      continue;
    }

    // Require at least one assignment
    if (pending.assignments.length === 0) {
      diagnostics.push(
        diagnostic(
          "E021",
          `Action "${pending.name}" has no assignments. All v0.4 actions require at least one assignment.`,
          pending.lineNumber,
          pending.sourceLine,
          'Add: "  set <field> to <value>"'
        )
      );
      continue;
    }

    // Validate preconditions
    const resolvedPreconditions: PreconditionIr[] = [];
    let actionHasError = false;

    for (const rawPre of pending.preconditions) {
      const field = entity.fields.find((f) => f.name === rawPre.fieldName);
      if (field === undefined) {
        diagnostics.push(
          diagnostic(
            "E023",
            `Unknown field "${rawPre.fieldName}" in precondition of action "${pending.name}".`,
            rawPre.lineNumber,
            rawPre.sourceLine,
            `Available fields: ${entity.fields.map((f) => f.name).join(", ") || "(none)"}`
          )
        );
        actionHasError = true;
        continue;
      }

      // Validate operator for field type
      const op = rawPre.operator as PreconditionOperator;
      if (
        field.type !== "integer" &&
        (op === "is greater than" || op === "is at least" || op === "is less than" || op === "is at most")
      ) {
        diagnostics.push(
          diagnostic(
            "E028",
            `Comparison operator "${op}" is only valid for integer fields, not "${field.type}".`,
            rawPre.lineNumber,
            rawPre.sourceLine,
            'Use "is" or "is not" for boolean and text fields.'
          )
        );
        actionHasError = true;
        continue;
      }

      // Parse and type-check the literal value
      const parsedValue = parseLiteral(field.type, rawPre.rawValue);
      if (!parsedValue.ok) {
        diagnostics.push(
          diagnostic(
            "E024",
            `Type mismatch in precondition: ${parsedValue.message}`,
            rawPre.lineNumber,
            rawPre.sourceLine,
            `Field "${rawPre.fieldName}" is of type "${field.type}".`
          )
        );
        actionHasError = true;
        continue;
      }

      resolvedPreconditions.push({
        fieldName: rawPre.fieldName,
        operator: op,
        value: parsedValue.value,
        message: rawPre.message
      });
    }

    // Validate assignments
    const resolvedAssignments: AssignmentIr[] = [];
    const assignedFields = new Set<string>();

    for (const rawAssign of pending.assignments) {
      const field = entity.fields.find((f) => f.name === rawAssign.fieldName);
      if (field === undefined) {
        diagnostics.push(
          diagnostic(
            "E023",
            `Unknown field "${rawAssign.fieldName}" in assignment of action "${pending.name}".`,
            rawAssign.lineNumber,
            rawAssign.sourceLine,
            `Available fields: ${entity.fields.map((f) => f.name).join(", ") || "(none)"}`
          )
        );
        actionHasError = true;
        continue;
      }

      const systemFields = ["id", "created_at", "updated_at", "version"];
      if (systemFields.includes(rawAssign.fieldName)) {
        diagnostics.push(
          diagnostic(
            "E025",
            `System field "${rawAssign.fieldName}" cannot be assigned in an action.`,
            rawAssign.lineNumber,
            rawAssign.sourceLine,
            "Actions may only assign user-defined fields."
          )
        );
        actionHasError = true;
        continue;
      }

      if (assignedFields.has(rawAssign.fieldName)) {
        diagnostics.push(
          diagnostic(
            "E026",
            `Field "${rawAssign.fieldName}" is assigned more than once in action "${pending.name}".`,
            rawAssign.lineNumber,
            rawAssign.sourceLine,
            "Each field may be assigned at most once per action."
          )
        );
        actionHasError = true;
        continue;
      }
      assignedFields.add(rawAssign.fieldName);

      const parsedValue = parseLiteral(field.type, rawAssign.rawValue);
      if (!parsedValue.ok) {
        diagnostics.push(
          diagnostic(
            "E024",
            `Type mismatch in assignment: ${parsedValue.message}`,
            rawAssign.lineNumber,
            rawAssign.sourceLine,
            `Field "${rawAssign.fieldName}" is of type "${field.type}".`
          )
        );
        actionHasError = true;
        continue;
      }

      resolvedAssignments.push({
        fieldName: rawAssign.fieldName,
        value: parsedValue.value
      });
    }

    if (actionHasError) {
      continue;
    }

    // No-op detection: if every assignment would produce no change given ALL preconditions
    // (only detectable when a single precondition equates the same field to the same value assigned)
    for (const assign of resolvedAssignments) {
      const preForSameField = resolvedPreconditions.filter(
        (pre) => pre.fieldName === assign.fieldName && pre.operator === "is"
      );
      if (preForSameField.length > 0 && preForSameField.every((pre) => pre.value === assign.value)) {
        diagnostics.push(
          diagnostic(
            "E022",
            `Assignment "set ${assign.fieldName} to ${JSON.stringify(assign.value)}" is a no-op: all "is" preconditions on "${assign.fieldName}" require the same value.`,
            pending.lineNumber,
            pending.sourceLine,
            "The assignment would never change the field's value."
          )
        );
        actionHasError = true;
        break;
      }
    }

    if (actionHasError) {
      continue;
    }

    actions.push({
      id: pending.id,
      name: pending.name,
      entityId,
      preconditions: resolvedPreconditions,
      assignments: resolvedAssignments
    });
  }

  const roles: RoleIr[] = pendingRoles.map((role) => ({
    id: role.id,
    name: role.name
  }));

  const roleByName = new Map<string, RoleIr>(roles.map((role) => [role.name, role]));
  const entityByName = new Map<string, EntityIr>(entities.map((entity) => [entity.name, entity]));
  const actionsByEntityAndName = new Map<string, ActionIr>();
  for (const action of actions) {
    const entity = entities.find((candidate) => candidate.id === action.entityId);
    if (!entity) {
      continue;
    }
    actionsByEntityAndName.set(`${entity.name}:${action.name}`, action);
  }

  let authentication: AuthenticationIr | undefined;
  if (pendingAuthentication !== undefined) {
    const authEntity = entityByName.get(pendingAuthentication.identityEntityName);
    if (!authEntity) {
      diagnostics.push(
        diagnostic(
          "E048",
          `Identity entity "${pendingAuthentication.identityEntityName}" must exist and contain the declared identity field.`,
          pendingAuthentication.lineNumber,
          pendingAuthentication.sourceLine,
          "Declare the identity entity and a required unique text identity field."
        )
      );
    } else {
      const identityField = authEntity.fields.find(
        (field) => field.name === pendingAuthentication.identityFieldName
      );
      if (!identityField || identityField.type !== "text" || !identityField.required || !identityField.unique) {
        diagnostics.push(
          diagnostic(
            "E048",
            `Identity field "${pendingAuthentication.identityFieldName}" must exist on "${authEntity.name}" and be required unique text.`,
            pendingAuthentication.lineNumber,
            pendingAuthentication.sourceLine,
            "Use a required unique text field for identity."
          )
        );
      } else {
        authentication = {
          identityEntityId: authEntity.id,
          identityFieldId: identityField.id
        };
      }
    }
  }

  if (authentication === undefined) {
    for (const pendingRole of pendingRoles) {
      diagnostics.push(
        diagnostic("E049", "Roles require authentication.", pendingRole.lineNumber, pendingRole.sourceLine, "Add an authentication declaration first.")
      );
    }
    for (const pendingPermission of pendingPermissions) {
      diagnostics.push(
        diagnostic(
          pendingPermission.operation === "provision" ? "E050" : "E049",
          pendingPermission.operation === "provision"
            ? "Provisioning accounts requires authentication."
            : "Allow rules require authentication.",
          pendingPermission.lineNumber,
          pendingPermission.sourceLine,
          pendingPermission.operation === "provision"
            ? "Declare authentication before provisioning permissions."
            : "Add an authentication declaration first."
        )
      );
    }
  }

  const permissions: PermissionIr[] = [];
  const permissionKeys = new Set<string>();
  for (const pending of pendingPermissions) {
    const role = roleByName.get(pending.roleName);
    if (!role) {
      diagnostics.push(
        diagnostic("E041", `Role "${pending.roleName}" is not declared.`, pending.lineNumber, pending.sourceLine, "Declare the role before allow statements.")
      );
      continue;
    }

    let entityId = "";
    let actionId: string | undefined;
    let scope: PermissionIr["scope"];
    if (pending.entityName !== undefined) {
      const entity = entityByName.get(pending.entityName);
      if (!entity) {
        diagnostics.push(
          diagnostic("E042", `Entity "${pending.entityName}" is not declared.`, pending.lineNumber, pending.sourceLine, "Declare the entity before permissions.")
        );
        continue;
      }
      entityId = entity.id;

      if (pending.operation === "run") {
        const action = actionsByEntityAndName.get(`${pending.entityName}:${pending.actionName ?? ""}`);
        if (!action) {
          diagnostics.push(
            diagnostic("E043", `Action "${pending.actionName}" on "${pending.entityName}" is not declared.`, pending.lineNumber, pending.sourceLine, "Declare the action before run permissions.")
          );
          continue;
        }
        actionId = action.id;
      }

      if (pending.scopeKind === "self") {
        if (!authentication || authentication.identityEntityId !== entity.id) {
          diagnostics.push(
            diagnostic("E044", `Self scope is only valid on the identity entity "${pendingAuthentication?.identityEntityName ?? "identity"}".`, pending.lineNumber, pending.sourceLine, "Use owner scope for non-identity entities.")
          );
          continue;
        }
        scope = { kind: "self" };
      } else if (pending.scopeKind === "owner" || pending.scopeKind === "force-owner") {
        const ownerRelationship = authentication
          ? relationships.find((rel) =>
              rel.fromEntityId === entity.id &&
              rel.toEntityId === authentication.identityEntityId &&
              rel.name === "owner"
            )
          : undefined;
        if (!ownerRelationship) {
          diagnostics.push(
            diagnostic("E045", `Entity "${entity.name}" does not have an ownership relationship to the identity entity.`, pending.lineNumber, pending.sourceLine, "Declare a belongs-to relationship to the identity entity.")
          );
          continue;
        }
        scope = pending.scopeKind === "owner"
          ? { kind: "owner", relationshipId: ownerRelationship.id }
          : { kind: "force-owner" };
      }
    }

    const permissionId = pending.operation === "run"
      ? `perm-${role.id}-run-${actionId ?? "missing-action"}`
      : pending.operation === "provision"
        ? `perm-${role.id}-provision`
        : `perm-${role.id}-${pending.operation}-${entityId ?? "missing-entity"}`;
    const dedupeKey = [
      role.id,
      pending.operation,
      entityId,
      actionId ?? "",
      scope?.kind ?? "",
      scope && "relationshipId" in scope ? scope.relationshipId : ""
    ].join("|");
    if (permissionKeys.has(dedupeKey)) {
      diagnostics.push(
        diagnostic("E046", `Duplicate permission for role "${role.name}".`, pending.lineNumber, pending.sourceLine, "Each allow rule must be unique by role, operation, target, and scope.")
      );
      continue;
    }
    permissionKeys.add(dedupeKey);

    permissions.push({
      id: permissionId,
      roleId: role.id,
      operation: pending.operation,
      entityId,
      ...(actionId === undefined ? {} : { actionId }),
      ...(scope === undefined ? {} : { scope })
    });
  }

  if (diagnostics.length > 0) {
    return { diagnostics };
  }

  return {
    diagnostics,
    ir: {
      schemaVersion: "0.5.0",
      application,
      ...(authentication === undefined ? {} : { authentication }),
      roles,
      permissions,
      entities,
      relationships,
      actions
    }
  };
}

// ── Field parsing ─────────────────────────────────────────────────────────────

function parseField(
  line: string,
  lineNumber: number
): ParsedFieldDefinition | InvalidFieldDefinition {
  const explicit = explicitFieldPattern.exec(line);
  if (explicit) {
    return buildFieldFromMatch(explicit, line, lineNumber);
  }

  return diagnoseFieldFailure(line, lineNumber);
}

function buildFieldFromMatch(
  match: RegExpExecArray,
  sourceLine: string,
  lineNumber: number
): ParsedFieldDefinition | InvalidFieldDefinition {
  const name = requiredCapture(match, 1);
  const required = match[2] !== undefined;
  const unique = match[3] !== undefined;
  const type = requiredCapture(match, 4) as FieldType;
  const id = requiredCapture(match, 5);
  const rawMin = match[6];
  const rawMax = match[7];
  const rawDefault = match[8];

  let length: LengthConstraint | undefined;
  if (rawMin !== undefined && rawMax !== undefined) {
    if (type !== "text") {
      return {
        ok: false,
        diagnostic: diagnostic(
          "E009",
          `Length constraints can only be applied to text fields, not "${type}".`,
          lineNumber,
          sourceLine,
          "Remove the length constraint or change the field type to text."
        )
      };
    }
    const min = Number.parseInt(rawMin, 10);
    const max = Number.parseInt(rawMax, 10);
    if (min < 1 || min >= max) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "E010",
          `Invalid length range: between ${min} and ${max}. Minimum must be at least 1 and less than maximum.`,
          lineNumber,
          sourceLine,
          "Example: length between 1 and 200"
        )
      };
    }
    length = { min, max };
  }

  let defaultValue: FieldDefault | undefined;
  if (rawDefault !== undefined) {
    const parsedDefault = parseDefault(type, rawDefault);
    if (!parsedDefault.ok) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "E008",
          parsedDefault.message,
          lineNumber,
          sourceLine,
          defaultHint(type)
        )
      };
    }
    defaultValue = parsedDefault.value;
  }

  const field: FieldIr = {
    id,
    name,
    type,
    required,
    unique,
    ...(defaultValue === undefined ? {} : { default: defaultValue }),
    ...(length === undefined ? {} : { length })
  };

  return { ok: true, field };
}

// Duplicate modifier detection (E014) — highest priority; unambiguous.
const duplicateRequiredPattern = /^  [a-z][A-Za-z0-9]* is (?:an? )?required required\b/;
const duplicateUniquePattern = /^  [a-z][A-Za-z0-9]* is (?:an? )?(?:required )?unique unique\b/;

// Wrong-order modifier detection (E013): "unique required" (unique before required),
// or a modifier appearing after the type.
const uniqueBeforeRequiredPattern = /^  [a-z][A-Za-z0-9]* is (?:an? )?unique required\b/;
const modifierAfterTypePattern =
  /^  [a-z][A-Za-z0-9]* is (?:an? )?(?:required |unique |required unique |unique required )?(?:text|integer|boolean)(?: field)? (required|unique)\b/;

function diagnoseFieldFailure(
  line: string,
  lineNumber: number
): InvalidFieldDefinition {
  if (duplicateRequiredPattern.test(line)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "E014",
        "Duplicate modifier 'required'.",
        lineNumber,
        line,
        fieldSyntaxHint
      )
    };
  }

  if (duplicateUniquePattern.test(line)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "E014",
        "Duplicate modifier 'unique'.",
        lineNumber,
        line,
        fieldSyntaxHint
      )
    };
  }

  if (uniqueBeforeRequiredPattern.test(line)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "E013",
        "Modifier order is invalid. Canonical order: required unique. Use: '<name> is [required ][unique ]<type>...'",
        lineNumber,
        line,
        fieldSyntaxHint
      )
    };
  }

  if (modifierAfterTypePattern.test(line)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "E013",
        "Modifier order is invalid. Canonical order: required unique. Use: '<name> is [required ][unique ]<type>...'",
        lineNumber,
        line,
        fieldSyntaxHint
      )
    };
  }

  return {
    ok: false,
    diagnostic: diagnostic(
      "E001",
      "This statement is not part of the IntentLang grammar.",
      lineNumber,
      line,
      fieldSyntaxHint
    )
  };
}

// ── Default value parsing ─────────────────────────────────────────────────────

function parseDefault(
  type: FieldType,
  rawValue: string
): ParsedDefault | InvalidDefault {
  const trimmed = rawValue.trim();

  if (type === "boolean") {
    if (trimmed === "true") return { ok: true, value: true };
    if (trimmed === "false") return { ok: true, value: false };
    return { ok: false, message: `Boolean default "${trimmed}" must be true or false.` };
  }

  if (type === "integer") {
    if (!/^-?\d+$/.test(trimmed)) {
      return { ok: false, message: `Integer default "${trimmed}" is not a whole number.` };
    }
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) {
      return { ok: false, message: `Integer default "${trimmed}" exceeds the safe integer range.` };
    }
    return { ok: true, value };
  }

  if (!/^"(?:[^"\\]|\\.)*"$/.test(trimmed)) {
    return { ok: false, message: "Text defaults must be enclosed in double quotes." };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) as string };
  } catch {
    return { ok: false, message: "The text default contains an invalid escape sequence." };
  }
}

function defaultHint(type: FieldType): string {
  if (type === "boolean") return "Example: default false";
  if (type === "integer") return "Example: default 0";
  return 'Example: default "Untitled"';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requiredCapture(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) {
    throw new Error(`Parser grammar capture ${index} is unexpectedly missing.`);
  }
  return value;
}

function duplicateId(line: number, sourceLine: string, id: string): Diagnostic {
  return diagnostic(
    "E005",
    `Stable id "${id}" is already in use.`,
    line,
    sourceLine,
    "Every application, entity, field, and relationship must have a globally unique stable id."
  );
}

function naturalDuplicateId(line: number, sourceLine: string, id: string): Diagnostic {
  return diagnostic(
    "E005",
    `Stable id "${id}" is already in use.`,
    line,
    sourceLine,
    `The natural syntax derives the stable ID '${id}' for this declaration. If you mixed explicit and natural syntax, ensure the explicit ID matches the derived ID.`
  );
}

export function slugId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function diagnostic(
  code: string,
  message: string,
  line: number,
  sourceLine: string,
  hint: string
): Diagnostic {
  const firstContent = sourceLine.search(/\S/);
  return {
    code,
    message,
    line,
    column: Math.max(firstContent, 0) + 1,
    length: Math.max(sourceLine.trim().length, 1),
    hint
  };
}

function parseQuotedString(raw: string): string {
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw.slice(1, -1);
  }
}

interface ParsedLiteral {
  ok: true;
  value: FieldDefault;
}
interface InvalidLiteral {
  ok: false;
  message: string;
}

function parseLiteral(
  type: FieldType,
  raw: string
): ParsedLiteral | InvalidLiteral {
  const trimmed = raw.trim();
  if (type === "boolean") {
    if (trimmed === "true") return { ok: true, value: true };
    if (trimmed === "false") return { ok: true, value: false };
    return {
      ok: false,
      message: `Boolean literal must be true or false, got "${trimmed}".`
    };
  }
  if (type === "integer") {
    if (!/^-?\d+$/.test(trimmed)) {
      return {
        ok: false,
        message: `Integer literal must be a whole number, got "${trimmed}".`
      };
    }
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value)) {
      return {
        ok: false,
        message: `Integer literal "${trimmed}" exceeds the safe integer range.`
      };
    }
    return { ok: true, value };
  }
  // text
  if (!/^"(?:[^"\\]|\\.)*"$/.test(trimmed)) {
    return {
      ok: false,
      message: `Text literal must be a double-quoted string, got "${trimmed}".`
    };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) as string };
  } catch {
    return { ok: false, message: "Text literal contains an invalid escape sequence." };
  }
}

// Suppress unused import warning
void fieldTypes;
