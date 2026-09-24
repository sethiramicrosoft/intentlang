import type { ProgramIr } from "../model.js";
import type { TraceArtifact, TraceLink, TraceMap } from "./contracts.js";
import { sourceFingerprint } from "./semantic-fingerprint.js";
import { expandPolicySource } from "./policies.js";
import { expandDeclarationSource } from "./abstractions.js";

function artifacts(kind: string, id: string, name: string): TraceArtifact[] {
  if (kind === "application") {
    return [
      { kind: "manifest", path: "intentlang.manifest.json", symbol: id },
      { kind: "database", path: "migration.sql" },
      { kind: "runtime", path: "app.mjs" },
      { kind: "ui", path: "app.js" },
      { kind: "ui", path: "index.html" }
    ];
  }
  if (kind === "entity") {
    return [
      { kind: "database", path: "migration.sql", symbol: id },
      { kind: "runtime", path: "app.mjs", symbol: `/api/${name.toLowerCase()}` },
      { kind: "ui", path: "app.js", symbol: id }
    ];
  }
  if (kind === "field" || kind === "relationship") {
    return [
      { kind: "database", path: "migration.sql", symbol: id },
      { kind: "runtime", path: "app.mjs", symbol: id },
      { kind: "ui", path: "app.js", symbol: id }
    ];
  }
  if (kind === "action") {
    return [
      { kind: "runtime", path: "app.mjs", symbol: `/actions/${name}` },
      { kind: "ui", path: "app.js", symbol: id }
    ];
  }
  return [
    { kind: "runtime", path: "app.mjs", symbol: id },
    { kind: "ui", path: "app.js", symbol: id }
  ];
}

function link(
  file: string,
  startLine: number,
  endLine: number,
  ruleIds: string[],
  irNodeId: string,
  kind: string,
  name = irNodeId
): TraceLink {
  return {
    source: { file, startLine, endLine },
    ruleIds,
    irNodeId,
    artifacts: artifacts(kind, irNodeId, name)
  };
}

