import type { Diagnostic } from "../model.js";

export interface PolicyExpansion {
  kind: "policy" | "inheritance";
  source: string;
  sourceLine: number;
  targetRole: string;
  statements: string[];
}

export interface PolicyExpandSuccess {
  ok: true;
  source: string;
  expansions: PolicyExpansion[];
}

export interface PolicyExpandFailure {
  ok: false;
  diagnostics: Diagnostic[];
}

export type PolicyExpandResult = PolicyExpandSuccess | PolicyExpandFailure;

interface PolicyDefinition {
  name: string;
  line: number;
  statements: string[];
}

function entityList(value: string): string[] {
  return value
    .replace(/\s+and\s+/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandPolicyStatement(
  statement: string,
  role: string,
  actionsByEntity: Map<string, string[]>
): string[] {
  const readSelf = /^allow to read self ([A-Z][A-Za-z0-9]*)$/.exec(statement);
  if (readSelf) {
    return [`allow ${role} to read ${readSelf[1]} where self`];
  }
  const readMany = /^allow to read (.+)$/.exec(statement);
  if (readMany) {
    return entityList(readMany[1]!).map(
      (entity) => `allow ${role} to read ${entity}`
    );
  }
  const manage = /^allow to manage (.+)$/.exec(statement);
  if (manage) {
    return entityList(manage[1]!).flatMap((entity) => [
      `allow ${role} to create ${entity}`,
      `allow ${role} to read ${entity}`,
      `allow ${role} to update ${entity}`
    ]);
  }
  const own =
    /^allow to create and update own (.+)$/.exec(statement);
  if (own) {
    return entityList(own[1]!).flatMap((entity) => [
      `allow ${role} to create ${entity} with owner as self`,
      `allow ${role} to update ${entity} where owner is self`
    ]);
  }
  const runOwn =
    /^allow to run all actions on own (.+)$/.exec(statement);
  if (runOwn) {
    return entityList(runOwn[1]!).flatMap((entity) =>
      (actionsByEntity.get(entity) ?? []).map(
        (action) =>
          `allow ${role} to run ${action} on ${entity} where owner is self`
      )
    );
  }
  const runAll =
    /^allow to run all actions on (.+)$/.exec(statement);
  if (runAll) {
    return entityList(runAll[1]!).flatMap((entity) =>
      (actionsByEntity.get(entity) ?? []).map(
        (action) => `allow ${role} to run ${action} on ${entity}`
      )
    );
  }
  if (statement === "allow to provision accounts") {
    return [`allow ${role} to provision accounts`];
  }
  return [statement.replace(/^allow to /, `allow ${role} to `)];
}

function diagnostic(
  code: string,
  message: string,
  line: number,
  source: string,
  hint: string
): Diagnostic {
  return {
    code,
    message,
    line,
    column: Math.max(1, source.search(/\S/) + 1),
    length: Math.max(1, source.trim().length),
    hint
  };
}

function roleOfAllow(statement: string): string | undefined {
  return /^allow ([A-Z][A-Za-z0-9]*) to /.exec(statement)?.[1];
}

function retargetAllow(statement: string, role: string): string {
  return statement.replace(
    /^allow [A-Z][A-Za-z0-9]* to /,
    `allow ${role} to `
  );
}

export function expandPolicySource(source: string): PolicyExpandResult {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const output = [...lines];
  const diagnostics: Diagnostic[] = [];
  const policies = new Map<string, PolicyDefinition>();
  const inheritance = new Map<string, { parent: string; line: number }>();
  const roles = new Set<string>();
  const grants: Array<{ policy: string; role: string; line: number }> = [];
  const actionsByEntity = new Map<string, string[]>();

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const trimmed = raw.trim();
    const policy = /^policy ([A-Z][A-Za-z0-9]*)$/.exec(trimmed);
    if (policy) {
      const name = policy[1]!;
      const statements: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && /^\s{2}allow to /.test(lines[cursor]!)) {
        statements.push(lines[cursor]!.trim());
        output[cursor] = "";
        cursor += 1;
      }
      if (policies.has(name)) {
        diagnostics.push(
          diagnostic(
            "E051",
            `Policy "${name}" is already declared.`,
            index + 1,
            raw,
            "Policy names must be unique."
          )
        );
      } else if (statements.length === 0) {
        diagnostics.push(
          diagnostic(
            "E052",
            `Policy "${name}" has no allow statements.`,
            index + 1,
            raw,
            'Add at least one indented "allow to ..." statement.'
          )
        );
      } else {
        policies.set(name, { name, line: index + 1, statements });
      }
      output[index] = "";
      index = cursor - 1;
      continue;
    }

    const inheritedRole =
      /^role ([A-Z][A-Za-z0-9]*) extends ([A-Z][A-Za-z0-9]*)$/.exec(trimmed);
    if (inheritedRole) {
      const child = inheritedRole[1]!;
      roles.add(child);
      inheritance.set(child, { parent: inheritedRole[2]!, line: index + 1 });
      output[index] = `role ${child}`;
      continue;
    }

    const role = /^role ([A-Z][A-Za-z0-9]*)/.exec(trimmed);
    if (role) roles.add(role[1]!);

    const action =
      /^action ([a-z][a-z0-9]*) (?:a|an) ([A-Z][A-Za-z0-9]*)/.exec(trimmed);
    if (action) {
      const actions = actionsByEntity.get(action[2]!) ?? [];
      actions.push(action[1]!);
      actionsByEntity.set(action[2]!, actions);
    }

    const grant =
      /^grant ([A-Z][A-Za-z0-9]*) to ([A-Z][A-Za-z0-9]*)$/.exec(trimmed);
    if (grant) {
      grants.push({
        policy: grant[1]!,
        role: grant[2]!,
        line: index + 1
      });
      output[index] = "";
    }
  }

  for (const [child, edge] of inheritance) {
    if (!roles.has(edge.parent)) {
      diagnostics.push(
        diagnostic(
          "E053",
          `Role "${child}" extends unknown role "${edge.parent}".`,
          edge.line,
          lines[edge.line - 1]!,
          "Declare the parent role before using it."
        )
      );
    }
  }

  for (const role of roles) {
    const path = new Set<string>();
    let current: string | undefined = role;
    while (current) {
      if (path.has(current)) {
        const edge = inheritance.get(current);
        diagnostics.push(
          diagnostic(
            "E054",
            `Role inheritance cycle includes "${current}".`,
            edge?.line ?? 1,
            lines[(edge?.line ?? 1) - 1] ?? "",
            "Remove one extends declaration so the role graph is acyclic."
          )
        );
        break;
      }
      path.add(current);
      current = inheritance.get(current)?.parent;
    }
  }

  const expansions: PolicyExpansion[] = [];
  const effective = new Map<string, Set<string>>();
  const add = (
    role: string,
    statement: string,
    kind: PolicyExpansion["kind"],
    sourceName: string,
    sourceLine: number
  ): boolean => {
    let statements = effective.get(role);
    if (!statements) {
      statements = new Set<string>();
      effective.set(role, statements);
    }
    const normalized = retargetAllow(statement, role);
    if (statements.has(normalized)) return false;
    statements.add(normalized);
    let expansion = expansions.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.source === sourceName &&
        candidate.targetRole === role
    );
    if (!expansion) {
      expansion = {
        kind,
        source: sourceName,
        sourceLine,
        targetRole: role,
        statements: []
      };
      expansions.push(expansion);
    }
    expansion.statements.push(normalized);
    return true;
  };

  for (const line of output) {
    const role = roleOfAllow(line.trim());
    if (role) {
      let statements = effective.get(role);
      if (!statements) {
        statements = new Set<string>();
        effective.set(role, statements);
      }
      statements.add(line.trim());
    }
  }

  for (const grant of grants) {
    const policy = policies.get(grant.policy);
    if (!policy) {
      diagnostics.push(
        diagnostic(
          "E055",
          `Policy "${grant.policy}" is not declared.`,
          grant.line,
          lines[grant.line - 1]!,
          "Declare the policy before granting it."
        )
      );
      continue;
    }
    if (!roles.has(grant.role)) {
      diagnostics.push(
        diagnostic(
          "E056",
          `Role "${grant.role}" is not declared.`,
          grant.line,
          lines[grant.line - 1]!,
          "Declare the role before granting a policy."
        )
      );
      continue;
    }
    const missingActionEntity = policy.statements
      .flatMap((statement) => {
        const match =
          /^allow to run all actions on (?:own )?(.+)$/.exec(statement);
        return match ? entityList(match[1]!) : [];
      })
      .find((entity) => (actionsByEntity.get(entity) ?? []).length === 0);
    if (missingActionEntity) {
      diagnostics.push(
        diagnostic(
          "E052",
          `Policy "${policy.name}" cannot expand actions for "${missingActionEntity}" because it declares no actions.`,
          grant.line,
          lines[grant.line - 1]!,
          "Declare an action for the entity or remove it from the run-all statement."
        )
      );
      continue;
    }
    for (const statement of policy.statements) {
      for (const expandedStatement of expandPolicyStatement(
        statement,
        grant.role,
        actionsByEntity
      )) {
        if (
          !add(
            grant.role,
            expandedStatement,
            "policy",
            policy.name,
            grant.line
          )
        ) {
          diagnostics.push(
            diagnostic(
              "E046",
              `Policy "${policy.name}" grants duplicate permission "${expandedStatement}".`,
              grant.line,
              lines[grant.line - 1]!,
              "Remove the duplicate grant or overlapping policy statement."
            )
          );
        }
      }
    }
  }

  const inherited = new Set<string>();
  const expandInheritance = (role: string): void => {
    if (inherited.has(role)) return;
    const edge = inheritance.get(role);
    if (!edge) {
      inherited.add(role);
      return;
    }
    expandInheritance(edge.parent);
    for (const statement of effective.get(edge.parent) ?? []) {
      if (!add(role, statement, "inheritance", edge.parent, edge.line)) {
        diagnostics.push(
          diagnostic(
            "E046",
            `Role "${role}" inherits duplicate permission "${statement}".`,
            edge.line,
            lines[edge.line - 1]!,
            "Remove the overlapping direct or inherited permission."
          )
        );
      }
    }
    inherited.add(role);
  };
  if (diagnostics.length === 0) {
    for (const role of roles) expandInheritance(role);
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const generated = expansions.flatMap(({ statements }) => statements);
  const expandedSource = [...output, ...generated].join("\n");
  return { ok: true, source: expandedSource, expansions };
}
