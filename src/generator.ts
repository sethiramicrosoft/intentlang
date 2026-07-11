import type {
  EntityIr,
  FieldIr,
  ProgramIr,
  RelationshipIr
} from "./model.js";

export interface GeneratedSchema {
  migrationSql: string;
}

export function generateSchema(ir: ProgramIr): GeneratedSchema {
  const lines: string[] = [
    "PRAGMA foreign_keys = ON;",
    "PRAGMA journal_mode = WAL;",
    ""
  ];

  for (const entity of ir.entities) {
    const rels = ir.relationships.filter((relationship) => relationship.fromEntityId === entity.id);
    lines.push(generateCreateTable(entity, rels, ir));
    lines.push("");
  }

  for (const entity of ir.entities) {
    const tableName = entityTableName(entity.name);
    for (const field of entity.fields) {
      if (!field.unique) {
        continue;
      }
      lines.push(
        `-- UNIQUE: ${field.id} (NULL values are not considered equal in SQLite; multiple NULLs are allowed for optional unique fields)`,
        `CREATE UNIQUE INDEX "${field.id}_unique" ON "${tableName}"("${field.name}");`
      );
    }
  }

  return { migrationSql: lines.join("\n") };
}

export function entityTableName(entityName: string): string {
  return entityName.toLowerCase() + "s";
}

export function uniqueIndexName(field: FieldIr): string {
  return `${field.id}_unique`;
}

function generateCreateTable(
  entity: EntityIr,
  rels: RelationshipIr[],
  ir: ProgramIr
): string {
  const tableName = entityTableName(entity.name);
  const parts: string[] = [
    `  "id" TEXT PRIMARY KEY`,
    `  "created_at" TEXT NOT NULL`,
    `  "updated_at" TEXT NOT NULL`,
    `  "version" INTEGER NOT NULL DEFAULT 1`
  ];

  for (const field of entity.fields) {
    parts.push(generateScalarColumn(field));
  }

  for (const rel of rels) {
    parts.push(`  "${rel.name}_id" TEXT NOT NULL`);
  }

  for (const rel of rels) {
    const toEntity = ir.entities.find((candidate) => candidate.id === rel.toEntityId);
    if (!toEntity) {
      continue;
    }
    parts.push(
      `  FOREIGN KEY("${rel.name}_id") REFERENCES "${entityTableName(toEntity.name)}"("id") ON DELETE ${onDeleteToSql(rel.onDelete)}`
    );
  }

  return `CREATE TABLE "${tableName}" (\n${parts.join(",\n")}\n);`;
}

function onDeleteToSql(onDelete: "restrict" | "cascade" | "set null"): string {
  switch (onDelete) {
    case "restrict":
      return "RESTRICT";
    case "cascade":
      return "CASCADE";
    case "set null":
      return "SET NULL";
  }
}

function generateScalarColumn(field: FieldIr): string {
  const col = `"${field.name}"`;

  if (field.type === "text") {
    let def = `  ${col} TEXT`;
    if (field.required) {
      def += " NOT NULL";
    }
    if (field.default !== undefined) {
      def += ` DEFAULT ${sqlStringLiteral(field.default as string)}`;
    }
    if (field.length) {
      def += ` CHECK(length(${col}) >= ${field.length.min} AND length(${col}) <= ${field.length.max})`;
    }
    return def;
  }

  if (field.type === "integer") {
    let def = `  ${col} INTEGER`;
    if (field.required) {
      def += " NOT NULL";
    }
    if (field.default !== undefined) {
      def += ` DEFAULT ${field.default as number}`;
    }
    return def;
  }

  let def = `  ${col} INTEGER`;
  if (field.required) {
    def += " NOT NULL";
  }
  if (field.default !== undefined) {
    def += ` DEFAULT ${(field.default as boolean) ? 1 : 0}`;
  }
  def += ` CHECK(${col} IN (0, 1))`;
  return def;
}

function sqlStringLiteral(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

export function generateAddColumnClause(field: FieldIr): string {
  const col = `"${field.name}"`;

  if (field.type === "text") {
    let def = `${col} TEXT`;
    if (field.required) {
      def += " NOT NULL";
    }
    if (field.default !== undefined) {
      def += ` DEFAULT ${sqlStringLiteral(String(field.default))}`;
    }
    if (field.length) {
      def += ` CHECK(length(${col}) >= ${field.length.min} AND length(${col}) <= ${field.length.max})`;
    }
    return def;
  }

  if (field.type === "integer") {
    let def = `${col} INTEGER`;
    if (field.required) {
      def += " NOT NULL";
    }
    if (field.default !== undefined) {
      def += ` DEFAULT ${field.default}`;
    }
    return def;
  }

  let def = `${col} INTEGER`;
  if (field.required) {
    def += " NOT NULL";
  }
  if (field.default !== undefined) {
    def += ` DEFAULT ${field.default === true ? 1 : 0}`;
  }
  def += ` CHECK(${col} IN (0, 1))`;
  return def;
}