export function buildTraceMap(
  source: string,
  ir: ProgramIr,
  file = "<memory>"
): TraceMap {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const links: TraceLink[] = [];
  const entityByName = new Map(ir.entities.map((entity) => [entity.name, entity]));
  const roleByName = new Map(ir.roles.map((role) => [role.name, role]));
  let currentEntityName: string | undefined;
  let permissionIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!.trimEnd();
    const trimmed = text.trim();
    const line = index + 1;
    if (!trimmed || trimmed.startsWith("#")) continue;

    const application = /^application\s+([A-Z][A-Za-z0-9]*)/.exec(trimmed);
    if (application) {
      links.push(
        link(file, line, line, ["APP-DECL-001"], ir.application.id, "application")
      );
      currentEntityName = undefined;
      continue;
    }

    const authentication = /^authentication\s+uses\s+/.exec(trimmed);
    if (authentication && ir.authentication) {
      links.push(
        link(file, line, line, ["AUTH-DECL-001"], "authentication", "authentication")
      );
      currentEntityName = undefined;
      continue;
    }

    const roleMatch = /^role\s+([A-Z][A-Za-z0-9]*)/.exec(trimmed);
    if (roleMatch) {
      const role = roleByName.get(roleMatch[1]!);
      if (role) {
        links.push(
          link(file, line, line, ["ROLE-DECL-001"], role.id, "role", role.name)
        );
      }
      currentEntityName = undefined;
      continue;
    }

    const explicitEntity = /^entity\s+([A-Z][A-Za-z0-9]*)\s+with\s+id\s+/.exec(trimmed);
    if (explicitEntity) {
      const entity = entityByName.get(explicitEntity[1]!);
      if (entity) {
        links.push(
          link(file, line, line, ["ENTITY-DECL-001"], entity.id, "entity", entity.name)
        );
        currentEntityName = entity.name;
      }
      continue;
    }

    const naturalField =
      /^(?:a|an)\s+([A-Z][A-Za-z0-9]*)\s+has\s+(?:a|an)\s+(?:required\s+)?(?:unique\s+)?([a-z][A-Za-z0-9]*)\s+as\s+/.exec(
        trimmed
      );
    if (naturalField) {
      const entity = entityByName.get(naturalField[1]!);
      const field = entity?.fields.find((candidate) => candidate.name === naturalField[2]);
      if (entity && field) {
        if (!links.some((candidate) => candidate.irNodeId === entity.id)) {
          links.push(
            link(file, line, line, ["ENTITY-DECL-001"], entity.id, "entity", entity.name)
          );
        }
        links.push(
          link(file, line, line, ["FIELD-DECL-001"], field.id, "field", field.name)
        );
      }
      currentEntityName = undefined;
      continue;
    }

    const explicitField =
      /^\s{2}([a-z][A-Za-z0-9]*)\s+is\s+.*\s+with\s+id\s+([a-z][a-z0-9-]*)/.exec(
        text
      );
    if (explicitField && currentEntityName) {
      const entity = entityByName.get(currentEntityName);
      const field = entity?.fields.find((candidate) => candidate.id === explicitField[2]);
      if (field) {
        links.push(
          link(file, line, line, ["FIELD-DECL-001"], field.id, "field", field.name)
        );
      }
      continue;
    }

    const relationship =
      /^(?:each\s+)?([A-Z][A-Za-z0-9]*)\s+belongs\s+to\s+(?:(?:a|an)\s+)?([A-Z][A-Za-z0-9]*)\s+as\s+([a-z][A-Za-z0-9]*)/.exec(
        trimmed
      );
    if (relationship) {
      const from = entityByName.get(relationship[1]!);
      const rel = ir.relationships.find(
        (candidate) =>
          candidate.fromEntityId === from?.id && candidate.name === relationship[3]
      );
      if (rel) {
        links.push(
          link(file, line, line, ["REL-DECL-001"], rel.id, "relationship", rel.name)
        );
      }
      currentEntityName = undefined;
      continue;
    }

    const actionMatch =
      /^action\s+([a-z][a-z0-9]*)\s+(?:a|an)\s+([A-Z][A-Za-z0-9]*)/.exec(trimmed);
    if (actionMatch) {
      const entity = entityByName.get(actionMatch[2]!);
      const action = ir.actions.find(
        (candidate) =>
          candidate.entityId === entity?.id && candidate.name === actionMatch[1]
      );
      if (action) {
        let endLine = line;
        while (
          endLine < lines.length &&
          (/^\s{2}(?:require|set)\s+/.test(lines[endLine] ?? "") ||
            (lines[endLine] ?? "").trim() === "")
        ) {
          if ((lines[endLine] ?? "").trim() !== "") endLine += 1;
          else break;
        }
        links.push(
          link(file, line, endLine, ["ACTION-DECL-001"], action.id, "action", action.name)
        );
      }
      currentEntityName = undefined;
      continue;
    }

    if (/^allow\s+/.test(trimmed)) {
      const permission = ir.permissions[permissionIndex++];
      if (permission) {
        links.push(
          link(
            file,
            line,
            line,
            ["PERMISSION-DECL-001"],
            permission.id,
            "permission"
          )
        );
      }
      currentEntityName = undefined;
    }
  }

  const declarations = expandDeclarationSource(source);
  if (declarations.ok) {
    for (const expansion of declarations.expansions) {
      if (expansion.kind === "field-group") {
        for (const statement of expansion.statements) {
          const match =
            /^(?:a|an) ([A-Z][A-Za-z0-9]*) has (?:a|an) (?:required )?(?:unique )?([a-z][A-Za-z0-9]*) as /.exec(
              statement
            );
          if (!match) continue;
          const entity = entityByName.get(match[1]!);
          const field = entity?.fields.find(
            (candidate) => candidate.name === match[2]
          );
          if (field) {
            links.push(
              link(
                file,
                expansion.sourceLine,
                expansion.sourceLine,
                ["DECLARATION-EXPANSION-001", "FIELD-DECL-001"],
                field.id,
                "field",
                field.name
              )
            );
          }
        }
      } else {
        for (const statement of expansion.statements) {
          const match =
            /^action ([a-z][a-z0-9]*) (?:a|an) ([A-Z][A-Za-z0-9]*)$/.exec(
              statement
            );
          if (!match) continue;
          const entity = entityByName.get(match[2]!);
          const action = ir.actions.find(
            (candidate) =>
              candidate.entityId === entity?.id && candidate.name === match[1]
          );
          if (action) {
            links.push(
              link(
                file,
                expansion.sourceLine,
                expansion.sourceLine,
                ["DECLARATION-EXPANSION-001", "ACTION-DECL-001"],
                action.id,
                "action",
                action.name
              )
            );
          }
        }
      }
    }
  }

  const expanded = declarations.ok
    ? expandPolicySource(declarations.source)
    : expandPolicySource(source);
  if (expanded.ok) {
    for (const expansion of expanded.expansions) {
      for (const _statement of expansion.statements) {
        const permission = ir.permissions[permissionIndex++];
        if (!permission) break;
        links.push(
          link(
            file,
            expansion.sourceLine,
            expansion.sourceLine,
            ["POLICY-EXPANSION-001", "PERMISSION-DECL-001"],
            permission.id,
            "permission"
          )
        );
      }
    }
  }

  return { sourceFingerprint: sourceFingerprint(ir), links };
}

export function remapTraceMapSources(
  trace: TraceMap,
  sourceMap: Array<{ file: string; line: number }>
): TraceMap {
  return {
    ...trace,
    links: trace.links.map((item) => {
      const start = sourceMap[item.source.startLine - 1];
      const end = sourceMap[item.source.endLine - 1] ?? start;
      if (!start) return item;
      return {
        ...item,
        source: {
          file: start.file,
          startLine: start.line,
          endLine: end?.file === start.file ? end.line : start.line
        }
      };
    })
  };
}
